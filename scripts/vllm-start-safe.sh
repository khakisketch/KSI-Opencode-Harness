#!/usr/bin/env bash
set -euo pipefail

# The resident Developer profile is the normal operating mode. The fast Qwen
# profile remains available only through an explicit operator transition.
exec "$(dirname "$0")/vllm-profile-safe.sh" developer
