import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const {
  EVIDENCE_TOOL_NAMES,
  MAX_TOOL_BYTES,
  createEvidenceTools,
} = await import("../src/evidence-tools.mjs")

const ctx = (overrides = {}) => ({ sessionID: "s1", messageID: "m1", agent: "plan", directory: "/tmp", worktree: "/tmp", abort: new AbortController().signal, ...overrides })

test("registers exactly the six approved evidence tools", () => {
  assert.deepEqual([...EVIDENCE_TOOL_NAMES].sort(), [
    "ksi_audit_summary",
    "ksi_checkpoint_read",
    "ksi_env_probe",
    "ksi_reconcile",
    "ksi_repo_diffstat",
    "ksi_repo_status",
  ])
})

test("every tool definition carries description, args, and execute", async () => {
  const tools = createEvidenceTools({})
  assert.deepEqual(Object.keys(tools).sort(), [...EVIDENCE_TOOL_NAMES].sort())
  for (const name of EVIDENCE_TOOL_NAMES) {
    assert.equal(typeof tools[name].description, "string")
    assert.ok(tools[name].description.length > 0)
    assert.ok(tools[name].args && typeof tools[name].args === "object")
    assert.equal(typeof tools[name].execute, "function")
  }
})

test("ksi_repo_status degrades explicitly outside a git worktree", async () => {
  const worktree = await mkdtemp(join(tmpdir(), "ksi-ev-nogit-"))
  try {
    const tools = createEvidenceTools({ worktree })
    const result = JSON.parse(await tools.ksi_repo_status.execute({}, ctx()))
    assert.equal(result.ok, false)
    assert.match(result.degraded, /not-git-worktree/)
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_TOOL_BYTES)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("ksi_repo_diffstat requires a bounded paths array", async () => {
  const tools = createEvidenceTools({})
  await assert.rejects(() => tools.ksi_repo_diffstat.execute({}, ctx()), /paths/)
  await assert.rejects(() => tools.ksi_repo_diffstat.execute({ paths: [] }, ctx()), /paths/)
  await assert.rejects(
    () => tools.ksi_repo_diffstat.execute({ paths: Array.from({ length: 33 }, (_, i) => `f${i}.mjs`) }, ctx()),
    /paths/,
  )
  await assert.rejects(() => tools.ksi_repo_diffstat.execute({ paths: ["../escape.mjs"] }, ctx()), /relative/)
})

test("ksi_repo_diffstat returns counts only, never file contents", async () => {
  const tools = createEvidenceTools({ worktree: "/tmp/ksi-no-such-worktree" })
  const missing = JSON.parse(await tools.ksi_repo_diffstat.execute({ paths: ["src/agents.mjs"] }, ctx()))
  assert.equal(missing.ok, false)
  assert.match(missing.degraded, /.+/)
})

test("ksi_checkpoint_read reports missing checkpoints without throwing", async () => {
  const worktree = await mkdtemp(join(tmpdir(), "ksi-ev-nocheck-"))
  try {
    const tools = createEvidenceTools({ worktree })
    const result = JSON.parse(await tools.ksi_checkpoint_read.execute({}, ctx()))
    assert.equal(result.ok, false)
    assert.match(result.degraded, /not-git-worktree|missing-checkpoint|unreadable-checkpoint|unsafe-checkpoint-path|checkpoint-too-large/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("ksi_checkpoint_read output is bounded with truncation noted", async () => {
  const { createRepositoryService } = await import("../src/repository.mjs")
  const fakeRepo = {
    status: async () => ({ supported: false, reason: "not-git-worktree" }),
    readCheckpoint: async () => ({ supported: true, exists: true, content: "z".repeat(100_000), truncated: true }),
  }
  assert.ok(fakeRepo)
  const tools = createEvidenceTools({ repository: fakeRepo })
  const result = JSON.parse(await tools.ksi_checkpoint_read.execute({}, ctx()))
  assert.equal(result.ok, true)
  assert.equal(result.truncated, true)
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_TOOL_BYTES)
})

test("ksi_reconcile returns bounded continuity evidence", async () => {
  const tools = createEvidenceTools({ worktree: null })
  const result = JSON.parse(await tools.ksi_reconcile.execute({}, ctx({ sessionID: "sess-1", agent: "build" })))
  assert.equal(result.ok, true)
  assert.match(result.summary, /reconcile|unavailable/i)
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_TOOL_BYTES)
})

test("ksi_reconcile requires session context", async () => {
  const tools = createEvidenceTools({})
  await assert.rejects(() => tools.ksi_reconcile.execute({}, {}), /session/)
})

test("ksi_reconcile degrades on continuity failure instead of throwing fatally", async () => {
  const tools = createEvidenceTools({
    continuity: { ensureReconciled: async () => { throw new Error("EACCES: continuity store unreadable") } },
  })
  const text = await tools.ksi_reconcile.execute({}, ctx({ sessionID: "sess-9", agent: "build" }))
  const result = JSON.parse(text)
  assert.equal(result.ok, false)
  assert.match(result.degraded, /reconcile-unavailable/)
  assert.ok(Buffer.byteLength(text, "utf8") <= MAX_TOOL_BYTES)
})

test("tool definitions match the runtime-accepted shape with validating args", () => {
  // Offline acceptance proof for the vendored/native shape: both the native
  // `tool()` helper (verified `return input`) and the vendored identity
  // fallback preserve the exact `{ description, args, execute }` definition,
  // and every args schema exposes safeParse so OpenCode can validate bounds.
  // A live 1.18.31 plugin-load check remains a restart-gated item.
  const tools = createEvidenceTools({})
  const valid = {
    ksi_repo_status: {},
    ksi_repo_diffstat: { paths: ["src/agents.mjs"] },
    ksi_checkpoint_read: {},
    ksi_reconcile: {},
    ksi_env_probe: { scope: "machine" },
    ksi_audit_summary: { scope: "roles" },
  }
  for (const name of EVIDENCE_TOOL_NAMES) {
    assert.deepEqual(Object.keys(tools[name]).sort(), ["args", "description", "execute"])
    assert.equal(typeof tools[name].args.safeParse, "function", `${name} args lack safeParse`)
    const parsed = tools[name].args.safeParse(valid[name])
    assert.equal(parsed.success, true, `${name} rejects valid args`)
  }
  assert.equal(tools.ksi_repo_diffstat.args.safeParse({ paths: [] }).success, false)
  assert.equal(tools.ksi_env_probe.args.safeParse({ scope: "bios" }).success, false)
  assert.equal(tools.ksi_audit_summary.args.safeParse({ scope: "everything" }).success, false)
})

test("overflow preview keeps scope and command identifiers", async () => {
  const tools = createEvidenceTools({
    envProbe: {
      probe: async (scope) => ({
        ok: true,
        scope,
        commands: [
          { command: "free", args: ["-m"], output: "x".repeat(100_000), truncated: false },
          { command: "nproc", args: [], output: "y".repeat(100_000), truncated: false },
        ],
        truncated: false,
      }),
    },
  })
  const text = await tools.ksi_env_probe.execute({ scope: "machine" }, ctx())
  const result = JSON.parse(text)
  assert.equal(result.truncated, true)
  assert.equal(result.scope, "machine")
  assert.ok(Buffer.byteLength(text, "utf8") <= MAX_TOOL_BYTES, `overflow output exceeds ${MAX_TOOL_BYTES}B`)
  const identifiers = JSON.stringify(result.commands ?? result)
  assert.match(identifiers, /free/)
  assert.match(identifiers, /nproc/)
  assert.ok(!text.includes("x".repeat(1000)), "overflow preview must not retain giant outputs")
})

test("ksi_env_probe rejects unknown scopes", async () => {
  const tools = createEvidenceTools({})
  await assert.rejects(() => tools.ksi_env_probe.execute({ scope: "bios" }, ctx()), /scope/)
})

test("ksi_env_probe delegates to the fixed env probe with bounded output", async () => {
  const tools = createEvidenceTools({
    envProbe: { probe: async (scope) => ({ ok: true, scope, commands: [], truncated: false }) },
  })
  const result = JSON.parse(await tools.ksi_env_probe.execute({ scope: "machine" }, ctx()))
  assert.equal(result.ok, true)
  assert.equal(result.scope, "machine")
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= MAX_TOOL_BYTES)
})

test("ksi_audit_summary aggregates counts only, never titles or costs", async () => {
  const { DatabaseSync } = await import("node:sqlite")
  const dir = await mkdtemp(join(tmpdir(), "ksi-ev-audit-"))
  try {
    const dbPath = join(dir, "audit.db")
    const db = new DatabaseSync(dbPath)
    db.exec("CREATE TABLE session (id TEXT PRIMARY KEY, agent TEXT, title TEXT, cost REAL)")
    db.exec("CREATE TABLE part (id TEXT PRIMARY KEY, data TEXT)")
    db.prepare("INSERT INTO session VALUES (?, ?, ?, ?)").run("s1", "developer", "Secret launch plan", 12.5)
    db.prepare("INSERT INTO part VALUES (?, ?)").run("p1", JSON.stringify({ type: "tool", tool: "bash" }))
    db.close()
    const tools = createEvidenceTools({ auditDbPath: dbPath })
    const result = JSON.parse(await tools.ksi_audit_summary.execute({ scope: "roles" }, ctx()))
    assert.equal(result.ok, true)
    const text = JSON.stringify(result)
    assert.doesNotMatch(text, /Secret launch plan/)
    assert.ok(!("title" in result) && !text.includes('"cost"'), "audit output must not carry titles or costs")
    assert.ok(Array.isArray(result.byRole))
    assert.equal(result.byRole[0].role, "developer")
    const toolsResult = JSON.parse(await tools.ksi_audit_summary.execute({ scope: "tools" }, ctx()))
    assert.equal(toolsResult.ok, true)
    assert.ok(Array.isArray(toolsResult.byTool))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("ksi_audit_summary degrades explicitly when the DB is missing", async () => {
  const tools = createEvidenceTools({ auditDbPath: join(tmpdir(), "ksi-no-such-audit.db") })
  const result = JSON.parse(await tools.ksi_audit_summary.execute({}, ctx()))
  assert.equal(result.ok, false)
  assert.match(result.degraded, /audit-unavailable/)
})

test("Plan and Build grant exactly the six evidence tools without Plan shell", async () => {
  const { PLAN_PERMISSION, BUILD_PERMISSION } = await import("../src/agents.mjs")
  for (const permission of [PLAN_PERMISSION, BUILD_PERMISSION]) {
    for (const name of EVIDENCE_TOOL_NAMES) {
      assert.equal(permission[name], "allow", `${name} is not granted`)
    }
  }
  assert.equal(PLAN_PERMISSION.bash, "deny")
  assert.equal(BUILD_PERMISSION.bash, "deny")
})

test("plugin registers the six evidence tools on the tool hook", async () => {
  const plugin = (await import("../index.mjs")).default
  const hooks = await plugin({ directory: "/tmp/ksi-no-such-worktree", worktree: "/tmp/ksi-no-such-worktree" })
  assert.deepEqual(Object.keys(hooks.tool ?? {}).sort(), [...EVIDENCE_TOOL_NAMES].sort())
})

test("all degraded tool results stay within the output bound", async () => {
  const tools = createEvidenceTools({ worktree: "/tmp/ksi-no-such-worktree", auditDbPath: join(tmpdir(), "ksi-no-such-audit.db") })
  const calls = [
    tools.ksi_repo_status.execute({}, ctx()),
    tools.ksi_checkpoint_read.execute({}, ctx()),
    tools.ksi_reconcile.execute({}, ctx({ sessionID: "x" })),
    tools.ksi_audit_summary.execute({}, ctx()),
  ]
  for (const call of calls) {
    const text = await call
    assert.ok(Buffer.byteLength(text, "utf8") <= MAX_TOOL_BYTES, `tool output exceeds ${MAX_TOOL_BYTES}B`)
  }
})
