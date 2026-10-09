import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, symlinkSync, existsSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync, spawnSync } from "node:child_process"
import { inspectDesignBinding } from "../scripts/design-binding.mjs"
import * as report from "../scripts/work-report.mjs"

const DOCTOR = fileURLToPath(new URL("../scripts/work-doctor.mjs", import.meta.url))

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ksi-design-binding-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, "product")
  const configDir = join(root, "config")
  mkdirSync(join(repo, "docs/superpowers"), { recursive: true })
  mkdirSync(join(configDir, "agents"), { recursive: true })
  return { root, repo, configDir }
}

function setupLocal({ repo, configDir }, { design = "fixture-design-id", sourceWorkspace = null, extra = "" } = {}) {
  for (const name of ["developer", "reviewer"]) writeFileSync(join(configDir, `agents/${name}.md`), "role fixture\n")
  writeFileSync(join(configDir, "AGENTS.md"), "Fixture policy; no live activation proof\n")
  const sourceRow = sourceWorkspace === null ? "" : `| Source workspace | ${sourceWorkspace} |\n`
  writeFileSync(join(repo, "docs/superpowers/product-state.md"), `## Product binding\n\n| Field | Value |\n| --- | --- |\n| Repository | . |\n${sourceRow}| Design project | ${design} |\n| Design storage | . |\n| Entry | index.html |\n| Start command | node never-execute-this.mjs |\n| Verify command | node also-never-execute-this.mjs |\n| Product URL | https://example.invalid |\n| Brand source | tokens.css |\n${extra}`)
}

function project(id, dir, name = `${id}-name`) {
  return { id, name, metadata: { baseDir: dir, resolvedDir: dir } }
}

// Missing caller snapshot stays live-unknown; nothing is created or inferred.
test("missing snapshot stays live-unknown without creating or selecting a project", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" } })
  assert.equal(result.state, "unknown")
  assert.equal(result.selectedId, null)
  assert.match(result.reasons.join("\n"), /live|snapshot not supplied/i)
  assert.deepEqual(readdirSync(f.repo).sort(), ["docs"])
})

// Name-only matches never count as identity, even for a single candidate.
test("name-only match without exact id stays unknown and never matches", t => {
  const f = fixture(t)
  setupLocal(f)
  const dir = f.repo
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "Fixture Product" },
    projects: [{ id: "actual-id-1", name: "Fixture Product", metadata: { baseDir: dir, resolvedDir: dir } }],
  })
  assert.equal(result.state, "unknown")
  assert.equal(result.selectedId, null)
  assert.match(result.reasons.join("\n"), /name-only|exact id/i)
})

// A stale recorded id absent from an explicit snapshot stays unknown, not matched.
test("stale recorded id absent from the snapshot stays unknown, never matched", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "stale-id-aaa" },
    projects: [project("current-id-bbb", f.repo)],
  })
  assert.equal(result.state, "unknown")
  assert.equal(result.selectedId, null)
})

// Substring candidates are ambiguous; the tool must not guess by name.
test("substring candidates across several projects are ambiguous", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "EVENTOUCH" },
    projects: [
      { id: "proj-aaa", name: "EVENTOUCH source", metadata: { baseDir: f.repo, resolvedDir: f.repo } },
      { id: "proj-bbb", name: "EVENTOUCH legacy", metadata: { baseDir: f.repo, resolvedDir: f.repo } },
    ],
  })
  assert.equal(result.state, "ambiguous")
  assert.equal(result.selectedId, null)
})

// Exact id plus agreeing directories is a metadata match, repeatable without writes.
test("exact id with agreeing directories matches repeatedly without writes", t => {
  const f = fixture(t)
  setupLocal(f)
  const binding = { "Design project": "fixture-design-id" }
  const projects = { projects: [project("fixture-design-id", f.repo)] }
  const before = readFileSync(join(f.repo, "docs/superpowers/product-state.md"), "utf8")
  const first = inspectDesignBinding({ repo: f.repo, binding, projects })
  const second = inspectDesignBinding({ repo: f.repo, binding, projects })
  assert.equal(first.state, "matched")
  assert.equal(first.selectedId, "fixture-design-id")
  assert.deepEqual(second, first)
  assert.equal(readFileSync(join(f.repo, "docs/superpowers/product-state.md"), "utf8"), before)
  assert.deepEqual(readdirSync(f.repo).sort(), ["docs"])
  assert.match(first.reasons.join("\n"), /not .*readiness|metadata only/i)
})

// Array snapshots are accepted exactly like actual MCP {projects:[...]} lists.
test("array snapshots behave exactly like MCP list containers", t => {
  const f = fixture(t)
  setupLocal(f)
  const binding = { "Design project": "fixture-design-id" }
  const record = project("fixture-design-id", f.repo)
  const fromList = inspectDesignBinding({ repo: f.repo, binding, projects: { projects: [record] } })
  const fromArray = inspectDesignBinding({ repo: f.repo, binding, projects: [record] })
  assert.equal(fromList.state, "matched")
  assert.deepEqual(fromArray, fromList)
})

// Contradictory metadata directories never match.
test("contradictory baseDir and resolvedDir are a mismatch", t => {
  const f = fixture(t)
  setupLocal(f)
  const other = join(f.root, "elsewhere")
  mkdirSync(other, { recursive: true })
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id" },
    projects: [{ id: "fixture-design-id", name: "x", metadata: { baseDir: f.repo, resolvedDir: other } }],
  })
  assert.equal(result.state, "mismatch")
  assert.equal(result.selectedId, "fixture-design-id")
})

// Directories pointing elsewhere are a mismatch, not a silent retarget.
test("metadata directories pointing at another checkout are a mismatch", t => {
  const f = fixture(t)
  setupLocal(f)
  const other = join(f.root, "other-checkout")
  mkdirSync(other, { recursive: true })
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id" },
    projects: [project("fixture-design-id", other)],
  })
  assert.equal(result.state, "mismatch")
  assert.equal(result.selectedId, "fixture-design-id")
})

// An ancestor directory is not the exact expected root.
test("ancestor metadata directory is a mismatch, not a match", t => {
  const f = fixture(t)
  setupLocal(f)
  const nested = join(f.repo, "nested")
  mkdirSync(nested, { recursive: true })
  const result = inspectDesignBinding({
    repo: nested,
    binding: { "Design project": "fixture-design-id", "Source workspace": "." },
    projects: [project("fixture-design-id", f.repo)],
  })
  assert.equal(result.state, "mismatch")
})

// A directory nested inside the expected root is not the exact root either.
test("nested metadata directory is a mismatch, not a match", t => {
  const f = fixture(t)
  setupLocal(f)
  const nested = join(f.repo, "packages", "web")
  mkdirSync(nested, { recursive: true })
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id" },
    projects: [project("fixture-design-id", nested)],
  })
  assert.equal(result.state, "mismatch")
  assert.match(result.reasons.join(" "), /nested inside/)
})

// Recorded source workspace selects the expected root for comparison.
test("recorded source workspace is honored against the snapshot directories", t => {
  const f = fixture(t)
  const ws = join(f.repo, "apps", "web")
  mkdirSync(ws, { recursive: true })
  setupLocal(f, { sourceWorkspace: "apps/web" })
  const good = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id", "Source workspace": "apps/web" },
    projects: [project("fixture-design-id", ws)],
  })
  assert.equal(good.state, "matched")
  const bad = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id", "Source workspace": "apps/web" },
    projects: [project("fixture-design-id", f.repo)],
  })
  assert.equal(bad.state, "mismatch")
})

// Two products sharing one repository keep explicit identities and workspaces.
test("same repository with separate products keeps explicit identities apart", t => {
  const f = fixture(t)
  setupLocal(f)
  const a = join(f.repo, "apps", "a")
  const b = join(f.repo, "apps", "b")
  mkdirSync(a, { recursive: true })
  mkdirSync(b, { recursive: true })
  const snapshot = [project("product-a-id", a), project("product-b-id", b)]
  const matchA = inspectDesignBinding({ repo: f.repo, binding: { "Design project": "product-a-id", "Source workspace": "apps/a" }, projects: snapshot })
  const matchB = inspectDesignBinding({ repo: f.repo, binding: { "Design project": "product-b-id", "Source workspace": "apps/b" }, projects: snapshot })
  const crossed = inspectDesignBinding({ repo: f.repo, binding: { "Design project": "product-a-id", "Source workspace": "apps/a" }, projects: [project("product-a-id", b)] })
  assert.equal(matchA.state, "matched")
  assert.equal(matchA.selectedId, "product-a-id")
  assert.equal(matchB.state, "matched")
  assert.equal(matchB.selectedId, "product-b-id")
  assert.equal(crossed.state, "mismatch")
})

// A worktree checkout differing from the recorded source is a mismatch.
test("worktree directory differing from the recorded source is a mismatch", t => {
  const f = fixture(t)
  setupLocal(f)
  const worktree = join(f.root, "product-worktree")
  mkdirSync(worktree, { recursive: true })
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id" },
    projects: [project("fixture-design-id", worktree)],
  })
  assert.equal(result.state, "mismatch")
})

// Real symlinked paths resolve to the same identity instead of mismatching.
test("real symlink paths resolve to the same source identity", t => {
  const f = fixture(t)
  setupLocal(f)
  const real = join(f.root, "real-source")
  mkdirSync(real, { recursive: true })
  const link = join(f.root, "linked-source")
  symlinkSync(real, link)
  assert.equal(realpathSync(link), realpathSync(real))
  const result = inspectDesignBinding({
    repo: link,
    binding: { "Design project": "fixture-design-id" },
    projects: [project("fixture-design-id", real)],
  })
  assert.equal(result.state, "matched")
})

// Malformed snapshots are invalid, never empty-matched.
test("malformed snapshot containers and records are invalid", t => {
  const f = fixture(t)
  setupLocal(f)
  const binding = { "Design project": "fixture-design-id" }
  for (const projects of ["oops", 42, { projects: "nope" }, { projects: [{ id: 7 }] }, { projects: [null] }, { projects: [{ name: "no-id" }] }]) {
    const result = inspectDesignBinding({ repo: f.repo, binding, projects })
    assert.equal(result.state, "invalid", JSON.stringify(projects))
  }
  const dupes = inspectDesignBinding({ repo: f.repo, binding, projects: [project("dup", f.repo), project("dup", f.repo)] })
  assert.equal(dupes.state, "invalid")
  const wrongMeta = inspectDesignBinding({ repo: f.repo, binding, projects: [{ id: "fixture-design-id", metadata: { baseDir: 7 } }] })
  assert.equal(wrongMeta.state, "invalid")
})

// An explicitly empty snapshot never matches a recorded identity.
test("explicitly empty snapshot never matches a recorded identity", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects: [] })
  assert.notEqual(result.state, "matched")
  assert.equal(result.selectedId, null)
})

// Recorded commands and URLs are witnesses only; inspection never runs them.
test("recorded commands and URLs are never executed during inspection", t => {
  const f = fixture(t)
  setupLocal(f)
  const sentinel = join(f.root, "must-never-exist")
  const path = join(f.repo, "docs/superpowers/product-state.md")
  writeFileSync(path, readFileSync(path, "utf8").replace("node never-execute-this.mjs", `touch ${sentinel}`).replace("https://example.invalid", "https://example.invalid/hook?token=secret"))
  const before = readFileSync(path, "utf8")
  const result = inspectDesignBinding({
    repo: f.repo,
    binding: { "Design project": "fixture-design-id", "Start command": `touch ${sentinel}`, "Product URL": "https://example.invalid/hook?token=secret" },
    projects: [project("fixture-design-id", f.repo)],
  })
  assert.equal(result.state, "matched")
  assert.equal(existsSync(sentinel), false)
  assert.equal(readFileSync(path, "utf8"), before)
  assert.deepEqual(readdirSync(f.root).sort(), ["config", "product"])
})

// Readiness integration: matched metadata stays live-unverified, never runtime-ready.
test("readiness with a matching snapshot stays unverified and discloses metadata limits", t => {
  const f = fixture(t)
  setupLocal(f)
  const result = report.inspectReadiness({ ...f, frontend: true, projects: [project("fixture-design-id", f.repo)] })
  const design = result.checks.find(c => c.id === "design-binding")
  assert.equal(design.state, "matched")
  assert.match(design.detail, /not .*readiness|metadata/i)
  assert.match(design.detail, /no project .*creat/i)
  assert.equal(result.status, "unverified")
})

// Readiness integration: explicit mismatch or malformed snapshot needs preparation.
test("readiness with mismatch or malformed snapshot needs preparation", t => {
  const f = fixture(t)
  setupLocal(f)
  const other = join(f.root, "elsewhere")
  mkdirSync(other, { recursive: true })
  const mismatched = report.inspectReadiness({ ...f, frontend: true, projects: [project("fixture-design-id", other)] })
  assert.equal(mismatched.checks.find(c => c.id === "design-binding").state, "mismatch")
  assert.equal(mismatched.status, "needs-setup")
  const malformed = report.inspectReadiness({ ...f, frontend: true, projects: "oops" })
  assert.equal(malformed.checks.find(c => c.id === "design-binding").state, "invalid")
  assert.equal(malformed.status, "needs-setup")
})

// Readiness integration: legacy record-only behavior is preserved without a snapshot.
test("readiness without a snapshot preserves legacy record-only behavior", t => {
  const f = fixture(t)
  setupLocal(f)
  const before = readFileSync(join(f.repo, "docs/superpowers/product-state.md"), "utf8")
  const result = report.inspectReadiness({ ...f, frontend: true })
  assert.equal(result.status, "unverified")
  assert.equal(result.checks.find(c => c.id === "binding").state, "present")
  const design = result.checks.find(c => c.id === "design-binding")
  assert.equal(design.state, "unknown")
  assert.equal(readFileSync(join(f.repo, "docs/superpowers/product-state.md"), "utf8"), before)
})

// CLI: absent flag keeps legacy output; malformed uses report unavailable instead of matching.
test("doctor CLI design-projects flag handles absent, missing and malformed files", t => {
  const f = fixture(t)
  setupLocal(f)
  const legacy = JSON.parse(execFileSync(process.execPath, [DOCTOR, "--repo", f.repo, "--config", f.configDir, "--frontend", "--json"], { encoding: "utf8" }))
  assert.equal(legacy.checks.find(c => c.id === "design-binding").state, "unknown")
  const missingValue = spawnSync(process.execPath, [DOCTOR, "--design-projects"], { encoding: "utf8" })
  assert.notEqual(missingValue.status, 0)
  assert.match(missingValue.stderr, /Usage:/)
  const absent = resolve(f.root, "does-not-exist.json")
  const absentOut = JSON.parse(execFileSync(process.execPath, [DOCTOR, "--repo", f.repo, "--config", f.configDir, "--frontend", "--json", "--design-projects", absent], { encoding: "utf8" }))
  assert.equal(absentOut.checks.find(c => c.id === "design-binding").state, "invalid")
  assert.equal(absentOut.status, "needs-setup")
  const malformed = join(f.root, "malformed.json")
  writeFileSync(malformed, "{not json")
  const malformedOut = JSON.parse(execFileSync(process.execPath, [DOCTOR, "--repo", f.repo, "--config", f.configDir, "--frontend", "--json", "--design-projects", malformed], { encoding: "utf8" }))
  assert.equal(malformedOut.checks.find(c => c.id === "design-binding").state, "invalid")
  const snapshot = join(f.root, "projects.json")
  writeFileSync(snapshot, JSON.stringify({ projects: [{ id: "fixture-design-id", metadata: { baseDir: f.repo, resolvedDir: f.repo } }] }))
  const matched = JSON.parse(execFileSync(process.execPath, [DOCTOR, "--repo", f.repo, "--config", f.configDir, "--frontend", "--json", "--design-projects", snapshot], { encoding: "utf8" }))
  assert.equal(matched.checks.find(c => c.id === "design-binding").state, "matched")
  assert.equal(matched.status, "unverified")
})

// Break caught: an identity-only snapshot claims source correspondence without a source.
test("exact identity without source directories stays unknown and needs preparation", t => {
  const f = fixture(t)
  setupLocal(f)
  const projects = [{ id: "fixture-design-id" }]
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects }).state, "unknown")
  const result = report.inspectReadiness({ ...f, frontend: true, projects })
  assert.equal(result.checks.find(c => c.id === "design-binding").state, "unknown")
  assert.equal(result.status, "needs-setup")
})

// Break caught: empty/relative directories normalize to cwd and falsely match it.
test("snapshot directories must be nonempty absolute paths", t => {
  const f = fixture(t)
  for (const baseDir of ["", "  ", ".", "nested/.."])
    assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects: [{ id: "fixture-design-id", metadata: { baseDir } }] }).state, "invalid", JSON.stringify(baseDir))
})

// Break caught: fallback precedence hides contradictory redundant path fields.
test("all supplied source directories must agree rather than shadow contradictions", t => {
  const f = fixture(t)
  const other = join(f.root, "other")
  mkdirSync(other)
  const projects = [{ id: "fixture-design-id", metadata: { baseDir: f.repo, resolvedDir: f.repo }, baseDir: other, resolvedDir: f.repo }]
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects }).state, "mismatch")
})

// Break caught: stale recorded storage is ignored despite an otherwise matching snapshot.
test("recorded design storage must agree with the intended source", t => {
  const f = fixture(t)
  const other = join(f.root, "other")
  mkdirSync(other)
  const projects = [project("fixture-design-id", f.repo)]
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id", "Design storage": other }, projects }).state, "mismatch")
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id", "Design storage": "." }, projects }).state, "matched")
})

// Break caught: an explicitly corrupt null snapshot is mistaken for omitted evidence.
test("explicit null snapshots and blank identities are invalid", t => {
  const f = fixture(t)
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects: null }).state, "invalid")
  assert.equal(inspectDesignBinding({ repo: f.repo, binding: { "Design project": "fixture-design-id" }, projects: [{ id: "  ", metadata: { baseDir: f.repo } }] }).state, "invalid")
})
