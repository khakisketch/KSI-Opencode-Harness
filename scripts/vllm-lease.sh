#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Lease supervisor for one local subagent task. Spawned by the harness plugin,
# it holds the exclusive host vLLM lease from before the profile transition
# until the fast profile has been restored, so no other OpenCode process (or
# the manual/systemd entrypoints) can remove the engine underneath a live task.
#
# Protocol (JSON lines on stdout; the profile script's own output goes to
# stderr so the protocol channel stays clean):
#   {"type":"acquiring",...}
#   {"type":"ready",...}              profile switched and healthy
#   {"type":"busy",...}               another host process holds the lease
#   {"type":"transition-failed",...}  profile switch failed before readiness
#   {"type":"restoring",...}
#   {"type":"restored",...}           resident Developer profile restored
#   {"type":"recovery-required",...}  default restore failed; host left fail-closed
#
# Control (stdin): a single "release" line ends the lease and restores the
# resident Developer profile.
# EOF on stdin (parent died) triggers the same restoration. TERM/INT/HUP also
# request restoration.

PROFILE=${1:?usage: vllm-lease.sh fast|developer [nonce]}
NONCE=${2:-unknown}
LOCK="${VLLM_LEASE_LOCK:-/tmp/opencode/vllm-profile.lock}"
STATE="${VLLM_LEASE_STATE:-/tmp/opencode/vllm-lease-state.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_PROFILE_SCRIPT="$SCRIPT_DIR/vllm-profile-safe.sh"
PROFILE_SCRIPT="${VLLM_LEASE_PROFILE_SCRIPT:-$DEFAULT_PROFILE_SCRIPT}"

mkdir -p /tmp/opencode
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "{\"type\":\"busy\",\"nonce\":\"$NONCE\"}"
  exit 1
fi

cleaned=0
write_state() {
  local phase=$1
  printf '{"version":1,"nonce":"%s","profile":"%s","pid":%s,"ppid":%s,"phase":"%s","updated":%s}\n' \
    "$NONCE" "$PROFILE" "$$" "${PPID:-0}" "$phase" "$(date +%s)" > "${STATE}.tmp"
  mv -f "${STATE}.tmp" "$STATE"
}

restore_default() {
  if [ "$cleaned" -eq 1 ]; then return 0; fi
  cleaned=1
  write_state restoring
  echo "{\"type\":\"restoring\",\"profile\":\"developer\"}"
  if VLLM_LEASE=1 "$PROFILE_SCRIPT" developer 1>&2; then
    write_state released
    echo "{\"type\":\"restored\",\"ok\":true}"
    return 0
  fi
  write_state recovery-required
  echo "{\"type\":\"recovery-required\"}"
  if [ "$PROFILE_SCRIPT" = "$DEFAULT_PROFILE_SCRIPT" ]; then
    docker rm -f vllm-engine-a vllm-engine-developer >/dev/null 2>&1 || true
  fi
  return 1
}
trap 'restore_default || true; exit 0' EXIT
trap 'restore_default || true; exit 0' TERM INT HUP

write_state acquiring
echo "{\"type\":\"acquiring\",\"profile\":\"$PROFILE\",\"nonce\":\"$NONCE\"}"
if ! VLLM_LEASE=1 "$PROFILE_SCRIPT" "$PROFILE" 1>&2; then
  write_state failed
  if restore_default; then
    echo "{\"type\":\"transition-failed\",\"profile\":\"$PROFILE\",\"recovered\":true}"
  fi
  exit 1
fi
write_state active
echo "{\"type\":\"ready\",\"profile\":\"$PROFILE\"}"

while IFS= read -r line; do
  case "$line" in
    release) break ;;
  esac
done
exit 0
