"""Bing daily wallpaper."""
from __future__ import annotations

import logging

import requests

from lib.io import write_json

log = logging.getLogger("daily_image")


def main():
    r = requests.get(
        "https://www.bing.com/HPImageArchive.aspx",
        params={"format": "js", "idx": 0, "n": 1, "mkt": "en-US"},
        timeout=10,
    )
    r.raise_for_status()
    img = r.json()["images"][0]
    write_json("daily_image", {
        "url": "https://www.bing.com" + img["url"],
        "title": img.get("title", ""),
        "copyright": img.get("copyright", ""),
    })
    log.info("daily_image: %s", img.get("title"))


if __name__ == "__main__":
    main()
