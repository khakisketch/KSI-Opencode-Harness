import test from "node:test"
import assert from "node:assert/strict"
import { buildIsolatedEnv, checkAgents, checkRetiredSkills, RETIRED_DESIGN_SKILLS } from "../scripts/verify-native-v2-isolated.mjs"
import * as verifier from "../scripts/verify-native-v2-isolated.mjs"

function catalog(overrides = {}) {
  const agents = [
    ...["build", "plan"].map((id) => ({ id, mode: "primary" })),
    ...["explore", "developer", "test-runner", "reviewer"].map((id) => ({ id, mode: "subagent" })),
  ]
  const developer = agents.find((agent) => agent.id === "developer")
  developer.model = { providerID: "opencode-go", id: "deepseek-v4.1-flash" }
  developer.steps = 47
  developer.permissions = [{ action: "subagent", resource: "*", effect: "deny" }]
  Object.assign(developer, overrides.developer ?? {})
  return agents
}

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
  const agents = catalog()
  assert.deepEqual(checkAgents(agents), { ok: true, failures: [] })
  agents.find((agent) => agent.id === "developer").mode = "primary"
  assert.match(checkAgents(agents).failures.join(" "), /developer.*subagent/)
  agents.find((agent) => agent.id === "developer").mode = "subagent"
  agents.find((agent) => agent.id === "developer").permissions = []
  assert.match(checkAgents(agents).failures.join(" "), /developerTestRunner is not default-off/)
})

test("catalog check rejects a custom-role skill blockade", () => {
  const agents = catalog()
  agents.find((agent) => agent.id === "developer").permissions = [
    { action: "subagent", resource: "*", effect: "deny" },
    { action: "skill", resource: "*", effect: "deny" },
  ]
  assert.match(checkAgents(agents).failures.join(" "), /skill/i)
})

test("catalog check rejects every leftover retired role", () => {
  for (const retired of ["design", "research", "design-critic"]) {
    const agents = catalog()
    agents.push({ id: retired, mode: "subagent" })
    assert.match(checkAgents(agents).failures.join(" "), new RegExp(`retired ${retired}`, "i"), retired)
  }
})

test("retired design skills must not reappear in the isolated skill catalog", () => {
  assert.deepEqual(RETIRED_DESIGN_SKILLS, ["frontend-design", "impeccable-design-polish", "web-design-guidelines"])
  assert.deepEqual(checkRetiredSkills([]), { ok: true, failures: [] })
  assert.deepEqual(checkRetiredSkills([{ id: "brainstorming", path: "/tmp/skills/brainstorming/SKILL.md" }]), { ok: true, failures: [] })
  const leaked = checkRetiredSkills([
    { id: "frontend-design", path: "/tmp/skills/frontend-design/SKILL.md" },
    { id: "impeccable-design-polish", path: "/tmp/skills/impeccable-design-polish/SKILL.md" },
  ])
  assert.equal(leaked.ok, false)
  assert.match(leaked.failures.join(" "), /frontend-design/)
  assert.match(leaked.failures.join(" "), /impeccable-design-polish/)
})
