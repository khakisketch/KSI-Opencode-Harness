// Durable, file-based state for the design completion notifier.
//
// Layout (default `~/.local/state/opencode-design-notifier/`):
//   bindings.json  — one record per watched (run, session) or pending request
//   paused.json    — { "*": {at} } global pause and/or { "ses_...": {at} } per session
//   leader.json    — single-poller lease { instanceId, at }
//   events.log     — bounded JSONL diagnostics (never stores prompts)
//
// All writes are atomic (temp file + rename). A lock file serializes writers;
// on contention the lock waits up to `lockTimeoutMs` and then fails the write
// instead of proceeding unlocked, so an update is retried instead of lost.

import { appendFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const BINDINGS_FILE = "bindings.json";
const PAUSED_FILE = "paused.json";
const LEGACY_PAUSE_FILE = "paused";
const LEADER_FILE = "leader.json";
const LOG_FILE = "events.log";
const LOCK_FILE = "bindings.lock";
const LOG_CAP_BYTES = 256 * 1024;
const RECORD_CAP = 500;
const DELIVERED_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FINAL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const STALE_LOCK_MS = 5_000;
const LOCK_TIMEOUT_MS = 5_000;

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
// true when anything was removed. `held` is deliberately not final: it is a
// stored completion waiting for wake permission, not a finished record.
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

export function createStore({ dir, now = () => Date.now(), lockTimeoutMs = LOCK_TIMEOUT_MS }) {
  const bindingsPath = join(dir, BINDINGS_FILE);
  const pausedPath = join(dir, PAUSED_FILE);
  const legacyPausePath = join(dir, LEGACY_PAUSE_FILE);
  const leaderPath = join(dir, LEADER_FILE);
  const logPath = join(dir, LOG_FILE);
  const lockPath = join(dir, LOCK_FILE);

  async function writeJsonAtomic(path, value) {
    const tmp = `${path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rename(tmp, path);
  }

  async function readJsonFile(path) {
    try {
      const value = JSON.parse(await readFile(path, "utf8"));
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
      return null;
    } catch (error) {
      if (error?.code === "ENOENT") return null;
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function init() {
    await mkdir(dir, { recursive: true });
    // Clean up temp files stranded by a crash (best effort).
    try {
      const entries = await readdir(dir);
      for (const name of entries) {
        if (!name.includes(".tmp-")) continue;
        const info = await stat(join(dir, name)).catch(() => null);
        if (info && now() - info.mtimeMs > 60 * 60 * 1000) {
          await rm(join(dir, name), { force: true }).catch(() => {});
        }
      }
    } catch {}
    // Migrate the legacy global `paused` file into paused.json.
    try {
      const legacy = await stat(legacyPausePath);
      const existing = await readJsonFile(pausedPath);
      if (!existing || Object.keys(existing).length === 0) {
        await writeJsonAtomic(pausedPath, { "*": { at: Math.round(legacy.mtimeMs) } });
      }
      await rm(legacyPausePath, { force: true });
    } catch {}
  }

  async function load() {
    let raw;
    try {
      raw = await readFile(bindingsPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
    try {
      const value = JSON.parse(raw);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {}
    // Corrupt or non-object JSON: preserve it once, then start clean.
    await rename(bindingsPath, `${bindingsPath}.corrupt-${now()}`).catch(() => {});
    return {};
  }

  async function save(bindings) {
    await writeJsonAtomic(bindingsPath, bindings);
  }

  async function withLock(fn) {
    await mkdir(dir, { recursive: true });
    const deadline = Date.now() + lockTimeoutMs;
    for (;;) {
      let handle = null;
      try {
        handle = await open(lockPath, "wx");
      } catch (error) {
        if (error?.code !== "EEXIST") throw error;
        try {
          const info = await stat(lockPath);
          if (Date.now() - info.mtimeMs > STALE_LOCK_MS) {
            await rm(lockPath, { force: true });
            continue;
          }
        } catch {}
        if (Date.now() >= deadline) {
          const timeout = new Error(`state lock timeout after ${lockTimeoutMs}ms`);
          timeout.code = "STATE_LOCK_TIMEOUT";
          throw timeout;
        }
        await sleep(20 + Math.floor(Math.random() * 40));
        continue;
      }
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await rm(lockPath, { force: true }).catch(() => {});
      }
    }
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
      if (!record || (record.state !== "tracking" && record.state !== "held")) return false;
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

  // ---- wake permission (per session, with an optional global switch) ----

  async function readPausedMap() {
    return (await readJsonFile(pausedPath)) ?? {};
  }

  async function isPausedFor(sessionID) {
    const map = await readPausedMap();
    if (map["*"]) return true;
    if (typeof sessionID === "string" && sessionID && map[sessionID]) return true;
    if (Object.keys(map).length === 0) {
      // Pre-migration legacy file (init migrates it).
      try {
        await stat(legacyPausePath);
        return true;
      } catch {}
    }
    return false;
  }

  async function listPaused() {
    const map = await readPausedMap();
    return {
      global: Boolean(map["*"]),
      sessions: Object.keys(map).filter((key) => key !== "*"),
    };
  }

  // key: "ses_..." for one session, "*" for every session.
  async function setPaused(key, paused) {
    if (key !== "*" && (typeof key !== "string" || !key.startsWith("ses"))) {
      throw new Error(`invalid pause key: ${String(key).slice(0, 40)}`);
    }
    await withLock(async () => {
      const map = await readPausedMap();
      if (paused) map[key] = { at: now() };
      else delete map[key];
      await writeJsonAtomic(pausedPath, map);
    });
    await rm(legacyPausePath, { force: true }).catch(() => {});
  }

  // ---- single-poller leadership lease ----

  async function readLeadership() {
    const value = await readJsonFile(leaderPath);
    if (!value || typeof value.instanceId !== "string" || typeof value.at !== "number") return null;
    return { instanceId: value.instanceId, at: value.at };
  }

  // Acquire or renew the poller lease. Returns true when this instance holds
  // it. A fresh lease held by another instance is respected; a lease older
  // than ttlMs is taken over.
  async function tryAcquireLeadership(instanceId, { ttlMs = 60_000, now: at = now() } = {}) {
    return withLock(async () => {
      const current = await readJsonFile(leaderPath);
      const fresh = current && typeof current.at === "number" && at - current.at < ttlMs;
      if (fresh && current.instanceId !== instanceId) return false;
      await writeJsonAtomic(leaderPath, { instanceId, at });
      return true;
    });
  }

  async function releaseLeadership(instanceId) {
    try {
      return await withLock(async () => {
        const current = await readJsonFile(leaderPath);
        if (!current || current.instanceId !== instanceId) return false;
        await rm(leaderPath, { force: true });
        return true;
      });
    } catch {
      return false;
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

  return {
    dir,
    init,
    load,
    save,
    mutate,
    claimDelivery,
    get,
    put,
    remove,
    isPausedFor,
    setPaused,
    listPaused,
    tryAcquireLeadership,
    releaseLeadership,
    readLeadership,
    log,
  };
}
