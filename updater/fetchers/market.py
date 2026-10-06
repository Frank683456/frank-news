"""Market tickers: Yahoo (primary) + CNBC (backup & cross-check) + Eastmoney (沪深300 history).

- Yahoo chart API: price + ~1 month of daily closes in ONE call per symbol (spark + prev close).
- CNBC quote API: one batched call for every symbol. Used to cross-check Yahoo, and to stand in
  when Yahoo fails for a symbol. Stooq (the old backup) died 2026-10: browser bot-check on every
  endpoint, so it was removed.
- Eastmoney kline: 沪深300 daily closes. Yahoo's 000300.SS only ever returns the latest bar, so
  before v1.4.0 沪深300 always showed +0.00% and no sparkline.
- CoinGecko for BTC (CNBC BTC.CM= as backup).

All network calls run concurrently with short connect timeouts, so one dead source can no longer
stall the */5 cron round (Stooq timeouts used to drag it to ~3 minutes).
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

from lib.io import write_json
from lib.xverify import SourceResult, merge_numeric

log = logging.getLogger("market")

TIMEOUT = (3, 8)  # (connect, read) seconds
HEADERS = {"User-Agent": "Mozilla/5.0 (FrankDashboard/1.4)"}
SPARK_POINTS = 7

# symbol, name, yahoo, cnbc, kind. kind=index → 休市检测（交易所长假时标「休市」）
STOCKS = [
    ("SPX", "S&P 500", "^GSPC", ".SPX", "index"),
    ("IXIC", "纳指", "^IXIC", ".IXIC", "index"),
    ("DJI", "道指", "^DJI", ".DJI", "index"),
    ("HSI", "恒指", "^HSI", ".HSI", "index"),
    ("N225", "日经225", "^N225", ".N225", "index"),
    ("CSI300", "沪深300", "000300.SS", "", "index"),
    ("VIX", "VIX", "^VIX", ".VIX", "index"),
    ("US10Y", "10Y 国债", "^TNX", "US10Y", "rate"),
    ("DXY", "美元指数", "DX-Y.NYB", ".DXY", "fx"),
    ("USDCNY", "美元/人民币", "USDCNY=X", "CNY=", "fx"),
    ("USDJPY", "美元/日元", "JPY=X", "JPY=", "fx"),
    ("GOLD", "黄金", "GC=F", "@GC.1", "future"),
    ("SILVER", "白银", "SI=F", "@SI.1", "future"),
    ("WTI", "原油", "CL=F", "@CL.1", "future"),
]
EASTMONEY = {"CSI300": "1.000300"}
BTC = ("BTC", "BTC", "bitcoin", "BTC.CM=")


# ---------------------------------------------------------------- sources

def yahoo(sym: str) -> dict:
    r = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
        params={"interval": "1d", "range": "1mo"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    res = r.json()["chart"]["result"][0]
    meta = res["meta"]
    tz = ZoneInfo(meta.get("exchangeTimezoneName") or "UTC")
    bars = [
        (datetime.fromtimestamp(t, tz).date(), float(c))
        for t, c in zip(res.get("timestamp") or [], res["indicators"]["quote"][0]["close"])
        if c is not None
    ]
    start = (meta.get("currentTradingPeriod") or {}).get("regular", {}).get("start")
    return {
        "price": float(meta["regularMarketPrice"]),
        "bars": bars,
        "tz": tz,
        "lastDate": datetime.fromtimestamp(meta["regularMarketTime"], tz).date(),
        "open": datetime.fromtimestamp(start, tz).time() if start else None,
        # 区间只有 1 根 K 线时（如 000300.SS），这就是上一交易日收盘
        "chartPrev": meta.get("chartPreviousClose"),
    }


def eastmoney(secid: str) -> list[tuple[date, float]]:
    try:
        return _eastmoney(secid)
    except Exception:  # 东财偶发直接断连接（RemoteDisconnected），隔 1 秒重试一次
        time.sleep(1)
        return _eastmoney(secid)


def _eastmoney(secid: str) -> list[tuple[date, float]]:
    r = requests.get(
        "https://push2his.eastmoney.com/api/qt/stock/kline/get",
        params={"secid": secid, "klt": 101, "fqt": 0, "lmt": 30, "end": "20500101",
                "fields1": "f1", "fields2": "f51,f53"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for line in r.json()["data"]["klines"]:
        d, c = line.split(",")[:2]
        out.append((date.fromisoformat(d), float(c)))
    return out


def _num(s) -> float | None:
    try:
        return float(str(s).replace(",", "").replace("%", ""))
    except (TypeError, ValueError):
        return None


def cnbc(symbols: list[str]) -> dict[str, dict]:
    """One batched request → {cnbc_symbol: {price, prev}}; symbols CNBC doesn't know are absent."""
    r = requests.get(
        "https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol",
        params={"symbols": "|".join(symbols), "requestMethod": "itv", "noform": 1,
                "partnerId": 2, "fund": 1, "exthrs": 1, "output": "json"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    quotes = r.json()["FormattedQuoteResult"]["FormattedQuote"]
    if isinstance(quotes, dict):
        quotes = [quotes]
    out = {}
    for q in quotes:
        price = _num(q.get("last"))
        if price is None:
            continue
        out[q["symbol"]] = {"price": price, "prev": _num(q.get("previous_day_closing"))}
    return out


def coingecko() -> dict:
    p = requests.get(
        "https://api.coingecko.com/api/v3/simple/price",
        params={"ids": BTC[2], "vs_currencies": "usd", "include_24hr_change": "true"},
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    p.raise_for_status()
    d = p.json()[BTC[2]]
    price = float(d["usd"])
    prev = price / (1 + float(d["usd_24h_change"]) / 100)
    spark = []
    try:
        s = requests.get(
            f"https://api.coingecko.com/api/v3/coins/{BTC[2]}/market_chart",
            params={"vs_currency": "usd", "days": "7", "interval": "daily"},
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        s.raise_for_status()
        spark = [float(x[1]) for x in s.json().get("prices", [])]
    except Exception as e:
        log.warning("coingecko series failed: %s", e)
    return {"price": price, "prev": prev, "spark": spark}


# ---------------------------------------------------------------- logic

def is_closed(last: date, tz: ZoneInfo, open_t) -> bool:
    """交易所休市（长假）判定：最后一根 K 线之后漏了工作日。

    - 最后交易日与今天之间夹着工作日（如国庆 9-30 → 10-06）→ 休市；
    - 今天是工作日、开盘 1 小时后仍没有今天的 K 线 → 休市（单日假期当天）。
    周末不算休市；单日假期后的下一个交易日开盘前会短暂显示休市，可接受。
    """
    now = datetime.now(tz)
    today = now.date()
    d = last + timedelta(days=1)
    while d < today:
        if d.weekday() < 5:
            return True
        d += timedelta(days=1)
    if today.weekday() < 5 and last < today and open_t is not None:
        opened = datetime.combine(today, open_t, tz) + timedelta(hours=1)
        return now > opened
    return False


def safe(fn, *args):
    try:
        return fn(*args), None
    except Exception as e:
        return None, str(e)


def main():
    with ThreadPoolExecutor(max_workers=12) as pool:
        y_futs = {s[0]: pool.submit(safe, yahoo, s[2]) for s in STOCKS}
        em_futs = {k: pool.submit(safe, eastmoney, v) for k, v in EASTMONEY.items()}
        cn_fut = pool.submit(safe, cnbc, [s[3] for s in STOCKS if s[3]] + [BTC[3]])
        cg_fut = pool.submit(safe, coingecko)

    cn, cn_err = cn_fut.result()
    if cn_err:
        log.warning("cnbc batch failed: %s", cn_err)
    cn = cn or {}

    items = []
    for sym, name, ysym, csym, kind in STOCKS:
        y, y_err = y_futs[sym].result()
        if y_err:
            log.warning("yahoo %s failed: %s", sym, y_err)
        c = cn.get(csym) if csym else None

        bars = y["bars"] if y else []
        if sym in em_futs:
            em, em_err = em_futs[sym].result()
            if em_err:
                log.warning("eastmoney %s failed: %s", sym, em_err)
            elif em:
                bars = em
        # 日线偶尔比实时价慢一拍（今天盘中价已有、今天的 K 线还没出）→ 把实时价补成今天这根
        if y and bars and bars[-1][0] < y["lastDate"]:
            bars = bars + [(y["lastDate"], y["price"])]

        results = []
        if y:
            results.append(SourceResult("yahoo", y["price"]))
        if c:
            results.append(SourceResult("cnbc", c["price"]))
        if sym in em_futs and bars and not y:
            results.append(SourceResult("eastmoney", bars[-1][1]))
        price = results[0].value if results else None  # 主源优先，不取中位数（两源时中位数=平均）
        if price is None:
            log.warning("all sources failed for %s", sym)
            continue
        _, disagree = merge_numeric(results, tolerance_pct=0.5)

        spark = [b[1] for b in bars[-SPARK_POINTS:]]
        if len(bars) >= 2:
            prev = bars[-2][1]
        elif c and c.get("prev"):
            prev = c["prev"]
        elif y and y.get("chartPrev"):
            prev = float(y["chartPrev"])
        else:
            prev = price
        if spark:
            spark[-1] = price

        closed = False
        if kind == "index" and y:
            last = bars[-1][0] if bars else y["lastDate"]
            closed = is_closed(last, y["tz"], y["open"])

        change = price - prev
        items.append({
            "symbol": sym, "name": name, "price": price,
            "change": change, "changePct": (change / prev * 100) if prev else 0.0,
            "disagree": disagree, "sources": len(results), "closed": closed,
            "spark": spark,
        })

    cg, cg_err = cg_fut.result()
    c = cn.get(BTC[3])
    if cg_err:
        log.warning("coingecko failed: %s", cg_err)
    if cg or c:
        price = cg["price"] if cg else c["price"]
        prev = cg["prev"] if cg else (c.get("prev") or price)
        results = [SourceResult(n, v["price"]) for n, v in (("coingecko", cg), ("cnbc", c)) if v]
        _, disagree = merge_numeric(results, tolerance_pct=1.0)
        change = price - prev
        items.append({
            "symbol": BTC[0], "name": BTC[1], "price": price,
            "change": change, "changePct": (change / prev * 100) if prev else 0.0,
            "disagree": disagree, "sources": len(results), "closed": False,
            "spark": cg["spark"] if cg else [],
        })

    if not items:
        log.error("market: 0 items, keeping previous json")
        return

    # 备用源健康：CNBC 覆盖的品种里拿到一半以上才算正常；页面据此显示「双源核对 / 备用源异常」
    expected = sum(1 for s in STOCKS if s[3]) + 1
    backup_ok = len(cn) >= expected // 2
    write_json("market", {
        "items": items,
        "backup": {"name": "CNBC", "ok": backup_ok, "covered": len(cn), "expected": expected},
    })
    log.info("market: wrote %d items (cnbc %d/%d)", len(items), len(cn), expected)


if __name__ == "__main__":
    main()
