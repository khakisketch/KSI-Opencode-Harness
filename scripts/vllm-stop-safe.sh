#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

WAIT_SECONDS=900
LOCK=/tmp/opencode/vllm-profile.lock

mkdir -p /tmp/opencode
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Refusing stop: another vLLM transition or local task lease is active." >&2
  exit 1
fi

docker rm -f vllm-engine-a vllm-engine-developer >/dev/null 2>&1 || true
for ((elapsed=0; elapsed<WAIT_SECONDS; elapsed+=5)); do
  managed=$(docker ps --format '{{.Names}}' | grep -E '^(vllm-engine-a|vllm-engine-developer)$' || true)
  compute_pids=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null \
    | awk '$1 ~ /^[0-9]+$/ { print $1 }')
  if [ -z "$managed" ] && [ -z "$compute_pids" ]; then
    echo "Managed vLLM profiles are stopped and NVIDIA allocations are quiescent."
    exit 0
  fi
  sleep 5
done

echo "Managed vLLM profiles did not quiesce after ${WAIT_SECONDS}s." >&2
exit 1
