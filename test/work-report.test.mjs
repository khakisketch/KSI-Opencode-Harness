import test from "node:test"
import assert from "node:assert/strict"

import {
  formatTokens,
  parseNextSlices,
  summarizeBindings,
  summarizeGoals,
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
