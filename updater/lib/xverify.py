"""Cross-verification helpers for multi-source market/fx data.

Usage:
    values = collect_sources([source_a, source_b, source_c])
    merged = merge_numeric(values, tolerance_pct=0.5)
"""
from __future__ import annotations

import logging
import statistics
from dataclasses import dataclass
from typing import Callable

log = logging.getLogger("xverify")


@dataclass
class SourceResult:
    name: str
    value: float | None
    error: str | None = None


def collect(sources: list[tuple[str, Callable[[], float]]]) -> list[SourceResult]:
    out: list[SourceResult] = []
    for name, fn in sources:
        try:
            v = fn()
            out.append(SourceResult(name=name, value=float(v)))
        except Exception as e:
            log.warning("source %s failed: %s", name, e)
            out.append(SourceResult(name=name, value=None, error=str(e)))
    return out


def merge_numeric(
    results: list[SourceResult], tolerance_pct: float = 0.5
) -> tuple[float | None, bool]:
    """Return (consensus_value, disagree_flag). Uses median of available sources.
    disagree=True when max/min divergence exceeds tolerance_pct%.
    """
    vals = [r.value for r in results if r.value is not None]
    if not vals:
        return None, False
    med = statistics.median(vals)
    if len(vals) == 1 or med == 0:
        return med, False
    spread_pct = abs(max(vals) - min(vals)) / abs(med) * 100
    return med, spread_pct > tolerance_pct
