import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  formatTokens,
  parseNextSlices,
  summarizeBindings,
  summarizeGoals,
  renderReport,
  buildReport,
} from "../scripts/work-report.mjs"

test("parseNextSlices extracts only the Next slices section", () => {
  const markdown = [
    "# Product State",
    "",
    "## Next slices (미완만)",
    "",
    "- m04 design-workspace-separation — remaining: 사용자 수용",
    "- m05 beta release — remaining: README acceptance",
    "",
    "## Backlog",
    "",
    "- something else",
  ].join("\n")
  assert.deepEqual(parseNextSlices(markdown), [
    "m04 design-workspace-separation — remaining: 사용자 수용",
    "m05 beta release — remaining: README acceptance",
  ])
  assert.deepEqual(parseNextSlices("# no section"), [])
})

test("summarizeGoals normalizes the v2 goals.json shape and sorts by recency", () => {
  const raw = {
    version: 3,
    goals: {
      ses_a: {
        sessionID: "ses_a",
        objective: "first\nobjective",
        status: "complete",
        tokensUsed: 393061352,
        tokenBudget: null,
        autoTurns: 9,
        maxAutoTurns: 80,
        updatedAt: 1790990000,
      },
      ses_b: {
        sessionID: "ses_b",
        objective: "second",
        status: "active",
        tokensUsed: 10,
        tokenBudget: 1000,
        autoTurns: 1,
        maxAutoTurns: 5,
        updatedAt: 1790990500,
      },
    },
  }
  const goals = summarizeGoals(raw)
  assert.equal(goals.length, 2)
  assert.equal(goals[0].sessionID, "ses_b", "most recently updated first")
  assert.equal(goals[1].objective, "first objective", "newlines collapsed")
  assert.equal(goals[1].tokensUsed, 393061352)
  assert.equal(goals[1].updatedAt, 1790990000 * 1000, "second-based goal timestamps become milliseconds")
  assert.equal(goals[1].maxDurationSeconds, null)
})

test("summarizeBindings lists pending runs first and keeps classification", () => {
  const raw = {
    "run:a@ses_1": {
      key: "run:a@ses_1",
      state: "delivered",
      runId: "a",
      sessionID: "ses_1",
      updatedAt: 300,
      delivery: { classification: "invalid" },
    },
    "run:b@ses_2": {
      key: "run:b@ses_2",
      state: "held",
      runId: "b",
      sessionID: "ses_2",
      updatedAt: 100,
    },
    "run:c@ses_3": {
      key: "run:c@ses_3",
      state: "tracking",
      runId: "c",
      sessionID: "ses_3",
      updatedAt: 200,
      lastStatus: { deliverableValid: true },
    },
  }
  const rows = summarizeBindings(raw)
  assert.equal(rows.length, 3)
  assert.deepEqual(
    rows.map((row) => row.state),
    ["tracking", "held", "delivered"],
    "pending states sort first",
  )
  assert.equal(rows[2].classification, "invalid")
  assert.equal(rows[0].classification, "valid")
})

test("formatTokens keeps numbers readable", () => {
  assert.equal(formatTokens(393061352), "393.1M")
  assert.equal(formatTokens(922), "922")
  assert.equal(formatTokens(1_050_000), "1.1M")
  assert.equal(formatTokens(2_500_000_000), "2.50B")
  assert.equal(formatTokens(undefined), "?")
})

test("unlimited goals are informational rather than a failure warning", () => {
  const report = renderReport({generatedAt: 0, days: 7, goals: [{status: "active", tokenBudget: null, maxAutoTurns: null, maxDurationSeconds: null}], designRuns: [], designPaused: {}, usage: {byProject: [], top: []}, repo: null, nextSlices: []})
  assert.doesNotMatch(report, /!unbounded/)
  assert.match(report, /limits: none/)
})

test("missing or malformed state sources surface warnings instead of silently meaning none", () => {
  const before = process.env.KSI_WORK_REPORT_GOALS
  process.env.KSI_WORK_REPORT_GOALS = join(tmpdir(), "ksi-definitely-absent-report-state.json")
  try {
    const report = buildReport({ includeUsage: false })
    assert.equal(report.warnings.some(w => /goal.*unavailable/i.test(w)), true)
  } finally {
    if (before === undefined) delete process.env.KSI_WORK_REPORT_GOALS
    else process.env.KSI_WORK_REPORT_GOALS = before
  }
})

test("valid JSON of the wrong state shape is unavailable, not zero goals", t => {
  const dir = mkdtempSync(join(tmpdir(), "ksi-report-test-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const file = join(dir, "state.json")
  writeFileSync(file, '"not a goal container"')
  const before = process.env.KSI_WORK_REPORT_GOALS
  process.env.KSI_WORK_REPORT_GOALS = file
  try {
    assert.equal(buildReport({ includeUsage: false }).warnings.some(w => /Goal state unavailable/i.test(w)), true)
  } finally {
    if (before === undefined) delete process.env.KSI_WORK_REPORT_GOALS
    else process.env.KSI_WORK_REPORT_GOALS = before
  }
})

test("design artifact verdict is kept separate from pending product verification in reports", () => {
  const rows = summarizeBindings({ one: { state: "delivered", lastStatus: { status: "succeeded", deliverableValid: false, deliverableValidation: "entry_not_touched" } } })
  assert.equal(rows[0].classification, "invalid")
  assert.equal(rows[0].productVerification, "required")
  const report = renderReport({ generatedAt: 0, days: 7, goals: [], designRuns: rows, designPaused: {}, usage: {byProject: [], top: []}, repo: null, nextSlices: [] })
  assert.match(report, /artifact=invalid.*product=required/)
})

// Break caught: undelivered running/failed/canceled snapshots collapse to invalid.
test("design report keeps execution classification consistent before and after delivery", () => {
  for (const [state, runStatus, valid, expected, product] of [
    ["tracking", "running", null, "pending", "unknown"],
    ["held", "failed", null, "failed", "blocked"],
    ["tracking", "canceled", false, "canceled", "blocked"],
    ["held", "succeeded", false, "invalid", "required"],
    ["tracking", "succeeded", true, "valid", "required"],
  ]) {
    const record = { state, lastStatus: { status: runStatus, deliverableValid: valid } }
    const row = summarizeBindings({ one: record })[0]
    assert.equal(row.classification, expected, runStatus)
    assert.equal(row.productVerification, product, runStatus)
    assert.equal(summarizeBindings({ one: { ...record, state: "delivered", delivery: { classification: expected } } })[0].classification, expected)
  }
})

// Break caught: deep wrong-type containers disappear as zero activity without warnings.
test("nested malformed goal and design containers are unavailable rather than empty", t => {
  const dir = mkdtempSync(join(tmpdir(), "ksi-report-shape-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const keys = ["KSI_WORK_REPORT_GOALS", "KSI_WORK_REPORT_BINDINGS", "KSI_WORK_REPORT_PAUSED"]
  const before = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const paths = keys.map((key, i) => join(dir, `${i}.json`))
  for (const [i, key] of keys.entries()) process.env[key] = paths[i]
  t.after(() => {
    for (const key of keys) {
      if (before[key] === undefined) delete process.env[key]
      else process.env[key] = before[key]
    }
  })
  writeFileSync(paths[2], "{}")
  for (const goals of [{ version: 3, goals: "invalid" }, { goals: null }, { goals: { one: "invalid-record" } }, { goals: { one: [] } }]) {
    writeFileSync(paths[0], JSON.stringify(goals))
    writeFileSync(paths[1], "{}")
    const report = buildReport({ includeUsage: false })
    assert.equal(report.warnings.some(w => /Goal state unavailable/i.test(w)), true, JSON.stringify(goals))
  }
  writeFileSync(paths[0], "{}")
  for (const bindings of [{ one: "invalid-record" }, { one: [] }, { one: { lastStatus: "invalid" } }]) {
    writeFileSync(paths[1], JSON.stringify(bindings))
    assert.equal(buildReport({ includeUsage: false }).warnings.some(w => /Design state unavailable/i.test(w)), true, JSON.stringify(bindings))
  }
  // Empty and supported legacy containers must remain valid and isolated from live files.
  for (const goals of [{}, { goals: {} }, { goals: [{ sessionID: "ses_fixture", status: "active" }] }, { ses_fixture: { status: "active" } }]) {
    writeFileSync(paths[0], JSON.stringify(goals))
    writeFileSync(paths[1], JSON.stringify({ one: { state: "tracking", lastStatus: null } }))
    assert.deepEqual(buildReport({ includeUsage: false }).warnings, [])
  }
})
