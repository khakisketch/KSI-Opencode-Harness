import test from "node:test"
import assert from "node:assert/strict"

import { validateDeveloperTaskContract, validateReadTaskContract } from "../src/contracts.mjs"

const completeTask = `Objective: Update the local route.
Allowed write paths: index.mjs
Forbidden shared files: package-lock.json
Acceptance criteria: The route uses balanced.
Targeted verification: npm test
Escalate if: A public contract must change.`

test("accepts a complete bounded Developer task", () => {
  assert.doesNotThrow(() => validateDeveloperTaskContract({ prompt: completeTask }))
})

test("rejects a Developer task missing a required section", () => {
  assert.throws(
    () => validateDeveloperTaskContract({ prompt: "Objective: Update the route." }),
    /missing required section/i,
  )
})

test("rejects an oversized new Developer task before execution", () => {
  assert.throws(
    () => validateDeveloperTaskContract({ prompt: `${completeTask}\n${"x".repeat(12 * 1024)}` }),
    /12 KiB/i,
  )
})

test("measures the raw prompt so whitespace cannot bypass the byte cap", () => {
  assert.throws(
    () => validateDeveloperTaskContract({ prompt: `${completeTask}${" ".repeat(12 * 1024)}` }),
    /12 KiB/i,
  )
})

test("accepts a concise repair task with failure evidence", () => {
  assert.doesNotThrow(() => validateDeveloperTaskContract({
    task_id: "ses_existing",
    prompt: "Failing command: npm test\nEvidence: Assertion expected balanced but received quality.",
  }))
})

test("rejects an underspecified repair task", () => {
  assert.throws(
    () => validateDeveloperTaskContract({ task_id: "ses_existing", prompt: "Please fix it." }),
    /repair requests require/i,
  )
})

test("empty section cannot consume the next label as its value", () => {
  assert.throws(() => validateDeveloperTaskContract({ prompt: completeTask.replace("Objective: Update the local route.", "Objective:") }), /Objective/)
})

test("repair packets share the token-budget byte ceiling", () => {
  assert.throws(() => validateDeveloperTaskContract({ task_id: "existing", prompt: `Failure: failed\nEvidence: ${"x".repeat(12 * 1024)}` }), /12 KiB/)
})

test("read/execution role contracts require their own evidence fields", () => {
  for (const [role, prompt] of [
    ["explore", "Objective: locate\nScope: src"],
    ["test-runner", "Objective: verify\nCommands: npm test\nScope: cwd fixture, no external effects"],
    ["reviewer", "Objective: inspect\nScope: src\nEvidence: baseline and diff"],
    ["plan-reviewer", "Objective: critique\nScope: plan\nEvidence: agreed requirement"],
  ]) {
    assert.doesNotThrow(() => validateReadTaskContract(role, { prompt }))
    assert.throws(() => validateReadTaskContract(role, { prompt: "Objective: only" }), /requires/)
  }
})
