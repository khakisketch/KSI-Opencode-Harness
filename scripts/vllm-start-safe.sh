#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Start exactly one shared vLLM engine. Duplicate model residency can exhaust
# GB10 unified memory and freeze the host before the kernel can recover.
MIN_AVAILABLE_G=${MIN_AVAILABLE_G:-70}
MAX_PSI_AVG10=${MAX_PSI_AVG10:-0.10}
WAIT_SECONDS=${WAIT_SECONDS:-600}
LOCK=/tmp/opencode/vllm-start.lock

if ! [[ "$MIN_AVAILABLE_G" =~ ^[0-9]+$ ]] \
  || [ "$MIN_AVAILABLE_G" -lt 70 ] \
  || ! [[ "$MAX_PSI_AVG10" =~ ^[0-9]+([.][0-9]+)?$ ]] \
  || awk -v maximum="$MAX_PSI_AVG10" 'BEGIN { exit !(maximum > 0.10) }' \
  || ! [[ "$WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Invalid admission-control configuration." >&2
  exit 1
fi

mkdir -p /tmp/opencode
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "Another vLLM start is already in progress." >&2
  exit 1
fi

# The second replica is forbidden on this UMA host. Both local providers share
# engine A through port 8666.
docker rm -f vllm-engine-b >/dev/null 2>&1 || true

other_vllm=$(docker ps --format '{{.Names}} {{.Image}}' \
  | awk '$1 != "vllm-engine-a" && (tolower($1) ~ /vllm/ || tolower($2) ~ /vllm/) { print $1 }')
if [ -n "$other_vllm" ]; then
  echo "Refusing startup: another vLLM container is running: $other_vllm" >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx vllm-engine-a \
  && curl -sf -m 3 http://127.0.0.1:8666/v1/models | grep -q qwen3.6; then
  echo "vllm-engine-a is already ready on port 8666."
  exit 0
fi

available_g=$(free -g | awk '/Mem:/{print $7}')
psi_avg10=$(awk -F'[ =]' '/^some /{print $3}' /proc/pressure/memory)
echo "Available RAM: ${available_g} GiB; memory PSI avg10: ${psi_avg10}"

if ! [[ "$available_g" =~ ^[0-9]+$ ]] || ! [[ "$psi_avg10" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Unable to read host memory admission metrics; refusing cold start." >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx vllm-engine-a; then
  echo "vllm-engine-a is already starting; refusing a competing cold start." >&2
  exit 1
fi

compute_pids=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null \
  | awk '$1 ~ /^[0-9]+$/ { print $1 }')
if [ -n "$compute_pids" ]; then
  echo "Refusing cold start: another NVIDIA compute workload is active (PID: $compute_pids)." >&2
  exit 1
fi

if [ "$available_g" -lt "$MIN_AVAILABLE_G" ]; then
  echo "Refusing cold start: ${MIN_AVAILABLE_G} GiB available RAM is required." >&2
  exit 1
fi

if awk -v current="$psi_avg10" -v maximum="$MAX_PSI_AVG10" 'BEGIN { exit !(current > maximum) }'; then
  echo "Refusing cold start: memory PSI avg10 exceeds ${MAX_PSI_AVG10}." >&2
  exit 1
fi

docker rm -f vllm-engine-a >/dev/null 2>&1 || true
docker run -d --name vllm-engine-a -p 127.0.0.1:8666:8000 \
  --memory 56g --memory-swap 64g --oom-score-adj 500 \
  --device nvidia.com/gpu=all \
  -e VLLM_MARLIN_USE_ATOMIC_ADD=1 -e VLLM_USE_FLASHINFER_MOE_FP4=0 \
  -v /home/ksi/models/hf-hub:/root/.cache/huggingface \
  vllm/vllm-openai:v0.24.0-ubuntu2404 nvidia/Qwen3.6-35B-A3B-NVFP4 \
  --tensor-parallel-size 1 --trust-remote-code --quantization modelopt --kv-cache-dtype fp8 \
  --moe-backend marlin --gpu-memory-utilization 0.25 --max-model-len 32768 --max-num-seqs 2 \
  --max-num-batched-tokens 4096 --enable-chunked-prefill --async-scheduling --enable-prefix-caching \
  --speculative-config '{"method":"mtp","num_speculative_tokens":3,"moe_backend":"triton"}' \
  --load-format fastsafetensors --reasoning-parser qwen3 --tool-call-parser qwen3_xml --enable-auto-tool-choice \
  --served-model-name qwen3.6-35b-a3b >/dev/null

for ((elapsed=0; elapsed<WAIT_SECONDS; elapsed+=5)); do
  if curl -sf -m 3 http://127.0.0.1:8666/v1/models | grep -q qwen3.6; then
    echo "vllm-engine-a is ready on port 8666 after ${elapsed}s."
    exit 0
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx vllm-engine-a; then
    echo "vllm-engine-a exited during startup." >&2
    docker logs --tail 40 vllm-engine-a >&2 || true
    exit 1
  fi
  sleep 5
done

echo "vllm-engine-a startup timed out after ${WAIT_SECONDS}s." >&2
docker rm -f vllm-engine-a >/dev/null 2>&1 || true
exit 1
