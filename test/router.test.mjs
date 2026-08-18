import test from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

import plugin from "../index.mjs"
import { selectRoute } from "../src/router.mjs"
import { LeaseManager } from "../src/lease.mjs"

const gpt = { providerID: "openai", modelID: "gpt-5.6-sol" }
const qwen = { providerID: "custom", modelID: "qwen-main" }
const nvidia = { providerID: "nvidia", modelID: "nemotron-3-ultra", variant: "high" }
const local = { providerID: "local", modelID: "qwen3.6-35b-a3b" }
const developer = { providerID: "local-developer", modelID: "qwen3.8-27b", variant: "quality" }
const text = (value) => [{ type: "text", text: value }]
const fakeSupervisor = fileURLToPath(new URL("./fixtures/fake-lease.mjs", import.meta.url))

test("OpenAI utility agents use their fixed role-specialized models", () => {
  const gptExplore = selectRoute({ model: gpt, agent: "explore", parts: text("find files") })
  assert.equal(gptExplore.providerID, "openai")
  assert.equal(gptExplore.modelID, "gpt-5.4-mini")
  assert.equal(gptExplore.variant, "medium")

  const gptTests = selectRoute({ model: gpt, agent: "test-runner", parts: text("run tests") })
  assert.equal(gptTests.providerID, "openai")
  assert.equal(gptTests.modelID, "gpt-5.3-codex-spark")
  assert.equal(gptTests.variant, "medium")

  const gptReviewer = selectRoute({ model: gpt, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(gptReviewer.providerID, "openai")
  assert.equal(gptReviewer.modelID, "gpt-5.6-terra")
  assert.equal(gptReviewer.variant, "high")
})

test("Explore stays on Mini while non-OpenAI Reviewer inherits the main model", () => {
  const qwenRoute = selectRoute({ model: qwen, agent: "explore", parts: text("find files") })
  assert.ok(qwenRoute)
  assert.equal(qwenRoute.modelID, "gpt-5.4-mini")
  assert.equal(qwenRoute.providerID, "openai")

  const qwenReviewer = selectRoute({ model: qwen, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(qwenReviewer.modelID, "qwen-main")
  assert.equal(qwenReviewer.providerID, "custom")

  const localRoute = selectRoute({ model: local, agent: "explore", parts: text("find files") })
  assert.ok(localRoute)
  assert.equal(localRoute.providerID, "openai")
  assert.equal(localRoute.modelID, "gpt-5.4-mini")

  const nvidiaReviewer = selectRoute({ model: nvidia, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(nvidiaReviewer.providerID, "nvidia")
  assert.equal(nvidiaReviewer.modelID, "nemotron-3-ultra")
})

test("non-OpenAI high-risk judgment inherits the main model", () => {
  const route = selectRoute({
    model: nvidia,
    agent: "reviewer",
    parts: text("Give the final security release go/no-go verdict"),
  })
  assert.equal(route.providerID, "nvidia")
  assert.equal(route.modelID, "nemotron-3-ultra")
  assert.equal(route.tier, undefined)
  assert.equal(route.variant, "high")
  assert.equal(route.agent, "risk-analyst")
  assert.ok(route.reason.includes("high-risk-judgment"))
})

test("primary agents keep their selected model and do not auto-convert to subagents", () => {
  assert.equal(
    selectRoute({ model: local, agent: "build", parts: text("Give the final security release verdict") }),
    undefined,
  )
  assert.equal(selectRoute({ model: gpt, agent: "plan", parts: text("Final migration decision") }), undefined)
})

test("routes bounded discovery to GPT-5.4 Mini medium", () => {
  assert.deepEqual(selectRoute({ model: nvidia, agent: "explore", parts: text("Locate the router definition") }), {
    providerID: "openai",
    modelID: "gpt-5.4-mini",
    tier: undefined,
    variant: "medium",
    agent: undefined,
    reason: ["agent:explore", "fixed-openai"],
  })
})

test("test-runner uses GPT-5.3 Codex Spark medium", () => {
  const route = selectRoute({ model: nvidia, agent: "test-runner", parts: text("Run unit tests") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.3-codex-spark")
  assert.equal(route.tier, undefined)
  assert.equal(route.variant, "medium")
})

test("developer uses the dedicated quality-focused local model", () => {
  const route = selectRoute({ model: gpt, agent: "developer", parts: text("Implement the approved change") })
  assert.equal(route.providerID, "local-developer")
  assert.equal(route.modelID, "qwen3.8-27b")
  assert.equal(route.variant, "quality")
  assert.equal(route.tier, undefined)
})

test("high-risk developer judgment promotes to the OpenAI risk analyst", () => {
  const route = selectRoute({
    model: gpt,
    agent: "developer",
    parts: text("Give the final security release go/no-go verdict"),
  })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.agent, "risk-analyst")
})

test("approved security implementation remains a Developer task", () => {
  const route = selectRoute({
    model: gpt,
    agent: "developer",
    parts: text("Implement the approved authentication change within the assigned files"),
  })
  assert.equal(route.providerID, "local-developer")
  assert.equal(route.modelID, "qwen3.8-27b")
  assert.equal(route.agent, undefined)
})

test("non-OpenAI reviewer inherits the primary model", () => {
  const route = selectRoute({ model: nvidia, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(route.providerID, "nvidia")
  assert.equal(route.modelID, "nemotron-3-ultra")
  assert.equal(route.tier, undefined)
  assert.equal(route.variant, "high")
})

test("risk-analyst routes to Sol xhigh", () => {
  const route = selectRoute({ model: gpt, agent: "risk-analyst", parts: text("Final security verdict") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.tier, "sol")
  assert.equal(route.variant, "xhigh")
})

test("reviewer defaults to Terra high and accepts explicit xhigh effort", () => {
  const base = selectRoute({ model: gpt, agent: "reviewer", parts: text("Review the lifecycle change") })
  assert.equal(base.modelID, "gpt-5.6-terra")
  assert.equal(base.variant, "high")

  const escalated = selectRoute({
    model: gpt,
    agent: "reviewer",
    parts: text("Review the lifecycle change [effort:xhigh]"),
  })
  assert.equal(escalated.modelID, "gpt-5.6-terra")
  assert.equal(escalated.variant, "xhigh")
})

test("promotes high-risk final judgment to Sol from reviewer", () => {
  const route = selectRoute({
    model: gpt,
    agent: "reviewer",
    parts: text("Give the final security release go/no-go verdict"),
  })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.agent, "risk-analyst")
  assert.ok(route.reason.includes("high-risk-judgment"))
})

test("tier markers do not override fixed Explore routing", () => {
  const inPlace = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [route:terra]") })
  assert.equal(inPlace.providerID, "openai")
  assert.equal(inPlace.modelID, "gpt-5.4-mini")
  assert.equal(inPlace.tier, undefined)
  assert.equal(inPlace.variant, "medium")

  const sol = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [route:sol]") })
  assert.equal(sol.providerID, "openai")
  assert.equal(sol.modelID, "gpt-5.4-mini")
  assert.equal(sol.tier, undefined)
  assert.equal(sol.variant, "medium")
})

test("non-OpenAI tier markers do not override fixed Explore", () => {
  const route = selectRoute({ model: nvidia, agent: "explore", parts: text("Locate files [route:terra]") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.4-mini")
  assert.equal(route.tier, undefined)
  assert.equal(route.variant, "medium")
  assert.deepEqual(route.reason, ["agent:explore", "fixed-openai"])
})

test("explicit maximum effort cannot override fixed Explore", () => {
  const max = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [effort:max]") })
  assert.equal(max.providerID, "openai")
  assert.equal(max.modelID, "gpt-5.4-mini")
  assert.equal(max.tier, undefined)
  assert.equal(max.variant, "medium")

  const noDowngrade = selectRoute({ model: gpt, agent: "risk-analyst", parts: text("Final release verdict [route:luna]") })
  assert.equal(noDowngrade.providerID, "openai")
  assert.equal(noDowngrade.modelID, "gpt-5.6-sol")
  assert.equal(noDowngrade.variant, "xhigh")
})

test("plugin installs agents and fixes Explore on GPT-5.4 Mini", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)

  assert.equal(config.agent["explore"].mode, "subagent")
  assert.equal(config.agent["explore"].steps, 12)
  assert.equal(config.agent["test-runner"].mode, "subagent")
  assert.equal(config.agent["reviewer"].mode, "subagent")
  assert.equal(config.permission["*"], "allow")
  assert.equal(config.permission.doom_loop, "allow")
  assert.equal(config.permission.external_directory, "allow")
  assert.equal(config.agent["explore"].permission["*"], "allow")
  assert.equal(config.agent["test-runner"].permission["*"], "allow")
  assert.equal(config.agent["reviewer"].permission["*"], "allow")
  assert.equal(config.agent["risk-analyst"].mode, "subagent")
  assert.equal(config.agent["risk-analyst"].permission["*"], "allow")
  assert.equal(config.agent.plan.permission.bash, "deny")
  assert.equal(config.agent.plan.permission.edit["*"], "deny")
  assert.equal(config.agent.plan.permission.edit[".opencode/working-state.md"], "allow")
  assert.equal(config.agent.plan.permission.read["*.env"], "deny")
  assert.equal(config.agent.plan.permission.doom_loop, "deny")
  assert.equal(config.instructions.length, 1)

  const output = { message: { model: gpt }, parts: text("Locate the router") }
  await hooks["chat.message"]({ model: gpt, agent: "explore" }, output)
  assert.deepEqual(output.message.model, {
    providerID: "openai",
    modelID: "gpt-5.4-mini",
    variant: "medium",
  })
  assert.equal(output.message.agent, undefined)
})

test("plugin fixes Explore on Mini and inherits non-OpenAI Reviewer", async () => {
  const hooks = await plugin()
  const output = { message: { model: qwen }, parts: text("Locate the router") }
  await hooks["chat.message"]({ model: qwen, agent: "explore" }, output)
  assert.deepEqual(output.message.model, {
    providerID: "openai",
    modelID: "gpt-5.4-mini",
    variant: "medium",
  })

  const denseOutput = { message: { model: nvidia }, parts: text("Review this PR") }
  await hooks["chat.message"]({ model: nvidia, agent: "reviewer" }, denseOutput)
  assert.deepEqual(denseOutput.message.model, {
    providerID: "nvidia",
    modelID: "nemotron-3-ultra",
    variant: "high",
  })
})

test("direct non-OpenAI risk-analyst use inherits the main model", () => {
  const route = selectRoute({ model: nvidia, agent: "risk-analyst", parts: text("Assess the evidence") })
  assert.equal(route.providerID, "nvidia")
  assert.equal(route.modelID, "nemotron-3-ultra")
  assert.equal(route.tier, undefined)
  assert.equal(route.variant, "high")
  assert.ok(route.reason.includes("non-openai-main-inheritance"))
})

test("plugin falls back to resolved output agent and model", async () => {
  const hooks = await plugin()
  const output = { message: { model: gpt, agent: "reviewer" }, parts: text("Review this PR") }
  await hooks["chat.message"]({}, output)
  assert.deepEqual(output.message.model, {
    providerID: "openai",
    modelID: "gpt-5.6-terra",
    variant: "high",
  })
})

test("plugin preserves a separate non-OpenAI input variant for Risk Analyst", async () => {
  const hooks = await plugin()
  const model = { providerID: "nvidia", modelID: "nemotron-3-ultra" }
  const output = { message: { model, agent: "risk-analyst" }, parts: text("Assess the evidence") }
  await hooks["chat.message"]({ model, agent: "risk-analyst", variant: "high" }, output)
  assert.deepEqual(output.message.model, {
    providerID: "nvidia",
    modelID: "nemotron-3-ultra",
    variant: "high",
  })
})

test("plugin loads reserved prompts for all installed agents", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)
  for (const name of ["developer", "explore", "test-runner", "reviewer", "risk-analyst"]) {
    assert.ok(config.agent[name].prompt.length > 100, `${name} prompt should be loaded`)
  }
  assert.match(config.agent.developer.prompt, /do not inventory the repository/i)
  assert.match(config.agent.developer.prompt, /smallest targeted verification/i)
  assert.match(config.agent.developer.prompt, /two unsuccessful repair attempts/i)
  assert.match(config.agent.reviewer.prompt, /Never return `Approved`/)
})

test("plugin installs a write-capable developer with unrestricted tool permission", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)

  assert.equal(config.agent.developer.mode, "subagent")
  assert.equal(config.agent.developer.steps, 40)
  assert.match(config.agent.developer.description, /targets safe two-Developer waves/)
  assert.equal(config.agent.developer.permission["*"], "allow")
  assert.equal(config.agent.developer.permission.bash, "allow")
  assert.equal(config.agent.developer.permission.external_directory, "allow")
})

test("resident local agents reject background waves before acquiring a lease", async () => {
  const hooks = await plugin()
  await assert.rejects(
    () =>
      hooks["tool.execute.before"](
        { tool: "task", sessionID: "parent", callID: "background" },
        { args: { subagent_type: "developer", background: true } },
      ),
    /Build controls the active wave/,
  )
})

test("detached child lifecycle retains the shared lease past parent idle", async () => {
  const manager = new LeaseManager({ supervisorPath: fakeSupervisor })
  const hooks = await plugin({ leaseManager: manager })
  await hooks["tool.execute.before"](
    { tool: "task", sessionID: "parent", callID: "call" },
    { args: { subagent_type: "developer" } },
  )
  await hooks["tool.execute.after"](
    { tool: "task", sessionID: "parent", callID: "call" },
    { metadata: { background: true, sessionId: "child" } },
  )
  await hooks.event({ event: { type: "session.status", properties: { sessionID: "parent", status: { type: "idle" } } } })
  assert.ok(manager.current)
  await hooks.event({ event: { type: "session.status", properties: { sessionID: "child", status: { type: "idle" } } } })
  assert.equal(manager.current, null)
})

test("recognizes common high-risk operational language promotes to risk-analyst", () => {
  for (const prompt of [
    "Is this OAuth rollout ready to ship?",
    "Should we ship this OAuth migration?",
    "Can we merge the RBAC rollout?",
    "Should we revoke these credentials?",
    "Can we delete production customer data?",
    "Give the final RBAC permissions verdict",
    "Can we proceed with the customer PII migration?",
    "Can we grant admin permissions?",
    "Should we run this production migration?",
    "Should we refund this payment?",
    "Can we declare an incident?",
    "Should we deploy?",
    "Can we roll out?",
    "이 결제 마이그레이션을 진행해도 되는지 최종 판정하세요",
  ]) {
    const route = selectRoute({ model: gpt, agent: "reviewer", parts: text(prompt) })
    assert.equal(route.modelID, "gpt-5.6-sol", prompt)
    assert.equal(route.agent, "risk-analyst", prompt)
  }
})

test("reserved prompts and unrestricted permission cannot be replaced", async () => {
  const hooks = await plugin()
  const config = {
    instructions: [],
    agent: {
      plan: { permission: "allow" },
      custom: { permission: "deny" },
      explore: { prompt: "untrusted explore", permission: "deny" },
      "risk-analyst": { prompt: "untrusted", permission: "deny" },
    },
  }
  hooks.config(config)

  assert.notEqual(config.agent["risk-analyst"].prompt, "untrusted")
  assert.notEqual(config.agent.explore.prompt, "untrusted explore")
  assert.equal(config.agent.explore.permission["*"], "allow")
  assert.equal(config.agent["risk-analyst"].permission["*"], "allow")
  assert.equal(config.agent.custom.permission["*"], "allow")
  assert.equal(config.agent.plan.permission.bash, "deny")
  assert.equal(config.agent.plan.permission.edit["*"], "deny")
})
