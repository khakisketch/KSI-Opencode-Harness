import { isAbsolute, relative, resolve, sep } from "node:path"

export const ROLES = ["explore", "developer", "test-runner", "reviewer", "research", "design-task"]

export const CALLS = {
  plan: ["explore", "reviewer", "research"],
  build: ["explore", "developer", "test-runner", "reviewer", "research", "design-task"],
}

export const EXECUTION_BUDGETS = {
  build: 200,
  design: 60,
  explore: 20,
  developer: 80,
  "test-runner": 24,
  reviewer: 32,
  research: 20,
  "design-task": 40,
}

const safeRead = {
  "*": "allow", "*.env": "deny", "*.env.*": "deny",
  "*credentials*": "deny", "*auth.json": "deny", "*.pem": "deny", "*.key": "deny",
  "*.env.example": "allow",
}
export const READ_ONLY_PERMISSION = {
  "*": "deny", read: safeRead, glob: "allow", grep: "allow", list: "allow",
  edit: "deny", bash: "deny", task: "deny", skill: "deny",
  external_directory: "deny", webfetch: "deny", websearch: "deny",
}
const rules = (names) => ({ "*": "deny", ...Object.fromEntries(names.map((name) => [name, "allow"])) })
export const DEVELOPER_PERMISSION = {
  ...READ_ONLY_PERMISSION, lsp: "allow", edit: "ask", bash: "ask",
  question: "allow", todowrite: "allow",
  skill: rules(["test-driven-development", "systematic-debugging", "verification-before-completion"]),
}
export const EVIDENCE_TOOLS = [
  "ksi_repo_status",
  "ksi_repo_diffstat",
  "ksi_checkpoint_read",
  "ksi_reconcile",
  "ksi_env_probe",
  "ksi_audit_summary",
]
const evidenceGrants = () => Object.fromEntries(EVIDENCE_TOOLS.map((name) => [name, "allow"]))
export const PLAN_PERMISSION = {
  ...READ_ONLY_PERMISSION, question: "allow", todowrite: "allow", plan_exit: "allow",
  webfetch: "allow", websearch: "allow", lsp: "allow",
  ...evidenceGrants(),
  skill: rules(["brainstorming", "writing-plans", "systematic-debugging", "ui-ux-pro-max", "customize-opencode"]),
  edit: { "*": "deny", ".opencode/working-state.md": "allow" },
  task: rules(CALLS.plan),
}
export const RESEARCH_PERMISSION = {
  ...READ_ONLY_PERMISSION, webfetch: "allow", websearch: "allow",
  "context7_*": "allow",
}
export const BUILD_BOOKKEEPING_EDIT = { "*": "deny", ".opencode/**": "allow", "docs/superpowers/plans/**": "allow", "docs/superpowers/product-state.md": "allow" }
export const BUILD_PERMISSION = {
  "*": "deny",
  read: { ...safeRead }, glob: "allow", grep: "allow", list: "allow",
  question: "allow", todowrite: "allow",
  webfetch: "allow", websearch: "allow",
  ...evidenceGrants(),
  skill: rules(["subagent-driven-development", "executing-plans", "verification-before-completion", "systematic-debugging"]),
  edit: BUILD_BOOKKEEPING_EDIT,
  bash: "deny", lsp: "deny", external_directory: "deny",
  task: rules(CALLS.build),
}
const designReadOnlyPermission = { ...READ_ONLY_PERMISSION }
delete designReadOnlyPermission.task
export const DESIGN_PERMISSION = {
  ...designReadOnlyPermission,
  lsp: "allow", question: "allow", todowrite: "allow",
  skill: rules(["brainstorming", "ui-ux-pro-max", "mobbin-design", "systematic-debugging", "verification-before-completion"]),
  edit: { "*": "deny", ".opencode/working-state.md": "allow" },
  bash: "ask", external_directory: "ask", webfetch: "ask", "playwright_*": "ask",
  "mobbin_*": "ask", "gpt_imagegen": "ask", "context7_*": "ask",
  "playwright_browser_run_code_unsafe": "deny",
  task: "deny",
}
function bookkeepingRootEditPatterns(bookkeepingRoot, worktree) {
  try {
    if (typeof bookkeepingRoot !== "string" || !bookkeepingRoot) return []
    if (typeof worktree !== "string" || !worktree) return []
    if (!isAbsolute(bookkeepingRoot) || !isAbsolute(worktree)) return []
    const location = relative(worktree, bookkeepingRoot)
    if (!location || location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) return []
    const prefix = location.split(sep).join("/")
    if (!prefix) return []
    const patterns = [`${prefix}/.opencode/**`, `${prefix}/docs/superpowers/plans/**`, `${prefix}/docs/superpowers/product-state.md`]
    return patterns.filter((pattern) => !Object.hasOwn(BUILD_BOOKKEEPING_EDIT, pattern))
  } catch {
    return []
  }
}

function buildBookkeepingEdit(bookkeepingRoot, worktree) {
  const edit = clonePermission(BUILD_BOOKKEEPING_EDIT)
  for (const pattern of bookkeepingRootEditPatterns(bookkeepingRoot, worktree)) {
    if (!Object.hasOwn(edit, pattern)) edit[pattern] = "allow"
  }
  return edit
}

const descriptions = {
  design: "User-facing visual design Primary: create approved, artifact-first previews within the authorized scope; no delegation or production integration.",
  build: "Execution orchestrator: decompose approved plans, delegate to workers, adjudicate evidence and completion. Never implements product code directly.",
  explore: "Bounded read-only code discovery for Plan and Build. Return evidence, not architecture decisions.",
  research: "Bounded external research for Plan and Build. Return versioned sources and counterevidence, not product decisions.",
  "design-task": "Delegated visual design execution for Build: prototype-only within assigned paths, no approval authority, no recursion.",
  developer: "Bounded general implementation and targeted repair, including complex work with coupled state, concurrency and difficult repairs within an approved contract. Escalate design changes and unexplained failures to Build. No delegation.",
  "test-runner": "Independent trusted test execution after writers stop. Return commands, evidence and unverified boundaries; no fixes.",
  reviewer: "Independent read-only review of actual changes and test evidence. Return defects and gaps, not final approval.",
}
const clonePermission = (permission) => structuredClone(permission)
const isPermissionMap = (permission) => permission !== null && typeof permission === "object" && !Array.isArray(permission)
const mergePermissionMap = (defaults, overrides) => ({
  ...Object.fromEntries(Object.entries(defaults).filter(([pattern]) => !Object.hasOwn(overrides, pattern))),
  ...clonePermission(overrides),
})
export const DESIGN_TASK_REVIEW_MODE = "review"
export const DESIGN_REVIEW_PERMISSION = {
  ...clonePermission(DESIGN_PERMISSION),
  edit: { "*": "deny" },
  external_directory: "deny",
  bash: "deny",
  task: "deny",
  lsp: "deny",
}
export const DESIGN_REVIEW_DENIED_TOOLS = ["edit", "write", "apply_patch", "bash", "task", "lsp"]
const rootPermissionActions = new Set(["deny", "ask"])
const unsafeBrowserTool = "playwright_browser_run_code_unsafe"
const globMetacharacters = /[*?\[\]{}]/

function previewEditPattern(directory, worktree) {
  if (directory === undefined && worktree === undefined) return "design-previews/**"
  if (typeof directory !== "string" || typeof worktree !== "string") {
    throw new Error("KSI: Design preview permission requires native directory and worktree context.")
  }
  if (!isAbsolute(directory) || !isAbsolute(worktree)) {
    throw new Error("KSI: Design native directory and worktree must be absolute paths.")
  }
  const location = relative(worktree, directory)
  if (isAbsolute(location) || location === ".." || location.startsWith(`..${sep}`)) {
    throw new Error("KSI: Design native directory must stay inside its worktree.")
  }
  return `${relative(worktree, resolve(directory, "design-previews")).split(sep).join("/")}/**`
}

function rootPermissionFailure() {
  throw new Error("KSI: Design root permission allow is not allowed; use scoped named tools or paths.")
}

function normalizedDesignPermission(existing) {
  if (existing === undefined || existing === null) return { beforeRoot: [], afterRoot: [], root: undefined }
  if (!isPermissionMap(existing)) {
    if (existing === "allow") rootPermissionFailure()
    if (rootPermissionActions.has(existing)) return { beforeRoot: [], afterRoot: [], root: existing }
    throw new Error("KSI: Design root permission must be deny or ask; use scoped named tools or paths.")
  }

  const entries = Object.entries(existing).filter(([tool]) => tool !== "task")
  const rootIndex = entries.findIndex(([tool]) => tool === "*")
  if (rootIndex === -1) return { beforeRoot: entries, afterRoot: [], root: undefined }
  const root = entries[rootIndex][1]
  if (root === "allow") rootPermissionFailure()
  if (!rootPermissionActions.has(root)) {
    throw new Error("KSI: Design root permission must be deny or ask; use scoped named tools or paths.")
  }
  return { beforeRoot: entries.slice(0, rootIndex), afterRoot: entries.slice(rootIndex + 1), root }
}

function validateDesignPermissionEntry(tool, value) {
  if (tool !== "edit") return
  if (value === "allow") {
    throw new Error("KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards.")
  }
  if (isPermissionMap(value)) {
    for (const [pattern, action] of Object.entries(value)) {
      if (action !== "allow") continue
      const normalized = pattern.replaceAll("\\", "/")
      const parts = normalized.split("/")
      const relativePath = normalized.trim().length > 0 && !normalized.includes("\0")
        && !/^[A-Za-z]:/.test(normalized)
        && parts.every((part) => part !== "" && part !== "." && part !== "..")
      const wildcard = normalized.search(globMetacharacters)
      // A root-level filename glob has no directory scope, even with a literal prefix.
      const scoped = wildcard === -1 || normalized.lastIndexOf("/", wildcard) > 0
      if (relativePath && scoped) continue
      throw new Error("KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards.")
    }
  }
}

function applyPermissionEntries(permission, entries) {
  for (const [tool, value] of entries) {
    validateDesignPermissionEntry(tool, value)
    const defaults = permission[tool]
    delete permission[tool]
    permission[tool] = isPermissionMap(defaults) && isPermissionMap(value)
      ? mergePermissionMap(defaults, value)
      : clonePermission(value)
  }
}

const DEVELOPER_TEST_RUNNER_PROMPT = `

Developer-to-Test Runner assistance is enabled for this session. You may request one targeted Test Runner helper only for author feedback, never as independent acceptance. Pause all edits and shell use while that helper is active. The Primary still owns final testing and review.`

function nativeSteps(name, existing) {
  if (!Object.hasOwn(existing, "steps")) return EXECUTION_BUDGETS[name]
  if (!Number.isSafeInteger(existing.steps) || existing.steps <= 0) {
    throw new Error(`KSI: ${name} supplied invalid positive integer native steps; received ${String(existing.steps)}.`)
  }
  return existing.steps
}

function developerPermission(developerTestRunner) {
  if (!developerTestRunner) return clonePermission(DEVELOPER_PERMISSION)
  return { ...clonePermission(DEVELOPER_PERMISSION), task: rules(["test-runner"]) }
}

function designPermission(existing, pattern) {
  const { beforeRoot, afterRoot, root } = normalizedDesignPermission(existing)
  const permission = clonePermission(DESIGN_PERMISSION)
  permission.edit[pattern] = "ask"
  delete permission.task
  if (root !== undefined) delete permission["*"]
  applyPermissionEntries(permission, beforeRoot)
  if (root !== undefined) permission["*"] = root
  applyPermissionEntries(permission, afterRoot)
  delete permission[unsafeBrowserTool]
  permission[unsafeBrowserTool] = "deny"
  return { ...permission, task: "deny" }
}

function roleDescription(name, developerTestRunner) {
  const description = descriptions[name]
  if (!developerTestRunner || name !== "developer") return description
  return description.replace("No delegation.", "No delegation except the narrow developerTestRunner opt-in for one targeted Test Runner helper.")
}

export function rolePermission(name, developerTestRunner = false, previewPattern = "design-previews/**") {
  if (name === "developer") return developerPermission(developerTestRunner)
  if (name === "test-runner") return { ...clonePermission(READ_ONLY_PERMISSION), bash: "allow" }
  if (name === "research") return clonePermission(RESEARCH_PERMISSION)
  if (name === "explore") return { ...clonePermission(READ_ONLY_PERMISSION), lsp: "allow" }
  if (name === "design-task") {
    return {
      ...clonePermission(DESIGN_PERMISSION),
      edit: { "*": "deny", [previewPattern]: "ask" },
      external_directory: "deny",
      task: "deny",
    }
  }
  return clonePermission(READ_ONLY_PERMISSION)
}

export function installAgents(config, prompts, { developerTestRunner = false, designPrompt, directory, worktree, bookkeepingRoot } = {}) {
  config.agent ??= {}
  config.agent.plan = { ...config.agent.plan, permission: clonePermission(PLAN_PERMISSION) }
  // Strict coordinator-only Build: user model/variant/steps are preserved, but
  // product edit and shell grants are never inherited. The hook adds a second
  // enforcement layer for direct-implementation attempts.
  const existingBuild = config.agent.build ?? {}
  const buildPermission = clonePermission(BUILD_PERMISSION)
  const patternRoot = typeof bookkeepingRoot === "string" && bookkeepingRoot
    ? bookkeepingRoot
    : (typeof directory === "string" && directory ? directory : null)
  buildPermission.edit = buildBookkeepingEdit(patternRoot, worktree)
  config.agent.build = {
    ...existingBuild,
    mode: "primary", description: descriptions.build,
    ...(prompts.build === undefined ? {} : { prompt: prompts.build }),
    steps: nativeSteps("build", existingBuild),
    permission: buildPermission,
  }
  const hasNativePair = typeof directory === "string" && typeof worktree === "string"
  const designPreviewPattern = hasNativePair ? previewEditPattern(directory, worktree) : "design-previews/**"
  const existingDesign = config.agent.design ?? {}
  config.agent.design = {
    ...existingDesign,
    mode: "primary", description: descriptions.design, prompt: designPrompt,
    steps: nativeSteps("design", existingDesign), permission: designPermission(existingDesign.permission, designPreviewPattern),
  }
  const previewPattern = (() => {
    if (!hasNativePair) return "design-previews/**"
    try {
      return previewEditPattern(directory, worktree)
    } catch {
      return "design-previews/**"
    }
  })()
  for (const name of ROLES) {
    const existing = config.agent[name] ?? {}
    config.agent[name] = {
      mode: "subagent", description: roleDescription(name, developerTestRunner),
      prompt: name === "design-task" ? designPrompt
        : developerTestRunner && name === "developer"
          ? `${prompts[name]}${DEVELOPER_TEST_RUNNER_PROMPT}`
          : prompts[name],
      ...(name === "design-task" ? { hidden: true } : {}),
      ...(existing.model === undefined ? {} : { model: existing.model }),
      ...(existing.variant === undefined ? {} : { variant: existing.variant }),
      steps: nativeSteps(name, existing),
      permission: rolePermission(name, developerTestRunner, previewPattern),
    }
  }
}
