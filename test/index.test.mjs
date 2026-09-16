import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import plugin from "../index.mjs"
import { ROLES, CALLS, rolePermission } from "../src/agents.mjs"

const contract = "Objective: Fix a bounded behavior.\nAllowed write paths: src/example.mjs\nForbidden shared files: package-lock.json\nAcceptance criteria: Regression test passes.\nTargeted verification: npm test\nEscalate if: Public contract changes."
const evidence = "Objective: Inspect.\nScope: src/example.mjs, cwd repository, no external effects.\nCommands: npm test\nEvidence: supplied baseline and changed paths."

test("installs six native roles without choosing a model or variant", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  assert.deepEqual(ROLES, ["explore", "developer", "test-runner", "reviewer", "research", "design-task"])
  for (const name of ROLES) {
    assert.equal("model" in config.agent[name], false)
    assert.equal("variant" in config.agent[name], false)
    assert.equal(config.agent[name].permission.task, "deny")
    assert.equal(config.agent[name].permission.external_directory, "deny")
  }
  assert.equal(config.agent.developer.permission.edit, "ask")
  assert.equal(config.agent.developer.permission.bash, "ask")
  assert.equal(config.agent.developer.permission.skill["test-driven-development"], "allow")
  assert.equal(config.agent.reviewer.permission.bash, "deny")
  assert.equal(config.agent["test-runner"].permission.bash, "allow")
  assert.equal(config.agent.plan.permission.task["reviewer"], "allow")
  assert.equal(config.agent.plan.permission.bash, "deny")
  assert.equal(config.agent.research.permission.webfetch, "allow")
  assert.equal(config.agent.research.permission.websearch, "allow")
  assert.equal(config.agent.research.permission.bash, "deny")
  assert.equal(config.agent.explore.permission.lsp, "allow")
  assert.equal(config.agent.explore.permission.webfetch, "deny")
  assert.equal(config.agent["design-task"].mode, "subagent")
  assert.equal(config.agent["design-task"].hidden, true)
  assert.equal(config.agent["design-task"].permission.task, "deny")
  assert.equal(config.agent["design-task"].permission.edit["*"], "deny")
  assert.equal(config.agent["design-task"].permission.edit[".opencode/working-state.md"], undefined)
  assert.match(config.agent["design-task"].prompt, /artifact-first/i)
})

test("grants Plan native code intelligence without widening execution", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  const plan = config.agent.plan.permission
  assert.equal(plan.lsp, "allow")
  assert.equal(plan.lsp, config.agent.explore.permission.lsp)
  assert.equal(plan.read["*"], "allow")
  assert.equal(plan.glob, "allow")
  assert.equal(plan.grep, "allow")
  assert.equal(plan.list, "allow")
  assert.equal(plan.webfetch, "allow")
  assert.equal(plan.websearch, "allow")
  for (const tool of ["ksi_repo_status", "ksi_repo_diffstat", "ksi_checkpoint_read", "ksi_reconcile", "ksi_env_probe", "ksi_audit_summary"]) {
    assert.equal(plan[tool], "allow")
  }
  assert.equal(plan.bash, "deny")
  assert.equal(plan.edit["*"], "deny")
  assert.equal(plan.edit[".opencode/working-state.md"], "allow")
  assert.deepEqual(Object.keys(plan.task).sort(), ["*", "explore", "research", "reviewer"])
  assert.equal(plan.task.explore, "allow")
  assert.equal(plan.task.reviewer, "allow")
  assert.equal(plan.task.research, "allow")
})

test("enforces strict coordinator-only Build while preserving model and variant", async () => {
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
    assert.equal(config.agent.build.mode, "primary")
    assert.match(config.agent.build.description, /orchestrator/i)
    assert.equal(config.agent.build.permission.edit["*"], "deny")
    assert.equal(config.agent.build.permission.bash, "deny")
    assert.equal(config.agent.build.permission.task.explore, "allow")
    assert.equal(config.agent.build.permission.task.research, "allow")
    assert.equal(config.agent.build.permission.task["design-task"], "allow")
    assert.equal(config.agent.build.permission.task["reviewer"], "allow")
    assert.notDeepEqual(config.agent.build.permission, permission)
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
  const config = { agent: { developer: { model: "custom/approved", variant: "careful" } } }
  hooks.config(config)
  assert.equal(config.agent.developer.model, "custom/approved")
  assert.equal(config.agent.developer.variant, "careful")
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
  assert.equal(first.agent.reviewer.permission.read["*"], "allow")
  assert.equal(second.agent.developer.permission.read["*"], "allow")
  assert.equal(second.agent.plan.permission.task.explore, "allow")
})

test("enforces strict Build permission while preserving top-level denial and commands", async () => {
  const hooks = await plugin()
  const config = { permission: "deny", command: { review: { template: "custom review", agent: "build" } } }
  hooks.config(config)
  assert.equal(config.permission, "deny")
  assert.equal(config.agent.build.permission.edit["*"], "deny")
  assert.equal(config.agent.build.permission.bash, "deny")
  assert.equal(config.command.review.template, "custom review")
  assert.equal(config.command.complete.agent, "build")
})

test("enforces caller/target graph including unknown caller and recursive bypass", async () => {
  const hooks = await plugin()
  const designContract = "Objective: Prototype.\nAllowed write paths: design-previews/x\nAcceptance criteria: Rendered.\nEvidence: artifact v1."
  const promptFor = (target) => target.startsWith("developer") ? contract : target === "design-task" ? designContract : evidence
  for (const caller of ["plan", "build", ...ROLES, "general", "unknown"]) {
    await hooks["chat.params"]({ sessionID: caller, agent: caller })
    for (const target of [...ROLES, "general", "custom"]) {
      const invoke = () => hooks["tool.execute.before"]({ tool: "task", sessionID: caller }, { args: {
        subagent_type: target, prompt: promptFor(target),
      } })
      if (CALLS[caller]?.includes(target)) await assert.doesNotReject(invoke)
      else await assert.rejects(invoke, /not allowed/)
    }
  }
  await assert.rejects(() => hooks["tool.execute.before"]({ tool: "task", sessionID: "missing" }, { args: { subagent_type: "explore", prompt: evidence } }), /not allowed/)
})

test("denies Build direct implementation while allowing bookkeeping paths", async () => {
  const hooks = await plugin({ directory: "/tmp/ksi-no-such-worktree", worktree: "/tmp/ksi-no-such-worktree" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b", agent: "build" })
  const denied = [
    { tool: "bash", args: { command: "git status" } },
    { tool: "edit", args: { filePath: "src/example.mjs", oldString: "a", newString: "b" } },
    { tool: "write", args: { filePath: "src/new.mjs", content: "x" } },
    { tool: "apply_patch", args: { patchText: "*** Begin Patch" } },
    { tool: "lsp", args: {} },
    { tool: "edit", args: { filePath: "../outside.md", oldString: "a", newString: "b" } },
  ]
  for (const call of denied) {
    await assert.rejects(() => hooks["tool.execute.before"]({ tool: call.tool, sessionID: "b" }, { args: call.args }), /Build never implements|code intelligence/)
  }
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "edit", sessionID: "b" },
    { args: { filePath: ".opencode/working-state.md", oldString: "a", newString: "b" } },
  ))
})

test("uses session directory fallback for Build bookkeeping when worktree is absent", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const sessionDir = await mkdtemp(join(tmpdir(), "ksi-session-"))
  try {
    const hooks = await plugin({ directory: sessionDir })
    await hooks["chat.params"]({ sessionID: "b-sess", agent: "build" })
    const allow = (tool, args) => hooks["tool.execute.before"]({ tool, sessionID: "b-sess" }, { args })
    const deny = (tool, args) => assert.rejects(() => allow(tool, args), /Build never implements/)
    await assert.doesNotReject(() => allow("edit", { filePath: ".opencode/working-state.md", oldString: "a", newString: "b" }))
    await assert.doesNotReject(() => allow("write", { filePath: "docs/superpowers/plans/task.md", content: "x" }))
    await assert.doesNotReject(() => allow("edit", { filePath: join(sessionDir, ".opencode/working-state.md"), oldString: "a", newString: "b" }))
    const pluginBookkeeping = fileURLToPath(new URL("../.opencode/working-state.md", import.meta.url))
    assert.notEqual(pluginBookkeeping, join(sessionDir, ".opencode/working-state.md"))
    await deny("edit", { filePath: pluginBookkeeping, oldString: "a", newString: "b" })
    await deny("edit", { filePath: ".opencode-evil/x.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "docs/superpowers/plans-evil/x.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "docs/superpowers/plans/../x.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "../outside.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "/tmp/ksi-outside.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "/tmp/.opencode/working-state.md", oldString: "a", newString: "b" })
    await deny("edit", { filePath: "src/example.mjs", oldString: "a", newString: "b" })
    await deny("bash", { command: "git status" })
    await deny("apply_patch", { patchText: "*** Begin Patch" })
  } finally {
    const { rm: remove } = await import("node:fs/promises")
    await remove(sessionDir, { recursive: true, force: true })
  }
})

test("denies Build bookkeeping writes when worktree and directory are both absent", async () => {
  const hooks = await plugin()
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-none", agent: "build" })
  const deny = (tool, args) => assert.rejects(
    () => hooks["tool.execute.before"]({ tool, sessionID: "b-none" }, { args }),
    /Build never implements/,
  )
  await deny("edit", { filePath: ".opencode/working-state.md", oldString: "a", newString: "b" })
  await deny("write", { filePath: "docs/superpowers/plans/task.md", content: "x" })
})

test("allows bookkeeping under either base when both are present", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-wt-"))
  const sessionDir = await mkdtemp(join(tmpdir(), "ksi-dir-"))
  try {
    const hooks = await plugin({ directory: sessionDir, worktree })
    await hooks["chat.params"]({ sessionID: "b-both", agent: "build" })
    const allow = (tool, args) => hooks["tool.execute.before"]({ tool, sessionID: "b-both" }, { args })
    await assert.doesNotReject(() => allow("edit", { filePath: ".opencode/working-state.md", oldString: "a", newString: "b" }))
    await assert.doesNotReject(() => allow("edit", { filePath: join(sessionDir, ".opencode/working-state.md"), oldString: "a", newString: "b" }))
  } finally {
    await rm(worktree, { recursive: true, force: true })
    await rm(sessionDir, { recursive: true, force: true })
  }
})

test("validates research and design-task contracts on dispatch", async () => {
  const hooks = await plugin()
  await hooks["chat.params"]({ sessionID: "b", agent: "build" })
  const invoke = (args) => hooks["tool.execute.before"]({ tool: "task", sessionID: "b" }, { args })
  await assert.rejects(() => invoke({ subagent_type: "research", prompt: "Objective: compare\nScope: docs" }), /Evidence/)
  await assert.doesNotReject(() => invoke({ subagent_type: "research", prompt: "Objective: compare\nScope: docs\nEvidence: v1 sources" }))
  await assert.rejects(() => invoke({ subagent_type: "design-task", prompt: "Objective: prototype" }), /design-task section/)
  await assert.doesNotReject(() => invoke({ subagent_type: "design-task", prompt: "Objective: prototype\nAllowed write paths: design-previews/x\nAcceptance criteria: rendered\nEvidence: v1" }))
  await hooks["chat.params"]({ sessionID: "p", agent: "plan" })
  const planInvoke = (args) => hooks["tool.execute.before"]({ tool: "task", sessionID: "p" }, { args })
  await assert.doesNotReject(() => planInvoke({ subagent_type: "research", prompt: "Objective: compare\nScope: docs\nEvidence: v1 sources" }))
  await assert.rejects(() => planInvoke({ subagent_type: "design-task", prompt: "Objective: prototype\nAllowed write paths: design-previews/x\nAcceptance criteria: rendered\nEvidence: v1" }), /not allowed/)
})

test("tracks design-task review sessions and denies writers with cleanup", async () => {
  const hooks = await plugin()
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-review", agent: "build" })
  const reviewPrompt = "Objective: Review the empty state.\nMode: review\nAllowed write paths: none\nAcceptance criteria: VISUAL PASS/FAIL/BLOCKED-no-render.\nEvidence: artifact v3 plus diff plus PNGs."
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "task", sessionID: "b-review", callID: "r1" },
    { args: { subagent_type: "design-task", prompt: reviewPrompt } },
  ))
  await hooks["tool.execute.after"](
    { tool: "task", sessionID: "b-review", callID: "r1", args: { subagent_type: "design-task", prompt: reviewPrompt } },
    { title: "review", output: "VISUAL PASS", metadata: { sessionId: "review-child-1" } },
  )
  await hooks["chat.params"]({ sessionID: "review-child-1", agent: "design-task" })
  for (const tool of ["edit", "write", "apply_patch", "bash", "task", "lsp"]) {
    await assert.rejects(
      () => hooks["tool.execute.before"]({ tool, sessionID: "review-child-1", callID: `rc-${tool}` }, { args: {} }),
      /design-task review session is read-only/i,
    )
  }
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "read", sessionID: "review-child-1", callID: "rc-read" }, { args: {} },
  ))
  await hooks.event({ event: { type: "session.deleted", properties: { info: { id: "review-child-1" } } } })
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "read", sessionID: "review-child-1", callID: "rc-after" }, { args: {} },
  ))

  const protoPrompt = "Objective: Prototype the empty state.\nAllowed write paths: design-previews/empty\nAcceptance criteria: Rendered artifact inspected.\nEvidence: artifact v3, approved scope."
  await hooks["tool.execute.after"](
    { tool: "task", sessionID: "b-review", callID: "p1", args: { subagent_type: "design-task", prompt: protoPrompt } },
    { title: "prototype", output: "ok", metadata: { sessionId: "proto-child-1" } },
  )
  await hooks["chat.params"]({ sessionID: "proto-child-1", agent: "design-task" })
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "read", sessionID: "proto-child-1", callID: "pc-read" }, { args: {} },
  ))
})

test("fails loudly when a review child session cannot be recorded", async () => {
  const hooks = await plugin()
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-untracked", agent: "build" })
  const reviewPrompt = "Objective: Review the empty state.\nMode: review\nAllowed write paths: none\nAcceptance criteria: VISUAL PASS/FAIL/BLOCKED-no-render.\nEvidence: artifact v3 plus diff plus PNGs."
  await assert.rejects(
    () => hooks["tool.execute.after"](
      { tool: "task", sessionID: "b-untracked", callID: "r-missing", args: { subagent_type: "design-task", prompt: reviewPrompt } },
      { title: "review", output: "VISUAL PASS", metadata: {} },
    ),
    /untracked design-task review/i,
  )
})

test("keeps the review denied set explicit and mirrored from the review permission", async () => {
  const { DESIGN_REVIEW_PERMISSION, DESIGN_REVIEW_DENIED_TOOLS } = await import("../src/agents.mjs")
  assert.deepEqual([...DESIGN_REVIEW_DENIED_TOOLS], ["edit", "write", "apply_patch", "bash", "task", "lsp"])
  assert.ok(DESIGN_REVIEW_DENIED_TOOLS.length > 0)
  for (const tool of DESIGN_REVIEW_DENIED_TOOLS) {
    const denied = tool === "edit"
      ? DESIGN_REVIEW_PERMISSION.edit?.["*"] === "deny"
      : (DESIGN_REVIEW_PERMISSION[tool] ?? DESIGN_REVIEW_PERMISSION["*"]) === "deny"
    assert.equal(denied, true, `review permission must deny ${tool}`)
  }
})

test("rejects stale task identity and reconciles the first dispatch per session", async () => {
  const { mkdtemp } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-reconcile-"))
  try {
    const hooks = await plugin({ directory: worktree, worktree })
    hooks.config({})
    await hooks["chat.params"]({ sessionID: "parent-a", agent: "build" })
    await hooks["chat.params"]({ sessionID: "other", agent: "developer" })
    const devResult = { title: "done", output: "ok", metadata: { sessionId: "child-1" } }
    await hooks["tool.execute.after"](
      { tool: "task", sessionID: "parent-a", callID: "c1", args: { subagent_type: "developer" } }, devResult,
    )
    const stale = { subagent_type: "developer", task_id: "child-1", prompt: "Failure: failed\nEvidence: log" }
    await hooks["chat.params"]({ sessionID: "parent-b", agent: "build" })
    await assert.rejects(
      () => hooks["tool.execute.before"]({ tool: "task", sessionID: "parent-b" }, { args: stale }),
      /different parent/,
    )
    const first = { subagent_type: "explore", prompt: evidence }
    const output = { args: { ...first } }
    await hooks["tool.execute.before"]({ tool: "task", sessionID: "parent-b" }, output)
    assert.match(output.args.prompt, /Continuity reconcile/)
    const second = { args: { ...first } }
    await hooks["tool.execute.before"]({ tool: "task", sessionID: "parent-b" }, second)
    assert.doesNotMatch(second.args.prompt, /Continuity reconcile/)
  } finally {
    const { rm } = await import("node:fs/promises")
    await rm(worktree, { recursive: true, force: true })
  }
})

test("archives oversized task output with a bounded preview and pointer", async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-archive-"))
  try {
    const hooks = await plugin({ directory: worktree, worktree })
    hooks.config({})
    const big = "y".repeat(9 * 1024)
    const result = { title: "done", output: big, metadata: {} }
    await hooks["tool.execute.after"](
      { tool: "task", sessionID: "s", callID: "c1", args: { subagent_type: "research" } }, result,
    )
    assert.ok(Buffer.byteLength(result.output, "utf8") < Buffer.byteLength(big, "utf8"))
    assert.match(result.output, /bounded preview/)
    assert.match(result.output, /task-output/)
    const small = { title: "done", output: "short", metadata: {} }
    await hooks["tool.execute.after"](
      { tool: "task", sessionID: "s", callID: "c2", args: { subagent_type: "explore" } }, small,
    )
    assert.equal(small.output, "short")
  } finally {
    const { rm } = await import("node:fs/promises")
    await rm(worktree, { recursive: true, force: true })
  }
})

test("validates contracts, foreground execution, excluded skills and session cleanup", async () => {
  const hooks = await plugin()
  await hooks["chat.params"]({ sessionID: "s", agent: "build" })
  const invoke = (args) => hooks["tool.execute.before"]({ tool: "task", sessionID: "s" }, { args })
  for (const name of ["developer"]) {
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
    developer: { steps: 9 },
    "test-runner": { steps: 11 },
    reviewer: { steps: 12 },
    research: { steps: 13 },
    "design-task": { steps: 14 },
  } }
  hooks.config(config)
  assert.deepEqual(Object.fromEntries(ROLES.map((name) => [name, config.agent[name].steps])), {
    explore: 7, developer: 9, "test-runner": 11, reviewer: 12,
    research: 13, "design-task": 14,
  })

  const defaults = {}
  hooks.config(defaults)
  assert.deepEqual(Object.fromEntries(ROLES.map((name) => [name, defaults.agent[name].steps])), {
    explore: 20, developer: 80, "test-runner": 24, reviewer: 32,
    research: 20, "design-task": 40,
  })
  assert.equal(defaults.agent.build.steps, 200)
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
  for (const name of ["developer"]) {
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

test("allows only direct root-Build Developer helpers and keeps Test Runner non-recursive", async () => {
  const sessions = new Map([
    ["build", { id: "build" }],
    ["complex", { id: "complex", parentID: "build" }],
    ["nested", { id: "nested", parentID: "complex" }],
  ])
  const hooks = await helperHooks(sessions)
  await hooks["chat.params"]({ sessionID: "build", agent: "build" })
  await hooks["chat.params"]({ sessionID: "complex", agent: "developer" })
  await hooks["chat.params"]({ sessionID: "nested", agent: "developer" })
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
  for (const name of ["developer"]) {
    assert.match(enabledConfig.agent[name].description, /except the narrow developerTestRunner opt-in/i)
    assert.match(enabledConfig.agent[name].prompt, /No delegation by default/i)
    assert.match(enabledConfig.agent[name].prompt, /author feedback/i)
  }
})

test("matches the developer role exactly and keeps near-miss names read-only", () => {
  assert.equal(rolePermission("developer").bash, "ask")
  for (const name of ["developer-complex", "developerx", "developer-complex-2"]) {
    assert.equal(rolePermission(name).bash, "deny", `near-miss role granted shell: ${name}`)
    assert.equal(rolePermission(name).edit, "deny", `near-miss role granted edits: ${name}`)
  }
})

test("build prompt dispatches developer only without absorbed role names", async () => {
  const prompt = await readFile(new URL("../agents/build.md", import.meta.url), "utf8")
  assert.doesNotMatch(prompt, /developer-complex|plan-reviewer/i)
  assert.match(prompt, /Developer \(including complex work\) for implementation/)
})

test("grants context7_* to research and Design track without widening other roles", async () => {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  assert.equal(config.agent.research.permission["context7_*"], "allow")
  assert.equal(rolePermission("research")["context7_*"], "allow")
  assert.equal(config.agent.design.permission["context7_*"], "ask")
  assert.equal(config.agent["design-task"].permission["context7_*"], "ask")
  for (const name of ["explore", "developer", "test-runner", "reviewer"]) {
    assert.equal(config.agent[name].permission["context7_*"], undefined, `${name} must not gain context7 grant`)
  }
})

test("chat.message mutates the last text part without creating parts", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-msg-inject-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const before = { id: "part-1", sessionID: "s-msg", messageID: "m-1", type: "text", text: "hello" }
    const output = { message: {}, parts: [before] }
    await hooks["chat.message"]({ sessionID: "s-msg" }, output)
    assert.equal(output.parts.length, 1)
    assert.equal(output.parts[0], before)
    assert.equal(before.id, "part-1")
    assert.equal(before.sessionID, "s-msg")
    assert.equal(before.messageID, "m-1")
    assert.equal(before.type, "text")
    assert.ok(before.text.startsWith("hello\n\n"))
    assert.match(before.text, /shared project checkpoint/i)
    assert.match(before.text, /# Working State/)
    // Once per session: a repeat call leaves the text untouched.
    const snapshot = before.text
    await hooks["chat.message"]({ sessionID: "s-msg" }, output)
    assert.equal(before.text, snapshot)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("chat.message appends to the last eligible text part and never pushes", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-msg-nopush-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const first = { type: "text", text: "first" }
    const tool = { type: "tool", tool: "task", state: {} }
    const last = { type: "text", text: "last" }
    const output = { message: {}, parts: [first, tool, last] }
    output.parts.push = () => { throw new Error("parts.push must never be called by continuity injection") }
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-nopush" }, output))
    assert.equal(first.text, "first")
    assert.equal(tool.text, undefined)
    assert.ok(last.text.startsWith("last\n\n"))
    assert.match(last.text, /shared project checkpoint/i)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("chat.message does nothing without an eligible text part and never throws", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-msg-noop-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    for (const parts of [[], [{ type: "tool", tool: "task" }], [{ type: "text" }], [{ type: "text", text: 42 }]]) {
      const output = { message: {}, parts }
      const length = parts.length
      await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: `s-noop-${length}-${parts.length}` }, output))
      assert.equal(output.parts.length, length)
    }
    // Missing sessionID and missing output shape: no throw, no-op.
    await assert.doesNotReject(() => hooks["chat.message"]({}, { message: {}, parts: [{ type: "text", text: "x" }] }))
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-noop-shape" }, {}))
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-noop-shape" }, null))
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("chat.message leaves text untouched when there is nothing to inject", async () => {
  const { mkdtemp, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const empty = await mkdtemp(join(tmpdir(), "ksi-msg-nothing-"))
  try {
    const hooks = await plugin({ directory: empty, worktree: empty })
    const output = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-msg-nothing" }, output))
    assert.equal(output.parts.length, 1)
    assert.equal(output.parts[0].text, "hello")
  } finally {
    await rm(empty, { recursive: true, force: true })
  }
})

test("chat.message stays silent for an oversized checkpoint and marks a malformed product", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-msg-bounds-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), `${"z".repeat(7 * 1024)}\n`, "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const oversized = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-msg-oversized" }, oversized))
    assert.equal(oversized.parts[0].text, "hello")
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(join(worktree, "docs", "superpowers", "product-state.md"), Buffer.from([0xff, 0xfe, 0x00, 0x28]))
    const malformed = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await assert.doesNotReject(() => hooks["chat.message"]({ sessionID: "s-msg-malformed" }, malformed))
    assert.ok(malformed.parts[0].text.startsWith("hello\n\n"))
    assert.match(malformed.parts[0].text, /\[continuity: product-state unavailable:/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("message path and transform fallback share one per-session injection", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-shared-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const model = { providerID: "p", modelID: "m" }
    // Message path first: the transform fallback must skip.
    const msg = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-shared-a" }, msg)
    assert.match(msg.parts[0].text, /shared project checkpoint/i)
    const fallback = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-shared-a", model }, fallback)
    assert.equal(fallback.system.length, 0)
    // Transform first: the message path must skip.
    const sys = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-shared-b", model }, sys)
    assert.equal(sys.system.length, 1)
    const late = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-shared-b" }, late)
    assert.equal(late.parts[0].text, "hello")
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("injects the checkpoint block exactly once per session on system.transform", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const model = { providerID: "p", modelID: "m" }
    const first = { system: ["base"] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-inject", model }, first)
    assert.equal(first.system.length, 2)
    assert.equal(typeof first.system[1], "string")
    assert.match(first.system[1], /shared project checkpoint/i)
    assert.match(first.system[1], /# Working State/)
    const second = { system: ["base"] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-inject", model }, second)
    assert.equal(second.system.length, 1)
    const other = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-other", model }, other)
    assert.equal(other.system.length, 1)
    assert.equal(typeof other.system[0], "string")
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("skips system.transform injection without blocking when no checkpoint exists", async () => {
  const hooks = await plugin()
  const output = { system: ["base"] }
  await assert.doesNotReject(() => hooks["experimental.chat.system.transform"]({ model: {} }, output))
  assert.equal(output.system.length, 1)
})

test("config() does not throw for directory-only sessions and installs the fallback design pattern", async () => {
  const hooks = await plugin({ directory: "/tmp/ksi-dir-only" })
  const config = {}
  assert.doesNotThrow(() => hooks.config(config))
  assert.equal(config.agent["design-task"].permission.edit["design-previews/**"], "ask")
})

test("session.deleted clears the once-per-session injection set", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-reset-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const model = { providerID: "p", modelID: "m" }
    const first = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-reset" }, first)
    assert.match(first.parts[0].text, /shared project checkpoint/i)
    const blocked = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-reset", model }, blocked)
    assert.equal(blocked.system.length, 0)
    await hooks.event({ event: { type: "session.deleted", properties: { info: { id: "s-reset" } } } })
    const third = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-reset", model }, third)
    assert.equal(third.system.length, 1)
    await hooks.event({ event: { type: "session.deleted", properties: { info: { id: "s-reset" } } } })
    const fourth = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-reset" }, fourth)
    assert.match(fourth.parts[0].text, /shared project checkpoint/i)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("session.compacted re-arms both paths so the next request injects again", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-compact-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const model = { providerID: "p", modelID: "m" }
    const first = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-compact" }, first)
    assert.match(first.parts[0].text, /shared project checkpoint/i)
    const second = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-compact", model }, second)
    assert.equal(second.system.length, 0)
    await hooks.event({ event: { type: "session.compacted", properties: { info: { id: "s-compact" } } } })
    const third = { message: {}, parts: [{ type: "text", text: "hello" }] }
    await hooks["chat.message"]({ sessionID: "s-compact" }, third)
    assert.match(third.parts[0].text, /shared project checkpoint/i)
    await hooks.event({ event: { type: "session.compacted", properties: { info: { id: "s-compact" } } } })
    const fourth = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-compact", model }, fourth)
    assert.equal(fourth.system.length, 1)
    assert.equal(typeof fourth.system[0], "string")
    assert.match(fourth.system[0], /shared project checkpoint/i)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("system.transform never throws and pushes nothing when there is nothing to inject", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  // Missing checkpoint and missing product state: no push, no throw.
  const empty = await mkdtemp(join(tmpdir(), "ksi-inject-nothing-"))
  try {
    const hooks = await plugin({ directory: empty, worktree: empty })
    const output = { system: [] }
    await assert.doesNotReject(() => hooks["experimental.chat.system.transform"]({ sessionID: "s-nothing", model: {} }, output))
    assert.equal(output.system.length, 0)
    // Repeat call also stays silent (never marked injected when nothing pushed).
    const repeat = { system: [] }
    await assert.doesNotReject(() => hooks["experimental.chat.system.transform"]({ sessionID: "s-nothing", model: {} }, repeat))
    assert.equal(repeat.system.length, 0)
    // Missing sessionID: no throw, no push.
    const noSession = { system: [] }
    await assert.doesNotReject(() => hooks["experimental.chat.system.transform"]({}, noSession))
    assert.equal(noSession.system.length, 0)
  } finally {
    await rm(empty, { recursive: true, force: true })
  }
})

test("system.transform stays silent for an oversized checkpoint and never throws", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-oversized-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), `${"z".repeat(7 * 1024)}\n`, "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { system: [] }
    await assert.doesNotReject(() => hooks["experimental.chat.system.transform"]({ sessionID: "s-oversized", model: {} }, output))
    assert.equal(output.system.length, 0)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("compaction without a checkpoint still pushes the pointer text", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-compact-missing-"))
  try {
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { context: [] }
    await hooks["experimental.session.compacting"]({}, output)
    assert.ok(output.context.length >= 1)
    assert.match(output.context[0], /Continuity pointers/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("compaction context includes the checkpoint block alongside pointers", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-compact-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { context: [] }
    await hooks["experimental.session.compacting"]({}, output)
    assert.ok(output.context.length >= 2)
    assert.match(output.context[0], /Continuity pointers/)
    assert.match(output.context.join("\n"), /shared project checkpoint/i)
    assert.match(output.context.join("\n"), /# Working State/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("installs Test Runner with a default of 24 steps while preserving explicit values", async () => {
  const { EXECUTION_BUDGETS } = await import("../src/agents.mjs")
  assert.equal(EXECUTION_BUDGETS["test-runner"], 24)
  const hooks = await plugin()
  const defaults = {}
  hooks.config(defaults)
  assert.equal(defaults.agent["test-runner"].steps, 24)
  const explicit = { agent: { "test-runner": { steps: 11 } } }
  hooks.config(explicit)
  assert.equal(explicit.agent["test-runner"].steps, 11)
})

test("injects the product-state block alongside the checkpoint on system.transform", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-product-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(
      join(worktree, "docs", "superpowers", "product-state.md"),
      "# Product State - Fixture\nUpdated: 2026-09-16\n## Goal\nShip the fixture goal.\n## Current slice\n- Name: Slice A fixture\n- Acceptance (user-visible end-to-end): fixture acceptance\n- Plan ledger: docs/superpowers/plans/fixture.md\n",
      "utf8",
    )
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { system: ["base"] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-product-inject", model: {} }, output)
    assert.equal(output.system.length, 2)
    assert.equal(typeof output.system[1], "string")
    assert.match(output.system[1], /shared project checkpoint/i)
    assert.match(output.system[1], /Product state \(docs\/superpowers\/product-state\.md\)/)
    assert.match(output.system[1], /Slice A fixture/)
    assert.ok(Buffer.byteLength(output.system[1], "utf8") <= 5000)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("keeps system.transform injection within the shared combined bound with a marker", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-combined-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), `${"y".repeat(4400)}\n`, "utf8")
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(
      join(worktree, "docs", "superpowers", "product-state.md"),
      "# Product State - Fixture\nUpdated: 2026-09-16\n## Goal\nShip the fixture goal.\n## Current slice\n- Name: Slice A fixture\n- Acceptance (user-visible end-to-end): fixture acceptance\n- Plan ledger: docs/superpowers/plans/fixture.md\n",
      "utf8",
    )
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-combined", model: {} }, output)
    assert.equal(output.system.length, 1)
    assert.equal(typeof output.system[0], "string")
    assert.match(output.system[0], /shared project checkpoint/i)
    assert.match(output.system[0], /clipped|omitted|truncated/i)
    assert.ok(Buffer.byteLength(output.system[0], "utf8") <= 5000)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("injects product-only output on system.transform when no checkpoint exists", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-product-only-"))
  try {
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(
      join(worktree, "docs", "superpowers", "product-state.md"),
      "# Product State - Fixture\nUpdated: 2026-09-16\n## Goal\nShip the fixture goal.\n## Current slice\n- Name: Slice A fixture\n- Acceptance (user-visible end-to-end): fixture acceptance\n- Plan ledger: docs/superpowers/plans/fixture.md\n",
      "utf8",
    )
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-product-only", model: {} }, output)
    assert.equal(output.system.length, 1)
    assert.equal(typeof output.system[0], "string")
    assert.match(output.system[0], /Product state \(docs\/superpowers\/product-state\.md\)/)
    assert.match(output.system[0], /Slice A fixture/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("stays silent for a missing product state but marks a malformed one on system.transform", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-inject-unavailable-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    const hooks = await plugin({ directory: worktree, worktree })
    const missing = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-missing-product", model: {} }, missing)
    assert.equal(missing.system.length, 1)
    assert.equal(typeof missing.system[0], "string")
    assert.doesNotMatch(missing.system[0], /product-state unavailable/)
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(join(worktree, "docs", "superpowers", "product-state.md"), Buffer.from([0xff, 0xfe, 0x00, 0x28]))
    const malformed = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "s-malformed-product", model: {} }, malformed)
    assert.equal(malformed.system.length, 1)
    assert.equal(typeof malformed.system[0], "string")
    assert.match(malformed.system[0], /\[continuity: product-state unavailable:/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("compaction includes the product-state block alongside checkpoint pointers", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-compact-product-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), "# Working State\n\nStatus: active\n", "utf8")
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(
      join(worktree, "docs", "superpowers", "product-state.md"),
      "# Product State - Fixture\nUpdated: 2026-09-16\n## Goal\nShip the fixture goal.\n## Current slice\n- Name: Slice A fixture\n- Acceptance (user-visible end-to-end): fixture acceptance\n- Plan ledger: docs/superpowers/plans/fixture.md\n",
      "utf8",
    )
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { context: [] }
    await hooks["experimental.session.compacting"]({}, output)
    assert.ok(output.context.length >= 2)
    assert.match(output.context[0], /Continuity pointers/)
    assert.match(output.context.join("\n"), /shared project checkpoint/i)
    assert.match(output.context.join("\n"), /Product state \(docs\/superpowers\/product-state\.md\)/)
    assert.match(output.context.join("\n"), /Slice A fixture/)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})

test("keeps compaction injection within the shared combined bound with a marker", async () => {
  const { mkdtemp, mkdir, rm, writeFile } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const worktree = await mkdtemp(join(tmpdir(), "ksi-compact-combined-"))
  try {
    await mkdir(join(worktree, ".opencode"), { recursive: true })
    await writeFile(join(worktree, ".opencode", "working-state.md"), `${"y".repeat(4400)}\n`, "utf8")
    await mkdir(join(worktree, "docs", "superpowers"), { recursive: true })
    await writeFile(
      join(worktree, "docs", "superpowers", "product-state.md"),
      "# Product State - Fixture\nUpdated: 2026-09-16\n## Goal\nShip the fixture goal.\n## Current slice\n- Name: Slice A fixture\n- Acceptance (user-visible end-to-end): fixture acceptance\n- Plan ledger: docs/superpowers/plans/fixture.md\n",
      "utf8",
    )
    const hooks = await plugin({ directory: worktree, worktree })
    const output = { context: [] }
    await hooks["experimental.session.compacting"]({}, output)
    assert.ok(output.context.length >= 2)
    const injected = output.context.slice(1).join("\n")
    assert.match(injected, /shared project checkpoint/i)
    assert.match(injected, /clipped|omitted|truncated/i)
    assert.ok(Buffer.byteLength(injected, "utf8") <= 5000)
  } finally {
    await rm(worktree, { recursive: true, force: true })
  }
})
