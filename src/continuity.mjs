import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const REGISTRY_VERSION = 1
const MAX_REGISTRY_TASKS = 200
const MAX_OUTPUT_BYTES = 8 * 1024
const MAX_PREVIEW_BYTES = 2000
const MAX_SUMMARY_STATUS_PATHS = 10

function sanitizeId(value, fallback) {
  if (typeof value !== "string" || !value) return fallback
  const cleaned = value.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 64)
  return cleaned || fallback
}

function truncateBytes(text, limit) {
  const buffer = Buffer.from(text, "utf8")
  if (buffer.length <= limit) return { text, truncated: false }
  return { text: buffer.subarray(0, limit).toString("utf8"), truncated: true }
}

/**
 * Bounded execution continuity for one worktree: task-identity registry,
 * reconcile-before-dispatch evidence, compaction pointers, and large-output
 * archiving. Native lifecycle records are recovery evidence, never a second
 * plan. All persistence lives under `.opencode/artifacts/` and never
 * contains prompts, tool payloads, or credentials.
 */
export function createContinuity({ worktree, repository } = {}) {
  const root = typeof worktree === "string" && worktree ? worktree : null
  const reconciled = new Set()

  const continuityDir = () => path.join(root, ".opencode", "artifacts", "continuity")
  const outputDir = () => path.join(root, ".opencode", "artifacts", "task-output")
  const registryPath = () => path.join(continuityDir(), "registry.json")
  const markerPath = (sessionId) => path.join(continuityDir(), `reconcile-${sanitizeId(sessionId, "session")}.json`)

  async function loadRegistry() {
    try {
      const raw = await readFile(registryPath(), "utf8")
      const data = JSON.parse(raw)
      if (data && data.version === REGISTRY_VERSION && data.tasks && typeof data.tasks === "object") return data
    } catch {
      // Missing or corrupt registry is treated as empty, never fatal.
    }
    return { version: REGISTRY_VERSION, tasks: {} }
  }

  async function saveRegistry(registry) {
    const entries = Object.entries(registry.tasks ?? {})
    const pruned = Object.fromEntries(entries.slice(-MAX_REGISTRY_TASKS))
    await mkdir(continuityDir(), { recursive: true })
    await writeFile(registryPath(), `${JSON.stringify({ version: REGISTRY_VERSION, tasks: pruned }, null, 2)}\n`, "utf8")
  }

  async function noteDispatch({ parentId, target } = {}) {
    if (!root || !parentId || !target) return { recorded: false }
    try {
      const registry = await loadRegistry()
      const key = `pending:${parentId}:${target}:${Date.now()}`
      registry.tasks[key] = { parent: parentId, target, state: "dispatched", updated: new Date().toISOString() }
      await saveRegistry(registry)
      return { recorded: true }
    } catch {
      return { recorded: false }
    }
  }

  async function noteResult({ parentId, childId, target, fingerprint, state } = {}) {
    if (!root || !childId) return { recorded: false }
    try {
      const registry = await loadRegistry()
      registry.tasks[childId] = {
        parent: parentId ?? null,
        target: target ?? null,
        fingerprint: fingerprint ?? null,
        state: state ?? "completed",
        updated: new Date().toISOString(),
      }
      await saveRegistry(registry)
      return { recorded: true }
    } catch {
      return { recorded: false }
    }
  }

  async function checkResume({ parentId, target, taskId } = {}) {
    if (!taskId) return { ok: true, resumed: false }
    if (!root) return { ok: true, resumed: true, unverified: true, note: "continuity store unavailable; resume is unverified" }
    const registry = await loadRegistry()
    const entry = registry.tasks[taskId]
    if (!entry) return { ok: true, resumed: true, unverified: true, note: "unknown task identity; repair evidence is required by the task contract" }
    if (entry.parent && parentId && entry.parent !== parentId) {
      return { ok: false, reason: `task identity belongs to a different parent session (${entry.parent}); refusing silent resume` }
    }
    if (entry.target && target && entry.target !== target) {
      return { ok: false, reason: `task identity was recorded for role ${entry.target}, not ${target}; refusing silent resume` }
    }
    return { ok: true, resumed: true }
  }

  async function ensureReconciled({ sessionId, agent } = {}) {
    if (!sessionId) return { reconciled: false, reason: "missing-session" }
    if (reconciled.has(sessionId)) return { reconciled: true, fresh: false }
    if (!root || !repository) {
      reconciled.add(sessionId)
      return { reconciled: true, fresh: true, degraded: true, summary: "Continuity store unavailable; verify worktree, HEAD, and plan ledger manually before dispatch." }
    }
    let status = null
    let checkpoint = null
    try {
      status = await repository.status()
    } catch {
      status = null
    }
    try {
      checkpoint = await repository.readCheckpoint()
    } catch {
      checkpoint = null
    }
    const registry = await loadRegistry()
    const unfinished = Object.entries(registry.tasks)
      .filter(([, entry]) => entry && (entry.state === "dispatched" || entry.state === "running"))
      .slice(-10)
      .map(([id, entry]) => `${id} (${entry.target ?? "unknown"}, ${entry.state})`)
    const lines = [
      `Reconciled session ${sessionId} (${agent ?? "unknown"}) against repository evidence.`,
      status?.supported
        ? `HEAD ${status.head?.unborn ? "unborn" : status.head?.oid ?? "unknown"}; clean=${status.summary?.clean ?? "unknown"}; staged=${status.summary?.staged ?? 0} unstaged=${status.summary?.unstaged ?? 0} untracked=${status.summary?.untracked ?? 0}.`
        : "Repository status unavailable; confirm worktree and HEAD manually.",
      ...(status?.supported && Array.isArray(status.paths) && status.paths.length
        ? [`Dirty sample: ${status.paths.slice(0, MAX_SUMMARY_STATUS_PATHS).map((entry) => entry.path).join(", ")}${status.paths.length > MAX_SUMMARY_STATUS_PATHS ? ", ..." : ""}`]
        : []),
      checkpoint?.exists ? "Checkpoint present; its content is the resume pointer, the plan ledger owns task state." : "Checkpoint missing or unreadable; re-establish plan, ownership, and next actions before dispatch.",
      unfinished.length ? `Unfinished registry entries (verify, do not assume): ${unfinished.join("; ")}` : "No unfinished registry entries.",
    ]
    const summary = lines.join("\n")
    try {
      await mkdir(continuityDir(), { recursive: true })
      await writeFile(markerPath(sessionId), `${JSON.stringify({ sessionId, agent: agent ?? null, at: new Date().toISOString(), head: status?.head ?? null }, null, 2)}\n`, "utf8")
    } catch {
      // Marker is an audit trail; reconciliation stands without it.
    }
    reconciled.add(sessionId)
    return { reconciled: true, fresh: true, summary }
  }

  function markCompacted(sessionId) {
    if (sessionId) {
      reconciled.delete(sessionId)
      return { cleared: sessionId }
    }
    reconciled.clear()
    return { cleared: "all" }
  }

  function forgetSession(sessionId) {
    if (sessionId) reconciled.delete(sessionId)
  }

  function compactionContext() {
    return [
      "Continuity pointers (read these before dispatching new work):",
      "- .opencode/working-state.md — resume pointer; plan ledger owns task state.",
      "- docs/superpowers/product-state.md — product SSOT: Goal, milestones, current slice+acceptance; update only at slice close.",
      "- .opencode/artifacts/continuity/registry.json — child task identity and terminal states.",
      "- Rule: reconcile worktree, HEAD, completed evidence, live child sessions, and post-verification drift before the first dispatch after start, restart, or compaction. Unknown identity blocks; never silently restart work.",
    ].join("\n")
  }

  async function archiveIfLarge({ sessionId, callId, target, text } = {}) {
    if (typeof text !== "string") return { truncated: false, text }
    if (Buffer.byteLength(text, "utf8") <= MAX_OUTPUT_BYTES) return { truncated: false, text }
    const preview = truncateBytes(text, MAX_PREVIEW_BYTES)
    if (!root) return { truncated: true, text: preview.text, pointer: null, storeFailed: true }
    const filename = `${sanitizeId(sessionId, "session")}-${sanitizeId(callId, "call")}.md`
    const filePath = path.join(outputDir(), filename)
    const body = [
      `# Task output artifact`,
      `- session: ${sessionId ?? "unknown"}`,
      `- call: ${callId ?? "unknown"}`,
      `- role: ${target ?? "unknown"}`,
      `- bytes: ${Buffer.byteLength(text, "utf8")}`,
      `- at: ${new Date().toISOString()}`,
      ``,
      text,
      ``,
    ].join("\n")
    try {
      await mkdir(outputDir(), { recursive: true })
      await writeFile(filePath, body, "utf8")
      return { truncated: true, text: preview.text, pointer: filePath }
    } catch {
      return { truncated: true, text: preview.text, pointer: null, storeFailed: true }
    }
  }

  return { noteDispatch, noteResult, checkResume, ensureReconciled, markCompacted, forgetSession, compactionContext, archiveIfLarge }
}

export const CONTINUITY_LIMITS = { MAX_OUTPUT_BYTES, MAX_PREVIEW_BYTES, MAX_REGISTRY_TASKS }
