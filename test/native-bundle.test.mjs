import test from "node:test"
import assert from "node:assert/strict"
import { buildNativeBundle } from "../src/native-bundle.mjs"

const agentNames = ["design", "developer", "test-runner", "reviewer"]

test("native bundle adds four roles without replacing built-in prompts or installing slash commands", async () => {
  const bundle = await buildNativeBundle()
  assert.deepEqual([...bundle.keys()].sort(), agentNames.map((name) => `agents/${name}.md`).sort())
  for (const name of agentNames) {
    const content = bundle.get(`agents/${name}.md`)
    assert.match(content, /^---\n/)
    assert.match(content, new RegExp(`\\nmode: ${name === "design" ? "primary" : "subagent"}\\n`))
    assert.match(content, /\npermissions: \[/)
    assert.doesNotMatch(content, /\n(?:model|steps|variant):/)
    assert.doesNotMatch(content, /"action":"ksi_[^"]+"/, "removed runtime tools must not be granted by the native bundle")
    assert.doesNotMatch(content, /"action":"skill"/, "native skill discovery must not be restricted by KSI")
    assert.doesNotMatch(content, /"action":"\*","resource":"\*","effect":"deny"/)
    assert.ok(content.split("---\n").at(-1).trim().length > 40)
  }
  assert.equal(bundle.has("agents/design-critic.md"), false)
  assert.doesNotMatch(bundle.get("agents/design.md"), /"action":"subagent","resource":"\*","effect":"deny"/)
  assert.match(bundle.get("agents/reviewer.md"), /"action":"edit","resource":"\*","effect":"deny"/)
  assert.match(bundle.get("agents/design.md"), /scale (?:the )?evidence to the work/i)
  assert.doesNotMatch(bundle.get("agents/design.md"), /Gates \(|no handoff without it/i)
  for (const name of agentNames) assert.doesNotMatch(bundle.get(`agents/${name}.md`), /You are (?:the )?KSI/i)
})

test("optional design kit adds complete OpenCode skill directories without changing default roles", async () => {
  const regular = await buildNativeBundle()
  const withKit = await buildNativeBundle({ withDesignKit: true })
  for (const [path, content] of regular) assert.equal(withKit.get(path), content)
  assert.deepEqual([...withKit.keys()].filter((path) => path.startsWith("skills/")).sort(), [
    "skills/frontend-design/LICENSE.txt",
    "skills/frontend-design/SKILL.md",
    ...["typography", "color", "anti-ai-slop", "state-coverage"].map((name) => `skills/frontend-design/references/craft/${name}.md`),
    "skills/impeccable-design-polish/SKILL.md",
    "skills/impeccable-design-polish/LICENSE",
    ...["typography", "color", "anti-ai-slop", "state-coverage", "accessibility-baseline", "animation-discipline"].map((name) => `skills/impeccable-design-polish/references/craft/${name}.md`),
    "skills/web-design-guidelines/LICENSE",
    "skills/web-design-guidelines/SKILL.md",
    "skills/web-design-guidelines/references/guidelines.md",
  ].sort())
  assert.match(withKit.get("skills/frontend-design/SKILL.md"), /name: frontend-design/)
  assert.match(withKit.get("skills/frontend-design/SKILL.md"), /OpenCode V2 usage/)
  assert.match(withKit.get("skills/frontend-design/SKILL.md"), /references\/craft\/typography\.md/)
  assert.doesNotMatch(withKit.get("skills/frontend-design/SKILL.md"), /optional upstream pairings named by the polish skill/)
  assert.match(withKit.get("skills/impeccable-design-polish/SKILL.md"), /references\/craft\/accessibility-baseline\.md/)
  assert.match(withKit.get("skills/impeccable-design-polish/SKILL.md"), /optional upstream pairings.*not installed/is)
  assert.match(withKit.get("skills/frontend-design/references/craft/typography.md"), /Typography craft rules/)
  const color = withKit.get("skills/frontend-design/references/craft/color.md")
  assert.ok(color.indexOf("# OpenCode V2 craft usage") < color.indexOf("# Color craft rules"))
  assert.match(color, /not mandatory KSI limits/i)
  assert.match(color, /OpenDesign daemon.*do not apply/is)
  const state = withKit.get("skills/impeccable-design-polish/references/craft/state-coverage.md")
  assert.ok(state.indexOf("# OpenCode V2 craft usage") < state.indexOf("# State coverage craft rules"))
  assert.match(state, /No fixed state or screenshot count/i)
  for (const [path, content] of withKit) {
    if (path.includes("/references/craft/")) assert.match(content, /^# OpenCode V2 craft usage/)
  }
  assert.match(withKit.get("skills/web-design-guidelines/SKILL.md"), /references\/guidelines\.md/)
  const guidelines = withKit.get("skills/web-design-guidelines/SKILL.md")
  assert.ok(guidelines.indexOf("## OpenCode V2 source boundary") < guidelines.indexOf("# Web Interface Guidelines"))
  assert.match(guidelines, /only when the Human explicitly asks for an update comparison/i)
  assert.match(guidelines, /untrusted reference data/i)
})

test("Developer to Test Runner delegation remains opt-in", async () => {
  const regular = (await buildNativeBundle()).get("agents/developer.md")
  const assisted = (await buildNativeBundle({ developerTestRunner: true })).get("agents/developer.md")
  assert.doesNotMatch(regular, /Developer-to-Test Runner assistance is enabled/)
  assert.match(assisted, /Developer-to-Test Runner assistance is enabled/)
  assert.match(assisted, /"action":"subagent","resource":"test-runner","effect":"allow"/)
  assert.doesNotMatch(regular, /"action":"subagent","resource":"test-runner","effect":"allow"/)
})

test("Design delegates investigation to Explore and independent review to Reviewer without retired roles", async () => {
  const bundle = await buildNativeBundle()
  const design = bundle.get("agents/design.md")
  const reviewer = bundle.get("agents/reviewer.md")
  assert.equal(bundle.has("agents/research.md"), false)
  assert.match(design, /"action":"subagent","resource":"explore","effect":"allow"/)
  assert.doesNotMatch(design, /"action":"subagent","resource":"research","effect":"allow"/)
  assert.match(design, /Explore.*local.*external/is)
  assert.equal(bundle.has("agents/design-critic.md"), false)
  assert.match(design, /"action":"subagent","resource":"reviewer","effect":"allow"/)
  assert.doesNotMatch(design, /"action":"subagent","resource":"design-critic","effect":"allow"/)
  assert.match(reviewer, /"action":"edit","resource":"\*","effect":"deny"/)
  assert.match(reviewer, /image input.*pixels/is)
})

test("Design is the material design owner while small established-pattern UI edits stay lightweight", async () => {
  const design = (await buildNativeBundle()).get("agents/design.md")
  assert.match(design, /normal Primary for material product, visual, and interaction design/i)
  assert.match(design, /Build can handle small UI changes within an approved pattern/i)
  assert.match(design, /Keep.*Change.*Do not copy/s)
  assert.match(design, /impeccable-design-polish/)
  assert.match(design, /Reviewer.*optional/s)
})
