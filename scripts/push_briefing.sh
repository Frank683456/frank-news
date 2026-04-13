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
DEST="${DASHBOARD_DEST:-monitor:/opt/frank-dashboard/data/}"

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

echo "[push_briefing] generating Artifact JSON..."
claude -p --output-format text < "$TMP_PROMPT" > "$OUT.tmp"

# Validate it parses.
python3 -c "import json, sys; json.load(open(sys.argv[1]))" "$OUT.tmp"
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
