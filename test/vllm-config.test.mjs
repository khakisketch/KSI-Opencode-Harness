import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const launcher = await readFile(new URL("../scripts/vllm-start-safe.sh", import.meta.url), "utf8")
const profileLauncher = await readFile(new URL("../scripts/vllm-profile-safe.sh", import.meta.url), "utf8")
const stopLauncher = await readFile(new URL("../scripts/vllm-stop-safe.sh", import.meta.url), "utf8")
const leaseSupervisor = await readFile(new URL("../scripts/vllm-lease.sh", import.meta.url), "utf8")
const exampleConfig = await readFile(new URL("../opencode.jsonc.example", import.meta.url), "utf8")
const parsedExampleConfig = JSON.parse(exampleConfig)
const harnessInstructions = await readFile(new URL("../instructions/harness.md", import.meta.url), "utf8")

test("default launcher starts the resident Developer profile", () => {
  assert.match(launcher, /vllm-profile-safe\.sh" developer/)
})

test("developer profile is text-only, quality-oriented, and mutually exclusive", () => {
  assert.match(profileLauncher, /developer\)/)
  assert.match(profileLauncher, /--language-model-only/)
  assert.match(profileLauncher, /--max-model-len 131072/)
  assert.match(profileLauncher, /--max-num-seqs 2/)
  assert.match(profileLauncher, /--no-async-scheduling/)
  assert.match(profileLauncher, /--no-enable-prefix-caching/)
  assert.match(profileLauncher, /--tool-call-parser qwen3_coder/)
  assert.match(profileLauncher, /--default-chat-template-kwargs '\{"enable_thinking":true,"preserve_thinking":true\}'/)
  assert.match(profileLauncher, /docker rm -f vllm-engine-a vllm-engine-developer/)
  assert.match(profileLauncher, /MIN_AVAILABLE_G=70/)
  assert.match(profileLauncher, /MAX_PSI_AVG10=0\.10/)
  assert.match(profileLauncher, /another vLLM container is running/)
  assert.match(profileLauncher, /! docker ps --format '\{\{\.Names\}\}' \| grep -qx "\$OTHER_NAME"/)
  assert.match(profileLauncher, /trap cleanup_on_interrupt INT TERM/)
  assert.match(profileLauncher, /available RAM fell below/)
  assert.doesNotMatch(profileLauncher, /--speculative-config/)
})

test("developer model keeps the 120K client window and explicit thinking budgets", () => {
  assert.match(exampleConfig, /"context": 122880/)
  assert.match(exampleConfig, /"balanced": \{[\s\S]*?"thinking_token_budget": 4096/)
  assert.match(exampleConfig, /"quality": \{[\s\S]*?"thinking_token_budget": 16384/)
})

test("example config bounds tool output and prunes stale context", () => {
  assert.deepEqual(parsedExampleConfig.tool_output, { max_lines: 600, max_bytes: 24576 })
  assert.deepEqual(parsedExampleConfig.compaction, {
    auto: true,
    prune: true,
    tail_turns: 4,
    preserve_recent_tokens: 32768,
    reserved: 16384,
  })
})

test("DGX scheduling prefers safe two-Developer waves without manufacturing parallelism", () => {
  assert.match(harnessInstructions, /Build targets a useful two-Developer wave/)
  assert.match(harnessInstructions, /Prefer two Developers in the same wave/)
  assert.match(harnessInstructions, /Use one only when no safe, useful partition exists/)
  assert.match(harnessInstructions, /Do not manufacture parallelism/)
  assert.match(harnessInstructions, /later single-owner wave/)
  assert.doesNotMatch(harnessInstructions, /Default to one Developer/)
})

test("shared fast profile allows bounded GPU parallelism (staged re-enable)", () => {
  assert.match(profileLauncher, /--max-num-seqs 2/)
  assert.match(profileLauncher, /--attention-backend TRITON_ATTN/)
  assert.match(profileLauncher, /--moe-backend marlin/)
  assert.match(profileLauncher, /VLLM_USE_FLASHINFER_MOE_FP4=0/)
})

test("stop launcher shares the profile lock and waits for GPU quiescence", () => {
  assert.match(stopLauncher, /vllm-profile\.lock/)
  assert.match(stopLauncher, /flock -n 9/)
  assert.match(stopLauncher, /docker rm -f vllm-engine-a vllm-engine-developer/)
  assert.match(stopLauncher, /NVIDIA allocations are quiescent/)
})

test("stop launcher refuses while another transition or lease is active", () => {
  assert.match(stopLauncher, /Refusing stop: another vLLM transition or local task lease is active/)
})

test("profile launcher is lease-aware", () => {
  assert.match(profileLauncher, /VLLM_LEASE/)
  assert.match(profileLauncher, /lease_check/)
  assert.match(profileLauncher, /host lease is not held by a live supervisor/)
  assert.match(profileLauncher, /Another vLLM profile transition or local task lease is active/)
})

test("lease supervisor holds the lock for the whole fallback task and restores Developer", () => {
  assert.match(leaseSupervisor, /vllm-profile\.lock/)
  assert.match(leaseSupervisor, /flock -n 9/)
  assert.match(leaseSupervisor, /"type":"ready"/)
  assert.match(leaseSupervisor, /"type":"busy"/)
  assert.match(leaseSupervisor, /"type":"restored"/)
  assert.match(leaseSupervisor, /"type":"recovery-required"/)
  assert.match(leaseSupervisor, /PROFILE_SCRIPT" = "\$DEFAULT_PROFILE_SCRIPT"/)
  assert.match(leaseSupervisor, /release/)
  assert.match(leaseSupervisor, /restore_default/)
  assert.match(leaseSupervisor, /trap .*TERM INT HUP/)
})
