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

test("concurrent updates do not lose keys (best-effort lock)", async () => {
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

test("pause flag toggles and log rotation caps the events log", async () => {
  await withTempDir(async (dir) => {
    const store = createStore({ dir })
    await store.init()
    assert.equal(await store.isPaused(), false)
    await store.setPaused(true)
    assert.equal(await store.isPaused(), true)
    await store.setPaused(false)
    assert.equal(await store.isPaused(), false)

    for (let index = 0; index < 400; index += 1) await store.log("bulk", { index, blob: "x".repeat(1024) })
    const info = await stat(join(dir, "events.log"))
    assert.ok(info.size <= 256 * 1024 + 4096, `log stayed bounded: ${info.size}`)
    const raw = await readFile(join(dir, "events.log"), "utf8")
    assert.match(raw, /"event":"bulk"/)
  })
})

test("reapBindings drops expired final records and enforces the cap", () => {
  const now = 1_000_000_000
  const bindings = {
    "run:a@ses": { state: "delivered", updatedAt: now - 31 * 24 * 60 * 60 * 1000 },
    "run:b@ses": { state: "tracking", updatedAt: now - 400 * 24 * 60 * 60 * 1000 },
    "run:c@ses": { state: "orphaned", updatedAt: now - 91 * 24 * 60 * 60 * 1000 },
    "run:d@ses": { state: "delivered", updatedAt: now },
  }
  assert.equal(reapBindings(bindings, now), true)
  assert.deepEqual(Object.keys(bindings).sort(), ["run:b@ses", "run:d@ses"])

  const crowded = {}
  for (let index = 0; index < 12; index += 1) {
    crowded[`run:${index}@ses`] = { state: "delivered", updatedAt: now - index }
  }
  crowded["run:live@ses"] = { state: "tracking", updatedAt: now }
  reapBindings(crowded, now, { recordCap: 5, deliveredTtlMs: Infinity, finalTtlMs: Infinity })
  assert.equal(Object.keys(crowded).length, 5)
  assert.ok("run:live@ses" in crowded, "tracking record survives the cap")
})
