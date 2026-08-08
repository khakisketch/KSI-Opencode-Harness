import test from "node:test"
import assert from "node:assert/strict"

import plugin from "../index.mjs"
import { selectRoute } from "../src/router.mjs"

const gpt = { providerID: "openai", modelID: "gpt-5.6-sol" }
const qwen = { providerID: "alibaba", modelID: "qwen3-235b-a22b" }
const local = { providerID: "local", modelID: "qwen3.6-35b-a3b" }
const localReviewer = { providerID: "local-reviewer", modelID: "qwen3.6-35b-a3b" }
const text = (value) => [{ type: "text", text: value }]

test("gpt main keeps gpt subagents", () => {
  const gptExplore = selectRoute({ model: gpt, agent: "explore", parts: text("find files") })
  assert.equal(gptExplore.providerID, "openai")
  assert.equal(gptExplore.modelID, "gpt-5.6-luna")

  const gptReviewer = selectRoute({ model: gpt, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(gptReviewer.providerID, "openai")
  assert.equal(gptReviewer.modelID, "gpt-5.6-terra")
})

test("non-gpt main routes subagents to local", () => {
  const qwenRoute = selectRoute({ model: qwen, agent: "explore", parts: text("find files") })
  assert.ok(qwenRoute)
  assert.equal(qwenRoute.modelID, "qwen3.6-35b-a3b")
  assert.equal(qwenRoute.providerID, "local")

  const qwenReviewer = selectRoute({ model: qwen, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(qwenReviewer.modelID, "qwen3.6-35b-a3b")
  assert.equal(qwenReviewer.providerID, "local")

  const localRoute = selectRoute({ model: local, agent: "explore", parts: text("find files") })
  assert.ok(localRoute)
  assert.equal(localRoute.providerID, "local")
  assert.equal(localRoute.modelID, "qwen3.6-35b-a3b")
})

test("local reviewer provider routes reviewer to qwen3.6-35b-a3b", () => {
  const route = selectRoute({ model: localReviewer, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(route.providerID, "local")
  assert.equal(route.modelID, "qwen3.6-35b-a3b")
  assert.equal(route.tier, "terra")
  assert.equal(route.variant, "xhigh")
})

test("local high-risk judgment promotes to cloud risk-analyst", () => {
  const route = selectRoute({
    model: local,
    agent: "reviewer",
    parts: text("Give the final security release go/no-go verdict"),
  })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.tier, "sol")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.agent, "risk-analyst")
  assert.ok(route.reason.includes("high-risk-judgment"))

  const bigRoute = selectRoute({
    model: localReviewer,
    agent: "reviewer",
    parts: text("Final migration go/no-go"),
  })
  assert.equal(bigRoute.providerID, "openai")
  assert.equal(bigRoute.modelID, "gpt-5.6-sol")
  assert.equal(bigRoute.agent, "risk-analyst")
})

test("routes bounded discovery to Luna with explicit effort", () => {
  assert.deepEqual(selectRoute({ model: gpt, agent: "explore", parts: text("Locate the router definition") }), {
    providerID: "openai",
    modelID: "gpt-5.6-luna",
    tier: "luna",
    variant: "high",
    temperature: 0.1,
    maxTokens: 128000,
    agent: undefined,
    reason: ["agent:explore"],
  })
})

test("test-runner routes to Luna", () => {
  const route = selectRoute({ model: gpt, agent: "test-runner", parts: text("Run unit tests") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-luna")
  assert.equal(route.tier, "luna")
  assert.equal(route.variant, "high")
  assert.equal(route.temperature, 0.1)
})

test("reviewer routes to Terra xhigh", () => {
  const route = selectRoute({ model: gpt, agent: "reviewer", parts: text("Review this PR") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-terra")
  assert.equal(route.tier, "terra")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.temperature, 0.0)
})

test("risk-analyst routes to Sol xhigh", () => {
  const route = selectRoute({ model: gpt, agent: "risk-analyst", parts: text("Final security verdict") })
  assert.equal(route.providerID, "openai")
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.tier, "sol")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.temperature, 0.0)
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

test("explicit tier marker promotes within the main provider", () => {
  const terra = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [route:terra]") })
  assert.equal(terra.providerID, "openai")
  assert.equal(terra.modelID, "gpt-5.6-terra")
  assert.equal(terra.tier, "terra")
  assert.equal(terra.variant, "xhigh")

  const sol = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [route:sol]") })
  assert.equal(sol.providerID, "openai")
  assert.equal(sol.modelID, "gpt-5.6-sol")
  assert.equal(sol.tier, "sol")
  assert.equal(sol.variant, "xhigh")
})

test("explicit maximum effort implies Sol and never downgrades", () => {
  const max = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [effort:max]") })
  assert.equal(max.providerID, "openai")
  assert.equal(max.modelID, "gpt-5.6-sol")
  assert.equal(max.variant, "max")

  const noDowngrade = selectRoute({ model: gpt, agent: "risk-analyst", parts: text("Final release verdict [route:luna]") })
  assert.equal(noDowngrade.providerID, "openai")
  assert.equal(noDowngrade.modelID, "gpt-5.6-sol")
  assert.equal(noDowngrade.variant, "xhigh")
})

test("plugin installs agents and writes model plus variant", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)

  assert.equal(config.agent["explore"].mode, "subagent")
  assert.equal(config.agent["test-runner"].mode, "subagent")
  assert.equal(config.agent["reviewer"].mode, "subagent")
  assert.equal(config.agent["risk-analyst"].mode, "subagent")
  assert.equal(config.agent["risk-analyst"].permission.edit, "deny")
  assert.equal(config.agent["risk-analyst"].permission["*"], "deny")
  assert.equal(config.instructions.length, 1)

  const output = { message: { model: gpt }, parts: text("Locate the router") }
  await hooks["chat.message"]({ model: gpt, agent: "explore" }, output)
  assert.deepEqual(output.message.model, {
    providerID: "openai",
    modelID: "gpt-5.6-luna",
    variant: "high",
  })
  assert.equal(output.message.agent, undefined)
})

test("plugin routes non-gpt subagents to local while preserving cloud risk routing", async () => {
  const hooks = await plugin()
  const output = { message: { model: local }, parts: text("Locate the router") }
  await hooks["chat.message"]({ model: local, agent: "explore" }, output)
  assert.deepEqual(output.message.model, {
    providerID: "local",
    modelID: "qwen3.6-35b-a3b",
    variant: "high",
  })

  const denseOutput = { message: { model: localReviewer }, parts: text("Review this PR") }
  await hooks["chat.message"]({ model: localReviewer, agent: "reviewer" }, denseOutput)
  assert.deepEqual(denseOutput.message.model, {
    providerID: "local",
    modelID: "qwen3.6-35b-a3b",
    variant: "xhigh",
  })
})

test("plugin loads reserved prompts for all installed agents", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)
  for (const name of ["explore", "test-runner", "reviewer", "risk-analyst"]) {
    assert.ok(config.agent[name].prompt.length > 100, `${name} prompt should be loaded`)
  }
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
    "이 결제 마이그레이션을 진행해도 되는지 최종 판정하세요",
  ]) {
    const route = selectRoute({ model: gpt, agent: "reviewer", parts: text(prompt) })
    assert.equal(route.modelID, "gpt-5.6-sol", prompt)
    assert.equal(route.agent, "risk-analyst", prompt)
  }
})

test("reserved agents and secret read rules cannot be replaced", async () => {
  const hooks = await plugin()
  const config = {
    instructions: [],
    agent: {
      explore: { prompt: "untrusted explore", permission: { codex: "allow" } },
      "risk-analyst": { prompt: "untrusted", permission: "allow" },
    },
  }
  hooks.config(config)

  assert.notEqual(config.agent["risk-analyst"].prompt, "untrusted")
  assert.notEqual(config.agent.explore.prompt, "untrusted explore")
  assert.equal(config.agent.explore.permission.codex, undefined)
  assert.equal(config.agent.explore.permission["*"], "deny")
  assert.equal(config.agent["risk-analyst"].permission["*"], "deny")
  assert.equal(config.agent["risk-analyst"].permission.read["**/.env"], "deny")
  assert.equal(config.agent["risk-analyst"].permission.read[".npmrc"], "deny")
  assert.equal(config.agent["risk-analyst"].permission.read["*.key"], "deny")
})
