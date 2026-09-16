import { execFile as execFileCallback } from "node:child_process"
import { constants } from "node:fs"
import { access } from "node:fs/promises"
import { basename, isAbsolute, join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFileCallback)

export const ENV_PROBE_SCOPES = ["machine", "gpu", "models"]
export const ENV_PROBE_LIMITS = { maxBytes: 4096, maxCommandBytes: 1024 }
// Bare command names never execute directly: each binary is resolved to a
// pinned absolute path inside these fixed system directories, so a hostile
// PATH entry cannot hijack the probe. Missing binaries degrade explicitly.
export const BINARY_SEARCH_DIRS = ["/usr/bin", "/bin", "/usr/local/bin"]

const SCOPE_COMMANDS = {
  machine: [
    { command: "free", args: ["-m"], timeout: 5000 },
    { command: "nproc", args: [], timeout: 5000 },
  ],
  gpu: [
    {
      command: "nvidia-smi",
      args: ["--query-gpu=name,memory.total,memory.used,utilization.gpu", "--format=csv"],
      timeout: 10000,
    },
  ],
  models: [
    { command: "ollama", args: ["list"], timeout: 10000 },
    { command: "ollama", args: ["ps"], timeout: 10000 },
  ],
}

function truncate(text, limit) {
  const buffer = Buffer.from(text, "utf8")
  if (buffer.length <= limit) return { text, truncated: false }
  return { text: buffer.subarray(0, limit).toString("utf8"), truncated: true }
}

async function defaultResolveBinary(name) {
  if (typeof name !== "string" || !name || name.includes("/") || name.includes("\0")) return null
  for (const dir of BINARY_SEARCH_DIRS) {
    const candidate = join(dir, name)
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next fixed directory; a missing binary degrades, never falls
      // back to PATH lookup.
    }
  }
  return null
}

/**
 * Fixed-command environment probe. Runs only the allowlisted commands above
 * via execFile with `shell: false` and per-command timeouts. Never reads
 * environment variables or credentials; unknown scopes and missing commands
 * resolve to an explicit degraded result instead of throwing.
 */
export function createEnvProbe({ run, resolveBinary } = {}) {
  async function defaultRun(command, args, options) {
    const { stdout } = await execFileAsync(command, args, {
      encoding: "utf8",
      timeout: options.timeout,
      shell: false,
      windowsHide: true,
      maxBuffer: 64 * 1024,
    })
    return { stdout, truncated: false }
  }

  const runner = typeof run === "function" ? run : defaultRun
  const resolver = typeof resolveBinary === "function" ? resolveBinary : defaultResolveBinary

  async function probe(scope) {
    const commands = SCOPE_COMMANDS[scope]
    if (!commands) {
      return { ok: false, scope: String(scope), degraded: `unknown-scope: expected one of ${ENV_PROBE_SCOPES.join(", ")}` }
    }
    const entries = []
    let degraded = null
    for (const spec of commands) {
      const binary = await resolver(spec.command)
      if (!binary || !isAbsolute(binary) || basename(binary) !== spec.command) {
        degraded = `command-unavailable: ${spec.command}`
        entries.push({ command: spec.command, args: [...spec.args], output: "", truncated: false, error: "command-unavailable" })
        continue
      }
      try {
        const result = await runner(binary, [...spec.args], { shell: false, timeout: spec.timeout })
        const clipped = truncate(String(result?.stdout ?? ""), ENV_PROBE_LIMITS.maxCommandBytes)
        entries.push({
          command: spec.command,
          path: binary,
          args: [...spec.args],
          output: clipped.text,
          truncated: clipped.truncated || Boolean(result?.truncated),
        })
      } catch (error) {
        const reason = error?.code === "ENOENT" ? "command-unavailable" : error?.code === "ETIMEDOUT" ? "command-timeout" : "command-failed"
        degraded = `${reason}: ${spec.command}`
        entries.push({ command: spec.command, path: binary, args: [...spec.args], output: "", truncated: false, error: reason })
      }
    }
    if (degraded && entries.every((entry) => entry.error)) {
      return { ok: false, scope, degraded }
    }
    const payload = { ok: true, scope, commands: entries, truncated: entries.some((entry) => entry.truncated) }
    if (degraded) payload.degraded = degraded
    const encoded = JSON.stringify(payload)
    if (Buffer.byteLength(encoded, "utf8") <= ENV_PROBE_LIMITS.maxBytes) return payload
    // Keep the fixed command list visible while bounding the body.
    const bounded = { ok: true, scope, commands: [], truncated: true }
    if (degraded) bounded.degraded = degraded
    let used = Buffer.byteLength(JSON.stringify(bounded), "utf8")
    for (const entry of entries) {
      const room = ENV_PROBE_LIMITS.maxBytes - used - 64
      if (room <= 0) break
      const clipped = truncate(entry.output ?? "", Math.min(room, ENV_PROBE_LIMITS.maxCommandBytes))
      const kept = { ...entry, output: clipped.text, truncated: entry.truncated || clipped.truncated }
      used += Buffer.byteLength(JSON.stringify(kept), "utf8")
      bounded.commands.push(kept)
    }
    bounded.truncated = true
    return bounded
  }

  return { probe }
}
