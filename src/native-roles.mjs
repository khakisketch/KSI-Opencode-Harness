export const NATIVE_ROLE_NAMES = ["design", "developer", "test-runner", "reviewer"]

const rule = (action, effect, resource = "*") => ({ action, resource, effect })
const allow = (...actions) => actions.map((action) => rule(action, "allow"))
const deny = (...actions) => actions.map((action) => rule(action, "deny"))
const ask = (...actions) => actions.map((action) => rule(action, "ask"))

const roles = {
  design: {
    mode: "primary",
    description: "Primary for material product, visual, and interaction design; creates inspectable artifacts within scope.",
    permissions: [
      ...allow("read", "glob", "grep", "list", "lsp", "edit", "shell", "question", "todowrite"),
      ...ask("webfetch", "websearch", "playwright_*", "mobbin_*", "context7_*"),
      rule("subagent", "allow", "explore"), rule("subagent", "allow", "reviewer"),
      rule("playwright_browser_run_code_unsafe", "deny"),
    ],
  },
  developer: {
    mode: "subagent",
    description: "Bounded implementation and repair within an assigned task; report changes and checks.",
    permissions: [
      ...allow("read", "glob", "grep", "list", "lsp", "edit", "shell", "question", "todowrite"),
      ...ask("external_directory", "webfetch", "websearch", "context7_*"),
      ...deny("subagent"),
    ],
  },
  "test-runner": {
    mode: "subagent",
    description: "Run assigned trusted checks independently and report actual results.",
    permissions: [...allow("read", "shell"), ...deny("edit", "subagent")],
  },
  reviewer: {
    mode: "subagent",
    description: "Independent read-only review of code changes or supplied design evidence; no approval authority.",
    permissions: [...allow("read", "glob", "grep", "lsp"), ...deny("edit", "subagent")],
  },
}

const developerTestRunnerPrompt = `

Developer-to-Test Runner assistance is enabled for this session. You may request a targeted Test Runner helper for author feedback, never as independent acceptance. The Primary still owns final testing and review.`

export function nativeRoleDefinition(name, { developerTestRunner = false } = {}) {
  const role = roles[name]
  if (!role) throw new Error(`Unknown native role: ${name}`)
  if (name !== "developer" || !developerTestRunner) return role
  return {
    ...role,
    description: `${role.description} May request Test Runner feedback when explicitly enabled.`,
    permissions: [...role.permissions, rule("subagent", "allow", "test-runner")],
    promptSuffix: developerTestRunnerPrompt,
  }
}
