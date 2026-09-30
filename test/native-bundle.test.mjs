import test from "node:test"
import assert from "node:assert/strict"
import { buildNativeBundle } from "../src/native-bundle.mjs"

const agentNames = ["developer", "test-runner", "reviewer"]

test("native bundle adds three subagent roles without replacing built-in prompts or installing slash commands", async () => {
  const bundle = await buildNativeBundle()
  assert.deepEqual([...bundle.keys()].sort(), agentNames.map((name) => `agents/${name}.md`).sort())
  for (const name of agentNames) {
    const content = bundle.get(`agents/${name}.md`)
    assert.match(content, /^---\n/)
    assert.match(content, /\nmode: subagent\n/)
    assert.match(content, /\npermissions: \[/)
    assert.doesNotMatch(content, /\n(?:model|steps|variant):/)
    assert.doesNotMatch(content, /"action":"ksi_[^"]+"/, "removed runtime tools must not be granted by the native bundle")
    assert.doesNotMatch(content, /"action":"skill"/, "native skill discovery must not be restricted by KSI")
    assert.doesNotMatch(content, /"action":"\*","resource":"\*","effect":"deny"/)
    assert.ok(content.split("---\n").at(-1).trim().length > 40)
  }
  assert.equal(bundle.has("agents/design.md"), false)
  assert.equal(bundle.has("agents/design-critic.md"), false)
  assert.equal(bundle.has("agents/research.md"), false)
  assert.match(bundle.get("agents/reviewer.md"), /"action":"edit","resource":"\*","effect":"deny"/)
  for (const name of agentNames) assert.doesNotMatch(bundle.get(`agents/${name}.md`), /You are (?:the )?KSI/i)
})

test("the retired design kit no longer contributes skills or craft references", async () => {
  const bundle = await buildNativeBundle()
  assert.deepEqual([...bundle.keys()].filter((path) => path.startsWith("skills/")), [])
  assert.deepEqual([...bundle.keys()].filter((path) => path.includes("vendor/")), [])
})

test("Developer to Test Runner delegation remains opt-in", async () => {
  const regular = (await buildNativeBundle()).get("agents/developer.md")
  const assisted = (await buildNativeBundle({ developerTestRunner: true })).get("agents/developer.md")
  assert.doesNotMatch(regular, /Developer-to-Test Runner assistance is enabled/)
  assert.match(assisted, /Developer-to-Test Runner assistance is enabled/)
  assert.match(assisted, /"action":"subagent","resource":"test-runner","effect":"allow"/)
  assert.doesNotMatch(regular, /"action":"subagent","resource":"test-runner","effect":"allow"/)
})

test("Reviewer stays a code and behaviour review role without design ownership", async () => {
  const reviewer = (await buildNativeBundle()).get("agents/reviewer.md")
  assert.match(reviewer, /"action":"edit","resource":"\*","effect":"deny"/)
  assert.match(reviewer, /"action":"subagent","resource":"\*","effect":"deny"/)
  assert.match(reviewer, /correctness, regressions/i)
  assert.doesNotMatch(reviewer, /design review|visual craft|approved direction/i)
  assert.doesNotMatch(reviewer, /frontend-design|impeccable-design-polish|web-design-guidelines/)
})

test("no remaining role claims design ownership or OpenDesign-vendored skills", async () => {
  const bundle = await buildNativeBundle()
  for (const name of agentNames) {
    const content = bundle.get(`agents/${name}.md`)
    assert.doesNotMatch(content, /material product, visual, and interaction design/i, `${name} must not claim design ownership`)
    assert.doesNotMatch(content, /frontend-design|impeccable-design-polish|web-design-guidelines/, `${name} must not reference the removed kit`)
  }
})
