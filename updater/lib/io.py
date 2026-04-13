"""Shared IO helpers for fetchers: atomic JSON write, timestamp stamping, logging."""
from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    stream=sys.stdout,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def write_json(name: str, payload: dict[str, Any]) -> Path:
    """Atomically write JSON to DATA_DIR/<name>.json, stamping updatedAt."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {**payload, "updatedAt": payload.get("updatedAt") or now_iso()}
    target = DATA_DIR / f"{name}.json"
    with tempfile.NamedTemporaryFile(
        "w", delete=False, dir=str(DATA_DIR), suffix=".tmp", encoding="utf-8"
    ) as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        tmp = Path(f.name)
    tmp.chmod(0o644)
    tmp.replace(target)
    return target


def read_json(name: str) -> dict[str, Any] | None:
    target = DATA_DIR / f"{name}.json"
    if not target.exists():
        return None
    try:
        return json.loads(target.read_text(encoding="utf-8"))
    except Exception:
        return None
