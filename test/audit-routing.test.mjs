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
