"""Market tickers with multi-source cross-verification.

Sources:
- Yahoo Finance quote API (free, unauthenticated)
- Stooq CSV quote (free)
- CoinGecko for crypto (free)
"""
from __future__ import annotations

import logging

import requests

from lib.io import write_json
from lib.xverify import collect, merge_numeric

log = logging.getLogger("market")

# (symbol, name, yahoo_symbol, stooq_symbol) — stooq optional, "" skips
STOCKS = [
    ("SPX", "S&P 500", "^GSPC", "^spx"),
    ("IXIC", "纳指", "^IXIC", "^ndq"),
    ("DJI", "道指", "^DJI", "^dji"),
    ("VIX", "VIX", "^VIX", "^vix"),
    ("US10Y", "10Y 国债", "^TNX", ""),
    ("GOLD", "黄金", "GC=F", "xauusd"),
    ("WTI", "原油", "CL=F", "cl.f"),
]
CRYPTO = [("BTC", "BTC", "bitcoin"), ("ETH", "ETH", "ethereum")]

HEADERS = {"User-Agent": "FrankDashboard/1.0"}


def yahoo(sym: str) -> float:
    r = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
        params={"interval": "1d", "range": "1d"},
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    result = r.json()["chart"]["result"][0]
    return float(result["meta"]["regularMarketPrice"])


def yahoo_prev(sym: str) -> float:
    r = requests.get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
        params={"interval": "1d", "range": "5d"},
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    result = r.json()["chart"]["result"][0]
    closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
    return float(closes[-2])


def stooq(sym: str) -> float:
    r = requests.get(
        f"https://stooq.com/q/l/?s={sym}&f=sd2t2ohlcvn&h&e=csv",
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    lines = r.text.strip().splitlines()
    if len(lines) < 2:
        raise RuntimeError("stooq no data")
    cols = lines[1].split(",")
    close = cols[6]
    if close in ("", "N/D"):
        raise RuntimeError("stooq empty close")
    return float(close)


def coingecko(coin_id: str) -> float:
    r = requests.get(
        f"https://api.coingecko.com/api/v3/simple/price",
        params={"ids": coin_id, "vs_currencies": "usd", "include_24hr_change": "true"},
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    return float(r.json()[coin_id]["usd"])


def coingecko_prev(coin_id: str, current: float) -> float:
    r = requests.get(
        f"https://api.coingecko.com/api/v3/simple/price",
        params={"ids": coin_id, "vs_currencies": "usd", "include_24hr_change": "true"},
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    pct = float(r.json()[coin_id]["usd_24h_change"]) / 100
    return current / (1 + pct)


def main():
    items = []
    for sym, name, y, s in STOCKS:
        sources = [(f"yahoo:{y}", lambda y=y: yahoo(y))]
        if s:
            sources.append((f"stooq:{s}", lambda s=s: stooq(s)))
        price_results = collect(sources)
        price, disagree = merge_numeric(price_results, tolerance_pct=0.5)
        if price is None:
            log.warning("all sources failed for %s", sym)
            continue
        try:
            prev = yahoo_prev(y)
        except Exception as e:
            log.warning("prev failed for %s: %s", sym, e)
            prev = price
        change = price - prev
        pct = (change / prev * 100) if prev else 0.0
        items.append({
            "symbol": sym, "name": name, "price": price,
            "change": change, "changePct": pct, "disagree": disagree,
        })

    for sym, name, coin in CRYPTO:
        try:
            price = coingecko(coin)
            prev = coingecko_prev(coin, price)
            change = price - prev
            pct = (change / prev * 100) if prev else 0.0
            items.append({
                "symbol": sym, "name": name, "price": price,
                "change": change, "changePct": pct, "disagree": False,
            })
        except Exception as e:
            log.warning("crypto %s failed: %s", sym, e)

    write_json("market", {"items": items})
    log.info("market: wrote %d items", len(items))


if __name__ == "__main__":
    main()
