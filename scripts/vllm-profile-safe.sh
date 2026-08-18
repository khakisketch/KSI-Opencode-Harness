#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# GB10 uses one shared 128 GiB UMA pool. A second active vLLM process has
# previously exhausted non-pageable driver memory and frozen the host.
PROFILE=${1:-}
MIN_AVAILABLE_G=70
MAX_PSI_AVG10=0.10
WAIT_SECONDS=900
LOCK="${VLLM_LEASE_LOCK:-/tmp/opencode/vllm-profile.lock}"

case "$PROFILE" in
  fast)
    NAME=vllm-engine-a
    PORT=8666
    MODEL=nvidia/Qwen3.6-35B-A3B-NVFP4
    SERVED_MODEL=qwen3.6-35b-a3b
    IMAGE=vllm/vllm-openai:v0.24.0-ubuntu2404
    MEMORY=56g
    OTHER_NAME=vllm-engine-developer
    EXTRA_ENV=(-e VLLM_MARLIN_USE_ATOMIC_ADD=1 -e VLLM_USE_FLASHINFER_MOE_FP4=0)
    MODEL_ARGS=(
      --tensor-parallel-size 1 --trust-remote-code --quantization modelopt --kv-cache-dtype fp8
      --moe-backend marlin --attention-backend TRITON_ATTN
      --gpu-memory-utilization 0.25 --max-model-len 32768 --max-num-seqs 2
      --max-num-batched-tokens 4096 --enable-chunked-prefill --no-async-scheduling --no-enable-prefix-caching
      --load-format fastsafetensors --reasoning-parser qwen3 --tool-call-parser qwen3_xml --enable-auto-tool-choice
    )
    ;;
  developer)
    NAME=vllm-engine-developer
    PORT=8667
    MODEL=unsloth/Qwen3.8-27B-NVFP4
    SERVED_MODEL=qwen3.8-27b
    IMAGE=vllm/vllm-openai:v0.25.0-ubuntu2404
    MEMORY=56g
    OTHER_NAME=vllm-engine-a
    EXTRA_ENV=()
    MODEL_ARGS=(
      --tensor-parallel-size 1 --trust-remote-code --language-model-only --kv-cache-dtype fp8
      --attention-backend TRITON_ATTN --gpu-memory-utilization 0.30
      --max-model-len 131072 --max-num-seqs 2 --max-num-batched-tokens 4096
      --enable-chunked-prefill --no-async-scheduling --no-enable-prefix-caching --load-format fastsafetensors
      --reasoning-parser qwen3 --tool-call-parser qwen3_coder --enable-auto-tool-choice
      --default-chat-template-kwargs '{"enable_thinking":true,"preserve_thinking":true}'
    )
    ;;
  *)
    echo "Usage: $0 fast|developer" >&2
    exit 2
    ;;
esac

mkdir -p /tmp/opencode
if [ "${VLLM_LEASE:-0}" = "1" ]; then
  # Running under a live lease supervisor that already holds the exclusive
  # lock. Open an independent descriptor and confirm the lease is still held;
  # if the lock is free the supervisor is gone and we must refuse rather than
  # transition a GPU profile without a lease.
  exec {lease_check}>"$LOCK"
  if flock -n "$lease_check"; then
    flock -u "$lease_check"
    echo "Refusing startup: host lease is not held by a live supervisor." >&2
    exit 1
  fi
else
  exec 9>"$LOCK"
  if ! flock -n 9; then
    echo "Another vLLM profile transition or local task lease is active." >&2
    exit 1
  fi
fi

started=0
cleanup_on_interrupt() {
  if [ "$started" -eq 1 ]; then
    docker rm -f "$NAME" >/dev/null 2>&1 || true
  fi
  exit 130
}
trap cleanup_on_interrupt INT TERM

other_vllm=$(docker ps --format '{{.Names}} {{.Image}}' \
  | awk '$1 != "vllm-engine-a" && $1 != "vllm-engine-developer" && (tolower($1) ~ /vllm/ || tolower($2) ~ /vllm/) { print $1 }')
if [ -n "$other_vllm" ]; then
  echo "Refusing startup: another vLLM container is running: $other_vllm" >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx "$NAME" \
  && ! docker ps --format '{{.Names}}' | grep -qx "$OTHER_NAME" \
  && curl -sf -m 3 "http://127.0.0.1:${PORT}/v1/models" | grep -q "${SERVED_MODEL}"; then
  echo "${PROFILE} profile is already ready on port ${PORT}."
  exit 0
fi

# Stop every managed engine before starting the target. Do not run a second
# profile while a first one is draining or releasing driver allocations.
docker rm -f vllm-engine-a vllm-engine-developer >/dev/null 2>&1 || true

for ((elapsed=0; elapsed<WAIT_SECONDS; elapsed+=5)); do
  managed=$(docker ps --format '{{.Names}}' | grep -E '^(vllm-engine-a|vllm-engine-developer)$' || true)
  compute_pids=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null \
    | awk '$1 ~ /^[0-9]+$/ { print $1 }')
  if [ -z "$managed" ] && [ -z "$compute_pids" ]; then
    break
  fi
  sleep 5
done

managed=$(docker ps --format '{{.Names}}' | grep -E '^(vllm-engine-a|vllm-engine-developer)$' || true)
compute_pids=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null \
  | awk '$1 ~ /^[0-9]+$/ { print $1 }')
if [ -n "$managed" ] || [ -n "$compute_pids" ]; then
  echo "Refusing startup: prior vLLM/NVIDIA allocation did not quiesce." >&2
  exit 1
fi

available_g=$(free -g | awk '/Mem:/{print $7}')
psi_avg10=$(awk -F'[ =]' '/^some /{print $3}' /proc/pressure/memory)
echo "Profile ${PROFILE}; available RAM: ${available_g} GiB; memory PSI avg10: ${psi_avg10}"

if ! [[ "$available_g" =~ ^[0-9]+$ ]] || ! [[ "$psi_avg10" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "Unable to read host memory admission metrics; refusing cold start." >&2
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

# A managed transition holds the shared lock, but an unrelated CUDA workload
# can still appear during the admission check. Refuse rather than overlap it.
managed=$(docker ps --format '{{.Names}}' | grep -E '^(vllm-engine-a|vllm-engine-developer)$' || true)
compute_pids=$(nvidia-smi --query-compute-apps=pid --format=csv,noheader,nounits 2>/dev/null \
  | awk '$1 ~ /^[0-9]+$/ { print $1 }')
if [ -n "$managed" ] || [ -n "$compute_pids" ]; then
  echo "Refusing startup: a vLLM/NVIDIA allocation appeared during admission." >&2
  exit 1
fi

available_g=$(free -g | awk '/Mem:/{print $7}')
psi_avg10=$(awk -F'[ =]' '/^some /{print $3}' /proc/pressure/memory)
if [ "$available_g" -lt "$MIN_AVAILABLE_G" ]; then
  echo "Refusing startup: available RAM fell below ${MIN_AVAILABLE_G} GiB during admission." >&2
  exit 1
fi
if awk -v current="$psi_avg10" -v maximum="$MAX_PSI_AVG10" 'BEGIN { exit !(current > maximum) }'; then
  echo "Refusing startup: memory PSI avg10 exceeded ${MAX_PSI_AVG10} during admission." >&2
  exit 1
fi

docker run -d --name "$NAME" -p "127.0.0.1:${PORT}:8000" \
  --memory "$MEMORY" --memory-swap 64g --oom-score-adj 500 \
  --device nvidia.com/gpu=all "${EXTRA_ENV[@]}" \
  -v /home/ksi/models/hf-hub:/root/.cache/huggingface \
  "$IMAGE" "$MODEL" "${MODEL_ARGS[@]}" --served-model-name "$SERVED_MODEL" >/dev/null
started=1

for ((elapsed=0; elapsed<WAIT_SECONDS; elapsed+=5)); do
  if curl -sf -m 3 "http://127.0.0.1:${PORT}/v1/models" | grep -q "${SERVED_MODEL}"; then
    echo "${PROFILE} profile is ready on port ${PORT} after ${elapsed}s."
    trap - INT TERM
    exit 0
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
    echo "${PROFILE} profile exited during startup." >&2
    docker logs --tail 40 "$NAME" >&2 || true
    exit 1
  fi
  sleep 5
done

echo "${PROFILE} profile startup timed out after ${WAIT_SECONDS}s." >&2
docker rm -f "$NAME" >/dev/null 2>&1 || true
exit 1
