import { homedir } from "node:os"
import { join } from "node:path"
import { createRepositoryService } from "./repository.mjs"
import { createContinuity } from "./continuity.mjs"
import { createEnvProbe } from "./env-probe.mjs"

export const EVIDENCE_TOOL_NAMES = [
  "ksi_repo_status",
  "ksi_repo_diffstat",
  "ksi_checkpoint_read",
  "ksi_reconcile",
  "ksi_env_probe",
  "ksi_audit_summary",
]
export const MAX_TOOL_BYTES = 4096
const MAX_PATHS = 32
const AUDIT_LIMIT = 50

// Native plugin tool helper when resolvable at runtime (OpenCode provides
// `@opencode-ai/plugin` to loaded plugins). The offline source checkout and
// the packed tarball cannot resolve it without adding a dependency, which is
// outside this change, so a vendored identity fallback keeps the same
// `{ description, args, execute }` shape OpenCode 1.18.31 requires.
const nativePlugin = await import("@opencode-ai/plugin").catch(() => null)
const defineTool = typeof nativePlugin?.tool === "function" ? nativePlugin.tool : (input) => input

class Schema {
  constructor(validate) {
    this.validate = validate
    this.isOptional = false
    this.hasDefault = false
    this.defaultValue = undefined
  }
  optional() {
    const next = new Schema(this.validate)
    next.hasDefault = this.hasDefault
    next.defaultValue = this.defaultValue
    next.isOptional = true
    return next
  }
  default(value) {
    const next = new Schema(this.validate)
    next.hasDefault = true
    next.defaultValue = value
    return next
  }
  describe() {
    return this
  }
  safeParse(value) {
    if (value === undefined) {
      if (this.hasDefault) return { success: true, data: this.defaultValue }
      if (this.isOptional) return { success: true, data: undefined }
      return { success: false, error: "value is required" }
    }
    return this.validate(value)
  }
  parse(value) {
    const parsed = this.safeParse(value)
    if (!parsed.success) throw new Error(`invalid args: ${parsed.error}`)
    return parsed.data
  }
}

function fail(error) {
  return { success: false, error }
}

const vendoredZ = {
  string: () => new Schema((value) =>
    typeof value === "string" ? { success: true, data: value } : fail("expected a string"),
  ),
  boolean: () => new Schema((value) =>
    typeof value === "boolean" ? { success: true, data: value } : fail("expected a boolean"),
  ),
  number: () => {
    let integer = false
    let min = null
    let max = null
    const schema = new Schema((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return fail("expected a number")
      if (integer && !Number.isInteger(value)) return fail("expected an integer")
      if (min !== null && value < min) return fail(`expected >= ${min}`)
      if (max !== null && value > max) return fail(`expected <= ${max}`)
      return { success: true, data: value }
    })
    schema.int = () => { integer = true; return schema }
    schema.min = (bound) => { min = bound; return schema }
    schema.max = (bound) => { max = bound; return schema }
    return schema
  },
  enum: (values) => new Schema((value) =>
    values.includes(value)
      ? { success: true, data: value }
      : fail(`invalid scope: expected one of ${values.join(", ")}`),
  ),
  array: (inner) => {
    let min = null
    let max = null
    const schema = new Schema((value) => {
      if (!Array.isArray(value)) return fail("invalid paths: expected an array")
      if (min !== null && value.length < min) return fail(`invalid paths: expected at least ${min}`)
      if (max !== null && value.length > max) return fail(`invalid paths: expected at most ${max}`)
      const data = []
      for (const entry of value) {
        const parsed = inner.safeParse(entry)
        if (!parsed.success) return fail(`invalid paths: ${parsed.error}`)
        data.push(parsed.data)
      }
      return { success: true, data }
    })
    schema.min = (bound) => { min = bound; return schema }
    schema.max = (bound) => { max = bound; return schema }
    return schema
  },
  object: (shape) => new Schema((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail("expected an object")
    const data = {}
    for (const [key, field] of Object.entries(shape)) {
      const parsed = field.safeParse(value[key])
      if (!parsed.success) {
        const label = key === "paths" ? "invalid paths" : `invalid ${key}`
        return fail(`${label}: ${parsed.error}`)
      }
      if (parsed.data !== undefined) data[key] = parsed.data
    }
    return { success: true, data }
  }),
}

const z = nativePlugin?.tool?.schema ?? vendoredZ

function parseArgs(schema, args) {
  const parsed = schema.safeParse(args ?? {})
  if (!parsed.success) throw new Error(`invalid args: ${parsed.error}`)
  return parsed.data
}

function boundText(text) {
  const buffer = Buffer.from(text, "utf8")
  if (buffer.length <= MAX_TOOL_BYTES) return { text, truncated: false }
  return { text: buffer.subarray(0, MAX_TOOL_BYTES).toString("utf8"), truncated: true }
}

function boundPayload(payload) {
  let text = JSON.stringify(payload)
  if (Buffer.byteLength(text, "utf8") <= MAX_TOOL_BYTES) return text
  // Clip the largest string field first, then nested command outputs, then
  // hard-truncate with a note that keeps scope/command identifiers.
  const clippable = ["content", "summary", "output"]
  const working = { ...payload }
  for (const key of clippable) {
    if (typeof working[key] === "string" && Buffer.byteLength(text, "utf8") > MAX_TOOL_BYTES) {
      const room = Math.max(256, MAX_TOOL_BYTES - Buffer.byteLength(JSON.stringify({ ...working, [key]: "" }), "utf8") - 64)
      working[key] = Buffer.from(working[key], "utf8").subarray(0, room).toString("utf8")
      working.truncated = true
      text = JSON.stringify(working)
    }
  }
  if (Array.isArray(working.commands) && Buffer.byteLength(text, "utf8") > MAX_TOOL_BYTES) {
    working.commands = working.commands.map((entry) => {
      if (entry && typeof entry.output === "string" && entry.output.length > 256) {
        return { ...entry, output: entry.output.slice(0, 256), truncated: true }
      }
      return entry
    })
    working.truncated = true
    text = JSON.stringify(working)
  }
  if (Buffer.byteLength(text, "utf8") <= MAX_TOOL_BYTES) return text
  const clipped = boundText(text)
  const fallback = { ok: working.ok ?? false, degraded: working.degraded ?? null, truncated: true, preview: clipped.text }
  // Preserve scope/command identifiers so the preview stays attributable.
  if (typeof payload.scope === "string") fallback.scope = payload.scope
  if (Array.isArray(payload.commands)) {
    fallback.commands = payload.commands
      .map((entry) => entry?.command)
      .filter((command) => typeof command === "string")
  }
  return JSON.stringify(fallback)
}

function validateRelativePaths(paths) {
  for (const raw of paths) {
    if (typeof raw !== "string" || !raw || raw.includes("\0") || raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) {
      throw new Error("each path must be a nonempty relative task path")
    }
    if (raw.startsWith(":")) throw new Error("each path must be a nonempty relative task path")
    const normalized = raw.replace(/\\/g, "/")
    const parts = normalized.split("/")
    if (parts.some((part) => !part || part === "." || part === "..")) {
      throw new Error("each path must be a worktree-relative task path without traversal")
    }
    if (normalized === ".git" || normalized.startsWith(".git/")) {
      throw new Error("each path must be a worktree-relative task path")
    }
  }
  return paths.map((raw) => raw.replace(/\\/g, "/"))
}

function scopeMatch(relativePath, scopes) {
  return scopes.some((scope) => relativePath === scope || relativePath.startsWith(`${scope}/`))
}

function defaultAuditDbPath() {
  return join(homedir(), ".local", "share", "opencode", "opencode.db")
}

/**
 * Six read-only evidence tools for Plan/Build. Every execute path runs
 * in-process with no shell: repository and continuity observations reuse the
 * existing services, env probing runs a fixed execFile allowlist, and the
 * audit summary issues fixed SELECT-only aggregation against a read-only DB
 * handle. Outputs are bounded to MAX_TOOL_BYTES; missing capabilities resolve
 * to an explicit degraded payload and never throw fatally.
 */
export function createEvidenceTools({
  worktree,
  repository,
  continuity,
  envProbe,
  auditDbPath,
} = {}) {
  const repo = repository ?? (typeof worktree === "string" && worktree ? createRepositoryService({ worktree }) : null)
  const cont = continuity ?? createContinuity({ worktree: typeof worktree === "string" ? worktree : null, repository: repo })
  const probe = envProbe ?? createEnvProbe()
  const auditPath = auditDbPath ?? defaultAuditDbPath()

  const statusArgs = z.object({ paths: z.array(z.string()).max(MAX_PATHS).optional() })
  const diffstatArgs = z.object({ paths: z.array(z.string()).min(1).max(MAX_PATHS) })
  const emptyArgs = z.object({})
  const reconcileArgs = z.object({ agent: z.enum(["plan", "build"]).optional() })
  const envArgs = z.object({ scope: z.enum(["machine", "gpu", "models"]).default("machine") })
  const auditArgs = z.object({ scope: z.enum(["roles", "tools"]).default("roles") })

  async function repoStatus() {
    if (!repo) return { supported: false, reason: "not-git-worktree" }
    try {
      return await repo.status()
    } catch {
      return { supported: false, reason: "status-unavailable" }
    }
  }

  const ksi_repo_status = defineTool({
    description: "Bounded repository status: HEAD, staged/unstaged/untracked counts, and a path sample. No file contents.",
    args: statusArgs,
    async execute(args) {
      const { paths } = parseArgs(statusArgs, args)
      const status = await repoStatus()
      if (!status.supported) return boundPayload({ ok: false, degraded: status.reason ?? "not-git-worktree" })
      const scopes = paths?.length ? validateRelativePaths(paths) : null
      const entries = scopes ? status.paths.filter((entry) => scopeMatch(entry.path, scopes)) : status.paths
      const sample = entries.slice(0, 20).map((entry) => ({ index: entry.index, worktree: entry.worktree, path: entry.path }))
      return boundPayload({
        ok: true,
        root: status.root,
        head: status.head,
        summary: status.summary,
        truncated: entries.length > sample.length || Boolean(status.summary?.truncated),
        paths: sample,
      })
    },
  })

  const ksi_repo_diffstat = defineTool({
    description: "Bounded per-path change flags and counts for explicit task paths. Never returns file contents or diffs.",
    args: diffstatArgs,
    async execute(args) {
      const { paths } = parseArgs(diffstatArgs, args)
      const scopes = validateRelativePaths(paths)
      const status = await repoStatus()
      if (!status.supported) return boundPayload({ ok: false, degraded: status.reason ?? "not-git-worktree" })
      const files = []
      for (const entry of status.paths) {
        if (!scopeMatch(entry.path, scopes)) continue
        if (files.length >= 32) break
        files.push({ path: entry.path, index: entry.index, worktree: entry.worktree })
      }
      return boundPayload({
        ok: true,
        paths: scopes,
        files,
        truncated: status.paths.some((entry) => scopeMatch(entry.path, scopes) && !files.some((file) => file.path === entry.path)),
        summary: status.summary,
      })
    },
  })

  const ksi_checkpoint_read = defineTool({
    description: "Bounded read of the existing working-state checkpoint pointer. Reports missing or unsafe checkpoints explicitly.",
    args: emptyArgs,
    async execute(args) {
      parseArgs(emptyArgs, args)
      if (!repo) return boundPayload({ ok: false, degraded: "not-git-worktree" })
      let checkpoint
      try {
        checkpoint = await repo.readCheckpoint()
      } catch {
        return boundPayload({ ok: false, degraded: "unreadable-checkpoint" })
      }
      if (!checkpoint.supported) return boundPayload({ ok: false, degraded: checkpoint.reason ?? "not-git-worktree" })
      if (!checkpoint.exists) return boundPayload({ ok: false, degraded: checkpoint.reason ?? "missing-checkpoint" })
      const clipped = boundText(checkpoint.content ?? "")
      return boundPayload({ ok: true, content: clipped.text, truncated: clipped.truncated || Boolean(checkpoint.truncated) })
    },
  })

  const ksi_reconcile = defineTool({
    description: "Bounded continuity reconcile for the calling session: worktree, HEAD, checkpoint presence, and unfinished task identities.",
    args: reconcileArgs,
    async execute(args, context) {
      const { agent } = parseArgs(reconcileArgs, args)
      const sessionId = context?.sessionID
      if (!sessionId) throw new Error("ksi_reconcile requires session context (sessionID)")
      let reconciled
      try {
        reconciled = await cont.ensureReconciled({ sessionId, agent: agent ?? context?.agent })
      } catch {
        // Continuity FS/JSON failures are evidence outages, not fatal tool
        // errors: report them as an explicit degraded payload.
        return boundPayload({ ok: false, degraded: "reconcile-unavailable" })
      }
      const clipped = boundText(reconciled.summary ?? "")
      return boundPayload({
        ok: true,
        summary: clipped.text,
        truncated: clipped.truncated,
        fresh: Boolean(reconciled.fresh),
        degraded: reconciled.degraded ? "continuity-degraded" : null,
      })
    },
  })

  const ksi_env_probe = defineTool({
    description: "Fixed-command environment probe (free, nproc, nvidia-smi query, ollama list/ps). No shell, no environment reads.",
    args: envArgs,
    async execute(args) {
      const { scope } = parseArgs(envArgs, args)
      const result = await probe.probe(scope)
      return boundPayload(result)
    },
  })

  async function auditSummary(scope) {
    let sqlite
    try {
      sqlite = await import("node:sqlite")
    } catch {
      return { ok: false, degraded: "audit-unavailable: sqlite-unsupported" }
    }
    let db
    try {
      db = new sqlite.DatabaseSync(auditPath, { readOnly: true })
    } catch {
      return { ok: false, degraded: "audit-unavailable: database-missing" }
    }
    try {
      // SELECT-only aggregation. Titles, directories, prompts, token counts,
      // and costs are never selected, so they cannot leak into the output.
      if (scope === "tools") {
        const rows = db.prepare(
          "SELECT json_extract(data,'$.tool') AS tool, COUNT(*) AS calls FROM part WHERE json_extract(data,'$.type')='tool' GROUP BY tool ORDER BY calls DESC LIMIT 50",
        ).all()
        return {
          ok: true,
          scope,
          byTool: rows.map((row) => ({ tool: row.tool ?? "unknown", calls: Number(row.calls) || 0 })).slice(0, AUDIT_LIMIT),
          truncated: rows.length >= AUDIT_LIMIT,
        }
      }
      const rows = db.prepare(
        "SELECT agent, COUNT(*) AS sessions FROM session GROUP BY agent ORDER BY sessions DESC LIMIT 50",
      ).all()
      return {
        ok: true,
        scope,
        byRole: rows.map((row) => ({ role: row.agent ?? "unknown", sessions: Number(row.sessions) || 0 })).slice(0, AUDIT_LIMIT),
        truncated: rows.length >= AUDIT_LIMIT,
      }
    } catch {
      return { ok: false, degraded: "audit-unavailable: query-failed" }
    } finally {
      try {
        db.close()
      } catch {
        // Read-only handle cleanup is best-effort.
      }
    }
  }

  const ksi_audit_summary = defineTool({
    description: "Role/tool call counts aggregated SELECT-only from the local OpenCode DB. Never returns titles, prompts, or costs.",
    args: auditArgs,
    async execute(args) {
      const { scope } = parseArgs(auditArgs, args)
      return boundPayload(await auditSummary(scope))
    },
  })

  return { ksi_repo_status, ksi_repo_diffstat, ksi_checkpoint_read, ksi_reconcile, ksi_env_probe, ksi_audit_summary }
}
