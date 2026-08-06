import test from "node:test"
import assert from "node:assert/strict"

import plugin from "../index.mjs"
import { selectRoute } from "../src/router.mjs"

const gpt = { providerID: "openai", modelID: "gpt-5.6-sol" }
const text = (value) => [{ type: "text", text: value }]

test("leaves non-GPT parents unchanged", () => {
  assert.equal(
    selectRoute({ model: { providerID: "nvidia", modelID: "deepseek-ai/deepseek-v4-pro" }, agent: "explore", parts: text("find files") }),
    undefined,
  )
  assert.equal(
    selectRoute({ model: { providerID: "openai", modelID: "o4-mini" }, agent: "explore", parts: text("find files") }),
    undefined,
  )
})

test("routes bounded discovery to Luna with explicit effort", () => {
  assert.deepEqual(selectRoute({ model: gpt, agent: "explore", parts: text("Locate the router definition") }), {
    modelID: "gpt-5.6-luna",
    tier: "luna",
    variant: "high",
    agent: undefined,
    reason: ["agent:explore"],
  })
})

test("promotes synthesis disguised as explore to Terra", () => {
  const route = selectRoute({
    model: gpt,
    agent: "explore",
    parts: text("Reconcile the product roadmap and propose architecture tradeoffs"),
  })
  assert.equal(route.modelID, "gpt-5.6-terra")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.agent, "analyst")
  assert.ok(route.reason.includes("synthesis"))
})

test("promotes high-risk final judgment to Sol", () => {
  const route = selectRoute({
    model: gpt,
    agent: "reviewer",
    parts: text("Give the final security release go/no-go verdict"),
  })
  assert.equal(route.modelID, "gpt-5.6-sol")
  assert.equal(route.variant, "xhigh")
  assert.equal(route.agent, "risk-analyst")
  assert.ok(route.reason.includes("high-risk-judgment"))
})

test("keeps bounded security implementation on Terra", () => {
  const route = selectRoute({ model: gpt, agent: "general", parts: text("Implement the approved authorization fix") })
  assert.equal(route.modelID, "gpt-5.6-terra")
  assert.equal(route.variant, "high")
})

test("explicit maximum effort implies Sol and never downgrades", () => {
  const max = selectRoute({ model: gpt, agent: "explore", parts: text("Locate files [effort:max]") })
  assert.equal(max.modelID, "gpt-5.6-sol")
  assert.equal(max.variant, "max")

  const noDowngrade = selectRoute({ model: gpt, agent: "risk-analyst", parts: text("Final release verdict [route:luna]") })
  assert.equal(noDowngrade.modelID, "gpt-5.6-sol")
  assert.equal(noDowngrade.variant, "xhigh")
})

test("plugin installs agents and writes model plus variant", async () => {
  const hooks = await plugin()
  const config = { instructions: [], agent: {} }
  hooks.config(config)

  assert.equal(config.agent["analyst"].mode, "subagent")
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

test("recognizes common high-risk operational language", () => {
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

test("does not promote bounded implementation without decision language", () => {
  for (const prompt of [
    "Implement the approved OAuth fix",
    "Merge the approved OAuth fix",
    "Implement the credential rotation UI",
    "Add tests for payment validation",
  ]) {
    const route = selectRoute({ model: gpt, agent: "general", parts: text(prompt) })
    assert.equal(route.modelID, "gpt-5.6-terra", prompt)
    assert.equal(route.agent, undefined, prompt)
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
