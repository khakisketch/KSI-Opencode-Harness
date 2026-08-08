#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

LOG="${1:-/tmp/opencode/vllm-load-monitor.log}"
INTERVAL="${2:-10}"
DURATION_MIN="${3:-20}"

if ! [[ "$INTERVAL" =~ ^[1-9][0-9]*$ ]] || ! [[ "$DURATION_MIN" =~ ^[1-9][0-9]*$ ]]; then
  echo "Interval and duration must be positive integers." >&2
  exit 1
fi

END=$(( $(date +%s) + DURATION_MIN * 60 ))

echo "=== vLLM 로드 계측 시작 $(date -Is) ===" > "$LOG"
while [ "$(date +%s)" -lt "$END" ]; do
  ts=$(date +%H:%M:%S)
  mem=$(free -g | awk '/Mem:/{print "used=" $3 " avail=" $7}')
  swap=$(free -g | awk '/Swap:/{print "swap_used=" $3}')
  stats=$(docker stats --no-stream --format "{{.Name}} mem={{.MemUsage}} cpu={{.CPUPerc}}" 2>/dev/null | grep vllm || echo "vllm 미실행")
  echo "[$ts] $mem $swap | $stats" >> "$LOG"
  sleep "$INTERVAL"
done
echo "=== 계측 종료 $(date -Is) ===" >> "$LOG"
