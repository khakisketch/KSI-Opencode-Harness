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

// Break caught: normal numbered checkpoint actions disappear from JSON and text.
test("status retains numbered Next actions in recorded order and rendered output", t => {
  const root = fixture(t)
  const file = join(root, ".opencode/working-state.md")
  const text = "Status: active\n\n## Next\n1. Inspect the actual diff\n2. Verify the integrated revision\n\n## Blockers\n- Not a next action\n"
  writeFileSync(file, text)
  const result = status.inspectWorkStatus(root)
  assert.deepEqual(result.next, ["Inspect the actual diff", "Verify the integrated revision"])
  assert.match(status.renderWorkStatus(result), /Next: Inspect the actual diff\n  Next: Verify the integrated revision/)
  assert.doesNotMatch(status.renderWorkStatus(result), /Next: Not a next action/)
  assert.equal(readFileSync(file, "utf8"), text)
})

// Break caught: supported Markdown markers/CRLF are skipped or the three-action cap is lost.
test("status accepts mixed Markdown Next markers and caps reported actions at three", t => {
  const root = fixture(t)
  writeFileSync(join(root, ".opencode/working-state.md"), [
    "Status: active", "", "## Next", "Introductory prose, not an action.",
    "  1) inspect result", "* verify persistence", "+ report evidence", "- later action", "",
  ].join("\r\n"))
  assert.deepEqual(status.inspectWorkStatus(root).next, ["inspect result", "verify persistence", "report evidence"])
})

// Break caught: explanations suppress the idle/unfinished warning or broaden it to non-idle states.
test("descriptive idle statuses reconcile unfinished ledgers without discarding their explanation", t => {
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const checkpoint = join(root, ".opencode/working-state.md")
  const ledger = join(root, "docs/superpowers/plans/fixture.md")
  for (const recorded of ["idle", "idle — checks complete", "idle: checks complete", "Idle - checks complete"]) {
    writeFileSync(checkpoint, `HEAD: ${head}\nStatus: ${recorded}\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n`)
    for (const unfinished of ["Status: in progress\n", "Status: technically complete\n- [ ] Required check\n"]) {
      writeFileSync(ledger, unfinished)
      const result = status.inspectWorkStatus(root)
      assert.equal(result.recordedStatus, recorded)
      assert.deepEqual(result.warnings, ["Idle checkpoint has an unfinished ledger; reconcile before claiming completion."], recorded)
    }
    writeFileSync(ledger, "Status: technically complete\n- [x] Required check\n")
    assert.deepEqual(status.inspectWorkStatus(root).warnings, [], recorded)
  }
  writeFileSync(ledger, "Status: in progress\n- [ ] Required check\n")
  for (const recorded of ["active — not idle", "unknown", "idleness", "idle-ish", "not idle"]) {
    writeFileSync(checkpoint, `HEAD: ${head}\nStatus: ${recorded}\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n`)
    assert.deepEqual(status.inspectWorkStatus(root).warnings, [], recorded)
  }
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

// Break caught: a reused ledger's first completed status hides later active work.
test("multiple ledger statuses are ambiguous without an explicit current section", t => {
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  writeFileSync(join(root, ".opencode/working-state.md"), `HEAD: ${head}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n`)
  writeFileSync(join(root, "docs/superpowers/plans/fixture.md"), "## Prior\nStatus: complete\n- [x] Old\n\n## Current\nStatus: in progress\n")
  const result = status.inspectWorkStatus(root)
  assert.equal(result.ledger.status, "ambiguous")
  assert.equal(result.warnings.some(w => /multiple.*status|ambiguous/i.test(w)), true)
})

// Break caught: historical statuses/checkboxes contaminate the selected current slice.
test("an explicit ledger section isolates current status and unfinished work", t => {
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const checkpoint = join(root, ".opencode/working-state.md")
  writeFileSync(join(root, "docs/superpowers/plans/fixture.md"), "## Prior\nStatus: active\n- [ ] Historical item\n\n## Current\nStatus: complete\n- [x] Done\n\n## Following\nStatus: active\n- [ ] Other slice\n")
  writeFileSync(checkpoint, `HEAD: ${head}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\nLedger section: Current\n`)
  assert.equal(status.inspectWorkStatus(root).ledger.status, "complete")
  assert.deepEqual(status.inspectWorkStatus(root).warnings, [])
  writeFileSync(checkpoint, `HEAD: ${head}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\nLedger section: Following\n`)
  assert.equal(status.inspectWorkStatus(root).ledger.status, "active")
  assert.equal(status.inspectWorkStatus(root).warnings.some(w => /unfinished ledger/i.test(w)), true)
})

// Break caught: missing/duplicate section selectors silently fall back to older work.
test("missing or duplicate ledger sections stay unknown or ambiguous with a warning", t => {
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const checkpoint = join(root, ".opencode/working-state.md")
  const ledger = join(root, "docs/superpowers/plans/fixture.md")
  writeFileSync(checkpoint, `HEAD: ${head}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\nLedger section: Current\n`)
  writeFileSync(ledger, "## Prior\nStatus: complete\n")
  const missing = status.inspectWorkStatus(root)
  assert.equal(missing.ledger.status, "unknown")
  assert.equal(missing.warnings.some(w => /section.*missing|section.*unavailable/i.test(w)), true)
  writeFileSync(ledger, "## Current\nStatus: complete\n\n## Current\nStatus: active\n")
  const duplicate = status.inspectWorkStatus(root)
  assert.equal(duplicate.ledger.status, "ambiguous")
  assert.equal(duplicate.warnings.some(w => /section.*ambiguous|duplicate/i.test(w)), true)
})

// Break caught: inactive matches active; equivalent Markdown tasks are missed.
test("inactive is not active and supported unchecked list markers warn consistently", t => {
  const root = fixture(t)
  const head = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  writeFileSync(join(root, ".opencode/working-state.md"), `HEAD: ${head}\nStatus: idle\nSlice: fixture | ledger: docs/superpowers/plans/fixture.md\n`)
  const ledger = join(root, "docs/superpowers/plans/fixture.md")
  writeFileSync(ledger, "Status: inactive\n- [x] Done\n")
  assert.deepEqual(status.inspectWorkStatus(root).warnings, [])
  for (const marker of ["-", "*", "+", "1.", "2)"]) {
    writeFileSync(ledger, `Status: complete\n${marker} [ ] Required check\n`)
    assert.equal(status.inspectWorkStatus(root).warnings.some(w => /unfinished ledger/i.test(w)), true, marker)
  }
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
