"""Zhihu hot list via api.zhihu.com (public, no auth)."""
from __future__ import annotations

import logging

import requests

from lib.io import write_json

log = logging.getLogger("zhihu")

ENDPOINT = "https://api.zhihu.com/topstory/hot-list"
HEADERS = {"User-Agent": "Mozilla/5.0 FrankDashboard/1.0"}


def main():
    r = requests.get(ENDPOINT, params={"limit": 20}, headers=HEADERS, timeout=10)
    r.raise_for_status()
    payload = r.json()
    items = []
    for entry in payload.get("data", [])[:10]:
        target = entry.get("target") or {}
        qid = target.get("id")
        title = target.get("title") or ""
        if not qid or not title:
            continue
        items.append({
            "title": title,
            "url": f"https://www.zhihu.com/question/{qid}",
        })
    write_json("zhihu", {"items": items})
    log.info("zhihu: %d items", len(items))


if __name__ == "__main__":
    main()
