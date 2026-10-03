import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createStore, defaultStateDir, reapBindings } from "../plugins/design-notifier/lib/state.js"

async function withTempDir(fn) {
  const dir = await mkdtemp(join(tmpdir(), "design-notifier-state-"))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test("defaultStateDir honors the environment override and XDG default", async () => {
  assert.equal(defaultStateDir({ KSI_DESIGN_NOTIFIER_STATE_DIR: " /custom/state " }), "/custom/state")
  assert.equal(defaultStateDir({ XDG_STATE_HOME: "/xdg" }), join("/xdg", "opencode-design-notifier"))
  const withHome = defaultStateDir({ HOME: "/home/tester" })
  assert.equal(withHome, join("/home/tester", ".local", "state", "opencode-design-notifier"))
})

test("bindings survive a store restart and round-trip through put/get/remove", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    await store.put("run:abc@ses_1", { key: "run:abc@ses_1", state: "tracking", runId: "abc" })
    const reopened = createStore({ dir })
    assert.deepEqual(await reopened.get("run:abc@ses_1"), {
      key: "run:abc@ses_1",
      state: "tracking",
      runId: "abc",
    })
    await reopened.remove("run:abc@ses_1")
    assert.equal(await reopened.get("run:abc@ses_1"), null)
  })
})

test("concurrent updates do not lose keys (serialized lock)", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        store.put(`run:${index}@ses`, { key: `run:${index}@ses`, state: "tracking", runId: String(index) }),
      ),
    )
    const bindings = await store.load()
    assert.equal(Object.keys(bindings).length, 12)
  })
})

test("a corrupt bindings file is preserved aside and replaced with empty state", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    await writeFile(join(dir, "bindings.json"), "{not json")
    assert.deepEqual(await store.load(), {})
    const entries = await readdir(dir)
    assert.ok(entries.some((name) => name.startsWith("bindings.json.corrupt-")), `corrupt copy kept: ${entries}`)
  })
})

test("pause is per session with an optional global switch", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    assert.equal(await store.isPausedFor("ses_a"), false)

    await store.setPaused("ses_a", true)
    assert.equal(await store.isPausedFor("ses_a"), true)
    assert.equal(await store.isPausedFor("ses_b"), false)
    assert.deepEqual(await store.listPaused(), { global: false, sessions: ["ses_a"] })

    await store.setPaused("*", true)
    assert.equal(await store.isPausedFor("ses_b"), true)
    assert.deepEqual(await store.listPaused(), { global: true, sessions: ["ses_a"] })

    await store.setPaused("*", false)
    assert.equal(await store.isPausedFor("ses_b"), false)
    assert.equal(await store.isPausedFor("ses_a"), true)

    await store.setPaused("ses_a", false)
    assert.equal(await store.isPausedFor("ses_a"), false)
    await assert.rejects(() => store.setPaused("not-a-session", true), /invalid pause key/)
  })
})

test("a legacy global paused file is migrated into paused.json on init", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    await writeFile(join(dir, "paused"), "2026-01-01T00:00:00.000Z\n")
    const reopened = createStore({ dir })
    await reopened.init()
    assert.equal(await reopened.isPausedFor("ses_any"), true)
    assert.deepEqual(await reopened.listPaused(), { global: true, sessions: [] })
    await assert.rejects(() => stat(join(dir, "paused")))
  })
})

test("a corrupt paused.json is preserved aside and treated as not paused", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    await writeFile(join(dir, "paused.json"), "{broken")
    assert.equal(await store.isPausedFor("ses_x"), false)
    const entries = await readdir(dir)
    assert.ok(entries.some((name) => name.startsWith("paused.json.corrupt-")), `corrupt copy kept: ${entries}`)
    // The switch still works after the corrupt copy is set aside.
    await store.setPaused("ses_x", true)
    assert.equal(await store.isPausedFor("ses_x"), true)
  })
})

test("log rotation caps the events log", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    for (let index = 0; index < 400; index += 1) await store.log("bulk", { index, blob: "x".repeat(1024) })
    const info = await stat(join(dir, "events.log"))
    assert.ok(info.size <= 256 * 1024 + 4096, `log stayed bounded: ${info.size}`)
    const raw = await readFile(join(dir, "events.log"), "utf8")
    assert.match(raw, /"event":"bulk"/)
  })
})

test("a contended lock fails the write after the timeout instead of writing unlocked", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir, lockTimeoutMs: 120 })
    await store.init()
    await writeFile(join(dir, "bindings.lock"), "")
    await assert.rejects(() => store.put("run:x@ses", { state: "tracking" }), /state lock timeout/)
    await rm(join(dir, "bindings.lock"), { force: true })
    await store.put("run:x@ses", { state: "tracking" })
    assert.equal((await store.get("run:x@ses")).state, "tracking")
  })
})

test("leadership is single-holder, renewable, and expireable", async () => {
  await withTempDir(async (dir) => {
    let now = 1_700_000_000_000
    const store = createStore({ dir, now: () => now })
    await store.init()

    assert.equal(await store.tryAcquireLeadership("inst-a", { ttlMs: 60_000 }), true)
    assert.equal(await store.tryAcquireLeadership("inst-b", { ttlMs: 60_000 }), false)
    assert.equal((await store.readLeadership()).instanceId, "inst-a")

    now += 30_000
    assert.equal(await store.tryAcquireLeadership("inst-a", { ttlMs: 60_000 }), true, "holder renews")
    assert.equal(await store.tryAcquireLeadership("inst-b", { ttlMs: 60_000 }), false)

    now += 61_000
    assert.equal(await store.tryAcquireLeadership("inst-b", { ttlMs: 60_000 }), true, "stale lease is taken over")
    assert.equal(await store.tryAcquireLeadership("inst-a", { ttlMs: 60_000 }), false)

    assert.equal(await store.releaseLeadership("inst-a"), false, "non-holder cannot release")
    assert.equal(await store.releaseLeadership("inst-b"), true)
    assert.equal(await store.readLeadership(), null)
    assert.equal(await store.tryAcquireLeadership("inst-a", { ttlMs: 60_000 }), true)
  })
})

test("concurrent leadership claims produce exactly one holder", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    const results = await Promise.all([
      store.tryAcquireLeadership("inst-x", { ttlMs: 60_000 }),
      store.tryAcquireLeadership("inst-y", { ttlMs: 60_000 }),
      store.tryAcquireLeadership("inst-z", { ttlMs: 60_000 }),
    ])
    assert.equal(results.filter(Boolean).length, 1, "exactly one concurrent claim wins")
    const holder = await store.readLeadership()
    assert.ok(["inst-x", "inst-y", "inst-z"].includes(holder.instanceId))
  })
})

test("reapBindings drops expired final records, keeps held records, and enforces the cap", () => {
  const now = 1_000_000_000
  const bindings = {
    "run:a@ses": { state: "delivered", updatedAt: now - 31 * 24 * 60 * 60 * 1000 },
    "run:b@ses": { state: "tracking", updatedAt: now - 400 * 24 * 60 * 60 * 1000 },
    "run:c@ses": { state: "orphaned", updatedAt: now - 91 * 24 * 60 * 60 * 1000 },
    "run:h@ses": { state: "held", updatedAt: now - 400 * 24 * 60 * 60 * 1000 },
    "run:d@ses": { state: "delivered", updatedAt: now },
  }
  assert.equal(reapBindings(bindings, now), true)
  assert.deepEqual(Object.keys(bindings).sort(), ["run:b@ses", "run:d@ses", "run:h@ses"])

  const crowded = {}
  for (let index = 0; index < 12; index += 1) {
    crowded[`run:${index}@ses`] = { state: "delivered", updatedAt: now - index }
  }
  crowded["run:live@ses"] = { state: "tracking", updatedAt: now }
  crowded["run:held@ses"] = { state: "held", updatedAt: now }
  reapBindings(crowded, now, { recordCap: 5, deliveredTtlMs: Infinity, finalTtlMs: Infinity })
  assert.equal(Object.keys(crowded).length, 5)
  assert.ok("run:live@ses" in crowded, "tracking record survives the cap")
  assert.ok("run:held@ses" in crowded, "held record survives the cap")
})
