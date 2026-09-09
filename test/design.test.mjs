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
  assert.equal(config.agent.design.permission.task, "deny")
  assert.equal(config.agent.design.permission.skill.brainstorming, "allow")
  assert.equal(config.agent.design.permission.skill["ui-ux-pro-max"], "allow")
  assert.equal(config.agent.design.permission.skill["test-driven-development"], undefined)
  assert.match(config.agent.design.prompt, /artifact-first/i)
  assert.equal("default_agent" in config, false)
  assert.deepEqual(ROLES, ["explore", "plan-reviewer", "developer", "developer-complex", "test-runner", "reviewer"])
  assert.equal("design" in CALLS, false)
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
  assert.throws(() => incomplete.config({}), /Design preview permission requires native directory and worktree context/)
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
