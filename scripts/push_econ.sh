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
RAW_FILE="$OUT.raw"

log() { echo "[push_econ] $*"; }

PROMPT="You are a financial data assistant. Use web search to find the schedule of market-moving events for the United States and China over the next 14 days, starting from today ($TODAY): macroeconomic releases AND major S&P 500 earnings reports.

Output STRICT JSON ONLY — no markdown fences, no commentary — exactly this shape:
{\"events\":[{\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"country\":\"US\",\"name\":\"CPI 通胀\",\"importance\":3}]}

Rules:
- Macro, top tier (importance 3): US CPI, PCE, 非农就业(NFP/jobs report), FOMC 利率决议, GDP; China CPI/PPI, GDP, LPR 利率决议.
- Macro, secondary (importance 2): US 零售销售, ISM PMI, PPI, ADP 就业, JOLTS, 消费者信心(谘商会/密歇根), 耐用品订单, 成屋/新屋销售; China 制造业PMI/财新PMI, 工业增加值, 社零, 贸易数据, 社融/信贷.
- Macro, minor but regular (importance 1): US 初请失业金 (weekly Thursday — include each one in the window).
- Earnings: include major S&P 500 companies reporting in the window. Mega-caps (微软/苹果/英伟达/谷歌/亚马逊/Meta/特斯拉/博通 etc.) = importance 3; other well-known large caps (银行/航空/工业/消费大票) = importance 2. name format: \"财报 · 微软 MSFT\". country: \"US\". Use the confirmed reporting date; omit if unconfirmed.
- date: as YYYY-MM-DD (must fall within the next 14 days from $TODAY).
- time: scheduled release time in the EVENT COUNTRY's local time (US events in US Eastern, China events in Beijing), 24h HH:MM. For earnings you may omit time (or use 盘前/盘后 knowledge to set 08:00/16:30). Omit the time field if genuinely unknown.
- country: exactly \"US\" or \"CN\".
- name: short Chinese label (e.g. \"CPI 通胀\", \"非农就业\", \"FOMC 利率决议\", \"财新制造业 PMI\", \"财报 · 英伟达 NVDA\").
- Do NOT fabricate dates. If you are not reasonably confident an event actually falls in the window, omit it. An empty events array is acceptable if nothing major is scheduled.
- Sort by date ascending. Max 14 events — when more qualify, keep the highest importance first, then earliest date.
- Output ONLY the JSON object, nothing else."

# claude 生成（允许联网搜索，不给 Write/Edit → 只能输出到 stdout；</dev/null 免 3s stdin 等待）。
# 失败重试一次，硬上限 2 次防烧额度。注意：纯 stdout 才进 RAW_FILE，stderr 单独丢弃，避免污染 JSON。
MAX_ATTEMPTS=2
attempt=1
while true; do
  log "generating econ calendar via claude (attempt $attempt/$MAX_ATTEMPTS)..."
  (cd "$PROJECT_DIR" && claude -p "$PROMPT" \
    --model opus \
    --allowed-tools "WebSearch,WebFetch" \
    --permission-mode acceptEdits </dev/null) > "$RAW_FILE" 2>/dev/null || true

  # 从 RAW_FILE（argv，不走 stdin）提取第一个 { 到最后一个 }，校验 + 清洗，补 updatedAt（不信任 claude 自报时间）
  if python3 - "$RAW_FILE" "$OUT" <<'PYEOF'
import re, sys, json, pathlib
from datetime import datetime
raw = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
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
pathlib.Path(sys.argv[2]).write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
print(f"events={len(out['events'])}")
PYEOF
  then
    rm -f "$RAW_FILE"
    break
  fi
  log "JSON invalid on attempt $attempt (raw tail: $(tail -c 200 "$RAW_FILE" 2>/dev/null))"
  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    log "giving up after $MAX_ATTEMPTS attempts"
    exit 1
  fi
  attempt=$((attempt + 1))
done

log "uploading to $DEST ..."
scp -q "$OUT" "$DEST"
log "done: $OUT ($(python3 -c "import json;print(len(json.load(open('$OUT'))['events']),'events')"))"
