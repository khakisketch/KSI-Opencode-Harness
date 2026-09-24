import { isAbsolute, relative, resolve, sep } from "node:path"

export const ROLES = ["explore", "developer", "test-runner", "reviewer", "research", "design-critic"]

export const CALLS = {
  plan: ["explore", "reviewer", "research"],
  build: ["explore", "developer", "test-runner", "reviewer", "research"],
  design: ["explore", "design-critic"],
}

export const EXECUTION_BUDGETS = {
  build: 200,
  design: 60,
  explore: 20,
  developer: 80,
  "test-runner": 24,
  reviewer: 32,
  research: 20,
  // design-critic is a local read-only visual critique (same bound as explore/research).
  "design-critic": 20,
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
export const GOAL_READ_TOOLS = ["get_goal", "get_goal_history", "list_all_goals"]
export const GOAL_WRITE_TOOLS = [
  "create_goal",
  "set_goal",
  "update_goal_objective",
  "update_goal",
  "update_goal_status",
  "clear_goal",
]
const goalGrants = (names) => Object.fromEntries(names.map((name) => [name, "allow"]))
export const PLAN_PERMISSION = {
  ...READ_ONLY_PERMISSION, question: "allow", todowrite: "allow", plan_exit: "allow",
  webfetch: "allow", websearch: "allow", lsp: "allow",
  ...evidenceGrants(),
  ...goalGrants(GOAL_READ_TOOLS),
  skill: rules(["brainstorming", "writing-plans", "systematic-debugging", "ui-ux-pro-max", "customize-opencode"]),
  edit: { "*": "deny", ".opencode/working-state.md": "allow" },
  task: rules(CALLS.plan),
}
export const RESEARCH_PERMISSION = {
  ...READ_ONLY_PERMISSION, webfetch: "allow", websearch: "allow",
  "context7_*": "allow",
}
export const DESIGN_CRITIC_PERMISSION = {
  "*": "deny",
  read: safeRead, glob: "allow", grep: "allow", list: "allow",
  edit: "deny", write: "deny", apply_patch: "deny", bash: "deny", task: "deny", lsp: "deny",
  external_directory: "deny", webfetch: "deny", websearch: "deny",
  "mobbin_*": "deny", "gpt_imagegen": "deny", "playwright_*": "deny", "context7_*": "deny",
  skill: "deny",
}
export const DESIGN_CRITIC_DENIED_TOOLS = ["edit", "write", "apply_patch", "bash", "task", "lsp", "skill", "external_directory", "webfetch", "websearch", "mobbin_*", "gpt_imagegen", "playwright_*", "context7_*"]
export const BUILD_BOOKKEEPING_EDIT = { "*": "deny", ".opencode/**": "allow", "docs/superpowers/plans/**": "allow", "docs/superpowers/product-state.md": "allow" }
export const BUILD_PERMISSION = {
  "*": "deny",
  read: { ...safeRead }, glob: "allow", grep: "allow", list: "allow",
  question: "allow", todowrite: "allow",
  webfetch: "allow", websearch: "allow",
  ...evidenceGrants(),
  ...goalGrants([...GOAL_READ_TOOLS, ...GOAL_WRITE_TOOLS]),
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
  design: "User-facing visual design Primary: create approved, artifact-first previews within the authorized scope; may dispatch only local read-only explore and design-critic with rendered PNG evidence.",
  build: "Execution orchestrator: decompose approved plans, delegate to workers, adjudicate evidence and completion. Never implements product code directly.",
  explore: "Bounded read-only code discovery for Plan, Build, and Design. Return evidence, not architecture decisions.",
  research: "Bounded external research for Plan and Build. Return versioned sources and counterevidence, not product decisions.",
  "design-critic": "Fresh independent critique of Design-supplied brief/version/token source and actual desktop/mobile PNG states; reports specific severity/evidence/impact with VISUAL PASS/FAIL/BLOCKED-no-render. No fixes, no design approval, no production acceptance; BLOCKED when images cannot be read.",
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
const rootPermissionActions = new Set(["deny"])
const unsafeBrowserTool = "playwright_browser_run_code_unsafe"
const secretReadDenyPatterns = new Set(["*.env", "*.env.*", "*credentials*", "*auth.json", "*.pem", "*.key"])
const protoKeys = new Set(["__proto__", "constructor", "prototype"])
function isProtoPattern(pattern) {
  return protoKeys.has(pattern)
}
function isUniversalReadPattern(pattern) {
  const stripped = pattern.replaceAll("*", "").replaceAll("/", "").trim()
  return stripped.length === 0
}
function isSecretOverlappingReadPattern(pattern) {
  const lower = pattern.toLowerCase()
  if (lower === "*.env.example") return false
  if (lower.includes(".env")) return true
  if (lower.includes("credential")) return true
  if (lower.includes("auth")) return true
  if (lower.includes("pem")) return true
  if (lower.includes("key")) return true
  return false
}
function isSecretEditPattern(pattern) {
  const lower = pattern.replaceAll("\\", "/").toLowerCase()
  if (lower.includes(".env")) return true
  if (lower.includes("credential")) return true
  if (lower.includes("auth.json")) return true
  if (lower.includes(".pem")) return true
  if (lower.includes(".key")) return true
  return false
}
const approvedDesignSkills = new Set(["brainstorming", "ui-ux-pro-max", "mobbin-design", "systematic-debugging", "verification-before-completion"])
const designWriteTools = new Set(["write", "apply_patch"])
const designAskGatedTools = new Set(["bash", "external_directory", "webfetch", "websearch", "mobbin_*", "context7_*", "gpt_imagegen", "playwright_*"])
const knownDesignTools = new Set(["*", "read", "glob", "grep", "list", "edit", "bash", "task", "skill", "external_directory", "webfetch", "websearch", "lsp", "question", "todowrite", "mobbin_*", "gpt_imagegen", "context7_*", "playwright_*", "playwright_browser_run_code_unsafe", "write", "apply_patch"])
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
    throw new Error("KSI: Design root permission must be deny; use scoped named tools or paths.")
  }

  const entries = Object.entries(existing).filter(([tool]) => tool !== "task")
  const rootIndex = entries.findIndex(([tool]) => tool === "*")
  if (rootIndex === -1) return { beforeRoot: entries, afterRoot: [], root: undefined }
  const root = entries[rootIndex][1]
  if (root === "allow") rootPermissionFailure()
  if (!rootPermissionActions.has(root)) {
    throw new Error("KSI: Design root permission ask is not allowed; use scoped named tools or paths.")
  }
  return { beforeRoot: entries.slice(0, rootIndex), afterRoot: entries.slice(rootIndex + 1), root }
}

function validateDesignReadPermission(value) {
  if (typeof value === "string") {
    if (value === "deny") return
    if (value === "allow" || value === "ask") {
      throw new Error(`KSI: Design read permission scalar ${value} is not allowed; use scoped read paths with secret denies intact.`)
    }
    throw new Error("KSI: Design read permission must be deny or a scoped map with secret denies intact.")
  }
  if (isPermissionMap(value)) {
    for (const [pattern, action] of Object.entries(value)) {
      if (isProtoPattern(pattern)) {
        throw new Error(`KSI: Design read permission for ${pattern} must be allow, ask, or deny.`)
      }
      if (typeof action !== "string") {
        throw new Error(`KSI: Design read permission for ${pattern} must be allow, ask, or deny.`)
      }
      if (secretReadDenyPatterns.has(pattern)) {
        if (action === "deny") continue
        throw new Error(`KSI: Design read permission must keep secret deny for ${pattern}; allow/ask override is not allowed.`)
      }
      if (pattern === "*") {
        if (action === "deny") continue
        if (action === "ask") {
          throw new Error("KSI: Design read permission wildcard allow/ask is not allowed; use scoped read paths with secret denies intact.")
        }
        const keepsSecrets = [...secretReadDenyPatterns].every((secret) => Object.hasOwn(value, secret) && value[secret] === "deny")
        if (action === "allow" && keepsSecrets) continue
        throw new Error("KSI: Design read permission wildcard allow/ask is not allowed; use scoped read paths with secret denies intact.")
      }
      if (isUniversalReadPattern(pattern)) {
        if (action === "deny") continue
        throw new Error("KSI: Design read permission universal allow/ask is not allowed; unknown native precedence stays fail-closed, use scoped read paths with secret denies intact.")
      }
      if (isSecretOverlappingReadPattern(pattern)) {
        if (action === "deny") continue
        throw new Error(`KSI: Design read permission for ${pattern} could match secrets under unknown native precedence; allow/ask override is not allowed.`)
      }
      if (action === "allow" || action === "ask" || action === "deny") continue
      throw new Error(`KSI: Design read permission for ${pattern} must be allow, ask, or deny.`)
    }
    return
  }
  throw new Error("KSI: Design read permission must be deny or a scoped map with secret denies intact.")
}

function validateDesignSkillPermission(value) {
  if (typeof value === "string") {
    if (value === "deny") return
    if (value === "allow" || value === "ask") {
      throw new Error(`KSI: Design skill permission scalar ${value} is not allowed; use approved skills or deny.`)
    }
    throw new Error("KSI: Design skill permission must be deny or a scoped map of approved skills.")
  }
  if (isPermissionMap(value)) {
    for (const [skillName, action] of Object.entries(value)) {
      if (isProtoPattern(skillName)) {
        throw new Error(`KSI: Design skill permission for ${skillName} must be allow, ask, or deny.`)
      }
      if (typeof action !== "string") {
        throw new Error(`KSI: Design skill permission for ${skillName} must be allow, ask, or deny.`)
      }
      if (action === "deny") continue
      if (action === "allow" || action === "ask") {
        if (skillName === "*") {
          throw new Error("KSI: Design skill permission wildcard allow/ask is not allowed; use approved skills or deny.")
        }
        if (!approvedDesignSkills.has(skillName)) {
          throw new Error(`KSI: Design skill permission for unlisted skill ${skillName} allow/ask is not allowed; use approved skills or deny.`)
        }
        continue
      }
      throw new Error(`KSI: Design skill permission for ${skillName} must be allow, ask, or deny.`)
    }
    return
  }
  throw new Error("KSI: Design skill permission must be deny or a scoped map of approved skills.")
}

function validateDesignPermissionEntry(tool, value, previewPattern) {
  if (isProtoPattern(tool)) {
    throw new Error(`KSI: Design ${tool} permission must be allow, ask, deny, or a scoped map.`)
  }
  if (typeof value !== "string" && !isPermissionMap(value)) {
    throw new Error(`KSI: Design ${tool} permission must be allow, ask, deny, or a scoped map.`)
  }
  if (designWriteTools.has(tool)) {
    if (value === "allow" || value === "ask") {
      throw new Error(`KSI: Design ${tool} permission must stay deny; use scoped edit paths with native ask.`)
    }
    if (isPermissionMap(value)) {
      for (const [pattern, action] of Object.entries(value)) {
        if (isProtoPattern(pattern)) {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (typeof action !== "string") {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (action === "allow" || action === "ask") {
          throw new Error(`KSI: Design ${tool} permission must stay deny; use scoped edit paths with native ask.`)
        }
      }
    }
    return
  }
  if (designAskGatedTools.has(tool)) {
    if (value === "allow") {
      throw new Error(`KSI: Design ${tool} permission allow is not allowed; use native ask or deny.`)
    }
    if (isPermissionMap(value)) {
      for (const [pattern, action] of Object.entries(value)) {
        if (isProtoPattern(pattern)) {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (typeof action !== "string") {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (action === "allow") {
          throw new Error(`KSI: Design ${tool} permission allow is not allowed; use native ask or deny.`)
        }
      }
    }
    return
  }
  if (tool === unsafeBrowserTool) return
  if (tool === "read") {
    validateDesignReadPermission(value)
    return
  }
  if (tool === "skill") {
    validateDesignSkillPermission(value)
    return
  }
  if (tool === "task" || tool === "glob" || tool === "grep" || tool === "list" || tool === "lsp" || tool === "question" || tool === "todowrite") return
  if (!knownDesignTools.has(tool)) {
    if (value === "allow" || value === "ask") {
      throw new Error(`KSI: Design ${tool} permission allow is not allowed; use scoped named tools or deny.`)
    }
    if (isPermissionMap(value)) {
      for (const [pattern, action] of Object.entries(value)) {
        if (isProtoPattern(pattern)) {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (typeof action !== "string") {
          throw new Error(`KSI: Design ${tool} permission for ${pattern} must be allow, ask, or deny.`)
        }
        if (action === "allow" || action === "ask") {
          throw new Error(`KSI: Design ${tool} permission allow is not allowed; use scoped named tools or deny.`)
        }
      }
    }
    return
  }
  if (tool !== "edit") return
  if (value === "allow" || value === "ask") {
    throw new Error("KSI: Design edit permission must use an exact path or a concrete directory prefix before wildcards.")
  }
  if (isPermissionMap(value)) {
    for (const [pattern, action] of Object.entries(value)) {
      if (isProtoPattern(pattern)) {
        throw new Error(`KSI: Design edit permission for ${pattern} must be allow, ask, or deny.`)
      }
      if (typeof action !== "string") {
        throw new Error(`KSI: Design edit permission for ${pattern} must be allow, ask, or deny.`)
      }
      if (typeof previewPattern === "string" && previewPattern && pattern === previewPattern && action === "allow") {
        throw new Error("KSI: Design preview permission must stay ask; autogenerated preview ask is not upgradable to allow on the public security boundary.")
      }
      if (action !== "allow" && action !== "ask") continue
      if (isSecretEditPattern(pattern)) {
        throw new Error(`KSI: Design edit permission for ${pattern} could match secrets; allow/ask is not allowed.`)
      }
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

function applyPermissionEntries(permission, entries, previewPattern) {
  for (const [tool, value] of entries) {
    validateDesignPermissionEntry(tool, value, previewPattern)
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
  if (typeof pattern === "string" && pattern) permission.edit[pattern] = "ask"
  delete permission.task
  if (root !== undefined) delete permission["*"]
  applyPermissionEntries(permission, beforeRoot, pattern)
  if (root !== undefined) permission["*"] = root
  applyPermissionEntries(permission, afterRoot, pattern)
  delete permission[unsafeBrowserTool]
  permission[unsafeBrowserTool] = "deny"
  // User task grants never widen Design: fail-closed to the two local read-only children.
  return { ...permission, task: rules(CALLS.design) }
}

function roleDescription(name, developerTestRunner) {
  const description = descriptions[name]
  if (!developerTestRunner || name !== "developer") return description
  return description.replace("No delegation.", "No delegation except the narrow developerTestRunner opt-in for one targeted Test Runner helper.")
}

export function rolePermission(name, developerTestRunner = false) {
  if (name === "developer") return developerPermission(developerTestRunner)
  if (name === "test-runner") return { ...clonePermission(READ_ONLY_PERMISSION), bash: "allow" }
  if (name === "research") return clonePermission(RESEARCH_PERMISSION)
  if (name === "design-critic") return clonePermission(DESIGN_CRITIC_PERMISSION)
  if (name === "explore") return { ...clonePermission(READ_ONLY_PERMISSION), lsp: "allow" }
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
  // Fail-closed: an invalid native pair (relative/empty/outside/cross-drive)
  // grants no preview path instead of throwing through config() or falling
  // back to a broad default. A missing pair keeps the narrow default.
  const designPreviewPattern = (() => {
    if (!hasNativePair) return "design-previews/**"
    try {
      return previewEditPattern(directory, worktree)
    } catch {
      return null
    }
  })()
  const existingDesign = config.agent.design ?? {}
  const designPermissionValue = designPermission(existingDesign.permission, designPreviewPattern)
  // Invalid complete native pair denies all edit: no autogenerated preview ask
  // and no explicit project UI allow or checkpoint allow survive fail-closed.
  if (hasNativePair && designPreviewPattern === null) designPermissionValue.edit = { "*": "deny" }
  config.agent.design = {
    ...existingDesign,
    mode: "primary", description: descriptions.design, prompt: designPrompt,
    steps: nativeSteps("design", existingDesign), permission: designPermissionValue,
  }
  for (const name of ROLES) {
    const existing = config.agent[name] ?? {}
    config.agent[name] = {
      mode: "subagent", description: roleDescription(name, developerTestRunner),
      prompt: developerTestRunner && name === "developer"
          ? `${prompts[name]}${DEVELOPER_TEST_RUNNER_PROMPT}`
          : prompts[name],
      ...(name === "design-critic" ? { hidden: true } : {}),
      ...(existing.model === undefined ? {} : { model: existing.model }),
      ...(existing.variant === undefined ? {} : { variant: existing.variant }),
      steps: nativeSteps(name, existing),
      permission: rolePermission(name, developerTestRunner),
    }
  }
  // Removed design-task leaves no native agent even if user config tried to grant it.
  delete config.agent["design-task"]
  if (config.agent.build?.permission?.task) delete config.agent.build.permission.task["design-task"]
}
