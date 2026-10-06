"""Halo blog RSS feed with cover image resolution."""
from __future__ import annotations

import logging
import os
from urllib.parse import urlsplit, urlunsplit

import feedparser
import requests
from bs4 import BeautifulSoup

from lib.io import write_json

log = logging.getLogger("blog_feed")

FEED_URL = os.environ.get("BLOG_FEED_URL", "https://frank2019.me/feed.xml")
# 页面上显示的文章/封面链接换成这个域名（主域在国内打不开时用；同一个 Halo，路径不变）。空＝原样。
PUBLIC_BASE = os.environ.get("BLOG_PUBLIC_BASE", "").rstrip("/")
HEADERS = {"User-Agent": "FrankDashboard/1.0"}


def public_url(url: str | None) -> str | None:
    if not url or not PUBLIC_BASE:
        return url
    parts = urlsplit(url)
    if parts.netloc != urlsplit(FEED_URL).netloc:
        return url
    return PUBLIC_BASE + urlunsplit(("", "", parts.path, parts.query, parts.fragment))


def og_image(url: str) -> str | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=8)
        soup = BeautifulSoup(r.text, "lxml")
        og = soup.find("meta", property="og:image")
        if og and og.get("content"):
            return og["content"]
        first_img = soup.find("img")
        if first_img and first_img.get("src"):
            return first_img["src"]
    except Exception as e:
        log.warning("og_image failed for %s: %s", url, e)
    return None


def extract_cover(entry) -> str | None:
    # Try media:content / enclosure first.
    if entry.get("media_content"):
        for m in entry.media_content:
            if m.get("url"):
                return m["url"]
    if entry.get("enclosures"):
        for e in entry.enclosures:
            if e.get("type", "").startswith("image/"):
                return e["href"]
    # Fallback: fetch article page og:image.
    return og_image(entry.link)


def main():
    parsed = feedparser.parse(FEED_URL)
    posts = []
    for e in parsed.entries[:5]:
        cover = extract_cover(e)
        date = ""
        if getattr(e, "published_parsed", None):
            import time
            date = time.strftime("%Y-%m-%d", e.published_parsed)
        posts.append({
            "title": e.title,
            "url": public_url(e.link),
            "cover": public_url(cover),
            "date": date,
            "excerpt": getattr(e, "summary", "")[:120],
        })
    write_json("blog_feed", {"posts": posts})
    log.info("blog_feed: %d posts", len(posts))


if __name__ == "__main__":
    main()
