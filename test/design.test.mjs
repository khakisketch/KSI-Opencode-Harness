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
  assert.deepEqual(config.agent.design.permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
  assert.equal(config.agent.design.permission.skill.brainstorming, "allow")
  assert.equal(config.agent.design.permission.skill["ui-ux-pro-max"], "allow")
  assert.equal(config.agent.design.permission.skill["test-driven-development"], undefined)
  assert.match(config.agent.design.prompt, /artifact-first/i)
  assert.equal("default_agent" in config, false)
  assert.deepEqual(ROLES, ["explore", "developer", "test-runner", "reviewer", "research", "design-critic"])
  assert.deepEqual(CALLS.design, ["explore", "design-critic"])
})

test("unblocks Design tools while keeping other roles narrow", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  for (const tool of ["mobbin_*", "gpt_imagegen", "context7_*"]) {
    assert.equal(config.agent.design.permission[tool], "ask")
  }
  for (const name of ["explore", "developer", "test-runner", "reviewer"]) {
    assert.equal(config.agent[name].permission["mobbin_*"], undefined, `${name} must not gain mobbin grant`)
    assert.equal(config.agent[name].permission["gpt_imagegen"], undefined, `${name} must not gain gpt_imagegen grant`)
  }
})

test("mandates the visual loop with mockup-only image outputs", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /1280x800/)
  assert.match(prompt, /390x844/)
  assert.match(prompt, /READ each PNG via vision/i)
  assert.match(prompt, /list findings vs brief\/tokens\/direction/i)
  assert.match(prompt, /re-capture and re-read at least once/i)
  assert.match(prompt, /verified capture suffices for established-pattern reuse/i)
  assert.match(prompt, /no handoff without it/i)
  assert.match(prompt, /gpt_imagegen outputs are mockups\/assets only, never evidence/i)
  assert.ok(prompt.length <= 3500, `design prompt keeps maintenance headroom, got ${prompt.length} chars`)
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
})

test("keeps invalid native preview pairs fail-closed without throwing plugin config", async () => {
  const worktree = resolve("project")
  const contexts = [
    { directory: resolve("outside"), worktree },
    { directory: "relative", worktree },
    { directory: worktree, worktree: "" },
  ]
  if (process.platform === "win32") contexts.push({ directory: "D:\\preview", worktree: "C:\\project" })
  for (const context of contexts) {
    const hooks = await plugin(context)
    const config = {}
    assert.doesNotThrow(() => hooks.config(config))
    const edit = config.agent.design.permission.edit
    assert.deepEqual(edit, { "*": "deny" })
    assert.equal(edit["design-previews/**"], undefined)
    assert.equal(Object.keys(edit).some((key) => key.includes("design-previews")), false)
    assert.equal(Object.entries(edit).some(([key, action]) => action === "ask" && key.includes("design-previews")), false)
    assert.equal(Object.keys(edit).some((key) => key.includes("..")), false)
  }

  const invalid = { directory: resolve("outside"), worktree }
  const invalidHooks = await plugin(invalid)
  const withOverride = { agent: { design: { permission: { edit: { "src/ui/**/*.tsx": "allow" } } } } }
  assert.doesNotThrow(() => invalidHooks.config(withOverride))
  assert.deepEqual(withOverride.agent.design.permission.edit, { "*": "deny" })
  assert.equal(withOverride.agent.design.permission.edit["design-previews/**"], undefined)

  const missing = await plugin({ directory: join(worktree, "apps", "visual") })
  const fallbackConfig = {}
  assert.doesNotThrow(() => missing.config(fallbackConfig))
  assert.equal(fallbackConfig.agent.design.permission.edit["design-previews/**"], "ask")
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
      "*": "deny",
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
  assert.deepEqual(design.permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
  assert.equal(Object.keys(design.permission).at(-1), "task")
})

test("normalizes root deny after defaults while rejecting root ask fallback", async () => {
  const hooks = await plugin()
  for (const permission of ["deny", { "*": "deny" }]) {
    const config = { agent: { design: { permission } } }
    hooks.config(config)
    const current = config.agent.design.permission
    assert.equal(current["*"], "deny")
    assert.ok(Object.keys(current).indexOf("*") > Object.keys(current).indexOf("playwright_*"))
    assert.equal(Object.keys(current).at(-1), "task")
    const snapshot = structuredClone(config)
    hooks.config(config)
    assert.deepEqual(config, snapshot)
  }
  for (const permission of ["ask", { "*": "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design root permission/,
    )
  }

  const scoped = { agent: { design: { permission: {
    "*": "deny", edit: { "src/ui/**/*.tsx": "allow" },
  } } } }
  hooks.config(scoped)
  const permission = scoped.agent.design.permission
  assert.ok(Object.keys(permission).indexOf("*") > Object.keys(permission).indexOf("playwright_*"))
  assert.ok(Object.keys(permission).indexOf("edit") > Object.keys(permission).indexOf("*"))
  assert.equal(permission.edit["src/ui/**/*.tsx"], "allow")
  assert.deepEqual(permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
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

test("keeps unsafe browser code execution denied after named override while rejecting wildcard allow", async () => {
  const hooks = await plugin()
  const config = { agent: { design: { permission: { "playwright_browser_run_code_unsafe": "allow" } } } }
  hooks.config(config)
  const permission = config.agent.design.permission
  assert.equal(permission.playwright_browser_run_code_unsafe, "deny")
  assert.ok(Object.keys(permission).indexOf("playwright_browser_run_code_unsafe") > Object.keys(permission).indexOf("playwright_*"))
  assert.deepEqual(Object.keys(permission).slice(-2), ["playwright_browser_run_code_unsafe", "task"])
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { "playwright_*": "allow" } } } }),
    /KSI: Design playwright_\* permission allow is not allowed/,
  )
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
  const first = { agent: { design: { permission: { edit: "deny", skill: "deny", task: "allow" } } } }
  const second = {}
  hooks.config(first)
  hooks.config(second)

  assert.equal(first.agent.design.permission.edit, "deny")
  assert.equal(first.agent.design.permission.skill, "deny")
  assert.deepEqual(first.agent.design.permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
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
  assert.match(prompt, /1\) brief/i)
  assert.match(prompt, /user, purpose, density, exclusions/i)
  assert.match(prompt, /ask, never guess/i)
  assert.match(prompt, /2\) token block/i)
  assert.match(prompt, /reuse tokens\/components first, no invented hex/i)
  assert.match(prompt, /3\) one aesthetic direction/i)
  assert.match(prompt, /4\) hierarchy then prototype/i)
  assert.match(prompt, /real states, responsive viewports/i)
  assert.match(prompt, /5\) self-review/i)
  assert.match(prompt, /640\/768\/1024\/1280/)
  assert.match(prompt, /no indigo defaults, no purple-blue gradients, no emoji-as-icons/i)
  assert.match(prompt, /6\) handoff format, then Human approval/i)
  assert.doesNotMatch(prompt, /design-task/i)
  assert.match(prompt, /paraphrased.*OpenDesign concepts.*Apache-2\.0/i)
  assert.ok(prompt.length <= 3500, `design prompt keeps maintenance headroom, got ${prompt.length} chars`)

  assert.match(guide, /Brief gate/i)
  assert.match(guide, /Token block prerequisite/i)
  assert.match(guide, /Aesthetic direction lock/i)
  assert.match(guide, /Hierarchy then prototype/i)
  assert.match(guide, /Self-review checklist/i)
  assert.match(guide, /640\/768\/1024\/1280/)
  assert.match(guide, /no indigo defaults, no purple-blue gradients, no emoji-as-icons/i)
  assert.doesNotMatch(guide, /design-task Evidence must cite/i)
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

test("removed design-task review permission leaves native reviewer read-only", async () => {
  const agents = await import("../src/agents.mjs")
  assert.equal(agents.DESIGN_REVIEW_PERMISSION, undefined, "dead review permission remains")
  assert.equal(agents.DESIGN_TASK_REVIEW_MODE, undefined, "dead review Mode remains")
  assert.equal(agents.DESIGN_REVIEW_DENIED_TOOLS, undefined, "dead denied set remains")
  const reviewer = await readFile(new URL("../agents/reviewer.md", import.meta.url), "utf8")
  assert.match(reviewer, /Mode:\s*visual-fidelity.*Allowed write paths:\s*none/is)
  assert.match(reviewer, /VISUAL PASS.*FAIL.*BLOCKED-no-render/is)
  assert.doesNotMatch(reviewer, /design-task/i)
  assert.match(reviewer, /Native read-only permissions are unchanged/i)
  assert.match(reviewer, /Plan cannot invoke visual mode/i)
})

test("reviewer visual mode declares Mode visual-fidelity plus Allowed write paths none marker", async () => {
  const reviewer = await readFile(new URL("../agents/reviewer.md", import.meta.url), "utf8")
  assert.match(reviewer, /Mode:\s*visual-fidelity.*Allowed write paths:\s*none/is)
})

test("scopes gate 6 to the Design primary without design-task", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /Design primary waits/i)
  assert.doesNotMatch(prompt, /design-task/i)
})

test("defines the established-pattern exception with evidence", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /verified capture suffices for established-pattern reuse/i)
  assert.match(prompt, /cited approved artifact/i)
  assert.match(prompt, /else full loop/i)
})

test("requires an intermediate viewport capture when layout changes", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /intermediate capture \+ READ when layout changes across breakpoints/i)
  assert.match(prompt, /else state why not/i)
})

test("requires reviewer visual-fidelity review after Developer UI integration", async () => {
  const build = await readFile(new URL("../agents/build.md", import.meta.url), "utf8")
  assert.match(build, /reviewer visual-fidelity review after Developer UI integration before completion/i)
  assert.match(build, /FAIL becomes work items/i)
  assert.match(build, /applies to UI completions/i)
  assert.match(build, /inputs.*artifact version plus diff plus PNGs/i)
  assert.match(build, /BLOCKED-no-render escalates to user/i)
  assert.match(build, /max two fix rounds then escalates/i)
  assert.match(build, /Mode:\s*visual-fidelity plus Allowed write paths:\s*none/i)
  assert.match(build, /reviewer stays native read-only/i)
  assert.doesNotMatch(build, /design-task/i)
})

test("scopes external_directory deny for reviewer visual docs", async () => {
  const guide = await readFile(new URL("../docs/design.md", import.meta.url), "utf8")
  assert.match(guide, /external_directory.*Design primary.*ask.*native reviewer.*deny/si)
  assert.doesNotMatch(guide, /design-task/i)
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

test("keeps Design as a denied target while allowing only two local read-only children", async () => {
  const hooks = await plugin({}, { developerTestRunner: true })
  hooks.config({})
  const criticPrompt = "Objective: Critique the empty state.\nScope: design-previews/empty, desktop/mobile viewports, no fixes.\nEvidence: artifact v3 brief v2 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile viewports inspected."
  for (const caller of ["design", "plan", "build", ...ROLES, "custom", "general", "unknown"]) {
    await hooks["chat.params"]({ sessionID: caller, agent: caller })
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: caller }, { args: {
      subagent_type: "design", prompt: evidence,
    } }), /not allowed/)
  }
  await hooks["chat.params"]({ sessionID: "design-outgoing", agent: "design" })
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
    subagent_type: "explore", prompt: evidence,
  } }))
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
    subagent_type: "design-critic", prompt: criticPrompt,
  } }))
  for (const target of ["design", "design-task", "research", "developer", "reviewer", "test-runner", "custom", "general"]) {
    const prompt = target === "design-critic" ? criticPrompt : evidence
    if (["explore", "design-critic"].includes(target)) continue
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
      subagent_type: target, prompt,
    } }), /not allowed/)
  }
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
    subagent_type: "explore", prompt: evidence, background: true,
  } }), /foreground/)
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "design-outgoing" }, { args: {
    subagent_type: "design-critic", prompt: criticPrompt, background: true,
  } }), /foreground/)
})

test("installs design-critic as hidden read-only with default steps and no model", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  assert.equal(config.agent["design-critic"].mode, "subagent")
  assert.equal(config.agent["design-critic"].hidden, true)
  assert.equal(config.agent["design-critic"].steps, 20)
  assert.equal("model" in config.agent["design-critic"], false)
  assert.equal("variant" in config.agent["design-critic"], false)
  const permission = config.agent["design-critic"].permission
  assert.equal(permission["*"], "deny")
  assert.equal(permission.read["*"], "allow")
  assert.equal(permission.glob, "allow")
  assert.equal(permission.grep, "allow")
  assert.equal(permission.list, "allow")
  for (const tool of ["edit", "write", "apply_patch", "bash", "task", "lsp", "skill", "external_directory", "webfetch", "websearch", "mobbin_*", "gpt_imagegen", "playwright_*", "context7_*"]) {
    assert.equal(permission[tool] ?? permission["*"], "deny", `design-critic must deny ${tool}`)
  }
  assert.match(config.agent["design-critic"].description, /fresh independent critique/i)
  assert.match(config.agent["design-critic"].description, /VISUAL PASS\/FAIL\/BLOCKED-no-render/)
  const prompt = await readFile(new URL("../agents/design-critic.md", import.meta.url), "utf8")
  assert.match(prompt, /fresh independent critique/i)
  assert.match(prompt, /desktop\/mobile PNG/i)
  assert.match(prompt, /severity\/evidence\/impact|severity.*evidence.*impact/i)
  assert.match(prompt, /VISUAL PASS\/FAIL\/BLOCKED-no-render/)
  assert.match(prompt, /no fix/i)
  assert.match(prompt, /no design approval|never.*approval/i)
  assert.match(prompt, /if actual images cannot be read/i)
  assert.match(prompt, /BLOCKED-no-render/i)
})

test("keeps Design user task overrides fail-closed to the two local children", async () => {
  const hooks = await plugin()
  const config = { agent: { design: { permission: { task: { "*": "allow" } } } } }
  hooks.config(config)
  assert.deepEqual(config.agent.design.permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
  assert.equal(Object.keys(config.agent.design.permission).at(-1), "task")
})

test("rejects design-critic dispatch without rendered PNG evidence and allows resume with evidence", async () => {
  const hooks = await plugin()
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "d", agent: "design" })
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "d" }, { args: {
    subagent_type: "design-critic", prompt: "Objective: Critique.\nScope: previews\nEvidence: placeholder",
  } }), /PNG|viewport|capture|placeholder/i)
  const valid = "Objective: Critique the empty state.\nScope: design-previews/empty, desktop/mobile viewports, no fixes.\nEvidence: artifact v3 brief v2 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile viewports inspected."
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "d" }, { args: {
    subagent_type: "design-critic", prompt: valid,
  } }))
  await assert.doesNotReject(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "d" }, { args: {
    subagent_type: "design-critic", task_id: "ses_existing", prompt: "Failure: render blocked\nEvidence: artifact v3 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile viewports inspected.",
  } }))
  for (const bad of [
    "Objective: Critique.\nScope: previews\nEvidence: artifact v3 plus fake.png desktop",
    "Objective: Critique.\nScope: previews\nEvidence: artifact v3 plus /tmp/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile",
    "Objective: Critique.\nScope: previews\nEvidence: artifact v3 plus ../outside-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile",
    "Objective: Critique.\nScope: previews\nEvidence: artifact v3 plus design-previews/empty-desktop-1280x800.png desktop viewport inspected.",
  ]) {
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "d" }, { args: {
      subagent_type: "design-critic", prompt: bad,
    } }), /workspace-relative|absolute|traversal|two PNG|desktop.*mobile|mobile|claims/i)
  }
})

test("keeps child explore and design-critic non-delegating", async () => {
  const hooks = await plugin()
  hooks.config({})
  for (const child of ["explore", "design-critic"]) {
    await hooks["chat.params"]({ sessionID: child, agent: child })
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: child }, { args: {
      subagent_type: "explore", prompt: evidence,
    } }), /not allowed|read-only/i)
  }
})

test("collaborates via human-openable localhost URL with narrow authorization", async () => {
  const [prompt, guide, policy] = await Promise.all([
    readFile(new URL("../agents/design.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/design.md", import.meta.url), "utf8"),
    readFile(new URL("../instructions/harness.md", import.meta.url), "utf8"),
  ])
  for (const text of [prompt, guide, policy]) {
    assert.match(text, /human-openable localhost/i)
    assert.match(text, /baseline vs revision/i)
    assert.match(text, /interactive inspection/i)
    assert.match(text, /desktop\/mobile PNGs/i)
    assert.match(text, /server\/tool consent.*separate/i)
    assert.match(text, /artifact-version\/scope visual approval/i)
    assert.match(text, /production acceptance/i)
    assert.match(text, /command\/path\/origin\/session/i)
    assert.match(text, /must never be bypassed/i)
    assert.match(text, /Stop the preview server/i)
  }
})

test("shows peer Primaries with no design-task role", async () => {
  const [architecture, readme] = await Promise.all([
    readFile(new URL("../docs/architecture.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ])
  for (const text of [architecture, readme]) {
    assert.match(text, /peer.*Primary/i)
    assert.doesNotMatch(text, /design-task/i)
  }
  assert.match(architecture, /Codex\/Claude internal agent structures untouched/i)
  assert.match(architecture, /Reviewer visual-fidelity mode/i)
  assert.match(readme, /integrated UI fidelity is checked by Reviewer visual-fidelity/i)
})

test("requires deliberate approval for project UI overrides and inspected render evidence", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /project UI.*deliberate approval/i)
  assert.match(prompt, /Never claim a screenshot, render, or visual analysis unless/i)
  assert.match(prompt, /actually obtained.*inspect/i)
  assert.match(prompt, /render tooling is (unavailable|missing), report that blocker/i)
  assert.match(prompt, /no denied-tool bypass/i)
})

test("packages the Design guide, system template, and critique rubric via explicit public docs", async () => {
  const [template, rubric, packageJson] = await Promise.all([
    readFile(new URL("../docs/design-system-template.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/design-critique.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ])
  const files = JSON.parse(packageJson).files
  for (const doc of [
    "docs/architecture.md",
    "docs/design.md",
    "docs/design-critique.md",
    "docs/design-system-template.md",
    "docs/execution.md",
    "docs/releasing.md",
    "docs/troubleshooting.md",
    "docs/verification.md",
  ]) {
    assert.ok(files.includes(doc), `package does not explicitly ship ${doc}`)
  }
  assert.ok(!files.includes("docs/"), "package must not ship the whole docs/ directory")
  assert.ok(!files.includes("docs"), "package must not ship the whole docs directory")
  assert.match(template, /Token\/component sources/i)
  assert.match(template, /never copy token values|no copied tokens/i)
  assert.match(template, /second token source of truth|duplicate SSOT/i)
  assert.match(template, /synthetic/i)
  assert.match(rubric, /read-only/i)
  assert.match(rubric, /VISUAL PASS\/FAIL\/BLOCKED-no-render/i)
  assert.match(rubric, /never replaces Human approval|never Human approval/i)
  assert.match(rubric, /falsifiable/i)
})

test("keeps Design authority over direction and approval without design-task", async () => {
  const guide = await readFile(new URL("../docs/design.md", import.meta.url), "utf8")
  assert.ok(ROLES.includes("design-critic"), "user-authorized local read-only design-critic is installed")
  assert.ok(!ROLES.includes("design-task"), "removed design-task is not a reserved role")
  assert.match(guide, /Design Primary owns.*concept\/prototype direction.*human approval/i)
  assert.doesNotMatch(guide, /design-task/i)
  assert.match(guide, /Build reviewer separately checks integrated fidelity/i)
  assert.match(guide, /never replaces Human approval/i)
})

test("defines a proportional ambiguity-aware workflow with honest fintech states", async () => {
  const guide = await readFile(new URL("../docs/design.md", import.meta.url), "utf8")
  assert.match(guide, /decision-changing first questions/i)
  assert.match(guide, /settled vs accepted\/processing/i)
  assert.match(guide, /never block simple established-pattern/i)
  assert.match(guide, /synthetic fintech data/i)
  assert.match(guide, /never.*settled.*only submitted/i)
  assert.match(guide, /success\/pending\/failure/i)
  assert.match(guide, /keyboard\/focus/i)
  assert.match(guide, /manual.*limits/i)
  assert.match(guide, /semantic accessibility snapshot/i)
})

test("points the Design prompt at the guide, system source, and rubric with min questions", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /Guide: docs\/design\.md/i)
  assert.match(prompt, /system source: docs\/design-system-template\.md/i)
  assert.match(prompt, /rubric: docs\/design-critique\.md/i)
  assert.match(prompt, /decision-changing first questions/i)
  assert.match(prompt, /rendered interaction/i)
  assert.ok(prompt.length <= 3500, `design prompt keeps maintenance headroom, got ${prompt.length} chars`)
})

test("handoff reproduction carries live URL, baseline/revision, synthetic evidence, and outstanding risk", async () => {
  const handoff = await readFile(new URL("../examples/design-handoff.md", import.meta.url), "utf8")
  assert.match(handoff, /Live URL.*localhost/i)
  assert.match(handoff, /Baseline vs revision/i)
  assert.match(handoff, /Synthetic state evidence/i)
  assert.match(handoff, /Outstanding risk/i)
  assert.match(handoff, /no approval until user inspected/i)
})

test("never approves from source or prompt text without an inspected render", async () => {
  const [guide, rubric, handoff] = await Promise.all([
    readFile(new URL("../docs/design.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/design-critique.md", import.meta.url), "utf8"),
    readFile(new URL("../examples/design-handoff.md", import.meta.url), "utf8"),
  ])
  for (const text of [guide, rubric, handoff]) {
    assert.match(text, /NOT visually approved|BLOCKED-no-render/i)
    assert.match(text, /never infer approval from source alone/i)
  }
})

test("limits Design dispatch to local explore and design-critic with PNG evidence", async () => {
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /only.*explore.*design-critic|explore.*design-critic.*only/i)
  assert.match(prompt, /rendered PNG evidence|PNG evidence/i)
  assert.match(prompt, /no other targets|no.*research/i)
  assert.ok(prompt.length <= 3500, `design prompt keeps maintenance headroom, got ${prompt.length} chars`)
})

test("reflects the Design caller in Explore without granting design decisions", async () => {
  const prompt = await readFile(new URL("../agents/explore.md", import.meta.url), "utf8")
  assert.match(prompt, /Design/i)
  assert.match(prompt, /Design owns.*decision|return.*to.*Design|Design.*approval/i)
  assert.doesNotMatch(prompt, /Explore approves|Explore decides|you approve the design/i)
})

test("README starts a design request and points at live work without rewriting routing/proof text", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")
  assert.match(readme, /Start.*design request/i)
  assert.match(readme, /localhost URL/i)
  assert.match(readme, /baseline vs revision/i)
  assert.match(readme, /until you inspect/i)
  assert.match(readme, /may differ from machine-local routing/i)
  assert.match(readme, /dated, scoped results/i)
})

test("leaves no stale Design cannot-delegate claims and keeps the narrow two-child rule", async () => {
  const paths = [
    "../agents/design.md",
    "../docs/design.md",
    "../docs/architecture.md",
    "../docs/execution.md",
    "../instructions/harness.md",
    "../README.md",
    "../INSTALL.md",
  ]
  const texts = await Promise.all(paths.map((p) => readFile(new URL(p, import.meta.url), "utf8")))
  for (const text of texts) {
    assert.doesNotMatch(text, /design-task/i)
    assert.doesNotMatch(text, /does not dispatch tasks in v1/i)
    assert.doesNotMatch(text, /Design never dispatches/i)
    assert.doesNotMatch(text, /v1에서.*task.*호출하지/)
    assert.doesNotMatch(text, /incoming\/outgoing.*금지/)
    assert.doesNotMatch(text, /Only Plan and Build can call native `task`/)
    assert.doesNotMatch(text, /only Plan\/Build dispatch workers/i)
    assert.doesNotMatch(text, /A future Design Critic is not enabled/)
    assert.doesNotMatch(text, /not enabled by this document/)
    assert.doesNotMatch(text, /no native `task` calls in v1/i)
  }
  const prompt = await readFile(new URL("../agents/design.md", import.meta.url), "utf8")
  assert.match(prompt, /only foreground local read-only explore and design-critic/i)
  assert.match(prompt, /no Research\/developer\/Design target/i)
  assert.doesNotMatch(prompt, /design-task/i)
  assert.ok(prompt.length <= 3300, `design prompt stays concise, got ${prompt.length} chars`)
  const guide = await readFile(new URL("../docs/design.md", import.meta.url), "utf8")
  assert.match(guide, /No Design → Research\/external child, developer, task recursion, or Design as target/)
  assert.doesNotMatch(guide, /design-task/i)
  assert.match(guide, /single-line `Evidence:`/)
  assert.match(guide, /not obligatory for tiny token-identical/)
  const rubric = await readFile(new URL("../docs/design-critique.md", import.meta.url), "utf8")
  assert.match(rubric, /hidden `design-critic`.*default 20 steps/i)
  assert.match(rubric, /never fixes or approves/i)
  assert.match(rubric, /BLOCKED-no-render/)
})

test("rejects scalar Design edit ask with scoped-path guidance while keeping deny safe", async () => {
  const hooks = await plugin()
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { edit: "ask" } } } }),
    /KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards/,
  )
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { edit: "allow" } } } }),
    /KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards/,
  )
  const denied = { agent: { design: { permission: { edit: "deny" } } } }
  assert.doesNotThrow(() => hooks.config(denied))
  assert.equal(denied.agent.design.permission.edit, "deny")
})

test("rejects broad Design edit ask and allow wildcards with scoped-path guidance", async () => {
  const hooks = await plugin()
  for (const edit of [{ "*": "ask" }, { "*": "allow" }, { "**": "ask" }, { "*.tsx": "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { edit } } } }),
      /KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards/,
    )
  }
})

test("denies all Design edit on invalid native pairs instead of keeping explicit allows", async () => {
  const worktree = resolve("project")
  const invalid = { directory: resolve("outside"), worktree }
  const hooks = await plugin(invalid)
  const config = { agent: { design: { permission: { edit: { "src/ui/**/*.tsx": "allow" } } } } }
  assert.doesNotThrow(() => hooks.config(config))
  assert.deepEqual(config.agent.design.permission.edit, { "*": "deny" })
})

test("rejects unbounded Design write and apply_patch overrides without granting aliases", async () => {
  const hooks = await plugin()
  for (const permission of [{ write: "allow" }, { write: "ask" }, { apply_patch: "allow" }, { apply_patch: "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design (write|apply_patch) permission/,
    )
  }
  for (const permission of [{ write: { "*": "allow" } }, { apply_patch: { "*": "ask" } }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design (write|apply_patch) permission/,
    )
  }
  const denied = { agent: { design: { permission: { write: "deny", apply_patch: "deny" } } } }
  assert.doesNotThrow(() => hooks.config(denied))
})

test("rejects root ask fallback and auto-allow for shell and external tools", async () => {
  const hooks = await plugin()
  for (const permission of ["ask", { "*": "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design root permission/,
    )
  }
  for (const tool of ["bash", "external_directory", "webfetch", "websearch", "mobbin_*", "context7_*", "gpt_imagegen", "playwright_*"]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { [tool]: "allow" } } } }),
      /KSI: Design .* permission/,
    )
    const asked = { agent: { design: { permission: { [tool]: "ask" } } } }
    assert.doesNotThrow(() => hooks.config(asked))
    const denied = { agent: { design: { permission: { [tool]: "deny" } } } }
    assert.doesNotThrow(() => hooks.config(denied))
  }
  for (const permission of [{ custom_tool: "allow" }, { custom_tool: "ask" }, { mobbin_search: "allow" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design .* permission/,
    )
  }
})

test("rejects preview allow upgrade while keeping scoped edit and forced unsafe deny", async () => {
  const hooks = await plugin()
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { edit: { "design-previews/**": "allow" } } } } }),
    /KSI: Design preview permission must stay ask/,
  )
  const scoped = { agent: { design: { permission: { edit: { "src/ui/**/*.tsx": "allow" } } } } }
  assert.doesNotThrow(() => hooks.config(scoped))
  assert.equal(scoped.agent.design.permission.edit["src/ui/**/*.tsx"], "allow")
  const unsafe = { agent: { design: { permission: { playwright_browser_run_code_unsafe: "allow" } } } }
  hooks.config(unsafe)
  assert.equal(unsafe.agent.design.permission.playwright_browser_run_code_unsafe, "deny")
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { "playwright_*": "allow" } } } }),
    /KSI: Design .* permission/,
  )
})

test("rejects risky Design read scalar and wildcard overrides while keeping deny safe", async () => {
  const hooks = await plugin()
  for (const read of ["allow", "ask", { "*": "allow" }, { "*": "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { read } } } }),
      /KSI: Design read permission/,
    )
  }
  const denied = { agent: { design: { permission: { read: "deny" } } } }
  assert.doesNotThrow(() => hooks.config(denied))
  assert.equal(denied.agent.design.permission.read, "deny")
  const wildcardDeny = { agent: { design: { permission: { read: { "*": "deny" } } } } }
  assert.doesNotThrow(() => hooks.config(wildcardDeny))
  assert.equal(wildcardDeny.agent.design.permission.read["*"], "deny")
})

test("rejects secret read deny overrides regardless of ordering and keeps benign scoped allow", async () => {
  const hooks = await plugin()
  const secrets = ["*.env", "*.env.*", "*credentials*", "*auth.json", "*.pem", "*.key"]
  for (const pattern of secrets) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { read: { [pattern]: "allow" } } } } }),
      /KSI: Design read permission must keep secret deny/,
    )
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { read: { [pattern]: "ask" } } } } }),
      /KSI: Design read permission must keep secret deny/,
    )
  }
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { read: { "src/ui/**": "allow", "*.env": "allow" } } } } }),
    /KSI: Design read permission must keep secret deny/,
  )
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { read: { "*.env": "allow", "src/ui/**": "allow" } } } } }),
    /KSI: Design read permission must keep secret deny/,
  )
  const benign = { agent: { design: { permission: { read: { "src/ui/**": "allow" } } } } }
  assert.doesNotThrow(() => hooks.config(benign))
  assert.equal(benign.agent.design.permission.read["src/ui/**"], "allow")
  for (const pattern of secrets) {
    assert.equal(benign.agent.design.permission.read[pattern], "deny", `secret deny retained for ${pattern}`)
  }
  const redundantDeny = { agent: { design: { permission: { read: { "*.env": "deny", "src/ui/**": "allow" } } } } }
  assert.doesNotThrow(() => hooks.config(redundantDeny))
  assert.equal(redundantDeny.agent.design.permission.read["*.env"], "deny")
  assert.equal(redundantDeny.agent.design.permission.read["src/ui/**"], "allow")
})

test("rejects unlisted Design skill grants while keeping approved skills and deny safe", async () => {
  const hooks = await plugin()
  for (const skill of ["allow", "ask", { "*": "allow" }, { "*": "ask" }, { "unlisted-skill": "allow" }, { "unlisted-skill": "ask" }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { skill } } } }),
      /KSI: Design skill permission/,
    )
  }
  const denied = { agent: { design: { permission: { skill: "deny" } } } }
  assert.doesNotThrow(() => hooks.config(denied))
  assert.equal(denied.agent.design.permission.skill, "deny")
  const baseline = {}
  hooks.config(baseline)
  const approved = Object.keys(baseline.agent.design.permission.skill).filter((key) => key !== "*")
  assert.ok(approved.includes("brainstorming"))
  const tightened = { agent: { design: { permission: { skill: { brainstorming: "deny" } } } } }
  assert.doesNotThrow(() => hooks.config(tightened))
  assert.equal(tightened.agent.design.permission.skill.brainstorming, "deny")
  assert.equal(tightened.agent.design.permission.skill["ui-ux-pro-max"], "allow")
  assert.equal(tightened.agent.design.permission.skill["unlisted-skill"], undefined)
  assert.deepEqual(tightened.agent.design.permission.task, { "*": "deny", explore: "allow", "design-critic": "allow" })
  assert.equal(tightened.agent.design.permission.playwright_browser_run_code_unsafe, "deny")
})

test("rejects malformed Design permission values instead of cloning arrays or numbers", async () => {
  const hooks = await plugin()
  for (const permission of [
    { read: ["allow"] },
    { read: 42 },
    { skill: ["allow"] },
    { skill: 42 },
    { edit: 42 },
    { bash: 42 },
  ]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design .* permission must be/,
    )
  }
  for (const permission of [{ read: { "src/ui/**": 42 } }, { skill: { brainstorming: 42 } }]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission } } }),
      /KSI: Design .* permission/,
    )
  }
})

test("rejects universal and secret-overlapping read allow/ask without claiming precise glob proof", async () => {
  const hooks = await plugin()
  const risky = ["**", "**/*", "**/**", "**/**/**", "*.env*", "*.ENV*", "*key*", "*credential*", "*credentials*", "*auth*", "*pem*"]
  for (const pattern of risky) {
    for (const action of ["allow", "ask"]) {
      assert.throws(
        () => hooks.config({ agent: { design: { permission: { read: { [pattern]: action } } } } }),
        /KSI: Design read permission/,
        `risky read ${pattern}=${action} must fail-closed`,
      )
    }
  }
  for (const pattern of ["SRC/**/*.ENV*", "src/**/credentials.json", "config/*AUTH*"]) {
    assert.throws(
      () => hooks.config({ agent: { design: { permission: { read: { [pattern]: "allow" } } } } }),
      /KSI: Design read permission/,
    )
  }
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { read: { "**": "allow", "*.env": "deny", "*.env.*": "deny", "*credentials*": "deny", "*auth.json": "deny", "*.pem": "deny", "*.key": "deny" } } } } }),
    /KSI: Design read permission/,
    "universal allow stays rejected even with secret denies intact (unknown native precedence)",
  )
  const idempotent = { agent: { design: { permission: { read: { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*credentials*": "deny", "*auth.json": "deny", "*.pem": "deny", "*.key": "deny" } } } } }
  assert.doesNotThrow(() => hooks.config(idempotent), "idempotent default clone with all secret denies stays allowed for compatibility")
  assert.equal(idempotent.agent.design.permission.read["*"], "allow")
  const protoRead = JSON.parse('{"__proto__":"allow"}')
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { read: protoRead } } } }),
    /KSI: Design read permission/,
  )
  const benign = { agent: { design: { permission: { read: { "src/ui/**": "allow" } } } } }
  assert.doesNotThrow(() => hooks.config(benign))
  assert.equal(benign.agent.design.permission.read["src/ui/**"], "allow")
  for (const pattern of ["*.env", "*.env.*", "*credentials*", "*auth.json", "*.pem", "*.key"]) {
    assert.equal(benign.agent.design.permission.read[pattern], "deny", `secret deny retained for ${pattern}`)
  }
  const wildcardDeny = { agent: { design: { permission: { read: { "*": "deny" } } } } }
  assert.doesNotThrow(() => hooks.config(wildcardDeny))
})

test("rejects secret-basename edit allow/ask including nested path and case", async () => {
  const hooks = await plugin()
  const secretEdits = [".env", "src/.env", "SRC/.ENV", "config/.env", ".env.local", "src/.env.production", "auth.json", "src/auth.json", "SRC/AUTH.JSON", "config/Auth.Json", "src/credentials.json", "config/my-credentials-backup.json", "certs/server.pem", "src/certs.PEM", "certs/server.key", "src/id.KEY", "src/nested/.env", "src/nested/auth.json"]
  for (const pattern of secretEdits) {
    for (const action of ["allow", "ask"]) {
      assert.throws(
        () => hooks.config({ agent: { design: { permission: { edit: { [pattern]: action } } } } }),
        /KSI: Design edit permission/,
        `secret edit ${pattern}=${action} must fail-closed`,
      )
    }
  }
  const protoEdit = JSON.parse('{"__proto__":"allow"}')
  assert.throws(
    () => hooks.config({ agent: { design: { permission: { edit: protoEdit } } } }),
    /KSI: Design edit permission/,
  )
  for (const pattern of ["src/ui/**/*.tsx", "src/components/**", "Preview.tsx", ".opencode/working-state.md"]) {
    const config = { agent: { design: { permission: { edit: { [pattern]: "allow" } } } } }
    assert.doesNotThrow(() => hooks.config(config))
    assert.equal(config.agent.design.permission.edit[pattern], "allow")
  }
})
