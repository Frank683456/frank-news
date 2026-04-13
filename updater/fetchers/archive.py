"""Scan /data for briefing-YYYY-MM-DD.json and build rich archive index."""
from __future__ import annotations

import json
import logging
import re

from lib.io import DATA_DIR, read_json, write_json

log = logging.getLogger("archive")

PATTERN = re.compile(r"^briefing-(\d{4}-\d{2}-\d{2})\.json$")


def main():
    entries = []
    for p in DATA_DIR.iterdir():
        m = PATTERN.match(p.name)
        if not m:
            continue
        date = m.group(1)
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:
            log.warning("failed to parse %s: %s", p.name, e)
            continue
        entries.append({
            "date": date,
            "title": doc.get("title") or "",
            "subtitle": doc.get("subtitle") or "",
            "mood": doc.get("mood") or "neutral",
        })
    entries.sort(key=lambda e: e["date"], reverse=True)
    # Back-compat: keep flat dates list.
    write_json("archive", {
        "entries": entries,
        "dates": [e["date"] for e in entries],
    })
    log.info("archive: %d briefings", len(entries))


if __name__ == "__main__":
    main()
