import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { analyzeAuditRows, validateRoutes } from "../src/audit-metrics.mjs"
import { ROLES } from "../src/agents.mjs"

const auditScript = fileURLToPath(new URL("../scripts/audit-routing.mjs", import.meta.url))

test("strict audit rejects missing expectation inputs before invoking the OpenCode DB", () => {
  const result = spawnSync(process.execPath, [auditScript, "--strict"], { encoding: "utf8" })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /--strict requires explicit --routes and --since/i)
})

test("route validation rejects malformed model strings and typo properties", () => {
  for (const model of ["openai", "/gpt", "openai/", " openai/gpt", "openai/gpt "]) {
    assert.throws(() => validateRoutes({ developer: { model } }, ROLES), /provider\/id/)
  }
  assert.throws(
    () => validateRoutes({ developer: { model: "openai/gpt", vairant: "high" } }, ROLES),
    /unknown property: vairant/,
  )
})

test("audit validates and compares namespaced model identifiers after the first slash", () => {
  const routes = validateRoutes({
    developer: { model: "openrouter/anthropic/claude-sonnet-4-6", variant: "high" },
  }, ROLES)
  const analysis = analyzeAuditRows([
    { agent: "developer", provider: "openrouter", model: "anthropic/claude-sonnet-4-6", variant: "high" },
  ], routes, ROLES)

  assert.equal(analysis.checked.length, 1)
  assert.equal(analysis.violations.length, 0)
})

test("audit analysis compares explicit expectations and treats zero evidence as unchecked", () => {
  const routes = validateRoutes({ developer: { model: "openai/gpt", variant: "high" } }, ROLES)
  const analysis = analyzeAuditRows([
    { agent: "developer", provider: "openai", model: "gpt", variant: "high" },
    { agent: "developer", provider: "openai", model: "other", variant: "high" },
  ], routes, ROLES)

  assert.equal(analysis.checked.length, 2)
  assert.equal(analysis.violations.length, 1)
  assert.equal(analyzeAuditRows([], routes, ROLES).checked.length, 0)
})

test("observational audit retains developer variants without expected routes", () => {
  const analysis = analyzeAuditRows([
    { agent: "developer", variant: "fast" },
    { agent: "developer", variant: "careful" },
  ], null, ROLES)

  assert.deepEqual([...analysis.developerVariants.entries()], [["careful", 1], ["fast", 1]])
})

test("example model routing covers every reserved role with approved models", async () => {
  const { readFile } = await import("node:fs/promises")
  const routing = JSON.parse(await readFile(new URL("../examples/model-routing.json", import.meta.url), "utf8"))
  const PINNED_ROLES = ["explore", "developer", "test-runner", "reviewer", "research"]
  assert.deepEqual(Object.keys(routing).sort(), [...PINNED_ROLES].sort())
  assert.ok(!Object.hasOwn(routing, "design-critic"), "hidden design-critic stays unpinned and inherits the native selected model")
  assert.ok(!Object.hasOwn(routing, "design-task"), "removed design-task leaves no portable route")
  assert.ok(ROLES.includes("design-critic"), "hidden design-critic is a reserved role without a portable example route")
  assert.ok(!ROLES.includes("design-task"), "removed design-task is not a reserved role")
  for (const name of PINNED_ROLES) {
    assert.equal(typeof routing[name].model, "string", `missing model for ${name}`)
    assert.doesNotMatch(routing[name].model, /openai/i, `openai reference for ${name}`)
  }
  assert.deepEqual(routing.developer, { model: "opencode-go/muse-spark-1.3-contributor", variant: "high" })
  assert.deepEqual(routing.reviewer, { model: "opencode-go/muse-spark-1.3-contributor", variant: "xhigh" })
  assert.deepEqual(routing.research, { model: "opencode-go/muse-spark-1.3-contributor", variant: "medium" })
  assert.deepEqual(routing.explore, { model: "ollama/nanbeige4.2-3b-32k:latest" })
  assert.deepEqual(routing["test-runner"], { model: "ollama/nanbeige4.2-3b-32k:latest" })
})
