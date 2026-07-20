"""Lianhe Zaobao latest news via Google News RSS.

Zaobao 官方 RSS 已下线（2026-07 实测全 404），页面纯前端渲染无法直接抓，
稳定路径 = Google News RSS 按站点路径过滤（when:1d 保证只出最近 24h 的新闻）。
Google News 的 <link> 是跳转链，需走 batchexecute 解码拿真实 zaobao 链接；
解码结果按文章 id 缓存，失败时回退跳转链（仍可打开，不丢条目）。
"""
from __future__ import annotations

import json
import logging
import re
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

from lib.io import DATA_DIR, write_json

log = logging.getLogger("zaobao")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
}

# (板块标签, Google News 查询)。zaobao.com.sg 现行路径：/news/china /news/world /finance
SECTIONS = [
    ("中国", "site:zaobao.com.sg/news/china when:1d"),
    ("国际", "site:zaobao.com.sg/news/world when:1d"),
    ("财经", "site:zaobao.com.sg/finance when:1d"),
]
PER_SECTION = 4
MAX_AGE = timedelta(hours=36)  # 硬过滤兜底，防 when:1d 失灵混入旧闻
CACHE_FILE = DATA_DIR / "zaobao_url_cache.json"
CACHE_CAP = 400


def fetch_section(label: str, query: str) -> list[dict]:
    url = (
        "https://news.google.com/rss/search?q="
        + urllib.parse.quote(query)
        + "&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
    )
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    now = datetime.now(timezone.utc)
    items = []
    for raw in re.findall(r"<item>(.*?)</item>", r.text, re.S):
        title_m = re.search(r"<title>(.*?)</title>", raw, re.S)
        link_m = re.search(r"<link>(.*?)</link>", raw, re.S)
        date_m = re.search(r"<pubDate>(.*?)</pubDate>", raw, re.S)
        if not (title_m and link_m and date_m):
            continue
        try:
            published = parsedate_to_datetime(date_m.group(1))
        except (TypeError, ValueError):
            continue
        if now - published > MAX_AGE:
            continue
        title = re.sub(r"\s*-\s*联合早报\s*$", "", title_m.group(1)).strip()
        art_id = link_m.group(1).rstrip().split("/articles/")[-1].split("?")[0]
        items.append({
            "title": title,
            "section": label,
            "gnId": art_id,
            "gnLink": link_m.group(1).strip(),
            "publishedAt": published.isoformat(timespec="seconds"),
        })
    items.sort(key=lambda x: x["publishedAt"], reverse=True)
    return items


def decode_url(art_id: str) -> str | None:
    """Google News 跳转链 → 真实 zaobao 链接（两步：取签名参数 + batchexecute）。"""
    page = requests.get(
        f"https://news.google.com/rss/articles/{art_id}", headers=HEADERS, timeout=20
    )
    sg = re.search(r'data-n-a-sg="([^"]+)"', page.text)
    ts = re.search(r'data-n-a-ts="([^"]+)"', page.text)
    if not (sg and ts):
        return None
    payload = [
        "Fbv4je",
        '["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,'
        "null,null,null,null,null,0,1],\"X\",\"X\",1,[1,1,1],1,1,null,0,0,null,0],"
        f'"{art_id}",{ts.group(1)},"{sg.group(1)}"]',
    ]
    r = requests.post(
        "https://news.google.com/_/DotsSplashUi/data/batchexecute",
        data={"f.req": json.dumps([[payload]])},
        headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        timeout=20,
    )
    m = re.search(r'https?://www\.zaobao[^"\\]+', r.text)
    return m.group(0) if m else None


def load_cache() -> dict[str, str]:
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_cache(cache: dict[str, str]) -> None:
    if len(cache) > CACHE_CAP:
        cache = dict(list(cache.items())[-CACHE_CAP:])
    CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")


def main():
    per_section: list[list[dict]] = []
    for label, query in SECTIONS:
        try:
            per_section.append(fetch_section(label, query)[: PER_SECTION + 2])
        except Exception as e:
            log.warning("zaobao section %s failed: %s", label, e)
            per_section.append([])

    # 轮流取各板块（中/国际/财经交错），跨板块按标题去重
    seen: set[str] = set()
    picked: list[dict] = []
    for i in range(PER_SECTION + 2):
        for sec in per_section:
            if i >= len(sec):
                continue
            key = re.sub(r"\s+", "", sec[i]["title"])
            if key in seen:
                continue
            seen.add(key)
            picked.append(sec[i])
    picked = picked[: PER_SECTION * 3]

    if not picked:
        log.error("zaobao: 0 fresh items, keeping previous json")
        return

    cache = load_cache()
    dirty = False
    for it in picked:
        real = cache.get(it["gnId"])
        if not real:
            try:
                real = decode_url(it["gnId"])
            except Exception as e:
                log.warning("decode failed for %s: %s", it["title"][:30], e)
                real = None
            if real:
                cache[it["gnId"]] = real
                dirty = True
        it["url"] = real or it["gnLink"]
        del it["gnId"], it["gnLink"]
    if dirty:
        save_cache(cache)

    write_json("zaobao", {"items": picked})
    log.info("zaobao: %d items (newest %s)", len(picked), picked[0]["publishedAt"])


if __name__ == "__main__":
    main()
