import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { execFileSync, spawnSync } from "node:child_process"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

// Namespace import allows a missing API to fail an assertion, not an import error.
import * as status from "../scripts/work-report.mjs"
import { isOutsideRoot } from "../scripts/work-status.mjs"

function fixture(t, git = true) {
  const root = mkdtempSync(join(tmpdir(), "ksi-status-test-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  if (git) {
    execFileSync("git", ["init", "-q", root])
    execFileSync("git", ["-C", root, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"])
  }
  mkdirSync(join(root, ".opencode"))
  mkdirSync(join(root, "docs/superpowers/plans"), { recursive: true })
  return root
}

// Break caught: checkpoint completion is trusted despite a different checked-out revision.
test("status warns on stale HEAD and idle checkpoint with unfinished ledger", t => {
  assert.equal(typeof status.inspectWorkStatus, "function")
  const root = fixture(t)
  writeFileSync(join(root, ".opencode/working-state.md"), "HEAD: 0000000\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n\n## Next\n- inspect result\n")
  writeFileSync(join(root, "docs/superpowers/plans/fixture.md"), "Status: in progress\n- [ ] Integration\n")
  const result = status.inspectWorkStatus(root)
  assert.equal(result.recordedStatus, "idle")
  assert.equal(result.warnings.some(w => /revision/i.test(w)), true)
  assert.equal(result.warnings.some(w => /unfinished ledger/i.test(w)), true)
  assert.deepEqual(result.next, ["inspect result"])
  assert.equal(result.acceptance, "not recorded")
})

test("missing/non-Git status stays unknown and never invents completion", t => {
  assert.equal(typeof status.inspectWorkStatus, "function")
  const result = status.inspectWorkStatus(fixture(t, false))
  assert.equal(result.recordedStatus, "unknown")
  assert.equal(result.git.head, null)
  assert.equal(result.delivery, "unknown")
  assert.equal(result.warnings.length > 0, true)
})

test("matching status is read-only and reports local delivery separately from acceptance", t => {
  assert.equal(typeof status.inspectWorkStatus, "function")
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const file = join(root, ".opencode/working-state.md")
  const text = `HEAD: ${head.slice(0, 7)}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n`
  writeFileSync(file, text)
  writeFileSync(join(root, "docs/superpowers/plans/fixture.md"), "Status: technically complete\n- [x] Integration\n")
  const result = status.inspectWorkStatus(root)
  assert.equal(result.warnings.length, 0)
  assert.equal(result.delivery, "unknown", "no upstream does not mean deployed")
  assert.equal(result.acceptance, "not recorded", "technical completion is not acceptance")
  assert.equal(readFileSync(file, "utf8"), text)
})

test("ledger pointers cannot escape the project through traversal or symlinks", t => {
  assert.equal(typeof status.inspectWorkStatus, "function")
  const root = fixture(t, false)
  const outside = fixture(t, false)
  writeFileSync(join(outside, "private.md"), "Status: secret-private-content\n")
  symlinkSync(join(outside, "private.md"), join(root, "docs/superpowers/plans/linked.md"))
  writeFileSync(join(root, ".opencode/working-state.md"), "Status: idle\nSlice: fixture | ledger: docs/superpowers/plans/linked.md\n")
  const result = status.inspectWorkStatus(root)
  assert.equal(result.ledger.status, "unknown")
  assert.equal(JSON.stringify(result).includes("secret-private-content"), false)
  assert.equal(result.warnings.some(w => /outside|unreadable/i.test(w)), true)
})

test("outside-root guard refuses parent escapes on native and Windows separators", () => {
  assert.equal(typeof isOutsideRoot, "function")
  // Windows form: backslash escapes are refused, siblings allowed.
  assert.equal(isOutsideRoot("..\\outside", "\\"), true)
  assert.equal(isOutsideRoot("..\\..\\outside", "\\"), true)
  assert.equal(isOutsideRoot("..", "\\"), true)
  assert.equal(isOutsideRoot("plans\\linked.md", "\\"), false)
  // Only a leading `..` segment escapes; deeper segments are contained.
  assert.equal(isOutsideRoot("plans\\..\\linked.md", "\\"), false)
  // POSIX form: behavior unchanged.
  assert.equal(isOutsideRoot("../outside", "/"), true)
  assert.equal(isOutsideRoot("..", "/"), true)
  assert.equal(isOutsideRoot("plans/linked.md", "/"), false)
  // A backslash is an ordinary filename character on POSIX, not an escape.
  assert.equal(isOutsideRoot("..\\outside", "/"), false)
})

test("status CLI rejects unknown options and option names used as paths", () => {
  const command = fileURLToPath(new URL("../scripts/work-report.mjs", import.meta.url))
  for (const args of [["--unknown", "--status"], ["--repo", "--json", "--status"]]) {
    const result = spawnSync(process.execPath, [command, ...args], { encoding: "utf8" })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Usage:/)
  }
})
