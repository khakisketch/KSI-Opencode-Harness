import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createStore } from "../plugins/design-notifier/lib/state.js"
import { isValidRunId } from "../plugins/design-notifier/lib/daemon.js"
import { createNotifier, extractRunId } from "../plugins/design-notifier/lib/notifier.js"

const RUN_A = "11111111-1111-4111-8111-111111111111"
const RUN_B = "22222222-2222-4222-8222-222222222222"
const SESSION = "ses_test000000000000000000000"
const SESSION_2 = "ses_test000000000000000000001"

const startResult = (runId, requestId, projectId = "proj-a") => ({
  content: [
    {
      type: "text",
      text: JSON.stringify({ id: runId, projectId, requestId, requestClientId: undefined, hint: "Run started." }),
    },
  ],
})

function terminalRun(id, overrides = {}) {
  return {
    id,
    projectId: "proj-a",
    status: "succeeded",
    deliverableValid: true,
    deliverableValidation: "valid",
    deliverableEntryFile: "index.html",
    artifactCount: 2,
    retryable: false,
    resumable: false,
    terminalAt: 1_700_000_000_000,
    ...overrides,
  }
}

async function withHarness(fn, { runs = {}, list = [] } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "design-notifier-test-"))
  const state = { now: 1_700_000_000_000 }
  const clock = () => state.now
  const deliveries = []
  const errors = new Map()
  const harness = {
    dir,
    state,
    clock,
    deliveries,
    errors,
    deliverError: null,
    daemon: {
      baseUrl: "http://fake",
      isValidRunId,
      getRun: async (runId) => {
        const key = `getRun:${runId}`
        if (errors.has(key)) throw errors.get(key)
        const run = runs[runId]
        if (!run) {
          const error = new Error("daemon responded 404")
          error.status = 404
          throw error
        }
        return run
      },
      listRuns: async () => list,
      findByRequestId: async ({ requestId }) => list.find((run) => run.clientRequestId === requestId) ?? null,
    },
  }
  try {
    const store = createStore({ dir, now: clock })
    await store.init()
    const notifier = createNotifier({
      store,
      daemon: harness.daemon,
      deliver: async ({ sessionID, message }) => {
        if (harness.deliverError) throw harness.deliverError
        deliveries.push({ sessionID, message })
      },
      pollMs: 60_000,
      clock,
      log: () => {},
    })
    const setDeliverError = (error) => {
      harness.deliverError = error
    }
    return await fn({ ...harness, store, notifier, setDeliverError })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const beforeEvent = (requestId, project = "proj-a") => ({
  tool: "opendesign_start_run",
  sessionID: SESSION,
  agent: "build",
  messageID: "msg_event",
  id: "call_1",
  input: { requestId, project, prompt: "do not persist this" },
})

const afterEvent = (requestId, result) => ({
  tool: "opendesign_start_run",
  sessionID: SESSION,
  agent: "build",
  messageID: "msg_event",
  id: "call_1",
  input: { requestId, project: "proj-a" },
  status: "completed",
  result,
})

test("captures a start_run request, attaches the run id and delivers exactly once", async () => {
  await withHarness(
    async ({ store, notifier, deliveries }) => {
      await notifier.handleToolBefore(beforeEvent("req-1"))
      const requested = await store.get("req:req-1")
      assert.equal(requested.state, "requested")
      assert.equal(requested.sessionID, SESSION)
      assert.ok(!JSON.stringify(requested).includes("do not persist"), "prompt text must not be stored")

      await notifier.handleToolAfter(afterEvent("req-1", startResult(RUN_A, "req-1")))
      const attached = await store.get(`run:${RUN_A}@${SESSION}`)
      assert.equal(attached.state, "tracking")
      assert.equal(attached.requestId, "req-1")
      assert.equal(await store.get("req:req-1"), null, "request key is re-keyed to the run")

      await notifier.tick()
      assert.equal(deliveries.length, 1)
      const [{ sessionID, message }] = deliveries
      assert.equal(sessionID, SESSION)
      assert.match(message.id, /^msg_[0-9a-f]{32}$/)
      assert.equal(message.resume, true)
      assert.equal(message.delivery, "queue")
      assert.match(message.text, new RegExp(RUN_A))
      assert.equal(message.metadata["ksi.design-notifier"].classification, "valid")

      const delivered = await store.get(`run:${RUN_A}@${SESSION}`)
      assert.equal(delivered.state, "delivered")
      await notifier.tick()
      assert.equal(deliveries.length, 1, "no duplicate delivery on the next tick")
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("recovers a lost start response by clientRequestId without starting a replacement run", async () => {
  const lost = terminalRun(RUN_B, {
    clientRequestId: "req-2",
    status: "failed",
    deliverableValid: false,
    deliverableValidation: "no_artifact",
    failureCategory: "environment",
  })
  await withHarness(
    async ({ store, notifier, deliveries, clock }) => {
      await notifier.handleToolBefore(beforeEvent("req-2", "proj-b"))
      await notifier.handleToolAfter({ ...afterEvent("req-2", { content: [] }), input: { requestId: "req-2", project: "proj-b" } })
      const pending = await store.get("req:req-2")
      assert.equal(pending.state, "requested")
      assert.match(String(pending.lastError), /run id not found/)

      await store.mutate((bindings) => {
        bindings["req:req-2"].createdAt = clock() - 30_000
      })
      await notifier.tick()
      const attached = await store.get(`run:${RUN_B}@${SESSION}`)
      assert.equal(attached.state, "tracking")
      assert.equal(attached.requestId, "req-2")

      await notifier.tick()
      assert.equal(deliveries.length, 1)
      assert.equal(deliveries[0].message.metadata["ksi.design-notifier"].classification, "failed")
    },
    { runs: { [RUN_B]: lost }, list: [lost] },
  )
})

test("a daemon outage records the error and retries on a later tick", async () => {
  await withHarness(
    async ({ notifier, deliveries, errors }) => {
      await notifier.handleToolBefore(beforeEvent("req-3"))
      await notifier.handleToolAfter(afterEvent("req-3", startResult(RUN_A, "req-3")))
      errors.set(`getRun:${RUN_A}`, new Error("connect ECONNREFUSED 127.0.0.1:7456"))

      await notifier.tick()
      assert.equal(deliveries.length, 0, "no delivery while the daemon is unreachable")

      errors.delete(`getRun:${RUN_A}`)
      await notifier.tick()
      assert.equal(deliveries.length, 1, "delivery happens once the daemon recovers")
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("session-not-found orphans the binding without cross-session delivery", async () => {
  await withHarness(
    async ({ store, notifier, deliveries, setDeliverError }) => {
      await notifier.handleToolBefore(beforeEvent("req-5"))
      await notifier.handleToolAfter(afterEvent("req-5", startResult(RUN_A, "req-5")))
      const notFound = new Error("session not found")
      notFound.status = 404
      setDeliverError(notFound)

      await notifier.tick()
      assert.equal(deliveries.length, 0)
      const binding = await store.get(`run:${RUN_A}@${SESSION}`)
      assert.equal(binding.state, "orphaned")
      assert.match(String(binding.lastError), /not delivered elsewhere/)

      setDeliverError(null)
      await notifier.tick()
      assert.equal(deliveries.length, 0, "orphaned bindings are not retried or rerouted")
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("paused mode admits without auto wake", async () => {
  await withHarness(
    async ({ store, notifier, deliveries }) => {
      await store.setPaused(true)
      await notifier.handleToolBefore(beforeEvent("req-6"))
      await notifier.handleToolAfter(afterEvent("req-6", startResult(RUN_A, "req-6")))
      await notifier.tick()
      assert.equal(deliveries.length, 1)
      assert.equal(deliveries[0].message.resume, false)
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("manual watch delivers per session and never re-delivers to the same session", async () => {
  await withHarness(
    async ({ notifier, deliveries }) => {
      const first = await notifier.watchRun({ runId: RUN_A, sessionID: SESSION })
      assert.equal(first.alreadyDelivered, false)
      await notifier.tick()
      assert.equal(deliveries.length, 1)

      const again = await notifier.watchRun({ runId: RUN_A, sessionID: SESSION })
      assert.equal(again.alreadyDelivered, true)
      await notifier.tick()
      assert.equal(deliveries.length, 1, "same session is not notified twice")

      await notifier.watchRun({ runId: RUN_A, sessionID: SESSION_2 })
      await notifier.tick()
      assert.equal(deliveries.length, 2, "a different session gets its own notification")
      assert.notEqual(deliveries[0].message.id, deliveries[1].message.id)
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("restart reconciliation delivers a pending run once", async () => {
  await withHarness(
    async ({ store, daemon, deliveries, clock }) => {
      await store.put(`run:${RUN_B}@${SESSION}`, {
        key: `run:${RUN_B}@${SESSION}`,
        kind: "run",
        runId: RUN_B,
        sessionID: SESSION,
        source: "hook",
        state: "tracking",
        createdAt: clock() - 60_000,
        updatedAt: clock() - 60_000,
        lastStatus: { status: "running" },
      })
      const restarted = createNotifier({
        store,
        daemon,
        deliver: async ({ sessionID, message }) => deliveries.push({ sessionID, message }),
        pollMs: 60_000,
        clock,
        log: () => {},
      })
      await restarted.tick()
      assert.equal(deliveries.length, 1)
      await restarted.tick()
      assert.equal(deliveries.length, 1)

      const third = createNotifier({
        store,
        daemon,
        deliver: async ({ sessionID, message }) => deliveries.push({ sessionID, message }),
        pollMs: 60_000,
        clock,
        log: () => {},
      })
      await third.tick()
      assert.equal(deliveries.length, 1)
    },
    { runs: { [RUN_B]: terminalRun(RUN_B) } },
  )
})

test("a failed start_run is recorded and does not create a watched run", async () => {
  await withHarness(async ({ store, notifier, deliveries }) => {
    await notifier.handleToolBefore(beforeEvent("req-7"))
    await notifier.handleToolAfter({
      ...afterEvent("req-7", undefined),
      status: "error",
      result: undefined,
      error: { message: "recharge required" },
    })
    const binding = await store.get("req:req-7")
    assert.equal(binding.state, "requested")
    assert.match(String(binding.lastError), /start_run failed/)
    await notifier.tick()
    await notifier.tick()
    assert.equal(deliveries.length, 0)
    assert.equal((await store.get("req:req-7")).state, "requested")
  })
})

test("a run missing on the daemon is marked missing, not orphaned, and is not delivered", async () => {
  await withHarness(async ({ store, notifier, deliveries }) => {
    await notifier.handleToolBefore(beforeEvent("req-missing"))
    await notifier.handleToolAfter(afterEvent("req-missing", startResult(RUN_A, "req-missing")))
    await notifier.tick()
    const binding = await store.get(`run:${RUN_A}@${SESSION}`)
    assert.equal(binding.state, "missing")
    assert.match(String(binding.lastError), /run not found on daemon/)
    assert.equal(deliveries.length, 0)
  })
})

test("concurrent instances admit at most one delivery for a binding (claim)", async () => {
  await withHarness(
    async ({ store, daemon, deliveries, clock }) => {
      const deliver = async ({ sessionID, message }) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        deliveries.push({ sessionID, message });
      };
      const first = createNotifier({ store, daemon, deliver, pollMs: 60_000, clock, log: () => {} });
      const second = createNotifier({ store, daemon, deliver, pollMs: 60_000, clock, log: () => {} });
      await store.put(`run:${RUN_A}@${SESSION}`, {
        key: `run:${RUN_A}@${SESSION}`,
        kind: "run",
        runId: RUN_A,
        sessionID: SESSION,
        source: "hook",
        state: "tracking",
        createdAt: clock() - 60_000,
        updatedAt: clock() - 60_000,
      });
      await Promise.all([first.tick(), second.tick()]);
      assert.equal(deliveries.length, 1, "only the claiming instance delivers");
      const binding = await store.get(`run:${RUN_A}@${SESSION}`)
      assert.equal(binding.state, "delivered")
      assert.equal(binding.deliveryClaim, null)
    },
    { runs: { [RUN_A]: terminalRun(RUN_A) } },
  )
})

test("attach without any session id keeps the request record instead of stranding a run key", async () => {
  await withHarness(async ({ store, notifier }) => {
    await notifier.handleToolBefore({ ...beforeEvent("req-nosession"), sessionID: undefined })
    await notifier.handleToolAfter({
      ...afterEvent("req-nosession", startResult(RUN_A, "req-nosession")),
      sessionID: undefined,
    })
    const request = await store.get("req:req-nosession")
    assert.equal(request.state, "requested")
    assert.match(String(request.lastError), /no session id/)
    const bindings = await store.load()
    assert.ok(!Object.keys(bindings).some((key) => key.includes(RUN_A)), "no run binding is created")
  })
})

test("extractRunId prefers request-matched candidates and rejects ambiguity", () => {
  const result = startResult(RUN_A, "req-1")
  assert.equal(extractRunId(result, "req-1", isValidRunId), RUN_A)
  assert.equal(extractRunId({ output: { runId: RUN_B } }, null, isValidRunId), RUN_B)
  assert.equal(
    extractRunId({ content: [{ type: "text", text: `two ids ${RUN_A} and ${RUN_B} without fields` }] }, null, isValidRunId),
    null,
    "ambiguous regex fallback returns null",
  )
  assert.equal(
    extractRunId({ content: [{ type: "text", text: JSON.stringify({ id: "ksi-deploy-smoke", projectId: "ksi-deploy-smoke" }) }] }, null, isValidRunId),
    null,
    "a project id alone is not a run id",
  )
  assert.equal(extractRunId({ content: [{ type: "text", text: JSON.stringify({ id: RUN_B, projectId: RUN_B }) }] }, null, isValidRunId), RUN_B)
  assert.equal(
    extractRunId({ content: JSON.stringify({ id: RUN_A, projectId: "proj-a", requestId: "req-9" }) }, "req-9", isValidRunId),
    RUN_A,
    "a plain string content is parsed too",
  )
  assert.equal(
    extractRunId({ structuredContent: { id: RUN_A, projectId: "proj-a" } }, null, isValidRunId),
    RUN_A,
    "structured MCP content is parsed",
  )
  assert.equal(
    extractRunId({ structuredOutput: { id: RUN_B, projectId: "proj-b" } }, null, isValidRunId),
    RUN_B,
    "structured output is parsed",
  )
})
