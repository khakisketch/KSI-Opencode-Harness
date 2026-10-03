// Durable, file-based state for the design completion notifier.
//
// Layout (default `~/.local/state/opencode-design-notifier/`):
//   bindings.json  — one record per watched (run, session) or pending request
//   paused         — presence means "admit notifications without auto wake"
//   events.log     — bounded JSONL diagnostics (never stores prompts)
//
// All writes are atomic (temp file + rename). A best-effort lock file keeps
// concurrent plugin instances from losing updates; on lock timeout we proceed
// without the lock rather than dropping the update.

import { appendFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const BINDINGS_FILE = "bindings.json";
const PAUSE_FILE = "paused";
const LOG_FILE = "events.log";
const LOCK_FILE = "bindings.lock";
const LOG_CAP_BYTES = 256 * 1024;
const RECORD_CAP = 500;
const DELIVERED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FINAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const STALE_LOCK_MS = 10 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function defaultStateDir(env = process.env) {
  const override = env.KSI_DESIGN_NOTIFIER_STATE_DIR;
  if (typeof override === "string" && override.trim()) return override.trim();
  const base =
    typeof env.XDG_STATE_HOME === "string" && env.XDG_STATE_HOME.trim()
      ? env.XDG_STATE_HOME.trim()
      : join(
          typeof env.HOME === "string" && env.HOME.trim() ? env.HOME.trim() : homedir(),
          ".local",
          "state",
        );
  return join(base, "opencode-design-notifier");
}

// Prune records that no longer need to be kept. Mutates `bindings`; returns
// true when anything was removed.
export function reapBindings(bindings, now, {
  recordCap = RECORD_CAP,
  deliveredTtlMs = DELIVERED_TTL_MS,
  finalTtlMs = FINAL_TTL_MS,
} = {}) {
  let changed = false;
  for (const [key, record] of Object.entries(bindings)) {
    if (!record || typeof record !== "object") {
      delete bindings[key];
      changed = true;
      continue;
    }
    const age = now - (record.updatedAt ?? record.createdAt ?? now);
    const finalState =
      record.state === "delivered" ||
      record.state === "orphaned" ||
      record.state === "unresolved" ||
      record.state === "missing";
    const ttl = record.state === "delivered" ? deliveredTtlMs : finalTtlMs;
    if (finalState && age > ttl) {
      delete bindings[key];
      changed = true;
    }
  }
  const keys = Object.keys(bindings);
  if (keys.length > recordCap) {
    const removable = keys
      .filter((key) => {
        const state = bindings[key].state;
        return state === "delivered" || state === "orphaned" || state === "unresolved" || state === "missing";
      })
      .sort((a, b) => (bindings[a].updatedAt ?? 0) - (bindings[b].updatedAt ?? 0));
    while (Object.keys(bindings).length > recordCap && removable.length > 0) {
      delete bindings[removable.shift()];
      changed = true;
    }
  }
  return changed;
}

export function createStore({ dir, now = () => Date.now() }) {
  const bindingsPath = join(dir, BINDINGS_FILE);
  const pausePath = join(dir, PAUSE_FILE);
  const logPath = join(dir, LOG_FILE);
  const lockPath = join(dir, LOCK_FILE);

  async function init() {
    await mkdir(dir, { recursive: true });
    // Clean up temp files stranded by a crash (best effort).
    try {
      const entries = await readdir(dir);
      for (const name of entries) {
        if (!name.startsWith(`${BINDINGS_FILE}.tmp-`)) continue;
        const info = await stat(join(dir, name)).catch(() => null);
        if (info && now() - info.mtimeMs > 60 * 60 * 1000) {
          await rm(join(dir, name), { force: true }).catch(() => {});
        }
      }
    } catch {}
  }

  async function load() {
    let value;
    try {
      value = JSON.parse(await readFile(bindingsPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      if (error instanceof SyntaxError) {
        await rename(bindingsPath, `${bindingsPath}.corrupt-${now()}`).catch(() => {});
        return {};
      }
      throw error;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
    // Valid JSON that is not an object would otherwise be silently discarded.
    await rename(bindingsPath, `${bindingsPath}.corrupt-${now()}`).catch(() => {});
    return {};
  }

  async function save(bindings) {
    const tmp = `${bindingsPath}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    await writeFile(tmp, `${JSON.stringify(bindings, null, 2)}\n`, { mode: 0o600 });
    await rename(tmp, bindingsPath);
  }

  async function withLock(fn) {
    await mkdir(dir, { recursive: true });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      let handle = null;
      try {
        handle = await open(lockPath, "wx");
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        try {
          const info = await stat(lockPath);
          if (now() - info.mtimeMs > STALE_LOCK_MS) {
            await rm(lockPath, { force: true });
            continue;
          }
        } catch {}
        await sleep(30 + Math.floor(Math.random() * 50));
        continue;
      }
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await rm(lockPath, { force: true }).catch(() => {});
      }
    }
    // Could not acquire a fresh lock in ~2.5s: proceed unlocked so an update
    // is never silently dropped (last-writer-wins is accepted).
    return fn();
  }

  async function mutate(fn) {
    return withLock(async () => {
      const bindings = await load();
      const result = await fn(bindings);
      // Returning exactly `false` skips the write (used to avoid rewriting
      // unchanged state on every poll).
      if (result !== false) await save(bindings);
      return result;
    });
  }

  // Claim a delivery under the state lock so concurrent plugin instances
  // (OpenCode loads the global plugin per location) cannot both deliver the
  // same binding. The claim expires so a crashed instance does not strand it.
  async function claimDelivery(key, { now: claimedAt = now(), token, ttlMs = 120_000 } = {}) {
    let claimed = false;
    await mutate((bindings) => {
      const record = bindings[key];
      if (!record || record.state !== "tracking") return false;
      const claim = record.deliveryClaim;
      if (claim && typeof claim.at === "number" && claimedAt - claim.at < ttlMs) return false;
      bindings[key] = { ...record, deliveryClaim: { at: claimedAt, token }, updatedAt: claimedAt };
      claimed = true;
      return true;
    });
    return claimed;
  }

  async function get(key) {
    const bindings = await load();
    return bindings[key] ?? null;
  }

  async function put(key, record) {
    return mutate((bindings) => {
      bindings[key] = record;
    });
  }

  async function remove(key) {
    return mutate((bindings) => {
      delete bindings[key];
    });
  }

  async function isPaused() {
    try {
      await stat(pausePath);
      return true;
    } catch {
      return false;
    }
  }

  async function setPaused(paused) {
    await mkdir(dir, { recursive: true });
    if (paused) {
      await writeFile(pausePath, `${new Date(now()).toISOString()}\n`, { mode: 0o600 });
    } else {
      await rm(pausePath, { force: true });
    }
  }

  async function log(event, fields = {}) {
    try {
      await mkdir(dir, { recursive: true });
      let rotate = false;
      try {
        const info = await stat(logPath);
        rotate = info.size > LOG_CAP_BYTES;
      } catch {}
      if (rotate) {
        const raw = await readFile(logPath, "utf8").catch(() => "");
        const keep = raw.slice(-Math.floor(LOG_CAP_BYTES / 2));
        const trimmed = keep.slice(keep.indexOf("\n") + 1 || 0);
        await writeFile(logPath, trimmed, { mode: 0o600 });
      }
      await appendFile(logPath, `${JSON.stringify({ t: now(), event, ...fields })}\n`, { mode: 0o600 });
    } catch {
      // Diagnostics must never break the notifier.
    }
  }

  return { dir, init, load, save, mutate, claimDelivery, get, put, remove, isPaused, setPaused, log };
}
