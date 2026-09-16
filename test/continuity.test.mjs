import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { CONTINUITY_LIMITS, createContinuity } from "../src/continuity.mjs"
import { createRepositoryService } from "../src/repository.mjs"

async function gitRepo() {
  const { execFile } = await import("node:child_process")
  const { promisify } = await import("node:util")
  const run = promisify(execFile)
  const root = await mkdtemp(path.join(tmpdir(), "ksi-continuity-"))
  await run("git", ["init", "--initial-branch=main"], { cwd: root })
  await run("git", ["config", "user.email", "test@example.invalid"], { cwd: root })
  await run("git", ["config", "user.name", "Continuity Test"], { cwd: root })
  await writeFile(path.join(root, "file.txt"), "base\n")
  await run("git", ["add", "."], { cwd: root })
  await run("git", ["commit", "-m", "initial"], { cwd: root })
  return root
}

test("resume accepts known child and rejects wrong parent or role", async () => {
  const root = await gitRepo()
  try {
    const continuity = createContinuity({ worktree: root, repository: createRepositoryService({ worktree: root }) })
    await continuity.noteResult({ parentId: "parent-a", childId: "child-1", target: "developer", state: "completed" })
    assert.deepEqual(await continuity.checkResume({ parentId: "parent-a", target: "developer", taskId: "child-1" }), { ok: true, resumed: true })
    const wrongParent = await continuity.checkResume({ parentId: "parent-b", target: "developer", taskId: "child-1" })
    assert.equal(wrongParent.ok, false)
    assert.match(wrongParent.reason, /different parent/)
    const wrongRole = await continuity.checkResume({ parentId: "parent-a", target: "reviewer", taskId: "child-1" })
    assert.equal(wrongRole.ok, false)
    assert.match(wrongRole.reason, /not reviewer/)
    const unknown = await continuity.checkResume({ parentId: "parent-a", target: "developer", taskId: "missing" })
    assert.equal(unknown.ok, true)
    assert.equal(unknown.unverified, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("first dispatch reconciles with bounded evidence and skips the second", async () => {
  const root = await gitRepo()
  try {
    const continuity = createContinuity({ worktree: root, repository: createRepositoryService({ worktree: root }) })
    const first = await continuity.ensureReconciled({ sessionId: "s1", agent: "build" })
    assert.equal(first.reconciled, true)
    assert.equal(first.fresh, true)
    assert.match(first.summary, /Reconciled session s1/)
    assert.match(first.summary, /HEAD/)
    const marker = JSON.parse(await readFile(path.join(root, ".opencode", "artifacts", "continuity", "reconcile-s1.json"), "utf8"))
    assert.equal(marker.sessionId, "s1")
    const second = await continuity.ensureReconciled({ sessionId: "s1", agent: "build" })
    assert.equal(second.fresh, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("compaction forces renewed reconciliation", async () => {
  const root = await gitRepo()
  try {
    const continuity = createContinuity({ worktree: root, repository: createRepositoryService({ worktree: root }) })
    await continuity.ensureReconciled({ sessionId: "s2", agent: "plan" })
    continuity.markCompacted("s2")
    const renewed = await continuity.ensureReconciled({ sessionId: "s2", agent: "plan" })
    assert.equal(renewed.fresh, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("compaction context points at recovery files without dumping history", async () => {
  const continuity = createContinuity({})
  const context = continuity.compactionContext()
  assert.match(context, /working-state\.md/)
  assert.match(context, /registry\.json/)
  assert.ok(Buffer.byteLength(context, "utf8") < 2048)
})

test("large task output is archived with provenance and a bounded preview", async () => {
  const root = await gitRepo()
  try {
    const continuity = createContinuity({ worktree: root, repository: null })
    const small = await continuity.archiveIfLarge({ sessionId: "s", callId: "c", target: "explore", text: "short" })
    assert.equal(small.truncated, false)
    const big = "x".repeat(CONTINUITY_LIMITS.MAX_OUTPUT_BYTES + 100)
    const archived = await continuity.archiveIfLarge({ sessionId: "s", callId: "c1", target: "research", text: big })
    assert.equal(archived.truncated, true)
    assert.ok(Buffer.byteLength(archived.text, "utf8") <= CONTINUITY_LIMITS.MAX_PREVIEW_BYTES)
    assert.match(archived.pointer, /task-output/)
    const stored = await readFile(archived.pointer, "utf8")
    assert.match(stored, /session: s/)
    assert.match(stored, /role: research/)
    assert.ok(stored.includes(big))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("reconcile degrades without a worktree instead of blocking", async () => {
  const continuity = createContinuity({})
  const result = await continuity.ensureReconciled({ sessionId: "s", agent: "build" })
  assert.equal(result.reconciled, true)
  assert.equal(result.degraded, true)
  const resume = await continuity.checkResume({ parentId: "p", target: "developer", taskId: "x" })
  assert.equal(resume.unverified, true)
})

test("checkpoint larger than the safety bound is refused, not loaded", async () => {
  const root = await gitRepo()
  try {
    await mkdir(path.join(root, ".opencode"), { recursive: true })
    await writeFile(path.join(root, ".opencode", "working-state.md"), "x".repeat(2 * 1024 * 1024))
    const repository = createRepositoryService({ worktree: root })
    const checkpoint = await repository.readCheckpoint()
    assert.equal(checkpoint.exists, false)
    assert.match(checkpoint.reason, /too-large|unreadable/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
