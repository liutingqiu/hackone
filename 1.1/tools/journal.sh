#!/usr/bin/env bash
# 追加一条工作留痕。用法：
#   ./tools/journal.sh <部门> "<做了什么>" "<证据>"
# 部门：chief | research | dev | qa | ops
set -euo pipefail
DEPT="${1:-}"; WHAT="${2:-}"; EV="${3:-}"
[ -z "$DEPT" ] || [ -z "$WHAT" ] && { echo "用法: journal.sh <部门> \"<做了什么>\" \"<证据>\""; exit 2; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DAY="$(date +%F)"; TS="$(date +%H:%M:%S)"
mkdir -p "$ROOT/journal"
printf '[%s] %-9s %-46s 证据: %s\n' "$TS" "$DEPT" "$WHAT" "$EV" >> "$ROOT/journal/$DAY.log"
echo "已留痕 → journal/$DAY.log"
