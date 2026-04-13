"""36Kr hot list via their RSS."""
from __future__ import annotations

import logging

import feedparser

from lib.io import write_json

log = logging.getLogger("kr36")

FEED = "https://36kr.com/feed"


def main():
    parsed = feedparser.parse(FEED)
    items = [{"title": e.title, "url": e.link} for e in parsed.entries[:10]]
    write_json("kr36", {"items": items})
    log.info("kr36: %d items", len(items))


if __name__ == "__main__":
    main()
