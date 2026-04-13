"""Hitokoto — random quote/hitokoto."""
from __future__ import annotations

import logging

import requests

from lib.io import write_json

log = logging.getLogger("hitokoto")


def main():
    r = requests.get("https://v1.hitokoto.cn/", params={"c": "i", "encode": "json"}, timeout=10)
    r.raise_for_status()
    d = r.json()
    write_json("hitokoto", {
        "text": d.get("hitokoto", ""),
        "from": d.get("from", ""),
    })


if __name__ == "__main__":
    main()
