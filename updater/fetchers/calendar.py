"""Personal countdowns — read from data-seed YAML."""
from __future__ import annotations

import logging
import os
from datetime import date
from pathlib import Path

import yaml

from lib.io import write_json

log = logging.getLogger("calendar")

EVENTS_FILE = Path(os.environ.get("CALENDAR_FILE", "/app/data-seed/calendar_events.yaml"))


def main():
    if not EVENTS_FILE.exists():
        log.warning("calendar events file missing: %s", EVENTS_FILE)
        write_json("calendar", {"events": []})
        return

    raw = yaml.safe_load(EVENTS_FILE.read_text(encoding="utf-8")) or []
    today = date.today()
    # Keep upcoming + recently passed (7 days).
    raw.sort(key=lambda x: x.get("date", ""))
    filtered = [e for e in raw if (date.fromisoformat(e["date"]) - today).days >= -7]
    write_json("calendar", {"events": filtered})
    log.info("calendar: %d events", len(filtered))


if __name__ == "__main__":
    main()
