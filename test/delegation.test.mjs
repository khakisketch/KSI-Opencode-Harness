import test from "node:test"
import assert from "node:assert/strict"
import { createDeveloperTestRunnerGuard } from "../src/delegation.mjs"

function session(id, parentID) {
  return {
    id, parentID, projectID: "project", directory: "/project", title: id, version: "1",
    time: { created: 1, updated: 1 },
  }
}

function clientFor(sessions) {
  return { session: { get: async ({ path: { id } }) => ({ data: sessions.get(id) }) } }
}

function allowedGuard() {
  const callers = new Map([["developer", "developer"], ["build", "build"]])
  const sessions = new Map([["developer", session("developer", "build")], ["build", session("build")]])
  return createDeveloperTestRunnerGuard({ client: clientFor(sessions), callers })
}

test("accepts a Developer that is a direct child of a root Build session", async () => {
  const guard = allowedGuard()
  await assert.doesNotReject(() => guard.acquire({ sessionID: "developer", callID: "help-1" }))
  assert.equal(guard.isActive("developer"), true)
})

test("fails closed when root ancestry or trusted Build role evidence is absent", async () => {
  const missing = createDeveloperTestRunnerGuard({ client: clientFor(new Map()), callers: new Map() })
  await assert.rejects(() => missing.acquire({ sessionID: "developer", callID: "one" }), /authoritative session ancestry/)
  assert.equal(missing.isActive("developer"), false)

  const wrongRole = createDeveloperTestRunnerGuard({
    client: clientFor(new Map([["developer", session("developer", "parent")], ["parent", session("parent")]])),
    callers: new Map([["parent", "plan"]]),
  })
  await assert.rejects(() => wrongRole.acquire({ sessionID: "developer", callID: "two" }), /root Build session/)

  const nonRoot = createDeveloperTestRunnerGuard({
    client: clientFor(new Map([["developer", session("developer", "build")], ["build", session("build", "earlier")]])),
    callers: new Map([["build", "build"]]),
  })
  await assert.rejects(() => nonRoot.acquire({ sessionID: "developer", callID: "three" }), /root Build session/)
})

test("acquires before asynchronous ancestry lookup and permits only one active helper", async () => {
  let releaseChild
  const child = new Promise((resolve) => { releaseChild = resolve })
  const client = { session: { get: async ({ path: { id } }) => {
    if (id === "developer") return { data: await child }
    return { data: session("build") }
  } } }
  const guard = createDeveloperTestRunnerGuard({ client, callers: new Map([["build", "build"]]) })
  const first = guard.acquire({ sessionID: "developer", callID: "first" })
  await assert.rejects(() => guard.acquire({ sessionID: "developer", callID: "second" }), /already active/)
  releaseChild(session("developer", "build"))
  await first
})

test("releases only the matching helper call after success or terminal error", async () => {
  const guard = allowedGuard()
  await guard.acquire({ sessionID: "developer", callID: "first" })
  assert.equal(guard.releaseAfter({ sessionID: "developer", callID: "first" }), true)
  assert.equal(guard.isActive("developer"), false)

  await guard.acquire({ sessionID: "developer", callID: "second" })
  assert.equal(guard.releaseTerminal({ sessionID: "developer", callID: "second", status: "error" }), true)
  assert.equal(guard.isActive("developer"), false)
})

test("keeps an unproven abort fail-closed and ignores stale terminal events", async () => {
  const guard = allowedGuard()
  await guard.acquire({ sessionID: "developer", callID: "old" })
  assert.equal(guard.releaseTerminal({ sessionID: "developer", callID: "old", status: "aborted" }), false)
  assert.equal(guard.isActive("developer"), true)
  assert.equal(guard.releaseAfter({ sessionID: "developer", callID: "old" }), true)

  await guard.acquire({ sessionID: "developer", callID: "new" })
  assert.equal(guard.releaseTerminal({ sessionID: "developer", callID: "old", status: "error" }), false)
  assert.equal(guard.activeCallID("developer"), "new")
})

test("cleans up guards for deleted sessions and disposal without affecting other sessions", async () => {
  const callers = new Map([["build-a", "build"], ["build-b", "build"]])
  const sessions = new Map([
    ["developer-a", session("developer-a", "build-a")], ["build-a", session("build-a")],
    ["developer-b", session("developer-b", "build-b")], ["build-b", session("build-b")],
  ])
  const guard = createDeveloperTestRunnerGuard({ client: clientFor(sessions), callers })
  await guard.acquire({ sessionID: "developer-a", callID: "a" })
  await guard.acquire({ sessionID: "developer-b", callID: "b" })
  guard.releaseSession("developer-a")
  assert.equal(guard.isActive("developer-a"), false)
  assert.equal(guard.isActive("developer-b"), true)
  guard.dispose()
  assert.equal(guard.isActive("developer-b"), false)
})
