import test from "node:test"
import assert from "node:assert/strict"

import { contractHint, validateDesignTaskContract, validateDeveloperTaskContract, validateReadTaskContract } from "../src/contracts.mjs"

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
    ["reviewer", "Objective: critique plan\nScope: plan\nEvidence: agreed requirement"],
    ["research", "Objective: compare\nScope: upstream docs\nEvidence: versioned sources"],
  ]) {
    assert.doesNotThrow(() => validateReadTaskContract(role, { prompt }))
    assert.throws(() => validateReadTaskContract(role, { prompt: "Objective: only" }), /requires/)
  }
})

test("design-task contracts bind prototype scope without full implementation sections", () => {
  const complete = "Objective: Prototype the empty state.\nAllowed write paths: design-previews/empty\nAcceptance criteria: Rendered artifact inspected.\nEvidence: artifact v3, approved scope."
  assert.doesNotThrow(() => validateDesignTaskContract({ prompt: complete }))
  assert.throws(() => validateDesignTaskContract({ prompt: "Objective: Prototype." }), /design-task section/)
  assert.doesNotThrow(() => validateDesignTaskContract({
    task_id: "ses_existing",
    prompt: "Failure: render blocked\nEvidence: missing capture tool",
  }))
  assert.throws(() => validateDesignTaskContract({ task_id: "ses_existing", prompt: "Please revise." }), /repair requests require/)
})

test("design-task review requests declare Mode review with no write paths", async () => {
  const { validateDesignTaskContract, isDesignTaskReviewPrompt } = await import("../src/contracts.mjs")
  const review = "Objective: Review the empty state.\nMode: review\nAllowed write paths: none\nAcceptance criteria: VISUAL PASS/FAIL/BLOCKED-no-render.\nEvidence: artifact v3 plus diff plus PNGs."
  assert.equal(isDesignTaskReviewPrompt(review), true)
  assert.doesNotThrow(() => validateDesignTaskContract({ prompt: review }))
  assert.throws(
    () => validateDesignTaskContract({ prompt: review.replace("Allowed write paths: none", "Allowed write paths: design-previews/x") }),
    /review requests require `Allowed write paths: none`/i,
  )
  assert.throws(
    () => validateDesignTaskContract({ prompt: "Objective: Prototype.\nAllowed write paths: none\nAcceptance criteria: rendered\nEvidence: v1" }),
    /prototype requests require concrete/i,
  )
  const prototype = "Objective: Prototype the empty state.\nAllowed write paths: design-previews/empty\nAcceptance criteria: Rendered artifact inspected.\nEvidence: artifact v3, approved scope."
  assert.equal(isDesignTaskReviewPrompt(prototype), false)
  assert.doesNotThrow(() => validateDesignTaskContract({ prompt: prototype }))
})

test("design-task repairs validate the review marker when declared", async () => {
  const { validateDesignTaskContract } = await import("../src/contracts.mjs")
  assert.doesNotThrow(() => validateDesignTaskContract({
    task_id: "ses_existing",
    prompt: "Failure: render blocked\nEvidence: missing capture tool",
  }))
  assert.doesNotThrow(() => validateDesignTaskContract({
    task_id: "ses_existing",
    prompt: "Mode: review\nAllowed write paths: none\nFailure: render blocked\nEvidence: missing capture tool",
  }))
  assert.throws(
    () => validateDesignTaskContract({
      task_id: "ses_existing",
      prompt: "Mode: review\nAllowed write paths: design-previews/x\nFailure: render blocked\nEvidence: missing capture tool",
    }),
    /review requests require `Allowed write paths: none`/i,
  )
  assert.throws(
    () => validateDesignTaskContract({
      task_id: "ses_existing",
      prompt: "Mode: prototype\nFailure: render blocked\nEvidence: missing capture tool",
    }),
    /must not declare `Mode:`/i,
  )
})

test("contractHint returns the expected template for each role", () => {
  const developerHint = contractHint("developer", false)
  for (const label of ["Objective:", "Allowed write paths:", "Forbidden shared files:", "Acceptance criteria:", "Targeted verification:", "Escalate if:"]) {
    assert.match(developerHint, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.equal(developerHint.split("\n").filter((line) => line.includes(":")).length >= 6, true)

  const repairHint = contractHint("developer", true)
  assert.match(repairHint, /task_id/)
  assert.match(repairHint, /Failure:/)
  assert.match(repairHint, /Failing command:/)
  assert.match(repairHint, /Evidence:/)

  assert.match(contractHint("explore", false), /Objective:/)
  assert.match(contractHint("explore", false), /Scope:/)
  assert.match(contractHint("test-runner", false), /Commands:/)
  assert.match(contractHint("reviewer", false), /Evidence:/)
  assert.match(contractHint("research", false), /Evidence:/)

  const designHint = contractHint("design-task", false)
  for (const label of ["Objective:", "Allowed write paths:", "Acceptance criteria:", "Evidence:"]) {
    assert.match(designHint, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("every Developer rejection appends its template once", () => {
  const capture = (fn) => {
    try { fn() } catch (error) { return String(error) }
    assert.fail("expected contract rejection")
  }
  const missingText = capture(() => validateDeveloperTaskContract({ prompt: "Objective: Update the route." }))
  assert.match(missingText, /missing required section/i)
  for (const label of ["Objective:", "Allowed write paths:", "Forbidden shared files:", "Acceptance criteria:", "Targeted verification:", "Escalate if:"]) {
    assert.match(missingText, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.equal((missingText.match(/Expected (repair )?contract:/g) ?? []).length, 1)

  const repairError = capture(() => validateDeveloperTaskContract({ task_id: "ses_existing", prompt: "Please fix it." }))
  assert.match(String(repairError), /task_id/)
  assert.match(String(repairError), /Failure:/)
  assert.match(String(repairError), /Evidence:/)

  const emptyError = capture(() => validateDeveloperTaskContract({ prompt: "   " }))
  assert.match(String(emptyError), /Objective:/)
})

test("every read-role and design-task rejection appends its template once", () => {
  const capture = (fn) => {
    try { fn() } catch (error) { return String(error) }
    assert.fail("expected contract rejection")
  }
  const exploreError = capture(() => validateReadTaskContract("explore", { prompt: "Objective: only" }))
  assert.match(String(exploreError), /Objective:/)
  assert.match(String(exploreError), /Scope:/)

  const runnerError = capture(() => validateReadTaskContract("test-runner", { prompt: "Objective: only" }))
  assert.match(String(runnerError), /Commands:/)
  assert.match(String(runnerError), /Scope:/)

  const reviewerError = capture(() => validateReadTaskContract("reviewer", { prompt: "Objective: only" }))
  assert.match(String(reviewerError), /Evidence:/)

  const designError = capture(() => validateDesignTaskContract({ prompt: "Objective: Prototype." }))
  assert.match(String(designError), /Allowed write paths:/)
  assert.match(String(designError), /Acceptance criteria:/)
  assert.match(String(designError), /Evidence:/)

  const designRepairError = capture(() => validateDesignTaskContract({ task_id: "ses_existing", prompt: "Please revise." }))
  assert.match(String(designRepairError), /task_id/)
  assert.match(String(designRepairError), /Failure:/)
  assert.match(String(designRepairError), /Evidence:/)
})
