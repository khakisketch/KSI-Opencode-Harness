export const ROLES = ["explore", "plan-reviewer", "developer", "developer-complex", "test-runner", "reviewer"]

export const CALLS = {
  plan: ["explore", "plan-reviewer"],
  build: ["explore", "developer", "developer-complex", "test-runner", "reviewer"],
}

export const EXECUTION_BUDGETS = {
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
const descriptions = {
  explore: "Bounded read-only code discovery for Plan and Build. Return evidence, not architecture decisions.",
  "plan-reviewer": "Plan-only independent critique: omissions, contracts, dependencies and verifiable acceptance. No implementation or approval.",
  developer: "Bounded general implementation and targeted repair. Escalate design changes and unexplained failures to Build. No delegation.",
  "developer-complex": "Complex implementation assigned by Build: coupled state, concurrency and difficult repairs within an approved contract. No delegation.",
  "test-runner": "Independent trusted test execution after writers stop. Return commands, evidence and unverified boundaries; no fixes.",
  reviewer: "Independent read-only review of actual changes and test evidence. Return defects and gaps, not final approval.",
}
const clonePermission = (permission) => structuredClone(permission)

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

function roleDescription(name, developerTestRunner) {
  const description = descriptions[name]
  if (!developerTestRunner || !name.startsWith("developer")) return description
  return description.replace("No delegation.", "No delegation except the narrow developerTestRunner opt-in for one targeted Test Runner helper.")
}

export function installAgents(config, prompts, { developerTestRunner = false } = {}) {
  config.agent ??= {}
  config.agent.plan = { ...config.agent.plan, permission: clonePermission(PLAN_PERMISSION) }
  // Preserve inherited and per-agent grants/denials exactly. The hook enforces the role graph.
  config.agent.build = { ...config.agent.build }
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
