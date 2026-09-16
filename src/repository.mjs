import { execFile as execFileCallback } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { chmod, lstat, mkdir, open, opendir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

const execFile = promisify(execFileCallback)
const MAX_STATUS_PATHS = 256
const MAX_STATUS_BYTES = 512 * 1024
const MAX_SCOPE_PATHS = 32
const MAX_FILES = 256
const MAX_FILE_BYTES = 256 * 1024
const MAX_TOTAL_BYTES = 8 * 1024 * 1024
const MAX_DIFF_BYTES = 512 * 1024
const MAX_CHECKPOINT_BYTES = 64 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GIT_ENV = {
  PATH: process.env.PATH || "",
  LC_ALL: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  GIT_TERMINAL_PROMPT: "0",
}
const GIT_PREFIX = [
  "--no-pager",
  "-c", "core.fsmonitor=false",
  "-c", "core.useBuiltinFSMonitor=false",
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.pager=cat",
  "-c", "diff.external=",
  "--literal-pathspecs",
]

function digest(value) {
  return createHash("sha256").update(value).digest("hex")
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function unsupported() {
  return { supported: false, reason: "not-git-worktree" }
}

function failure(message, code = "KSI_REPOSITORY") {
  const error = new Error(`Repository evidence rejected: ${message}`)
  error.code = code
  return error
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`)
}

function isSensitive(relativePath) {
  const name = path.posix.basename(relativePath).toLowerCase()
  if (name.startsWith(".env") && !name.includes("example") && !name.includes("sample")) return true
  return /(?:^|[._-])(auth|credential|credentials|secret|private)(?:[._-]|$)|^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)(?:[._-]|$)|\.(?:pem|key|p12|pfx)$/i.test(name)
}

function binary(contents) {
  return contents.includes(0)
}

function parseNullList(output) {
  return output.split("\0").filter(Boolean)
}

function parseStatus(output) {
  const tokens = parseNullList(output)
  const entries = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.length < 4) continue
    const entry = { index: token[0], worktree: token[1], path: token.slice(3) }
    if (entry.index === "R" || entry.index === "C" || entry.worktree === "R" || entry.worktree === "C") {
      entry.originalPath = tokens[index + 1] || null
      index += 1
    }
    entries.push(entry)
  }
  return entries
}

function statusSummary(entries, truncated = false) {
  const summary = { staged: 0, unstaged: 0, untracked: 0, total: entries.length, truncated }
  for (const entry of entries) {
    if (entry.index === "?" && entry.worktree === "?") summary.untracked += 1
    else {
      if (entry.index !== " ") summary.staged += 1
      if (entry.worktree !== " ") summary.unstaged += 1
    }
  }
  summary.clean = summary.staged === 0 && summary.unstaged === 0 && summary.untracked === 0 && !truncated
  return summary
}

function isScopeMatch(relativePath, scopes) {
  return scopes.some((scope) => relativePath === scope.path || (scope.directory && relativePath.startsWith(`${scope.path}/`)))
}

/**
 * @typedef {{ oid: string | null, unborn: boolean }} RepositoryHead
 * @typedef {{ staged: number, unstaged: number, untracked: number, total: number, clean: boolean, truncated: boolean }} StatusSummary
 * @typedef {{ supported: true, root: string, head: RepositoryHead, summary: StatusSummary, paths: Array<{ index: string, worktree: string, path: string, originalPath?: string | null }> } | { supported: false, reason: "not-git-worktree" }} RepositoryStatus
 * @typedef {{ complete: boolean, included: string[], excluded: Array<{ path: string, reason: string, bytes?: number }>, limits: { maxFiles: number, maxFileBytes: number, maxDiffBytes: number }, statusTruncated: boolean }} SnapshotCoverage
 * @typedef {{ identifier: string, manifestPath: string, diffPath: string, fingerprint: string, coverage: SnapshotCoverage }} RepositorySnapshot
 *
 * Creates a fixed-command, read-observation service for one Git worktree.
 * `status()` resolves to {@link RepositoryStatus}. `snapshot({ paths })`
 * accepts explicit worktree-relative files/directories and resolves to a
 * {@link RepositorySnapshot}; its generated artifacts are immutable
 * service-owned files. `verify({ snapshot })` resolves to `{ valid: boolean,
 * changed: Array<{path: string, reason?: string}>, unknown: Array<object> }`
 * and never restores content. `readCheckpoint()` resolves to bounded existing
 * content or an explicit missing/unsafe/unsupported result.
 */
export function createRepositoryService({ worktree } = {}) {
  if (typeof worktree !== "string" || !worktree.trim()) throw failure("worktree must be a nonempty path")
  const requestedWorktree = path.resolve(worktree)
  let repositoryPromise

  async function runGit(cwd, args, maxBuffer = MAX_STATUS_BYTES) {
    return execFile("git", [...GIT_PREFIX, ...args], {
      cwd,
      env: GIT_ENV,
      encoding: "utf8",
      maxBuffer,
      shell: false,
      windowsHide: true,
    })
  }

  async function repository() {
    if (!repositoryPromise) {
      repositoryPromise = (async () => {
        let start
        try {
          start = await realpath(requestedWorktree)
        } catch {
          return null
        }
        try {
          const { stdout } = await runGit(start, ["rev-parse", "--show-toplevel"])
          const root = await realpath(stdout.trim())
          // Always run scoped Git observation from the repository root so
          // root-relative task paths resolve identically when the native
          // worktree directory is a subdirectory of the repo.
          return { cwd: root, root }
        } catch {
          return null
        }
      })()
    }
    return repositoryPromise
  }

  async function headFor(repo) {
    try {
      const { stdout } = await runGit(repo.cwd, ["rev-parse", "--verify", "--quiet", "HEAD"])
      return { oid: stdout.trim(), unborn: false }
    } catch {
      return { oid: null, unborn: true }
    }
  }

  async function statusEntries(repo) {
    try {
      const { stdout } = await runGit(repo.cwd, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
      const entries = parseStatus(stdout)
      return { entries: entries.slice(0, MAX_STATUS_PATHS), truncated: entries.length > MAX_STATUS_PATHS }
    } catch {
      return { entries: [], truncated: true, unavailable: true }
    }
  }

  async function validateScopes(root, rawPaths) {
    if (!Array.isArray(rawPaths) || rawPaths.length === 0 || rawPaths.length > MAX_SCOPE_PATHS) {
      throw failure(`paths must contain between 1 and ${MAX_SCOPE_PATHS} explicit relative task paths`)
    }
    const seen = new Set()
    const scopes = []
    for (const raw of rawPaths) {
      if (typeof raw !== "string" || !raw || raw.includes("\0") || path.isAbsolute(raw) || path.win32.isAbsolute(raw)) {
        throw failure("each path must be a nonempty relative task path")
      }
      if (raw.startsWith(":")) throw failure("pathspec magic is not permitted")
      const normalized = raw.replace(/\\/g, "/").replace(/\/$/, "") || "."
      const parts = normalized.split("/")
      if (parts.some((part) => !part || part === "." || part === "..")) throw failure("relative task paths cannot traverse directories")
      if (normalized === ".git" || normalized.startsWith(".git/")) throw failure("Git metadata is not a task path")
      const absolute = path.resolve(root, normalized)
      if (!isInside(root, absolute)) throw failure("relative task paths cannot traverse directories")
      if (seen.has(normalized)) continue
      seen.add(normalized)

      let cursor = root
      let stats = null
      for (let index = 0; index < parts.length; index += 1) {
        cursor = path.join(cursor, parts[index])
        try {
          stats = await lstat(cursor)
        } catch (error) {
          if (error?.code === "ENOENT") {
            stats = null
            break
          }
          throw failure(`cannot inspect task path ${normalized}`)
        }
        if (stats.isSymbolicLink()) throw failure(`task path contains a symlink: ${normalized}`)
        if (index < parts.length - 1 && !stats.isDirectory()) throw failure(`task path parent is not a directory: ${normalized}`)
      }
      scopes.push({ path: normalized, directory: Boolean(stats?.isDirectory()) })
    }
    return scopes
  }

  async function scanDirectory(root, scope) {
    const files = new Map()
    let limitHit = false
    async function visit(relativePath) {
      if (files.size >= MAX_FILES) {
        limitHit = true
        return
      }
      const absolute = path.join(root, relativePath)
      let entries
      try {
        const directory = await opendir(absolute)
        entries = []
        for await (const entry of directory) entries.push(entry)
      } catch {
        return
      }
      for (const entry of entries) {
        if (files.size >= MAX_FILES) {
          limitHit = true
          break
        }
        const child = relativePath ? `${relativePath}/${entry.name}` : entry.name
        if (child === ".git" || child.startsWith(".git/")) continue
        if (child === ".opencode/artifacts/repository" || child.startsWith(".opencode/artifacts/repository/")) continue
        const absoluteChild = path.join(root, child)
        let stats
        try {
          stats = await lstat(absoluteChild)
        } catch {
          continue
        }
        if (stats.isDirectory() && !stats.isSymbolicLink()) await visit(child)
        else files.set(child, stats)
      }
    }
    await visit(scope.path)
    return { files, limitHit }
  }

  async function trackedPaths(repo, scopes) {
    const { stdout } = await runGit(repo.cwd, ["ls-files", "-z", "--cached", "--", ...scopes.map((scope) => scope.path)])
    return new Set(parseNullList(stdout))
  }

  async function indexEntries(repo, relativePath) {
    const { stdout } = await runGit(repo.cwd, ["ls-files", "-s", "-z", "--", relativePath])
    return parseNullList(stdout).map((entry) => {
      const match = /^(\d+) ([0-9a-f]{40,64}) (\d+)\t/.exec(entry)
      return match ? { mode: match[1], oid: match[2], stage: Number(match[3]) } : { malformed: true }
    })
  }

  async function currentFile(root, relativePath) {
    const absolute = path.join(root, relativePath)
    try {
      const stats = await lstat(absolute)
      if (stats.isSymbolicLink()) return { kind: "symlink" }
      if (!stats.isFile()) return { kind: "other" }
      if (stats.size > MAX_FILE_BYTES) return { kind: "oversized", bytes: stats.size }
      const contents = await readFile(absolute)
      if (binary(contents)) return { kind: "binary", bytes: contents.length }
      return { kind: "text", bytes: contents.length, hash: digest(contents), contents }
    } catch (error) {
      if (error?.code === "ENOENT") return { kind: "missing" }
      return { kind: "unreadable" }
    }
  }

  async function deletedIsBinary(repo, relativePath, head) {
    if (head.unborn) return false
    try {
      const { stdout } = await runGit(repo.cwd, ["diff", "--no-ext-diff", "--no-textconv", "--numstat", "HEAD", "--", relativePath])
      return stdout.split("\n").some((line) => line.startsWith("-\t-\t"))
    } catch {
      return true
    }
  }

  async function observe(repo, scopes) {
    const [head, status] = await Promise.all([headFor(repo), statusEntries(repo)])
    const tracked = await trackedPaths(repo, scopes)
    const untracked = new Set(status.entries.filter((entry) => entry.index === "?" && entry.worktree === "?").map((entry) => entry.path))
    const candidates = new Map()
    for (const trackedPath of tracked) candidates.set(trackedPath, null)
    // Include every status entry matching the scope so staged deletions and
    // renames are never silently omitted when the file is absent from both
    // the index listing and the worktree scan.
    for (const entry of status.entries) {
      if (entry.path && isScopeMatch(entry.path, scopes) && !candidates.has(entry.path)) candidates.set(entry.path, null)
      if (entry.originalPath && isScopeMatch(entry.originalPath, scopes) && !candidates.has(entry.originalPath)) {
        candidates.set(entry.originalPath, null)
      }
    }
    let limitHit = false
    for (const scope of scopes) {
      if (scope.directory) {
        const scanned = await scanDirectory(repo.root, scope)
        limitHit ||= scanned.limitHit
        for (const [relativePath, stats] of scanned.files) candidates.set(relativePath, stats)
      } else if (!candidates.has(scope.path)) {
        candidates.set(scope.path, null)
      }
    }

    const files = []
    const excluded = []
    let totalBytes = 0
    for (const relativePath of [...candidates.keys()].sort()) {
      if (!isScopeMatch(relativePath, scopes)) continue
      const trackedFile = tracked.has(relativePath)
      const untrackedFile = untracked.has(relativePath)
      const statusMatch = status.entries.some((entry) => entry.path === relativePath || entry.originalPath === relativePath)
      if (!trackedFile && !untrackedFile && !statusMatch) continue
      if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) {
        limitHit = true
        break
      }
      if (isSensitive(relativePath)) {
        excluded.push({ path: relativePath, reason: "sensitive" })
        continue
      }
      const current = await currentFile(repo.root, relativePath)
      if (current.kind === "symlink") {
        excluded.push({ path: relativePath, reason: "symlink" })
        continue
      }
      if (current.kind === "other" || current.kind === "unreadable") {
        excluded.push({ path: relativePath, reason: current.kind })
        continue
      }
      if (current.kind === "oversized") {
        excluded.push({ path: relativePath, reason: "oversized", bytes: current.bytes })
        continue
      }
      if (current.kind === "binary" || (current.kind === "missing" && await deletedIsBinary(repo, relativePath, head))) {
        excluded.push({ path: relativePath, reason: "binary" })
        continue
      }
      const index = await indexEntries(repo, relativePath)
      if (current.kind === "text") {
        if (totalBytes + current.bytes > MAX_TOTAL_BYTES) {
          limitHit = true
          excluded.push({ path: relativePath, reason: "file-limit", bytes: current.bytes })
          break
        }
        totalBytes += current.bytes
      }
      files.push({
        path: relativePath,
        tracked: trackedFile,
        untracked: untrackedFile,
        index,
        worktree: current.kind === "missing"
          ? { exists: false }
          : { exists: true, bytes: current.bytes, hash: current.hash },
        contents: current.kind === "text" ? current.contents : null,
      })
    }
    if (limitHit) excluded.push({ path: "*", reason: "file-limit" })
    const coverage = {
      complete: excluded.length === 0 && !status.truncated,
      included: files.map((file) => file.path),
      excluded,
      limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES, maxTotalBytes: MAX_TOTAL_BYTES, maxDiffBytes: MAX_DIFF_BYTES },
      statusTruncated: Boolean(status.truncated),
    }
    return { head, status, files, coverage }
  }

  async function safeArtifactRoot(root, create) {
    const parts = [".opencode", "artifacts", "repository"]
    let cursor = root
    for (const part of parts) {
      cursor = path.join(cursor, part)
      try {
        const stats = await lstat(cursor)
        if (stats.isSymbolicLink()) throw failure("artifact root contains a symlink")
        if (!stats.isDirectory()) throw failure("artifact root is not a directory")
      } catch (error) {
        if (error?.code !== "ENOENT") throw error
        if (!create) return null
        await mkdir(cursor)
        const stats = await lstat(cursor)
        if (stats.isSymbolicLink() || !stats.isDirectory()) throw failure("artifact root contains a symlink")
      }
    }
    const resolved = await realpath(cursor)
    if (!isInside(root, resolved)) throw failure("artifact root escapes the worktree")
    return cursor
  }

  async function reviewDiff(repo, observation) {
    let output = "# Repository evidence review artifact\n# Sections: [staged: index vs HEAD] then [unstaged: worktree vs index].\n"
    let limited = false
    for (const file of observation.files) {
      let part = ""
      if (file.untracked || observation.head.unborn) {
        const content = file.contents?.toString("utf8") || ""
        part = `diff --git a/${file.path} b/${file.path}\nnew file mode 100644\n--- /dev/null\n+++ b/${file.path}\n@@ -0,0 +1 @@\n${content.split("\n").filter((line, index, all) => index < all.length - 1 || line).map((line) => `+${line}\n`).join("")}`
      } else if (file.worktree && file.worktree.exists === false) {
        try {
          const staged = await runGit(repo.cwd, ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "HEAD", "--", file.path], MAX_DIFF_BYTES)
          const unstaged = await runGit(repo.cwd, ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "--", file.path], MAX_DIFF_BYTES)
          part = `${staged.stdout}${unstaged.stdout}`
        } catch {
          limited = true
          observation.coverage.excluded.push({ path: file.path, reason: "diff-unavailable" })
          continue
        }
      } else {
        try {
          const staged = await runGit(repo.cwd, ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "HEAD", "--", file.path], MAX_DIFF_BYTES)
          const unstaged = await runGit(repo.cwd, ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "--", file.path], MAX_DIFF_BYTES)
          part = `${staged.stdout}${unstaged.stdout}`
          if (!part) {
            const fallback = await runGit(repo.cwd, ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "--binary", "HEAD", "--", file.path], MAX_DIFF_BYTES)
            part = fallback.stdout
          }
        } catch {
          limited = true
          observation.coverage.excluded.push({ path: file.path, reason: "diff-unavailable" })
          continue
        }
      }
      if (Buffer.byteLength(output) + Buffer.byteLength(part) > MAX_DIFF_BYTES) {
        limited = true
        observation.coverage.excluded.push({ path: file.path, reason: "diff-limit" })
        continue
      }
      output += part
    }
    if (limited) observation.coverage.complete = false
    return output
  }

  function evidenceCore(scopes, observation) {
    return {
      version: 1,
      root: observation.root,
      paths: scopes.map((scope) => scope.path),
      head: observation.head,
      files: observation.files.map(({ contents, ...file }) => file),
      coverage: observation.coverage,
    }
  }

  async function status() {
    const repo = await repository()
    if (!repo) return unsupported()
    const [head, result] = await Promise.all([headFor(repo), statusEntries(repo)])
    return {
      supported: true,
      root: repo.root,
      head,
      summary: statusSummary(result.entries, result.truncated),
      paths: result.entries,
    }
  }

  async function snapshot({ paths } = {}) {
    const repo = await repository()
    if (!repo) return unsupported()
    const scopes = await validateScopes(repo.root, paths)
    const observation = await observe(repo, scopes)
    observation.root = repo.root
    const scopedStatus = observation.status.entries.filter((entry) => isScopeMatch(entry.path, scopes))
    const outsideStatus = observation.status.entries.filter((entry) => !isScopeMatch(entry.path, scopes))
    const identifier = randomUUID()
    const root = await safeArtifactRoot(repo.root, true)
    const diff = await reviewDiff(repo, observation)
    const core = evidenceCore(scopes, observation)
    const fingerprint = digest(stable(core))
    const manifestPath = path.join(root, `${identifier}.manifest.json`)
    const diffPath = path.join(root, `${identifier}.diff`)
    const manifest = {
      ...core,
      identifier,
      fingerprint,
      diff: { path: diffPath, hash: digest(diff), bytes: Buffer.byteLength(diff) },
      baseline: {
        description: "Observed dirty state at snapshot time; it is context only and is not attributed to a worker.",
        scope: statusSummary(scopedStatus, observation.status.truncated),
        outsideScope: statusSummary(outsideStatus, observation.status.truncated),
      },
    }
    await writeFile(diffPath, diff, { encoding: "utf8", flag: "wx", mode: 0o444 })
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o444 })
    await chmod(diffPath, 0o444)
    await chmod(manifestPath, 0o444)
    return { identifier, manifestPath, diffPath, fingerprint, coverage: observation.coverage }
  }

  async function verify({ snapshot } = {}) {
    const repo = await repository()
    if (!repo) return { valid: false, changed: [], unknown: [{ reason: "not-git-worktree" }] }
    if (!snapshot || typeof snapshot.identifier !== "string" || typeof snapshot.fingerprint !== "string" || !UUID_RE.test(snapshot.identifier)) {
      return { valid: false, changed: [], unknown: [{ reason: "invalid-snapshot" }] }
    }
    const root = await safeArtifactRoot(repo.root, false)
    if (!root) return { valid: false, changed: [], unknown: [{ reason: "missing-artifact" }] }
    const manifestPath = path.join(root, `${snapshot.identifier}.manifest.json`)
    let manifest
    try {
      const stats = await lstat(manifestPath)
      if (stats.isSymbolicLink() || !stats.isFile()) throw failure("artifact manifest is unsafe")
      manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    } catch {
      return { valid: false, changed: [], unknown: [{ reason: "missing-or-tampered-artifact" }] }
    }
    if (manifest.identifier !== snapshot.identifier || manifest.fingerprint !== snapshot.fingerprint) {
      return { valid: false, changed: [], unknown: [{ reason: "tampered-artifact-manifest" }] }
    }
    const diffPath = path.join(root, `${snapshot.identifier}.diff`)
    try {
      const stats = await lstat(diffPath)
      if (stats.isSymbolicLink() || !stats.isFile()) throw failure("artifact diff is unsafe")
      const diff = await readFile(diffPath)
      if (digest(diff) !== manifest.diff?.hash || diff.length !== manifest.diff?.bytes) throw failure("artifact diff has changed")
    } catch {
      return { valid: false, changed: [], unknown: [{ reason: "missing-or-tampered-artifact" }] }
    }
    const core = {
      version: manifest.version,
      root: manifest.root,
      paths: manifest.paths,
      head: manifest.head,
      files: manifest.files,
      coverage: manifest.coverage,
    }
    if (digest(stable(core)) !== manifest.fingerprint || manifest.root !== repo.root) {
      return { valid: false, changed: [], unknown: [{ reason: "tampered-artifact-manifest" }] }
    }
    let scopes
    try {
      scopes = await validateScopes(repo.root, manifest.paths)
    } catch {
      return { valid: false, changed: [], unknown: [{ reason: "unsafe-snapshot-scope" }] }
    }
    const observation = await observe(repo, scopes)
    observation.root = repo.root
    const current = evidenceCore(scopes, observation)
    if (digest(stable(current)) === manifest.fingerprint) {
      if (manifest.coverage.complete === false || observation.coverage.complete === false) {
        return { valid: false, changed: [], unknown: [{ reason: "incomplete-coverage", coverage: observation.coverage }] }
      }
      return { valid: true, changed: [], unknown: [] }
    }

    const previous = new Map(manifest.files.map((file) => [file.path, file]))
    const now = new Map(observation.files.map((file) => [file.path, file]))
    const changed = []
    for (const relativePath of new Set([...previous.keys(), ...now.keys()])) {
      if (stable(previous.get(relativePath)) !== stable(now.get(relativePath))) changed.push({ path: relativePath })
    }
    const unknown = []
    if (manifest.coverage.complete === false || observation.coverage.complete === false) {
      unknown.push({ reason: "incomplete-coverage", coverage: observation.coverage })
    }
    if (stable(manifest.head) !== stable(observation.head)) changed.push({ path: "HEAD", reason: "head-changed" })
    return { valid: false, changed: changed.sort((left, right) => left.path.localeCompare(right.path)), unknown }
  }

  async function readCheckpoint() {
    const repo = await repository()
    if (!repo) return unsupported()
    const checkpoint = path.join(repo.root, ".opencode", "working-state.md")
    try {
      const parent = await lstat(path.dirname(checkpoint))
      const file = await lstat(checkpoint)
      if (parent.isSymbolicLink() || file.isSymbolicLink() || !file.isFile()) {
        return { supported: true, exists: false, reason: "unsafe-checkpoint-path" }
      }
      if (file.size > 16 * MAX_CHECKPOINT_BYTES) {
        return { supported: true, exists: false, reason: "checkpoint-too-large" }
      }
      const handle = await open(checkpoint, "r")
      try {
        const buffer = Buffer.alloc(MAX_CHECKPOINT_BYTES + 1)
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
        return {
          supported: true,
          exists: true,
          content: buffer.subarray(0, Math.min(bytesRead, MAX_CHECKPOINT_BYTES)).toString("utf8"),
          truncated: bytesRead > MAX_CHECKPOINT_BYTES || file.size > MAX_CHECKPOINT_BYTES,
        }
      } finally {
        await handle.close()
      }
    } catch (error) {
      if (error?.code === "ENOENT") return { supported: true, exists: false, reason: "missing-checkpoint" }
      return { supported: true, exists: false, reason: "unreadable-checkpoint" }
    }
  }

  return { status, snapshot, verify, readCheckpoint }
}
