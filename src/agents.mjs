import { isAbsolute, relative, resolve, sep } from "node:path"

export const ROLES = ["explore", "plan-reviewer", "developer", "developer-complex", "test-runner", "reviewer"]

export const CALLS = {
  plan: ["explore", "plan-reviewer"],
  build: ["explore", "developer", "developer-complex", "test-runner", "reviewer"],
}

export const EXECUTION_BUDGETS = {
  design: 60,
  explore: 20,
  "plan-reviewer": 24,
  developer: 60,
  "developer-complex": 80,
  "test-runner": 16,
  reviewer: 32,
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
export const PLAN_PERMISSION = {
  ...READ_ONLY_PERMISSION, question: "allow", todowrite: "allow", plan_exit: "allow",
  webfetch: "allow", websearch: "allow",
  skill: rules(["brainstorming", "writing-plans", "systematic-debugging", "ui-ux-pro-max", "customize-opencode"]),
  edit: { "*": "deny", ".opencode/working-state.md": "allow" },
  task: rules(CALLS.plan),
}
const designReadOnlyPermission = { ...READ_ONLY_PERMISSION }
delete designReadOnlyPermission.task
export const DESIGN_PERMISSION = {
  ...designReadOnlyPermission,
  lsp: "allow", question: "allow", todowrite: "allow",
  skill: rules(["brainstorming", "ui-ux-pro-max", "systematic-debugging", "verification-before-completion"]),
  edit: { "*": "deny", ".opencode/working-state.md": "allow" },
  bash: "ask", external_directory: "ask", webfetch: "ask", "playwright_*": "ask",
  "playwright_browser_run_code_unsafe": "deny",
  task: "deny",
}
const descriptions = {
  design: "User-facing visual design Primary: create approved, artifact-first previews within the authorized scope; no delegation or production integration.",
  explore: "Bounded read-only code discovery for Plan and Build. Return evidence, not architecture decisions.",
  "plan-reviewer": "Plan-only independent critique: omissions, contracts, dependencies and verifiable acceptance. No implementation or approval.",
  developer: "Bounded general implementation and targeted repair. Escalate design changes and unexplained failures to Build. No delegation.",
  "developer-complex": "Complex implementation assigned by Build: coupled state, concurrency and difficult repairs within an approved contract. No delegation.",
  "test-runner": "Independent trusted test execution after writers stop. Return commands, evidence and unverified boundaries; no fixes.",
  reviewer: "Independent read-only review of actual changes and test evidence. Return defects and gaps, not final approval.",
}
const clonePermission = (permission) => structuredClone(permission)
const isPermissionMap = (permission) => permission !== null && typeof permission === "object" && !Array.isArray(permission)
const mergePermissionMap = (defaults, overrides) => ({
  ...Object.fromEntries(Object.entries(defaults).filter(([pattern]) => !Object.hasOwn(overrides, pattern))),
  ...clonePermission(overrides),
})
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
  if (!developerTestRunner || !name.startsWith("developer")) return description
  return description.replace("No delegation.", "No delegation except the narrow developerTestRunner opt-in for one targeted Test Runner helper.")
}

export function installAgents(config, prompts, { developerTestRunner = false, designPrompt, directory, worktree } = {}) {
  config.agent ??= {}
  config.agent.plan = { ...config.agent.plan, permission: clonePermission(PLAN_PERMISSION) }
  // Preserve inherited and per-agent grants/denials exactly. The hook enforces the role graph.
  config.agent.build = { ...config.agent.build }
  const existingDesign = config.agent.design ?? {}
  config.agent.design = {
    ...existingDesign,
    mode: "primary", description: descriptions.design, prompt: designPrompt,
    steps: nativeSteps("design", existingDesign), permission: designPermission(existingDesign.permission, previewEditPattern(directory, worktree)),
  }
  for (const name of ROLES) {
    const existing = config.agent[name] ?? {}
    config.agent[name] = {
      mode: "subagent", description: roleDescription(name, developerTestRunner),
      prompt: developerTestRunner && name.startsWith("developer")
        ? `${prompts[name]}${DEVELOPER_TEST_RUNNER_PROMPT}`
        : prompts[name],
      ...(existing.model === undefined ? {} : { model: existing.model }),
      ...(existing.variant === undefined ? {} : { variant: existing.variant }),
      steps: nativeSteps(name, existing),
      permission: name.startsWith("developer") ? developerPermission(developerTestRunner)
        : name === "test-runner" ? { ...clonePermission(READ_ONLY_PERMISSION), bash: "allow" } : clonePermission(READ_ONLY_PERMISSION),
    }
  }
}
