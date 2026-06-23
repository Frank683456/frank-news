#!/usr/bin/env bash
# 经济日历自动生成器 —— claude -p + WebSearch 拉未来两周高影响宏观事件，scp 到 dashboard 服务器。
# 取代 updater/fetchers/econ.py 的手工 YAML 占位版（那版自 2026-06-05 起数据耗尽一直空）。
# 费用 $0（claude 走 Max 订阅）。由 launchd com.frank.econ-calendar 每日触发。
#
# Usage: push_econ.sh
set -euo pipefail

export PATH="/opt/homebrew/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${ECON_OUT_DIR:-$HOME/briefing-archive}"
DEST="${ECON_DEST:-monitor:/opt/frank-news/data/econ.json}"
TODAY="$(date +%F)"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/econ-$TODAY.json"

log() { echo "[push_econ] $*"; }

PROMPT="You are a financial data assistant. Use web search to find the schedule of HIGH-IMPACT macroeconomic releases for the United States and China over the next 14 days, starting from today ($TODAY).

Output STRICT JSON ONLY — no markdown fences, no commentary — exactly this shape:
{\"events\":[{\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"country\":\"US\",\"name\":\"CPI 通胀\",\"importance\":3}]}

Rules:
- Only genuinely market-moving releases. US: CPI, PCE, 非农就业(NFP/jobs report), FOMC 利率决议, GDP, 零售销售, ISM PMI, 失业率, PPI. China(CN): CPI/PPI, 制造业PMI/财新PMI, GDP, 工业增加值, 社零, LPR 利率决议.
- date: release date as YYYY-MM-DD (must fall within the next 14 days from $TODAY).
- time: scheduled release time in the EVENT COUNTRY's local time (US events in US Eastern, China events in Beijing), 24h HH:MM. Omit the time field if genuinely unknown.
- country: exactly \"US\" or \"CN\".
- name: short Chinese label (e.g. \"CPI 通胀\", \"非农就业\", \"FOMC 利率决议\", \"制造业 PMI\", \"LPR 利率决议\").
- importance: 3 = top-tier (CPI/PCE/NFP/FOMC/GDP/LPR), 2 = secondary, 1 = minor.
- Do NOT fabricate dates. If you are not reasonably confident an event actually falls in the window, omit it. An empty events array is acceptable if nothing major is scheduled.
- Sort by date ascending. Max 12 events.
- Output ONLY the JSON object, nothing else."

# claude 生成（允许联网搜索，不给 Write/Edit → 只能输出到 stdout）。失败重试一次，硬上限 2 次防烧额度。
MAX_ATTEMPTS=2
attempt=1
while true; do
  log "generating econ calendar via claude (attempt $attempt/$MAX_ATTEMPTS)..."
  RAW=$(cd "$PROJECT_DIR" && claude -p "$PROMPT" \
    --model opus \
    --allowed-tools "WebSearch,WebFetch" \
    --permission-mode acceptEdits 2>&1) || true

  # 提取第一个 { 到最后一个 }，校验 JSON，补 updatedAt（不信任 claude 自报时间）
  if printf '%s' "$RAW" | python3 - "$OUT" <<'PYEOF'
import re, sys, json, pathlib
from datetime import datetime
raw = sys.stdin.read()
m = re.search(r'\{.*\}', raw, re.DOTALL)
if not m:
    sys.exit(1)
try:
    obj = json.loads(m.group(0))
except json.JSONDecodeError:
    sys.exit(1)
events = obj.get("events")
if not isinstance(events, list):
    sys.exit(1)
# 清洗 + 只保留必要字段
clean = []
for e in events:
    if not isinstance(e, dict) or not e.get("date") or not e.get("name"):
        continue
    rec = {
        "date": str(e["date"]),
        "country": str(e.get("country", "")),
        "name": str(e["name"]),
        "importance": int(e.get("importance", 1)),
    }
    if e.get("time"):
        rec["time"] = str(e["time"])
    clean.append(rec)
clean.sort(key=lambda x: (x["date"], x.get("time") or ""))
out = {"events": clean[:12], "updatedAt": datetime.now().astimezone().isoformat(timespec="seconds")}
pathlib.Path(sys.argv[1]).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"events={len(out['events'])}")
PYEOF
  then
    break
  fi
  log "JSON invalid on attempt $attempt"
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    log "giving up after $MAX_ATTEMPTS attempts (last raw tail: $(printf '%s' "$RAW" | tail -c 300))"
    exit 1
  fi
  attempt=$((attempt + 1))
done

log "uploading to $DEST ..."
scp -q "$OUT" "$DEST"
log "done: $OUT ($(python3 -c "import json;print(len(json.load(open('$OUT'))['events']),'events')"))"
