import test from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
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
  assert.equal(env.HOME, join("/tmp/ksi-test", "home"))
  assert.equal(env.XDG_CONFIG_HOME, join("/tmp/ksi-test", "home", ".config"))
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

function designDecisions() {
  return [
    ...["get_active_context", "get_project", "list_projects", "list_files", "get_file", "get_artifact", "search_files", "list_skills", "list_plugins", "list_agents", "get_run"]
      .map(name => ({ agent: "plan", action: `opendesign_${name}`, expected: "allow", effect: "allow" })),
    ...["start_run", "cancel_run", "write_file", "delete_file", "create_project", "delete_project", "create_artifact", "collect_brief", "confirm_brief", "future_mutation"]
      .map(name => ({ agent: "plan", action: `opendesign_${name}`, expected: "deny", effect: "deny" })),
    { agent: "build", action: "opendesign_start_run", expected: "allow", effect: "allow" },
    { agent: "plan", action: "edit", expected: "deny", effect: "deny" },
  ]
}

test("design permission evidence rejects an allowed Plan mutation and missing evaluation", () => {
  assert.deepEqual(verifier.checkDesignPermissions(designDecisions()), { ok: true, failures: [] })
  const decisions = designDecisions()
  decisions.find(d => d.agent === "plan" && d.action === "opendesign_start_run").effect = "allow"
  const unsafe = verifier.checkDesignPermissions(decisions)
  assert.equal(unsafe.ok, false)
  assert.match(unsafe.failures[0], /plan opendesign_start_run.*expected deny, got allow/)
  assert.equal(verifier.checkDesignPermissions([]).ok, false)
})

test("design permission evidence catches a blocked read and an unreported native verdict", () => {
  const decisions = designDecisions()
  decisions.find(d => d.action === "opendesign_get_artifact").effect = "deny"
  delete decisions.find(d => d.action === "opendesign_future_mutation").effect
  const result = verifier.checkDesignPermissions(decisions)
  assert.equal(result.ok, false)
  assert.equal(result.failures.length, 2)
})

test("design permission evidence rejects dropped and duplicate contract cases", () => {
  for (const action of ["opendesign_future_mutation", "opendesign_get_artifact", "edit"]) {
    const missing = designDecisions().filter(d => d.action !== action)
    assert.equal(verifier.checkDesignPermissions(missing).ok, false, action)
  }
  const missingBuild = designDecisions().filter(d => d.agent !== "build")
  assert.equal(verifier.checkDesignPermissions(missingBuild).ok, false)
  const duplicate = designDecisions()
  duplicate[duplicate.findIndex(d => d.action === "opendesign_future_mutation")] = { ...duplicate[0] }
  assert.equal(duplicate.length, 23)
  assert.equal(verifier.checkDesignPermissions(duplicate).ok, false)
})

test("design permission evidence does not trust a rewritten expected verdict", () => {
  const decisions = designDecisions()
  const unknown = decisions.find(d => d.action === "opendesign_future_mutation")
  unknown.expected = "allow"
  unknown.effect = "allow"
  assert.equal(verifier.checkDesignPermissions(decisions).ok, false)
})
