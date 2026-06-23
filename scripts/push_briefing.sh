#!/usr/bin/env bash
# Generate briefing Artifact JSON via claude -p, then scp to dashboard server.
# Invoke from morning-briefing-tg cron AFTER Telegram push succeeds.
#
# Usage: push_briefing.sh <markdown_file>

set -euo pipefail

MD="${1:?usage: push_briefing.sh <markdown_file> [YYYY-MM-DD]}"
DATE="${2:-$(date +%F)}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_DIR="$PROJECT_DIR/schemas"
OUT_DIR="${BRIEFING_OUT_DIR:-$HOME/briefing-archive}"

# DASHBOARD_DEST options:
#   "local"          → write to $PROJECT_DIR/data/ (dev / testing)
#   "user@host:path" → scp to remote
# default: try monitor:/opt/frank-dashboard/data/, fall back to local if monitor unreachable
DEST="${DASHBOARD_DEST:-monitor:/opt/frank-news/data/}"

mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/briefing-$DATE.json"

PROMPT_TEMPLATE="$SCHEMA_DIR/briefing_prompt.md"
MD_CONTENT=$(cat "$MD")

TMP_PROMPT=$(mktemp /tmp/briefing-prompt.XXXXXX.md)
trap 'rm -f "$TMP_PROMPT"' EXIT
python3 -c "
import sys, pathlib
tpl = pathlib.Path(sys.argv[1]).read_text()
md = pathlib.Path(sys.argv[2]).read_text()
pathlib.Path(sys.argv[3]).write_text(tpl.replace('{{MARKDOWN_CONTENT}}', md))
" "$PROMPT_TEMPLATE" "$MD" "$TMP_PROMPT"

# 调 Claude 生成 JSON,失败最多重试 1 次(共 2 次调用,硬上限,防烧额度)
# 在 PROJECT_DIR 执行，让 claude 能读到 schemas/artifact_briefing.json
MAX_ATTEMPTS=2
attempt=1
while true; do
    echo "[push_briefing] generating Artifact JSON (attempt $attempt/$MAX_ATTEMPTS)..."
    # 禁用写/执行/联网工具:这一步只是把已生成的 markdown 转成 JSON 输出到 stdout。
    # 否则 claude 会用 Write 工具把 JSON 写成 data/briefing-*.json,而 stdout 只剩闲聊,
    # 重试时又发现「文件已存在」直接放弃 → 解析永远失败(2026-05-22 翻车原因)。
    (cd "$PROJECT_DIR" && claude -p --output-format text \
        --disallowedTools "Write" "Edit" "NotebookEdit" "Bash" "WebSearch" "WebFetch" \
        < "$TMP_PROMPT") > "$OUT.raw"
    # 提取第一个 { 到最后一个 } 之间的内容，去掉前后非 JSON 噪声
    # 再尝试自动修复字符串内未转义的 ASCII 双引号（Claude 最常踩的坑）
    python3 - "$OUT.raw" "$OUT.tmp" <<'PYEOF'
import re, sys, json, pathlib
raw = pathlib.Path(sys.argv[1]).read_text()
m = re.search(r'\{.*\}', raw, re.DOTALL)
s = m.group(0) if m else raw

def fix_inner(inner):
    out, toggle = [], 0
    for ch in inner:
        if ch == '"':
            out.append('「' if toggle==0 else '」'); toggle ^= 1
        else:
            out.append(ch)
    if toggle == 1: out.append('」')
    return ''.join(out)

patterns = [
    re.compile(r'^(\s*"(?:text|title|subtitle|cite|label|name|value)"\s*:\s*)"(.*)"(\s*,?\s*)$'),
    re.compile(r'^(\s*)"(.*)"(\s*,?\s*)$'),
]
for _ in range(50):
    try:
        json.loads(s); break
    except json.JSONDecodeError as e:
        lines = s.split('\n')
        bad = lines[e.lineno-1]
        fixed = False
        for pat in patterns:
            mm = pat.match(bad)
            if mm:
                lines[e.lineno-1] = mm.group(1) + '"' + fix_inner(mm.group(2)) + '"' + mm.group(3)
                s = '\n'.join(lines); fixed = True; break
        if not fixed: break
pathlib.Path(sys.argv[2]).write_text(s)
PYEOF
    if python3 -c "import json, sys; json.load(open(sys.argv[1]))" "$OUT.tmp" 2>/dev/null; then
        rm -f "$OUT.raw"
        break
    fi
    echo "[push_briefing] JSON invalid on attempt $attempt"
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
        echo "[push_briefing] giving up after $MAX_ATTEMPTS attempts"
        exit 1
    fi
    attempt=$((attempt + 1))
done
mv "$OUT.tmp" "$OUT"

if [[ "$DEST" == "local" ]]; then
    TARGET="$PROJECT_DIR/data"
    mkdir -p "$TARGET"
    cp "$OUT" "$TARGET/briefing-$DATE.json"
    cp "$OUT" "$TARGET/briefing-latest.json"
    echo "[push_briefing] wrote locally: $TARGET/briefing-$DATE.json"
else
    echo "[push_briefing] uploading to $DEST ..."
    scp -q "$OUT" "$DEST/briefing-$DATE.json"
    scp -q "$OUT" "$DEST/briefing-latest.json"
    echo "[push_briefing] done: $OUT"
fi
