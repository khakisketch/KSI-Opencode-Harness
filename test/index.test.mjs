import test from "node:test"
import assert from "node:assert/strict"
import plugin from "../index.mjs"
import { ROLES, CALLS } from "../src/agents.mjs"

const contract = "Objective: Fix a bounded behavior.\nAllowed write paths: src/example.mjs\nForbidden shared files: package-lock.json\nAcceptance criteria: Regression test passes.\nTargeted verification: npm test\nEscalate if: Public contract changes."
const evidence = "Objective: Inspect.\nScope: src/example.mjs, cwd repository, no external effects.\nCommands: npm test\nEvidence: supplied baseline and changed paths."

test("installs six native roles without choosing a model or variant", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  for (const name of ROLES) {
    assert.equal("model" in config.agent[name], false)
    assert.equal("variant" in config.agent[name], false)
    assert.equal(config.agent[name].permission.task, "deny")
    assert.equal(config.agent[name].permission.external_directory, "deny")
  }
  assert.equal(config.agent.developer.permission.edit, "ask")
  assert.equal(config.agent["developer-complex"].permission.bash, "ask")
  assert.equal(config.agent.developer.permission.skill["test-driven-development"], "allow")
  assert.equal(config.agent.reviewer.permission.bash, "deny")
  assert.equal(config.agent["test-runner"].permission.bash, "allow")
  assert.equal(config.agent.plan.permission.task["plan-reviewer"], "allow")
  assert.equal(config.agent.plan.permission.bash, "deny")
})

test("preserves Primary model/effort and explicit Build grants and denials", async () => {
  const hooks = await plugin()
  for (const permission of ["deny", "ask", { bash: "deny", edit: "ask", task: "deny" }]) {
    const config = { model: "custom/main", agent: {
      plan: { model: "custom/plan", variant: "quality" },
      build: { model: "custom/build", variant: "fast", permission },
    } }
    hooks.config(config)
    assert.equal(config.agent.plan.model, "custom/plan")
    assert.equal(config.agent.plan.variant, "quality")
    assert.equal(config.agent.build.model, "custom/build")
    assert.equal(config.agent.build.variant, "fast")
    assert.deepEqual(config.agent.build.permission, permission)
    assert.equal(config.model, "custom/main")
  }
})

test("preserves only native worker model and variant selections", async () => {
  const hooks = await plugin()
  const config = { agent: { developer: { model: "local/approved" }, reviewer: { variant: "xhigh" }, custom: { model: "custom/other" } } }
  hooks.config(config)
  assert.equal(config.agent.developer.model, "local/approved")
  assert.equal("variant" in config.agent.developer, false)
  assert.equal(config.agent.reviewer.variant, "xhigh")
  assert.equal("model" in config.agent.reviewer, false)
  assert.equal(config.agent.custom.model, "custom/other")
  for (const name of ROLES.filter((name) => !["developer", "reviewer"].includes(name))) {
    assert.equal("model" in config.agent[name], false)
    assert.equal("variant" in config.agent[name], false)
  }
})

test("preserves a worker's explicit model and variant without injecting cloud effort", async () => {
  const hooks = await plugin()
  const config = { agent: { "developer-complex": { model: "custom/approved", variant: "careful" } } }
  hooks.config(config)
  assert.equal(config.agent["developer-complex"].model, "custom/approved")
  assert.equal(config.agent["developer-complex"].variant, "careful")
  const snapshot = structuredClone(config)
  hooks.config(config)
  assert.deepEqual(config, snapshot)
})

test("installs isolated mutable permission objects for every role and config", async () => {
  const hooks = await plugin()
  const first = {}
  const second = {}
  hooks.config(first)
  hooks.config(second)

  first.agent.developer.permission.read["*"] = "deny"
  first.agent.plan.permission.task.explore = "deny"
  assert.equal(first.agent["developer-complex"].permission.read["*"], "allow")
  assert.equal(second.agent.developer.permission.read["*"], "allow")
  assert.equal(second.agent.plan.permission.task.explore, "allow")
})

test("preserves inherited Build denial and existing commands", async () => {
  const hooks = await plugin()
  const config = { permission: "deny", command: { review: { template: "custom review", agent: "build" } } }
  hooks.config(config)
  assert.equal(config.permission, "deny")
  assert.equal(config.agent.build.permission, undefined)
  assert.equal(config.command.review.template, "custom review")
  assert.equal(config.command.complete.agent, "build")
})

test("enforces caller/target graph including unknown caller and recursive bypass", async () => {
  const hooks = await plugin()
  for (const caller of ["plan", "build", ...ROLES, "general", "unknown"]) {
    await hooks["chat.params"]({ sessionID: caller, agent: caller })
    for (const target of [...ROLES, "general", "custom"]) {
      const invoke = () => hooks["tool.execute.before"]({ tool: "task", sessionID: caller }, { args: {
        subagent_type: target, prompt: target.startsWith("developer") ? contract : evidence,
      } })
      if (CALLS[caller]?.includes(target)) await assert.doesNotReject(invoke)
      else await assert.rejects(invoke, /not allowed/)
    }
  }
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "missing" }, { args: { subagent_type: "explore", prompt: evidence } }), /not allowed/)
})

test("validates contracts, foreground execution, excluded skills and session cleanup", async () => {
  const hooks = await plugin()
  await hooks["chat.params"]({ sessionID: "s", agent: "build" })
  const invoke = (args) => hooks["tool.execute.before"]({ tool: "task", sessionID: "s" }, { args })
  for (const name of ["developer", "developer-complex"]) {
    await assert.rejects(() => invoke({ subagent_type: name, prompt: "Objective: incomplete" }), /missing required/)
    await assert.rejects(() => invoke({ subagent_type: name, prompt: contract, background: true }), /foreground/)
    await assert.doesNotReject(() => invoke({ subagent_type: name, task_id: "existing", prompt: "Failure: test failed\nEvidence: assertion mismatch" }))
  }
  await assert.rejects(() => invoke({ subagent_type: "reviewer", prompt: "Objective: inspect\nScope: file" }), /Evidence/)
  for (const name of ["grill-me", "goals"]) await assert.rejects(() => hooks["tool.execute.before"]({ tool: "skill" }, { args: { name } }), /excluded/)
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "skill" }, { args: { name: "brainstorming" } }))
  await hooks.event({ event: { type: "session.deleted", properties: { info: { id: "s" } } } })
  await assert.rejects(() => invoke({ subagent_type: "explore", prompt: evidence }), /unknown/)
})

test("installs approved execution budgets and preserves explicit positive native steps", async () => {
  const hooks = await plugin()
  const config = { agent: {
    explore: { steps: 7 },
    "plan-reviewer": { steps: 8 },
    developer: { steps: 9 },
    "developer-complex": { steps: 10 },
    "test-runner": { steps: 11 },
    reviewer: { steps: 12 },
  } }
  hooks.config(config)
  assert.deepEqual(Object.fromEntries(ROLES.map((name) => [name, config.agent[name].steps])), {
    explore: 7, "plan-reviewer": 8, developer: 9, "developer-complex": 10, "test-runner": 11, reviewer: 12,
  })

  const defaults = {}
  hooks.config(defaults)
  assert.deepEqual(Object.fromEntries(ROLES.map((name) => [name, defaults.agent[name].steps])), {
    explore: 20, "plan-reviewer": 24, developer: 60, "developer-complex": 80, "test-runner": 16, reviewer: 32,
  })
})

test("rejects invalid supplied native steps instead of defaulting them", async () => {
  const hooks = await plugin()
  for (const steps of [0, null, undefined, -1, 1.5, "60", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => hooks.config({ agent: { developer: { steps } } }), /positive integer native steps/)
  }
})

test("rejects unknown or non-boolean plugin options", async () => {
  await assert.rejects(() => plugin({}, { developerTestRunner: "true" }), /developerTestRunner.*boolean/)
  await assert.rejects(() => plugin({}, { unknown: true }), /unknown plugin option/)
  await assert.rejects(() => plugin({}, null), /options.*object/)
})

test("enables only Developer to Test Runner native task permission when opted in", async () => {
  const disabled = await plugin()
  const disabledConfig = {}
  disabled.config(disabledConfig)
  assert.equal(disabledConfig.agent.developer.permission.task, "deny")

  const enabled = await plugin({}, { developerTestRunner: true })
  const config = {}
  enabled.config(config)
  for (const name of ["developer", "developer-complex"]) {
    assert.deepEqual(config.agent[name].permission.task, { "*": "deny", "test-runner": "allow" })
  }
  assert.equal(config.agent["test-runner"].permission.task, "deny")
  assert.match(config.agent.developer.prompt, /author feedback/i)
  assert.doesNotMatch(disabledConfig.agent.developer.prompt, /author feedback/i)
})

test("sets native subagent depth two only for the opted-in helper path", async () => {
  const disabled = await plugin()
  const disabledConfig = {}
  disabled.config(disabledConfig)
  assert.equal("subagent_depth" in disabledConfig, false)

  const enabled = await plugin({}, { developerTestRunner: true })
  const defaultConfig = {}
  enabled.config(defaultConfig)
  assert.equal(defaultConfig.subagent_depth, 2)

  for (const subagent_depth of [0, 1, 3]) {
    const hooks = await plugin({}, { developerTestRunner: true })
    const config = { subagent_depth }
    hooks.config(config)
    assert.equal(config.subagent_depth, subagent_depth)
  }
})

test("denies helper acquisition before guard when native subagent depth is below two", async () => {
  const sessions = new Map([
    ["developer", { id: "developer", parentID: "build" }],
    ["build", { id: "build" }],
  ])
  const client = { session: { get: async ({ path: { id } }) => ({ data: sessions.get(id) }) } }
  const hooks = await plugin({ client }, { developerTestRunner: true })
  hooks.config({ subagent_depth: 1 })
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "helper" }, { args: helper }), /subagent_depth.*at least 2/i)
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "edit", sessionID: "developer", callID: "edit" }, { args: {} }))
})

test("preserves native depth above two without widening the root ancestry guard", async () => {
  const sessions = new Map([
    ["build", { id: "build" }],
    ["developer", { id: "developer", parentID: "build" }],
    ["nested", { id: "nested", parentID: "developer" }],
  ])
  const client = { session: { get: async ({ path: { id } }) => ({ data: sessions.get(id) }) } }
  const hooks = await plugin({ client }, { developerTestRunner: true })
  const config = { subagent_depth: 3 }
  hooks.config(config)
  assert.equal(config.subagent_depth, 3)
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  await hooks["chat.params"]({ sessionID: "nested", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "direct" }, { args: helper }))
  await hooks["tool.execute.after"]({ tool: "task", sessionID: "developer", callID: "direct", args: helper }, { title: "", output: "", metadata: {} })
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "nested", callID: "nested" }, { args: helper }), /root Build session/)
})

test("enforces opted-in helper ancestry, writer pause, terminal release, and result labeling", async () => {
  const sessions = new Map([
    ["developer", { id: "developer", parentID: "build" }],
    ["build", { id: "build" }],
  ])
  const client = { session: { get: async ({ path: { id } }) => ({ data: sessions.get(id) }) } }
  const hooks = await plugin({ client }, { developerTestRunner: true })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  await hooks["chat.params"]({ sessionID: "unrelated", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }

  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "helper" }, { args: helper }))
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "edit", sessionID: "developer", callID: "edit" }, { args: {} }), /helper.*active/)
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "bash", sessionID: "developer", callID: "bash" }, { args: {} }), /helper.*active/)
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "edit", sessionID: "unrelated", callID: "edit" }, { args: {} }))

  const result = { title: "Task result", output: "feedback", metadata: {} }
  await hooks["tool.execute.after"]({ tool: "task", sessionID: "developer", callID: "helper", args: helper }, result)
  assert.match(result.title, /author-requested.*not independent/i)
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "bash", sessionID: "developer", callID: "after" }, { args: {} }))

  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "terminal" }, { args: helper })
  await hooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", tool: "task", sessionID: "developer", callID: "terminal", state: { status: "error" },
  } } } })
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "edit", sessionID: "developer", callID: "after-terminal" }, { args: {} }))
})

async function helperHooks(sessions = new Map([
  ["developer", { id: "developer", parentID: "build" }],
  ["build", { id: "build" }],
])) {
  const client = { session: { get: async ({ path: { id } }) => ({ data: sessions.get(id) }) } }
  const hooks = await plugin({ client }, { developerTestRunner: true })
  hooks.config({})
  return hooks
}

test("does not release a Developer guard for unrelated child lifecycle events", async () => {
  const hooks = await helperHooks()
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }
  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "helper" }, { args: helper })

  await hooks.event({ event: { type: "session.created", properties: { info: { id: "unrelated-child", parentID: "developer" } } } })
  await hooks.event({ event: { type: "session.deleted", properties: { info: { id: "unrelated-child" } } } })
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "edit", sessionID: "developer", callID: "edit" }, { args: {} }), /helper.*active/)
})

test("labels known helpers in both terminal and after lifecycle orders", async () => {
  const hooks = await helperHooks()
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }

  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "after-first" }, { args: helper })
  const afterFirst = { title: "first", output: "", metadata: {} }
  await hooks["tool.execute.after"]({ tool: "task", sessionID: "developer", callID: "after-first", args: helper }, afterFirst)
  await hooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", tool: "task", sessionID: "developer", callID: "after-first", state: { status: "completed" },
  } } } })
  assert.match(afterFirst.title, /author-requested.*not independent/i)

  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "terminal-first" }, { args: helper })
  await hooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", tool: "task", sessionID: "developer", callID: "terminal-first", state: { status: "error" },
  } } } })
  const terminalFirst = { title: "second", output: "", metadata: {} }
  await hooks["tool.execute.after"]({ tool: "task", sessionID: "developer", callID: "terminal-first", args: helper }, terminalFirst)
  assert.match(terminalFirst.title, /author-requested.*not independent/i)
})

test("labels an old helper after its terminal event without unlocking a newer guard", async () => {
  const hooks = await helperHooks()
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "developer", agent: "developer" })
  const helper = { subagent_type: "test-runner", prompt: evidence }
  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "old" }, { args: helper })
  await hooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", tool: "task", sessionID: "developer", callID: "old", state: { status: "error" },
  } } } })
  await hooks["tool.execute.before"]({ tool: "task", sessionID: "developer", callID: "new" }, { args: helper })
  const oldResult = { title: "old", output: "", metadata: {} }
  await hooks["tool.execute.after"]({ tool: "task", sessionID: "developer", callID: "old", args: helper }, oldResult)
  assert.match(oldResult.title, /author-requested.*not independent/i)
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "bash", sessionID: "developer", callID: "write" }, { args: {} }), /helper.*active/)
})

test("allows only direct root-Build Complex helpers and keeps Test Runner non-recursive", async () => {
  const sessions = new Map([
    ["build", { id: "build" }],
    ["complex", { id: "complex", parentID: "build" }],
    ["nested", { id: "nested", parentID: "complex" }],
  ])
  const hooks = await helperHooks(sessions)
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "complex", agent: "developer-complex" })
  await hooks["chat.params"]({ sessionID: "nested", agent: "developer-complex" })
  await hooks["chat.params"]({ sessionID: "runner", agent: "test-runner" })
  const helper = { subagent_type: "test-runner", prompt: evidence }
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "complex", callID: "complex-helper" }, { args: helper }))
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "nested", callID: "nested-helper" }, { args: helper }), /root Build session/)
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "runner", callID: "recursive-helper" }, { args: helper }), /not allowed/)
})

test("uses an explicit narrow opt-in exception in enabled Developer descriptions", async () => {
  const disabled = await plugin()
  const disabledConfig = {}
  disabled.config(disabledConfig)
  assert.match(disabledConfig.agent.developer.description, /No delegation\.$/)

  const enabled = await plugin({}, { developerTestRunner: true })
  const enabledConfig = {}
  enabled.config(enabledConfig)
  for (const name of ["developer", "developer-complex"]) {
    assert.match(enabledConfig.agent[name].description, /except the narrow developerTestRunner opt-in/i)
    assert.match(enabledConfig.agent[name].prompt, /No delegation by default/i)
    assert.match(enabledConfig.agent[name].prompt, /author feedback/i)
  }
})
