import test from "node:test"
import assert from "node:assert/strict"
import { buildIsolatedEnv, checkAgents } from "../scripts/verify-native-v2-isolated.mjs"
import * as verifier from "../scripts/verify-native-v2-isolated.mjs"

test("isolated verifier child environment never inherits credentials or shared OpenCode overrides", () => {
  const env = buildIsolatedEnv("/tmp/ksi-test", "/usr/bin")
  assert.deepEqual(Object.keys(env).sort(), ["HOME", "PATH", "TMPDIR", "XDG_CACHE_HOME", "XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_STATE_HOME"].sort())
  assert.equal(env.HOME, "/tmp/ksi-test/home")
  assert.equal(env.XDG_CONFIG_HOME, "/tmp/ksi-test/home/.config")
})

test("isolated server readiness parser accepts only loopback startup with a generated password", () => {
  assert.deepEqual(verifier.parseServeStartup("server listening on http://127.0.0.1:49374\nserver password ephemeral-token\n"), {
    url: "http://127.0.0.1:49374",
    password: "ephemeral-token",
  })
  assert.equal(verifier.parseServeStartup("server listening on http://0.0.0.0:49374\nserver password token\n"), null)
  assert.equal(verifier.parseServeStartup("server listening on http://127.0.0.1:49374\n"), null)
})

test("catalog check retains built-in modes and user routing without requiring KSI Build permissions", () => {
  const agents = [
    ...["build", "plan", "design"].map((id) => ({ id, mode: "primary" })),
    ...["explore", "developer", "test-runner", "reviewer"].map((id) => ({ id, mode: "subagent" })),
  ]
  agents.find((agent) => agent.id === "developer").model = { providerID: "opencode-go", id: "deepseek-v4.1-flash" }
  agents.find((agent) => agent.id === "developer").steps = 47
  agents.find((agent) => agent.id === "design").permissions = [
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ]
  agents.find((agent) => agent.id === "developer").permissions = [{ action: "subagent", resource: "*", effect: "deny" }]
  assert.deepEqual(checkAgents(agents), { ok: true, failures: [] })
  agents.find((agent) => agent.id === "developer").mode = "primary"
  assert.match(checkAgents(agents).failures.join(" "), /developer.*subagent/)
  agents.find((agent) => agent.id === "developer").mode = "subagent"
  agents.find((agent) => agent.id === "design").permissions = [
    { action: "edit", resource: "design-previews/**", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ]
  assert.match(checkAgents(agents).failures.join(" "), /design.*workspace edit/i)
  agents.find((agent) => agent.id === "design").permissions = [
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ]
  agents.push({ id: "design-critic", mode: "subagent" })
  assert.match(checkAgents(agents).failures.join(" "), /retired design-critic/i)
})

test("catalog check rejects a custom-role skill blockade", () => {
  const agents = [
    ...["build", "plan", "design"].map((id) => ({ id, mode: "primary" })),
    ...["explore", "developer", "test-runner", "reviewer"].map((id) => ({ id, mode: "subagent" })),
  ]
  agents.find((agent) => agent.id === "developer").model = "opencode-go/deepseek-v4.1-flash"
  agents.find((agent) => agent.id === "developer").steps = 47
  agents.find((agent) => agent.id === "developer").permissions = [
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "skill", resource: "*", effect: "deny" },
  ]
  agents.find((agent) => agent.id === "design").permissions = [
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ]
  assert.match(checkAgents(agents).failures.join(" "), /skill/i)
})

test("catalog check catches Design approval required for an installed skill reference", () => {
  const agents = [
    ...["build", "plan", "design"].map((id) => ({ id, mode: "primary" })),
    ...["explore", "developer", "test-runner", "reviewer"].map((id) => ({ id, mode: "subagent" })),
  ]
  const configRoot = "/tmp/ksi-test/home/.config/opencode"
  const design = agents.find((agent) => agent.id === "design")
  design.permissions = [
    { action: "external_directory", resource: "*", effect: "ask" },
    { action: "external_directory", resource: `${configRoot}/*`, effect: "allow" },
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
    { action: "external_directory", resource: "*", effect: "ask" },
  ]
  const developer = agents.find((agent) => agent.id === "developer")
  developer.model = "opencode-go/deepseek-v4.1-flash"
  developer.steps = 47
  developer.permissions = [{ action: "subagent", resource: "*", effect: "deny" }]

  assert.match(checkAgents(agents, configRoot).failures.join(" "), /design.*installed skill reference.*approval/i)
  design.permissions.pop()
  assert.deepEqual(checkAgents(agents, configRoot), { ok: true, failures: [] })
})

test("catalog check rejects missing Design delegation or a leftover retired role", () => {
  const agents = [
    ...["build", "plan", "design"].map((id) => ({ id, mode: "primary" })),
    ...["explore", "developer", "test-runner", "reviewer"].map((id) => ({ id, mode: "subagent" })),
  ]
  const design = agents.find((agent) => agent.id === "design")
  const developer = agents.find((agent) => agent.id === "developer")
  design.permissions = [
    { action: "edit", resource: "*", effect: "allow" },
    { action: "subagent", resource: "explore", effect: "allow" },
    { action: "subagent", resource: "reviewer", effect: "allow" },
  ]
  developer.model = "opencode-go/deepseek-v4.1-flash"
  developer.steps = 47
  developer.permissions = [{ action: "subagent", resource: "*", effect: "deny" }]
  assert.deepEqual(checkAgents(agents), { ok: true, failures: [] })
  design.permissions.splice(1, 1)
  assert.match(checkAgents(agents).failures.join(" "), /design.*explore.*delegation/i)
  design.permissions.push({ action: "subagent", resource: "explore", effect: "allow" })
  design.permissions.splice(1, 1)
  assert.match(checkAgents(agents).failures.join(" "), /design.*reviewer.*delegation/i)
  design.permissions.push({ action: "subagent", resource: "reviewer", effect: "allow" })
  agents.push({ id: "research", mode: "subagent" })
  assert.match(checkAgents(agents).failures.join(" "), /retired research role/i)
})

test("skill catalog check requires all installed design skills from the isolated config", () => {
  assert.equal(typeof verifier.checkSkills, "function")
  const checkSkills = verifier.checkSkills
  const root = "/tmp/ksi-test/home/.config/opencode/skills"
  const available = [
    { id: "frontend-design", path: `${root}/frontend-design/SKILL.md` },
    { id: "impeccable-design-polish", path: `${root}/impeccable-design-polish/SKILL.md` },
    { id: "web-design-guidelines", path: `${root}/web-design-guidelines/SKILL.md` },
  ]
  assert.deepEqual(checkSkills(available, root), { ok: true, failures: [] })
  assert.match(checkSkills(available.filter((item) => item.id !== "impeccable-design-polish"), root).failures.join(" "), /impeccable-design-polish.*absent/i)
  assert.match(checkSkills([{ ...available[0], path: "/another/source/SKILL.md" }, ...available.slice(1)], root).failures.join(" "), /frontend-design.*isolated/i)
})
