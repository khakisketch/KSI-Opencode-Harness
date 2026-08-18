import test from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

import { LeaseManager, busyError, isLocalProvider, localProfileForAgent } from "../src/lease.mjs"

const SUPERVISOR = fileURLToPath(new URL("../scripts/vllm-lease.sh", import.meta.url))
const FAKE_PROFILE = fileURLToPath(new URL("./fixtures/fake-profile.sh", import.meta.url))
const FAKE_SUPERVISOR = fileURLToPath(new URL("./fixtures/fake-lease.mjs", import.meta.url))

function trackChild(child) {
  const lines = []
  const reader = createInterface({ input: child.stdout })
  reader.on("line", (line) => lines.push(line))
  const exit = new Promise((resolve) => child.on("exit", resolve))
  return { lines, exit }
}

function writeLines(child, text) {
  child.stdin.write(text)
}

function closeStdin(child) {
  child.stdin.end()
}

function waitFor(lines, type, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      try {
        if (lines.some((line) => JSON.parse(line).type === type)) return resolve()
      } catch {}
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${type}; lines=${JSON.stringify(lines)}`))
      setTimeout(tick, 20)
    }
    tick()
  })
}

test("localProfileForAgent classifies subagents to profiles", () => {
  assert.equal(localProfileForAgent("developer", "openai"), "developer")
  assert.equal(localProfileForAgent("explore", "openai"), null)
  assert.equal(localProfileForAgent("explore", "local"), null)
  assert.equal(localProfileForAgent("test-runner", "openai"), null)
  assert.equal(localProfileForAgent("reviewer", "openai"), null)
  assert.equal(localProfileForAgent("reviewer", "nvidia"), null)
  assert.equal(localProfileForAgent("reviewer", "local"), "fast")
  assert.equal(localProfileForAgent("risk-analyst", "local"), "fast")
  assert.equal(localProfileForAgent("risk-analyst", "local-developer"), "developer")
  assert.equal(localProfileForAgent("risk-analyst", "nvidia"), null)
  assert.equal(localProfileForAgent("general", "openai"), null)
})

test("both local providers require host profile custody", () => {
  assert.equal(isLocalProvider("local"), true)
  assert.equal(isLocalProvider("local-developer"), true)
  assert.equal(isLocalProvider("openai"), false)
  assert.equal(isLocalProvider("nvidia"), false)
})

test("busyError carries a stable machine-readable code", () => {
  const error = busyError("profile=developer")
  assert.equal(error.code, "KSI_GPU_BUSY")
  assert.match(error.message, /Local GPU busy/)
})

test("LeaseManager shares one profile within a session up to the configured limit", async () => {
  const manager = new LeaseManager({ supervisorPath: FAKE_SUPERVISOR })
  const first = await manager.acquire({ profile: "developer", sessionID: "s1", callID: "c1" })
  assert.equal(first.ready, true)
  assert.equal(manager.current, first)

  const second = await manager.acquire({ profile: "developer", sessionID: "s1", callID: "c2" })
  assert.equal(second, first)
  assert.deepEqual([...first.callIDs], ["c1", "c2"])

  await assert.rejects(() => manager.acquire({ profile: "developer", sessionID: "s1", callID: "c3" }), (error) => {
    assert.equal(error.code, "KSI_GPU_BUSY")
    return true
  })
  await assert.rejects(() => manager.acquire({ profile: "developer", sessionID: "s2", callID: "other" }), (error) => {
    assert.equal(error.code, "KSI_GPU_BUSY")
    return true
  })

  await manager.releaseCall({ sessionID: "s1", callID: "c1" })
  assert.equal(manager.current, first)
  await manager.releaseCall({ sessionID: "s1", callID: "c2" })
  assert.equal(manager.current, null)
  assert.equal(first.released, true)

  const fallback = await manager.acquire({ profile: "fast", sessionID: "s3", callID: "c3" })
  assert.equal(fallback.profile, "fast")
  await manager.release(fallback)
})

test("LeaseManager release is idempotent and ignores stale callbacks", async () => {
  const manager = new LeaseManager({ supervisorPath: FAKE_SUPERVISOR })
  const lease = await manager.acquire({ profile: "fast", sessionID: "s1", callID: "c1" })
  await manager.release(lease)
  await manager.release(lease)
  await manager.release({ released: false, sessionID: "other" })
  assert.equal(manager.current, null)
})

test("LeaseManager retains detached calls until their child session becomes idle", async () => {
  const manager = new LeaseManager({ supervisorPath: FAKE_SUPERVISOR })
  const lease = await manager.acquire({ profile: "developer", sessionID: "parent", callID: "call" })
  assert.equal(manager.bindChild({ sessionID: "parent", callID: "call", childSessionID: "child" }), true)
  assert.equal(await manager.releaseChild("unrelated"), false)
  assert.equal(manager.current, lease)
  assert.equal(await manager.releaseChild("child"), true)
  assert.equal(manager.current, null)
})

test("parent idle fallback does not need to release a lease with detached children", async () => {
  const manager = new LeaseManager({ supervisorPath: FAKE_SUPERVISOR })
  const lease = await manager.acquire({ profile: "developer", sessionID: "parent", callID: "call" })
  manager.bindChild({ sessionID: "parent", callID: "call", childSessionID: "child" })
  assert.equal(lease.childCalls.size, 1)
  assert.equal(manager.current, lease)
  await manager.releaseChild("child")
})

test("LeaseManager remains fail-closed after profile restoration fails", async () => {
  const manager = new LeaseManager({ supervisorPath: FAKE_SUPERVISOR })
  const lease = await manager.acquire({ profile: "recovery-fail", sessionID: "s1", callID: "c1" })
  await assert.rejects(() => manager.release(lease), /restore failed/)
  assert.equal(manager.current, null)
  await assert.rejects(() => manager.acquire({ profile: "developer", sessionID: "s2", callID: "c2" }), /restore failed/)
})

test("supervisor: ready then release restores the resident Developer profile", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const lock = join(dir, "profile.lock")
    const state = join(dir, "state.json")
    const child = spawn(SUPERVISOR, ["fast", "test-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: state,
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines, exit } = trackChild(child)
    await waitFor(lines, "ready")
    writeLines(child, "release\n")
    closeStdin(child)
    assert.equal(await exit, 0)
    const types = lines.map((line) => JSON.parse(line).type)
    assert.ok(types.includes("restored"), `expected restored, got ${JSON.stringify(lines)}`)
    const stateFile = JSON.parse(await readFile(state, "utf8"))
    assert.equal(stateFile.phase, "released")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("supervisor: parent EOF (crash) still restores the resident Developer profile", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const lock = join(dir, "profile.lock")
    const state = join(dir, "state.json")
    const child = spawn(SUPERVISOR, ["developer", "eof-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: state,
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines, exit } = trackChild(child)
    await waitFor(lines, "ready")
    closeStdin(child)
    assert.equal(await exit, 0)
    const types = lines.map((line) => JSON.parse(line).type)
    assert.ok(types.includes("restored"), `expected restored, got ${JSON.stringify(lines)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("supervisor: second lease attempt while held is rejected as busy", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const lock = join(dir, "profile.lock")
    const state = join(dir, "state.json")
    const holder = spawn(SUPERVISOR, ["developer", "holder-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: state,
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines: holderLines, exit: holderExit } = trackChild(holder)
    await waitFor(holderLines, "ready")

    const contender = spawn(SUPERVISOR, ["fast", "contender-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: `${state}.contender`,
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines, exit } = trackChild(contender)
    assert.equal(await exit, 1)
    const types = lines.map((line) => JSON.parse(line).type)
    assert.ok(types.includes("busy"), `expected busy, got ${JSON.stringify(lines)}`)

    writeLines(holder, "release\n")
    closeStdin(holder)
    await holderExit
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("supervisor: transition failure restores the resident Developer profile", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const lock = join(dir, "profile.lock")
    const state = join(dir, "state.json")
    const child = spawn(SUPERVISOR, ["fast", "fail-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: state,
        FAIL_PROFILE: "fast",
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines, exit } = trackChild(child)
    await waitFor(lines, "transition-failed")
    assert.equal(await exit, 0)
    const types = lines.map((line) => JSON.parse(line).type)
    assert.ok(types.includes("restored"), `expected restored after failure, got ${JSON.stringify(lines)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("LeaseManager waits for transition-failure recovery before rejecting", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const manager = new LeaseManager({
      supervisorPath: SUPERVISOR,
      supervisorEnv: {
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: join(dir, "profile.lock"),
        VLLM_LEASE_STATE: join(dir, "state.json"),
        FAIL_PROFILE: "fast",
      },
    })
    await assert.rejects(() => manager.acquire({ profile: "fast", sessionID: "s1", callID: "c1" }), /transition failed/)
    assert.equal(manager.current, null)
    assert.equal(manager.recoveryError, null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("LeaseManager remains fail-closed when transition and default restoration both fail", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const manager = new LeaseManager({
      supervisorPath: SUPERVISOR,
      supervisorEnv: {
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: join(dir, "profile.lock"),
        VLLM_LEASE_STATE: join(dir, "state.json"),
        FAIL_PROFILE: "all",
      },
    })
    await assert.rejects(
      () => manager.acquire({ profile: "fast", sessionID: "s1", callID: "c1" }),
      /restore failed/,
    )
    assert.equal(manager.current, null)
    assert.equal(manager.recoveryError?.code, "KSI_RESTORE_FAILED")
    await assert.rejects(
      () => manager.acquire({ profile: "developer", sessionID: "s2", callID: "c2" }),
      /restore failed/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("supervisor: recovery-required when resident Developer restore fails", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const lock = join(dir, "profile.lock")
    const state = join(dir, "state.json")
    const child = spawn(SUPERVISOR, ["fast", "failall-nonce"], {
      env: {
        ...process.env,
        VLLM_LEASE_PROFILE_SCRIPT: FAKE_PROFILE,
        VLLM_LEASE_LOCK: lock,
        VLLM_LEASE_STATE: state,
        FAIL_PROFILE: "developer",
      },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const { lines, exit } = trackChild(child)
    await waitFor(lines, "ready")
    writeLines(child, "release\n")
    closeStdin(child)
    await waitFor(lines, "recovery-required")
    assert.equal(await exit, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("profile script refuses startup when the lease lock is not held", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ksi-lease-"))
  try {
    const profile = await readFile(new URL("../scripts/vllm-profile-safe.sh", import.meta.url), "utf8")
    assert.match(profile, /VLLM_LEASE/)
    const lock = join(dir, "unheld.lock")
    await writeFile(lock, "")
    const script = fileURLToPath(new URL("../scripts/vllm-profile-safe.sh", import.meta.url))
    const child = spawn("bash", [script, "fast"], {
      env: { ...process.env, VLLM_LEASE: "1", VLLM_LEASE_LOCK: lock },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk) => (stderr += chunk))
    const code = await new Promise((resolve) => child.on("exit", resolve))
    assert.notEqual(code, 0)
    assert.match(stderr, /Refusing startup/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
