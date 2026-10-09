export const NATIVE_ROLE_NAMES = ["developer", "reviewer"]

const rule = (action, effect, resource = "*") => ({ action, resource, effect })
const allow = (...actions) => actions.map((action) => rule(action, "allow"))
const deny = (...actions) => actions.map((action) => rule(action, "deny"))
const ask = (...actions) => actions.map((action) => rule(action, "ask"))

const roles = {
  developer: {
    mode: "subagent",
    description: "Bounded implementation and repair within an assigned task; report changes and checks.",
    permissions: [
      ...allow("read", "glob", "grep", "list", "lsp", "edit", "shell", "question", "todowrite"),
      ...ask("external_directory", "webfetch", "websearch", "context7_*"),
      ...deny("subagent"),
    ],
  },
  reviewer: {
    mode: "subagent",
    description: "Independent read-only review of code changes and behaviour; no approval authority.",
    permissions: [...allow("read", "glob", "grep", "lsp"), ...deny("edit", "subagent")],
  },
}

export function nativeRoleDefinition(name) {
  const role = roles[name]
  if (!role) throw new Error(`Unknown native role: ${name}`)
  return role
}
