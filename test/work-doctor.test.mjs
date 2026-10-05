import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { execFileSync, spawnSync } from "node:child_process"
import * as report from "../scripts/work-report.mjs"

function fixture(t) {
  const root = mkdtempSync("/tmp/opencode/ksi-doctor-test-")
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, "product")
  const configDir = join(root, "config")
  mkdirSync(join(repo, "docs/superpowers"), { recursive: true })
  mkdirSync(join(configDir, "agents"), { recursive: true })
  return { root, repo, configDir }
}

function setupLocal({ repo, configDir }, extra = "") {
  for (const name of ["developer", "reviewer", "test-runner"]) writeFileSync(join(configDir, `agents/${name}.md`), "role fixture\n")
  writeFileSync(join(configDir, "AGENTS.md"), "Fixture policy; no live activation proof\n")
  writeFileSync(join(repo, "docs/superpowers/product-state.md"), `## Product binding\n\n| Field | Value |\n| --- | --- |\n| Repository | . |\n| Design project | fixture-design |\n| Design storage | . |\n| Entry | index.html |\n| Start command | node never-execute-this.mjs |\n| Verify command | node also-never-execute-this.mjs |\n| Product URL | https://example.invalid |\n| Brand source | tokens.css |\n${extra}`)
}

test("absent roles and policy require setup rather than pretending ready", t => {
  assert.equal(typeof report.inspectReadiness, "function")
  const result = report.inspectReadiness(fixture(t))
  assert.equal(result.status, "needs-setup")
  assert.equal(result.checks.find(c => c.id === "roles").state, "missing")
  assert.equal(result.checks.find(c => c.id === "policy").state, "missing")
})

// Catches running recorded commands or equating file presence to runtime capability.
test("complete local files remain live-unverified and are never executed or changed", t => {
  assert.equal(typeof report.inspectReadiness, "function")
  const f = fixture(t)
  setupLocal(f)
  const path = join(f.repo, "docs/superpowers/product-state.md")
  const before = readFileSync(path, "utf8")
  const result = report.inspectReadiness({ ...f, frontend: true })
  assert.equal(result.status, "unverified")
  assert.equal(result.checks.find(c => c.id === "binding").state, "present")
  assert.equal(result.checks.find(c => c.id === "effective-tools").state, "unknown")
  assert.equal(readFileSync(path, "utf8"), before)
  assert.deepEqual(readdirSync(f.repo).sort(), ["docs"])
})

test("mismatched repository binding is not usable even if all fields exist", t => {
  assert.equal(typeof report.inspectReadiness, "function")
  const f = fixture(t)
  setupLocal(f)
  const path = join(f.repo, "docs/superpowers/product-state.md")
  writeFileSync(path, readFileSync(path, "utf8").replace("| Repository | . |", "| Repository | ../other |"))
  const result = report.inspectReadiness({ ...f, frontend: true })
  assert.equal(result.status, "needs-setup")
  assert.equal(result.checks.find(c => c.id === "binding").state, "mismatch")
})

test("doctor CLI validates flags and produces a read-only JSON report", t => {
  const f = fixture(t)
  const command = new URL("../scripts/work-doctor.mjs", import.meta.url)
  const invalid = spawnSync(process.execPath, [command.pathname, "--unknown"], { encoding: "utf8" })
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stderr, /Usage:/)
  const result = execFileSync(process.execPath, [command.pathname, "--repo", f.repo, "--config", f.configDir, "--frontend", "--json"], { encoding: "utf8" })
  assert.equal(JSON.parse(result).status, "needs-setup")
})

test("a nonexistent requested repository is a missing prerequisite despite global setup", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = report.inspectReadiness({ ...f, repo: join(f.root, "absent") })
  assert.equal(result.status, "needs-setup")
  assert.equal(result.checks.find(c => c.id === "repository").state, "missing")
})
