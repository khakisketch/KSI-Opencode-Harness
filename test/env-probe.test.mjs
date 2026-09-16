import test from "node:test"
import assert from "node:assert/strict"

const { createEnvProbe, ENV_PROBE_SCOPES, ENV_PROBE_LIMITS, BINARY_SEARCH_DIRS } = await import("../src/env-probe.mjs")

const stubBin = async (name) => `/usr/bin/${name}`
const withBin = (extra = {}) => ({ resolveBinary: stubBin, ...extra })

test("exposes only the bounded scope enum", () => {
  assert.deepEqual([...ENV_PROBE_SCOPES].sort(), ["gpu", "machine", "models"])
})

test("rejects unknown scopes without throwing fatally from probe", async () => {
  const probe = createEnvProbe()
  const result = await probe.probe("kernel-internals")
  assert.equal(result.ok, false)
  assert.match(result.degraded, /unknown-scope/)
})

test("machine scope returns bounded output with truncation noted", async () => {
  const probe = createEnvProbe()
  const result = await probe.probe("machine")
  assert.equal(typeof result.ok, "boolean")
  const bytes = Buffer.byteLength(JSON.stringify(result), "utf8")
  assert.ok(bytes <= ENV_PROBE_LIMITS.maxBytes, `env-probe output ${bytes}B exceeds bound`)
  if (result.ok) {
    assert.ok(Array.isArray(result.commands))
    for (const entry of result.commands) {
      assert.ok(typeof entry.command === "string")
      assert.ok(typeof entry.output === "string")
      assert.equal(typeof entry.truncated, "boolean")
    }
  } else {
    assert.match(result.degraded, /.+/)
  }
})

test("gpu scope degrades explicitly when nvidia-smi is unavailable", async () => {
  const probe = createEnvProbe(withBin({ run: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }) } }))
  const result = await probe.probe("gpu")
  assert.equal(result.ok, false)
  assert.match(result.degraded, /unavailable/)
})

test("never uses a shell and only runs the fixed command list", async () => {
  const seen = []
  const probe = createEnvProbe(withBin({
    run: async (command, args, options) => {
      seen.push({ command, args, options })
      return { stdout: "ok", truncated: false }
    },
  }))
  const result = await probe.probe("models")
  assert.equal(result.ok, true)
  assert.ok(seen.length >= 1)
  const allowed = new Set(["free", "nproc", "nvidia-smi", "ollama"])
  const { basename, isAbsolute } = await import("node:path")
  for (const call of seen) {
    assert.ok(isAbsolute(call.command), `command is not an absolute path: ${call.command}`)
    assert.ok(allowed.has(basename(call.command)), `unexpected command: ${call.command}`)
    assert.equal(call.options.shell, false)
    assert.ok(Number.isFinite(call.options.timeout) && call.options.timeout > 0)
  }
  const commands = seen.map((call) => basename(call.command))
  assert.ok(commands.every((command) => command === "ollama"), "models scope must only run ollama")
  for (const entry of result.commands) {
    assert.ok(isAbsolute(entry.path), `entry lacks a pinned absolute path: ${entry.command}`)
  }
})

test("missing binary degrades without executing anything from PATH", async () => {
  let calls = 0
  const probe = createEnvProbe({
    resolveBinary: async () => null,
    run: async () => { calls += 1; return { stdout: "must not run", truncated: false } },
  })
  const result = await probe.probe("machine")
  assert.equal(result.ok, false)
  assert.match(result.degraded, /unavailable/)
  assert.equal(calls, 0, "probe executed a command without a pinned absolute path")
})

test("absolute binary search is confined to fixed system directories", () => {
  assert.ok(Array.isArray(BINARY_SEARCH_DIRS) && BINARY_SEARCH_DIRS.length > 0)
  const { isAbsolute } = { isAbsolute: (p) => p.startsWith("/") }
  for (const dir of BINARY_SEARCH_DIRS) {
    assert.ok(isAbsolute(dir), `search dir is not absolute: ${dir}`)
  }
})

test("rejects non-allowlisted ollama subcommands", async () => {
  const seen = []
  const probe = createEnvProbe(withBin({
    run: async (command, args, options) => {
      seen.push({ command, args })
      return { stdout: "ok", truncated: false }
    },
  }))
  await probe.probe("models")
  const subcommands = seen.map((call) => call.args[0])
  assert.ok(subcommands.includes("list"))
  assert.ok(subcommands.includes("ps"))
  for (const sub of subcommands) {
    assert.ok(["list", "ps"].includes(sub), `unexpected ollama subcommand: ${sub}`)
  }
})

test("truncates oversized command output and notes it", async () => {
  const probe = createEnvProbe(withBin({
    run: async () => ({ stdout: "x".repeat(100_000), truncated: false }),
  }))
  const result = await probe.probe("machine")
  assert.equal(result.ok, true)
  assert.equal(result.truncated, true)
  const bytes = Buffer.byteLength(JSON.stringify(result), "utf8")
  assert.ok(bytes <= ENV_PROBE_LIMITS.maxBytes, `env-probe output ${bytes}B exceeds bound`)
})

test("timeouts degrade instead of throwing fatally", async () => {
  const probe = createEnvProbe(withBin({
    run: async () => { throw Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }) },
  }))
  const result = await probe.probe("machine")
  assert.equal(result.ok, false)
  assert.match(result.degraded, /.+/)
})

test("probe output never contains environment secrets", async () => {
  const probe = createEnvProbe(withBin({
    run: async () => ({ stdout: "model list ok", truncated: false }),
  }))
  const result = await probe.probe("models")
  const text = JSON.stringify(result)
  assert.doesNotMatch(text, /sk-ant-|sk-proj-|ghp_|github_pat_|OPENAI_API_KEY|ANTHROPIC_API_KEY/i)
  assert.ok(!("env" in result))
})
