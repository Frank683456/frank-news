"""Economic calendar stub — upcoming high-impact events.

NOTE: investing.com / tradingeconomics need scraping or paid APIs.
Start with a hand-curated YAML; later replace with scraper.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime
from pathlib import Path

import yaml

from lib.io import write_json

log = logging.getLogger("econ")

EVENTS_FILE = Path(os.environ.get("ECON_FILE", "/app/data-seed/econ_events.yaml"))


def main():
    if not EVENTS_FILE.exists():
        log.warning("econ events file missing: %s", EVENTS_FILE)
        write_json("econ", {"events": []})
        return

    raw = yaml.safe_load(EVENTS_FILE.read_text(encoding="utf-8")) or []
    today = date.today()
    events = []
    for e in raw:
        try:
            d = datetime.strptime(e["date"], "%Y-%m-%d").date()
        except Exception:
            continue
        if (d - today).days < -1 or (d - today).days > 30:
            continue
        events.append({
            "date": e["date"],
            "time": e.get("time"),
            "country": e.get("country", ""),
            "name": e.get("name", ""),
            "importance": int(e.get("importance", 1)),
        })
    events.sort(key=lambda x: (x["date"], x.get("time") or ""))
    write_json("econ", {"events": events})
    log.info("econ: %d events", len(events))


if __name__ == "__main__":
    main()
