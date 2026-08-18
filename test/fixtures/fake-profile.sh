#!/usr/bin/env bash
set -euo pipefail

PROFILE=${1:?usage: fake-profile.sh fast|developer}

# Controlled behavior for lease supervisor tests.
#   FAIL_PROFILE=<fast|developer>  make a given profile fail
#   BLOCK_MS=<n>                    sleep before success
case "$PROFILE" in
  fast)
    if [ "${FAIL_PROFILE:-}" = "fast" ] || [ "${FAIL_PROFILE:-}" = "all" ]; then
      echo "fake fast failed" >&2
      exit 1
    fi
    ;;
  developer)
    if [ "${FAIL_PROFILE:-}" = "developer" ] || [ "${FAIL_PROFILE:-}" = "all" ]; then
      echo "fake developer failed" >&2
      exit 1
    fi
    ;;
  *)
    echo "unknown profile $PROFILE" >&2
    exit 2
    ;;
esac

if [ -n "${BLOCK_MS:-}" ]; then
  sleep "$((BLOCK_MS / 1000))"
fi
echo "fake profile ${PROFILE} ready" >&2
