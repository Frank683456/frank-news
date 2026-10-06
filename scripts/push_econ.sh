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
DEST="${ECON_DEST:-etf:/opt/frank-news/data/econ.json}"
TODAY="$(date +%F)"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/econ-$TODAY.json"
RAW_FILE="$OUT.raw"

log() { echo "[push_econ] $*"; }

PROMPT="You are a financial data assistant. Use web search to find the schedule of market-moving events for the United States and China over the next 14 days, starting from today ($TODAY): macroeconomic releases AND major S&P 500 earnings reports.

Output STRICT JSON ONLY — no markdown fences, no commentary — exactly this shape:
{\"events\":[{\"date\":\"YYYY-MM-DD\",\"time\":\"HH:MM\",\"tz\":\"ET\",\"country\":\"US\",\"name\":\"CPI 通胀\",\"importance\":3},{\"date\":\"YYYY-MM-DD\",\"session\":\"盘前\",\"country\":\"US\",\"name\":\"财报 · 摩根大通 JPM\",\"importance\":2}]}

Rules:
- Macro, top tier (importance 3): US CPI, PCE, 非农就业(NFP/jobs report), FOMC 利率决议, GDP; China CPI/PPI, GDP, LPR 利率决议.
- Macro, secondary (importance 2): US 零售销售, ISM PMI, PPI, ADP 就业, JOLTS, 消费者信心(谘商会/密歇根), 耐用品订单, 成屋/新屋销售; China 制造业PMI/财新PMI, 工业增加值, 社零, 贸易数据, 社融/信贷.
- Macro, minor but regular (importance 1): US 初请失业金 (weekly Thursday — include each one in the window).
- Earnings: include major S&P 500 companies reporting in the window. Mega-caps (微软/苹果/英伟达/谷歌/亚马逊/Meta/特斯拉/博通 etc.) = importance 3; other well-known large caps (银行/航空/工业/消费大票) = importance 2. name format: \"财报 · 微软 MSFT\". country: \"US\". Use the confirmed reporting date; omit if unconfirmed.
- date: as YYYY-MM-DD (must fall within the next 14 days from $TODAY).
- time + tz (macro releases only): the official scheduled release time in the EVENT COUNTRY's local time, 24h HH:MM, with tz \"ET\" for US events (US Eastern) or \"BJ\" for China events (Beijing). Do NOT convert time zones yourself. Omit time and tz if genuinely unknown.
- Earnings: NEVER give a clock time. Give session \"盘前\" (before the US open) or \"盘后\" (after the US close) when the company has announced it; omit session if unknown.
- country: exactly \"US\" or \"CN\".
- name: short Chinese label (e.g. \"CPI 通胀\", \"非农就业\", \"FOMC 利率决议\", \"财新制造业 PMI\", \"财报 · 英伟达 NVDA\").
- Do NOT fabricate dates. If you are not reasonably confident an event actually falls in the window, omit it. An empty events array is acceptable if nothing major is scheduled.
- List up to 24 qualifying events across the WHOLE 14-day window (later days matter as much as the first few). The script selects and sorts the final list itself.
- Output ONLY the JSON object, nothing else."

# claude 生成（允许联网搜索，不给 Write/Edit → 只能输出到 stdout；</dev/null 免 3s stdin 等待）。
# 失败重试一次，硬上限 2 次防烧额度。注意：纯 stdout 才进 RAW_FILE，stderr 单独丢弃，避免污染 JSON。
MAX_ATTEMPTS=2
attempt=1
while true; do
  log "generating econ calendar via claude (attempt $attempt/$MAX_ATTEMPTS)..."
  # ⛔ 不进 nmem 会话捕获（2026-08-21）：PATH 摘掉 /usr/local/bin（nmem 装那儿），钩子
  #    which("nmem") 找不到就整个跳过。8-03 钉 NMEM_SPACE 那版方向反了——不是不捕获，是把
  #    每天同一份提示词蒸馏出的重复记忆灌进正经空间（晨报实测积了 9 条）。故意不设 NMEM_SPACE：
  #    闸门万一失效也只脏 default 收件箱（有守门员清），不脏正经空间。
  # ⛔ 隔离（2026-09-30 实测旧跑法开工前先背 5.6 万 token：/Users/bot/CLAUDE.md 运维记录 + nmem 工作记忆
  #    + 73 个工具 + 飞书/Claude Docs 连接器）：在家目录外的空目录跑、--setting-sources project、
  #    --strict-mcp-config + 环境变量关连接器、--tools 只摆搜索和抓网页。改后 3 千 token。
  CLEAN_DIR="/Users/Shared/claude-clean/econ-calendar"
  mkdir -p "$CLEAN_DIR/.claude"
  printf '%s\n' '{"autoMemoryEnabled": false, "disableAllHooks": true}' > "$CLEAN_DIR/.claude/settings.json"
  (cd "$CLEAN_DIR" && env -u NMEM_SPACE ENABLE_CLAUDEAI_MCP_SERVERS=false \
    PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin" claude -p "$PROMPT" \
    --model claude-sonnet-5-5 \
    --effort high \
    --setting-sources project --strict-mcp-config \
    --tools "WebSearch,WebFetch" \
    --allowedTools "WebSearch,WebFetch" </dev/null) > "$RAW_FILE" 2>/dev/null || true

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
# v1.4.0：时间统一换成洛杉矶时间（模型给事件国当地时间 + tz，换算在这里做，不让模型算）；
# 财报只标盘前/盘后（不写凑出来的钟点）；同一天财报最多 3 家；先按重要度挑满 12 条再按日期排，
# 避免名额被前几天占光、两周窗口后半段一条都没有。
from datetime import date as _date, timedelta
from zoneinfo import ZoneInfo
PT = ZoneInfo("America/Los_Angeles")
TZS = {"ET": ZoneInfo("America/New_York"), "BJ": ZoneInfo("Asia/Shanghai")}
today = datetime.now(PT).date()
end = today + timedelta(days=14)
clean = []
for e in events:
    if not isinstance(e, dict) or not e.get("date") or not e.get("name"):
        continue
    try:
        d = _date.fromisoformat(str(e["date"])[:10])
    except ValueError:
        continue
    country = str(e.get("country", "")).upper()
    if country not in ("US", "CN"):
        continue
    name = str(e["name"]).strip()
    try:
        imp = min(3, max(1, int(e.get("importance", 1))))
    except (TypeError, ValueError):
        imp = 1
    rec = {"date": d.isoformat(), "country": country, "name": name, "importance": imp}
    if name.startswith("财报"):
        if e.get("session") in ("盘前", "盘后"):
            rec["session"] = e["session"]
    elif re.fullmatch(r"\d{1,2}:\d{2}", str(e.get("time", ""))):
        hh, mm = map(int, str(e["time"]).split(":"))
        src = TZS.get(str(e.get("tz", "")).upper()) or (TZS["BJ"] if country == "CN" else TZS["ET"])
        try:
            local = datetime(d.year, d.month, d.day, hh, mm, tzinfo=src).astimezone(PT)
        except ValueError:
            local = None
        if local:
            rec["date"], rec["time"] = local.date().isoformat(), local.strftime("%H:%M")
    if not (today.isoformat() <= rec["date"] <= end.isoformat()):
        continue
    clean.append(rec)
# 同名去重（模型偶尔重复列同一事件）
seen, uniq = set(), []
for r in clean:
    k = (r["date"], r["name"])
    if k not in seen:
        seen.add(k); uniq.append(r)
# 同一天财报最多 3 家，大票优先（同重要度保留模型给的顺序）
per_day, capped = {}, []
for r in sorted(uniq, key=lambda r: -r["importance"]):
    if r["name"].startswith("财报"):
        if per_day.get(r["date"], 0) >= 3:
            continue
        per_day[r["date"]] = per_day.get(r["date"], 0) + 1
    capped.append(r)
# 同重要度里宏观数据优先于个股财报（财报占名额最多，挤掉零售/PPI 这类数据不划算）
picked = sorted(capped, key=lambda r: (-r["importance"], r["name"].startswith("财报"), r["date"]))[:12]
SESSION_SORT = {"盘前": "05:00", "盘后": "13:00"}
picked.sort(key=lambda r: (r["date"], r.get("time") or SESSION_SORT.get(r.get("session"), "99:99")))
out = {"events": picked, "tz": "America/Los_Angeles",
       "updatedAt": datetime.now().astimezone().isoformat(timespec="seconds")}
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
