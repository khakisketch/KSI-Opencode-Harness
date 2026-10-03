import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import plugin from "../plugins/design-notifier/index.js"

const RUN_A = "11111111-1111-4111-8111-111111111111"
const SESSION = "ses_test000000000000000000000"

const runRecord = {
  id: RUN_A,
  projectId: "proj-a",
  status: "succeeded",
  deliverableValid: true,
  deliverableValidation: "valid",
  deliverableEntryFile: "index.html",
  artifactCount: 1,
  retryable: false,
  resumable: false,
}

const startResult = (runId, requestId) => ({
  content: [{ type: "text", text: JSON.stringify({ id: runId, projectId: "proj-a", requestId }) }],
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(condition, { timeout = 4000, step = 25 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await condition()) return true
    await sleep(step)
  }
  return false
}

test("plugin setup wires hooks, the design_runs tool and one-shot delivery", async () => {
  const dir = await mkdtemp(join(tmpdir(), "design-notifier-plugin-"))
  const originalFetch = globalThis.fetch
  const syntheticCalls = []
  const hooks = new Map()
  const tools = []
  let disposed = 0
  const makeRegistration = () => ({
    dispose: async () => {
      disposed += 1
    },
  })
  const ctx = {
    options: {
      stateDir: dir,
      daemonUrl: "http://daemon.test",
      pollMs: 5000,
      quickPollMs: 50,
      initialDelayMs: 50,
    },
    app: { version: "2.0.22-test" },
    tool: {
      hook: async (name, callback) => {
        hooks.set(name, callback)
        return makeRegistration()
      },
      transform: async (callback) => {
        callback({
          add: (tool) => tools.push(tool),
          namespace: () => {},
          update: () => {},
          remove: () => {},
          list: () => [],
          get: () => undefined,
        })
        return makeRegistration()
      },
    },
    session: {
      synthetic: async (input) => {
        syntheticCalls.push(input)
      },
    },
  }
  globalThis.fetch = async (url) => {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith("/api/runs/")) {
      const id = decodeURIComponent(parsed.pathname.slice("/api/runs/".length))
      if (id === RUN_A) {
        return new Response(JSON.stringify(runRecord), { status: 200, headers: { "content-type": "application/json" } })
      }
      return new Response("not found", { status: 404 })
    }
    if (parsed.pathname === "/api/runs") {
      return new Response(JSON.stringify({ runs: [runRecord] }), { status: 200, headers: { "content-type": "application/json" } })
    }
    return new Response("not found", { status: 404 })
  }

  try {
    const cleanup = await plugin.setup(ctx)
    assert.equal(plugin.id, "ksi.design-notifier")
    assert.equal(typeof cleanup, "function")
    assert.ok(hooks.has("execute.before"))
    assert.ok(hooks.has("execute.after"))
    assert.equal(tools.length, 1)
    assert.equal(tools[0].name, "design_runs")

    await hooks.get("execute.before")({
      tool: "opendesign_start_run",
      sessionID: SESSION,
      agent: "build",
      id: "call_1",
      input: { requestId: "req-1", project: "proj-a" },
    })
    await hooks.get("execute.after")({
      tool: "opendesign_start_run",
      sessionID: SESSION,
      agent: "build",
      id: "call_1",
      input: { requestId: "req-1", project: "proj-a" },
      status: "completed",
      result: startResult(RUN_A, "req-1"),
    })

    const delivered = await waitFor(() => syntheticCalls.length === 1)
    assert.ok(delivered, "the poller delivered the completion notification")
    const [call] = syntheticCalls
    assert.equal(call.sessionID, SESSION)
    assert.match(call.id, /^msg_[0-9a-f]{32}$/)
    assert.equal(call.resume, true)
    assert.equal(call.delivery, "queue")
    assert.match(call.text, new RegExp(RUN_A))
    assert.match(call.text, /automatic notification/)
    assert.ok(call.metadata["ksi.design-notifier"])

    await sleep(200)
    assert.equal(syntheticCalls.length, 1, "no duplicate delivery")

    const list = JSON.parse((await tools[0].execute({ action: "list" }, { sessionID: SESSION })).content[0].text)
    assert.equal(list.paused.global, false)
    assert.equal(list.paused.forThisSession, false)
    assert.equal(list.bindings.length, 1)
    assert.equal(list.bindings[0].state, "delivered")
    assert.equal(list.bindings[0].runId, RUN_A)
    assert.ok(list.leadership)
    assert.equal(list.leadership.isSelf, true)

    // Per-session pause applies to the calling session only.
    await tools[0].execute({ action: "pause" }, { sessionID: SESSION })
    const pausedFile = JSON.parse(await readFile(join(dir, "paused.json"), "utf8"))
    assert.ok(pausedFile[SESSION], "pause is keyed by session")
    const sessionPaused = JSON.parse((await tools[0].execute({ action: "list" }, { sessionID: SESSION })).content[0].text)
    assert.equal(sessionPaused.paused.forThisSession, true)
    await tools[0].execute({ action: "resume" }, { sessionID: SESSION })
    assert.deepEqual(JSON.parse(await readFile(join(dir, "paused.json"), "utf8")), {})

    // Global pause scope holds every session.
    await tools[0].execute({ action: "pause", scope: "all" }, {})
    const globalPaused = JSON.parse((await tools[0].execute({ action: "list" }, {})).content[0].text)
    assert.equal(globalPaused.paused.global, true)
    await tools[0].execute({ action: "resume", scope: "all" }, {})

    // scope=session without a calling session is rejected instead of guessed.
    const badPause = await tools[0].execute({ action: "pause" }, {})
    assert.match(badPause.content[0].text, /requires a calling session/)

    const watch = await tools[0].execute({ action: "watch", runId: RUN_A }, { sessionID: SESSION })
    assert.match(watch.content[0].text, /"alreadyDelivered":true/)

    const badWatch = await tools[0].execute({ action: "watch", runId: "not-a-run" }, { sessionID: SESSION })
    assert.match(badWatch.content[0].text, /watch failed/)

    await cleanup()
    assert.equal(disposed, 3)
  } finally {
    globalThis.fetch = originalFetch
    await rm(dir, { recursive: true, force: true })
  }
})
