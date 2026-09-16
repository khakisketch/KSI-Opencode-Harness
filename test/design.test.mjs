import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join, parse, relative, resolve, sep } from "node:path"
import plugin from "../index.mjs"
import { CALLS, ROLES } from "../src/agents.mjs"

const evidence = "Objective: Inspect.\nScope: src/example.mjs, cwd repository, no external effects.\nCommands: npm test\nEvidence: supplied baseline and changed paths."
const nativePreviewPattern = (worktree, directory) => `${relative(worktree, resolve(directory, "design-previews")).split(sep).join("/")}/**`

test("installs Design as an independent native Primary with the artifact-first defaults", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)

  assert.equal(config.agent.design.mode, "primary")
  assert.equal(config.agent.design.steps, 60)
  assert.equal("model" in config.agent.design, false)
  assert.equal("variant" in config.agent.design, false)
  assert.equal("temperature" in config.agent.design, false)
  assert.equal("effort" in config.agent.design, false)
  assert.equal("top_p" in config.agent.design, false)
  assert.equal(config.agent.design.permission.edit["*"], "deny")
  assert.equal(config.agent.design.permission.edit["design-previews/**"], "ask")
  assert.equal(config.agent.design.permission.edit[".opencode/working-state.md"], "allow")
  assert.equal(config.agent.design.permission.edit["*.tsx"], undefined)
  assert.equal(config.agent.design.permission.bash, "ask")
  assert.equal(config.agent.design.permission.external_directory, "ask")
  assert.equal(config.agent.design.permission.webfetch, "ask")
  assert.equal(config.agent.design.permission["playwright_*"], "ask")
  assert.equal(config.agent.design.permission["mobbin_*"], "ask")
  assert.equal(config.agent.design.permission["gpt_imagegen"], "ask")
  assert.equal(config.agent.design.permission["context7_*"], "ask")
  assert.equal(config.agent.design.permission.task, "deny")
  assert.equal(config.agent.design.permission.skill.brainstorming, "allow")
  assert.equal(config.agent.design.permission.skill["ui-ux-pro-max"], "allow")
  assert.equal(config.agent.design.permission.skill["test-driven-development"], undefined)
  assert.match(config.agent.design.prompt, /artifact-first/i)
  assert.equal("default_agent" in config, false)
  assert.deepEqual(ROLES, ["explore", "developer", "test-runner", "reviewer", "research", "design-task"])
  assert.equal("design" in CALLS, false)
})

test("unblocks dead Design tools while keeping other roles narrow", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  for (const tool of ["mobbin_*", "gpt_imagegen", "context7_*"]) {
    assert.equal(config.agent.design.permission[tool], "ask")
    assert.equal(config.agent["design-task"].permission[tool], "ask")
  }
  for (const name of ["explore", "developer", "test-runner", "reviewer"]) {
    assert.equal(config.agent[name].permission["mobbin_*"], undefined, `${name} must not gain mobbin grant`)
    assert.equal(config.agent[name].permission["gpt_imagegen"], undefined, `${name} must not gain gpt_imagegen grant`)
  }
})

test("mandates the visual loop and review mode with mockup-only image outputs", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /capture desktop 1280x800 plus mobile 390x844/i)
  assert.match(prompt, /READ each PNG via vision/i)
  assert.match(prompt, /list findings vs brief\/tokens\/direction/i)
  assert.match(prompt, /re-capture and re-read at least one full iteration/i)
  assert.match(prompt, /single verified capture suffices for established-pattern reuse/i)
  assert.match(prompt, /no handoff without it/i)
  assert.match(prompt, /gpt_imagegen outputs are mockups\/assets only, never evidence/i)
  assert.match(prompt, /review mode.*read-only/i)
  assert.match(prompt, /VISUAL PASS\/FAIL\/BLOCKED-no-render/i)
  assert.match(prompt, /never Human approval/i)
  assert.ok(prompt.length < 4000, `design prompt stays concise, got ${prompt.length} chars`)
})

test("anchors the generated preview permission to the native worktree-relative path", async () => {
  const gitRoot = resolve("project")
  const nonGitRoot = parse(gitRoot).root
  const cases = [
    { directory: gitRoot, worktree: gitRoot },
    { directory: join(gitRoot, "packages", "prototype"), worktree: gitRoot },
    { directory: resolve(nonGitRoot, "tmp", "opencode", "ksi-design-smoke"), worktree: nonGitRoot },
  ]
  for (const context of cases) {
    const hooks = await plugin(context)
    const config = {}
    hooks.config(config)
    const expected = nativePreviewPattern(context.worktree, context.directory)
    const edit = config.agent.design.permission.edit
    assert.equal(edit[expected], "ask")
    assert.equal(edit["*"], "deny")
    if (expected !== "design-previews/**") assert.equal(edit["design-previews/**"], undefined)
    assert.equal(edit[`${relative(context.worktree, resolve(context.directory, "outside")).split(sep).join("/")}/**`], undefined)
    const snapshot = structuredClone(config)
    hooks.config(config)
    assert.deepEqual(config, snapshot)
  }
})

test("keeps explicit project edit paths native and requires complete preview context", async () => {
  const worktree = resolve("project")
  const directory = join(worktree, "apps", "visual")
  const hooks = await plugin({ directory, worktree })
  const config = { agent: { design: { permission: { edit: { "src/ui/**/*.tsx": "allow" } } } } }
  hooks.config(config)
  assert.equal(config.agent.design.permission.edit["src/ui/**/*.tsx"], "allow")
  assert.equal(config.agent.design.permission.edit[nativePreviewPattern(worktree, directory)], "ask")

  const incomplete = await plugin({ directory })
  const fallbackConfig = {}
  assert.doesNotThrow(() => incomplete.config(fallbackConfig))
  assert.equal(fallbackConfig.agent.design.permission.edit["design-previews/**"], "ask")
  assert.equal(fallbackConfig.agent["design-task"].permission.edit["design-previews/**"], "ask")
})

test("rejects preview contexts outside the native worktree or without absolute roots", async () => {
  const worktree = resolve("project")
  const contexts = [
    { directory: resolve("outside"), worktree },
    { directory: "relative", worktree },
    { directory: worktree, worktree: "" },
  ]
  if (process.platform === "win32") contexts.push({ directory: "D:\\preview", worktree: "C:\\project" })
  for (const context of contexts) {
    const hooks = await plugin(context)
    assert.throws(() => hooks.config({}), /native.*(?:absolute|inside)/)
  }
})

test("rejects invalid explicit Design steps rather than changing a disabled Primary", async () => {
  const hooks = await plugin()
  for (const steps of [0, null, undefined, -1, 1.5, "60", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => hooks.config({ agent: { design: { steps } } }), /design supplied invalid positive integer native steps/)
  }
  const disabled = { agent: { design: { disable: true } } }
  hooks.config(disabled)
  assert.equal(disabled.agent.design.disable, true)
  assert.equal(disabled.agent.design.steps, 60)
})

test("preserves Design native settings while merging deliberate nested UI overrides", async () => {
  const hooks = await plugin()
  const config = { agent: { design: {
    model: "custom/design", variant: "careful", temperature: 0.4, top_p: 0.8,
    effort: "high", steps: 17, disable: true, custom_primary_setting: "kept",
    permission: {
      "*": "ask",
      edit: { "design-previews/**": "deny", "src/ui/**/*.tsx": "allow" },
      read: { "*.env": "deny", "src/ui/**": "allow" },
      bash: "deny",
      task: { "*": "allow" },
    },
  } } }
  hooks.config(config)

  const design = config.agent.design
  assert.equal(design.mode, "primary")
  assert.equal(design.model, "custom/design")
  assert.equal(design.variant, "careful")
  assert.equal(design.temperature, 0.4)
  assert.equal(design.top_p, 0.8)
  assert.equal(design.effort, "high")
  assert.equal(design.steps, 17)
  assert.equal(design.disable, true)
  assert.equal(design.custom_primary_setting, "kept")
  assert.deepEqual(design.permission.edit, {
    "*": "deny", ".opencode/working-state.md": "allow", "design-previews/**": "deny", "src/ui/**/*.tsx": "allow",
  })
  assert.deepEqual(Object.keys(design.permission.edit), ["*", ".opencode/working-state.md", "design-previews/**", "src/ui/**/*.tsx"])
  assert.equal(design.permission.read["*.env"], "deny")
  assert.equal(design.permission.read["src/ui/**"], "allow")
  assert.equal(design.permission.bash, "deny")
  assert.equal(design.permission.task, "deny")
  assert.equal(Object.keys(design.permission).at(-1), "task")
})

test("normalizes root deny and ask after defaults while allowing later scoped Design overrides", async () => {
  const hooks = await plugin()
  for (const action of ["deny", "ask"]) {
    const config = { agent: { design: { permission: action } } }
    hooks.config(config)
    const permission = config.agent.design.permission
    assert.equal(permission["*"], action)
    assert.ok(Object.keys(permission).indexOf("*") > Object.keys(permission).indexOf("playwright_*"))
    assert.equal(Object.keys(permission).at(-1), "task")
    const snapshot = structuredClone(config)
    hooks.config(config)
    assert.deepEqual(config, snapshot)
  }

  const scoped = { agent: { design: { permission: {
    "*": "deny", edit: { "src/ui/**/*.tsx": "allow" },
  } } } }
  hooks.config(scoped)
  const permission = scoped.agent.design.permission
  assert.ok(Object.keys(permission).indexOf("*") > Object.keys(permission).indexOf("playwright_*"))
  assert.ok(Object.keys(permission).indexOf("edit") > Object.keys(permission).indexOf("*"))
  assert.equal(permission.edit["src/ui/**/*.tsx"], "allow")
  assert.equal(permission.task, "deny")
})

test("rejects unsafe root allow permissions instead of opening unknown tools", async () => {
  const hooks = await plugin()
  for (const permission of ["allow", { "*": "allow" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design root permission allow is not allowed; use scoped named tools or paths/,
    )
  }
})

test("accepts only exact or concretely scoped Design edit allow paths", async () => {
  const hooks = await plugin()
  const rejected = ["*", "**", "**/*", "**/**", "**/**/**", "**/*.tsx", "*.tsx", "Card*.tsx", "design-previews*/**", "../outside/**", "src/../../outside/**", "../outside.tsx", "/tmp/**", "/tmp/exact.tsx", "C:/outside/**", "C:outside.tsx", "\\\\host\\share\\**", "./**", "src//**", "src/./**", ""]
  rejected.push("src/bad\0name.tsx")
  for (const edit of ["allow", ...rejected.map((pattern) => ({ [pattern]: "allow" }))]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { edit } } } }),
      /KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards/,
    )
  }
  for (const pattern of ["src/components/**", "src/cards/Card*.tsx", "Preview.tsx"]) {
    const config = { agent: { design: { permission: { edit: { [pattern]: "allow" } } } } }
    hooks.config(config)
    assert.equal(config.agent.design.permission.edit[pattern], "allow")
  }
})

test("keeps unsafe browser code execution denied after named and wildcard overrides", async () => {
  const hooks = await plugin()
  for (const override of [
    { "playwright_browser_run_code_unsafe": "allow" },
    { "playwright_*": "allow" },
  ]) {
    const config = { agent: { design: { permission: override } } }
    hooks.config(config)
    const permission = config.agent.design.permission
    assert.equal(permission.playwright_browser_run_code_unsafe, "deny")
    assert.ok(Object.keys(permission).indexOf("playwright_browser_run_code_unsafe") > Object.keys(permission).indexOf("playwright_*"))
    assert.deepEqual(Object.keys(permission).slice(-2), ["playwright_browser_run_code_unsafe", "task"])
  }
})

test("requires inspectable rendered artifacts for material visual approval", async () => {
  const [prompt, policy] = await Promise.all([
    readFile(new URL("../agents/design.md", import.meta.url), "utf8"),
    readFile(new URL("../instructions/harness.md", import.meta.url), "utf8"),
  ])
  for (const text of [prompt, policy]) {
    assert.match(text, /materially visual approval.*actual rendered artifact.*user could inspect/i)
    assert.match(text, /NOT visually approved/i)
    assert.match(text, /block dependent visual handoff/i)
    assert.match(text, /text-only.*minor approved nonvisual fixes.*proceed/i)
  }
})

test("keeps Design permission configuration cloned and stable with scalar overrides", async () => {
  const hooks = await plugin()
  const first = { agent: { design: { permission: { edit: "ask", skill: "deny", task: "allow" } } } }
  const second = {}
  hooks.config(first)
  hooks.config(second)

  assert.equal(first.agent.design.permission.edit, "ask")
  assert.equal(first.agent.design.permission.skill, "deny")
  assert.equal(first.agent.design.permission.task, "deny")
  assert.equal(Object.hasOwn(first.agent.design.permission, "0"), false)
  first.agent.design.permission.read["*"] = "deny"
  assert.equal(second.agent.design.permission.read["*"], "allow")
  const snapshot = structuredClone(first)
  hooks.config(first)
  assert.deepEqual(first, snapshot)
})

test("encodes ordered OpenDesign-inspired gates with brief and token Evidence", async () => {
  const [prompt, guide] = await Promise.all([
    readFile(new URL("../agents/design.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/design.md", import.meta.url), "utf8"),
  ])
  assert.match(prompt, /1\) collect brief/i)
  assert.match(prompt, /user, purpose, density, exclusions/i)
  assert.match(prompt, /ask on unknowns, never guess/i)
  assert.match(prompt, /2\) lock token block/i)
  assert.match(prompt, /reuse existing tokens\/components first, no invented hex/i)
  assert.match(prompt, /3\) lock one explicit aesthetic direction/i)
  assert.match(prompt, /4\) settle hierarchy then prototype/i)
  assert.match(prompt, /real states and responsive viewports/i)
  assert.match(prompt, /5\) self-review/i)
  assert.match(prompt, /640\/768\/1024\/1280/)
  assert.match(prompt, /no indigo defaults, no purple-blue gradients, no emoji-as-icons/i)
  assert.match(prompt, /6\) hand off.*Human approval/i)
  assert.match(prompt, /design-task Evidence cites brief version plus token block/i)
  assert.match(prompt, /paraphrased.*OpenDesign concepts.*Apache-2\.0/i)
  assert.ok(prompt.length < 4000, `design prompt stays concise, got ${prompt.length} chars`)

  assert.match(guide, /Brief gate/i)
  assert.match(guide, /Token block prerequisite/i)
  assert.match(guide, /Aesthetic direction lock/i)
  assert.match(guide, /Hierarchy then prototype/i)
  assert.match(guide, /Self-review checklist/i)
  assert.match(guide, /640\/768\/1024\/1280/)
  assert.match(guide, /no indigo defaults, no purple-blue gradients, no emoji-as-icons/i)
  assert.match(guide, /design-task Evidence must cite brief version plus token block/i)
  assert.match(guide, /adapted in our own words from OpenDesign concepts \(Apache-2\.0\)/i)
})

test("handoff template carries brief version, token block, and self-review", async () => {
  const handoff = await readFile(new URL("../examples/design-handoff.md", import.meta.url), "utf8")
  assert.match(handoff, /Brief version:/)
  assert.match(handoff, /Token block:/)
  assert.match(handoff, /Aesthetic direction:/)
  assert.match(handoff, /## Self-review/)
  assert.match(handoff, /640\/768\/1024\/1280/)
  assert.match(handoff, /no indigo defaults, no purple-blue gradients, no emoji-as-icons/i)
})

test("enforces a separate read-only design review permission", async () => {
  const { DESIGN_REVIEW_PERMISSION, DESIGN_TASK_REVIEW_MODE } = await import("../src/agents.mjs")
  assert.equal(DESIGN_TASK_REVIEW_MODE, "review")
  assert.equal(DESIGN_REVIEW_PERMISSION.edit["*"], "deny")
  assert.equal(DESIGN_REVIEW_PERMISSION["design-previews/**"], undefined)
  assert.equal(DESIGN_REVIEW_PERMISSION.task, "deny")
  assert.equal(DESIGN_REVIEW_PERMISSION.external_directory, "deny")
  assert.equal(DESIGN_REVIEW_PERMISSION.bash, "deny")
  assert.equal(DESIGN_REVIEW_PERMISSION.lsp, "deny")
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /review mode uses DESIGN_REVIEW_PERMISSION/i)
})

test("review mode declares the Mode review plus Allowed write paths none marker", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /Mode:\s*review.*Allowed write paths:\s*none/is)
})

test("scopes gate 6 to the Design primary with a design-task return rule", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /gate 6 applies to the user-facing Design primary/i)
  assert.match(prompt, /design-task returns.*instead of waiting for Human approval/i)
})

test("defines the established-pattern exception with evidence", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /established-pattern exception.*existing approved artifact.*token-identical reuse.*cited artifact version/i)
  assert.match(prompt, /else full loop/i)
})

test("requires an intermediate viewport capture when layout changes", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /at least one intermediate.*capture plus READ when layout changes across breakpoints/i)
  assert.match(prompt, /else state why not applicable/i)
})

test("requires design-task fidelity review after Developer UI integration", async () => {
  const build = await readFile(new URL("../agents/build.md", import.meta.url), "utf8")
  assert.match(build, /design-task fidelity review after Developer UI integration before completion/i)
  assert.match(build, /FAIL becomes work items/i)
  assert.match(build, /applies to UI completions/i)
  assert.match(build, /inputs.*artifact version plus diff plus PNGs/i)
  assert.match(build, /BLOCKED-no-render escalates to user/i)
  assert.match(build, /max two fix rounds then escalates/i)
})

test("scopes external_directory deny for design-task review docs", async () => {
  const guide = await readFile(new URL("../docs/design.md", import.meta.url), "utf8")
  assert.match(guide, /external_directory.*Design primary.*ask.*design-task.*deny/si)
})

test("requires Developer UI work to cite the approved artifact without invented values", async () => {
  const developer = await readFile(new URL("../agents/developer.md", import.meta.url), "utf8")
  assert.match(developer, /cite the approved artifact version for UI work/i)
  assert.match(developer, /no invented visual values/i)
})

test("requires Reviewer to flag invented tokens on UI diffs", async () => {
  const reviewer = await readFile(new URL("../agents/reviewer.md", import.meta.url), "utf8")
  assert.match(reviewer, /flag invented tokens.*approved artifact on UI diffs/i)
})

test("rejects every incoming and outgoing Design task attempt even with helper mode", async () => {
  const hooks = await plugin({}, { developerTestRunner: true })
  hooks.config({})
  for (const caller of ["design", "plan", "build", ...ROLES, "custom", "general", "unknown"]) {
    await hooks["chat.params"]({ sessionID: caller, agent: caller })
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: caller }, { args: {
      subagent_type: "design", prompt: evidence,
    } }), /not allowed/)
  }
  await hooks["chat.params"]({ sessionID: "design-outgoing", agent: "design" })
  for (const target of ["design", ...ROLES, "custom", "general"]) {
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
      subagent_type: target, prompt: evidence,
    } }), /not allowed/)
  }
})
