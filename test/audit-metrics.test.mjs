import test from "node:test"
import assert from "node:assert/strict"

import { percentile, sessionDurationMs, toEpochMs } from "../src/audit-metrics.mjs"

test("session duration includes setup before a single assistant turn", () => {
  assert.equal(sessionDurationMs({
    session_started_at: "2026-08-22T00:00:00.000Z",
    first_assistant_at: "2026-08-22T00:35:00.000Z",
    last_assistant_at: "2026-08-22T00:35:00.000Z",
  }), 35 * 60_000)
})

test("session duration falls back to the first assistant message for older rows", () => {
  assert.equal(sessionDurationMs({
    first_assistant_at: 1_000,
    last_assistant_at: 1_600,
  }), 600_000)
})

test("audit metrics parse seconds, milliseconds, and ISO timestamps", () => {
  assert.equal(toEpochMs(1_000), 1_000_000)
  assert.equal(toEpochMs(1_000_000_000_000), 1_000_000_000_000)
  assert.equal(toEpochMs("2026-08-22T00:00:00.000Z"), Date.parse("2026-08-22T00:00:00.000Z"))
  assert.equal(percentile([1, 3, 2, 4], 0.5), 3)
})
