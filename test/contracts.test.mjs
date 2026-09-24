import test from "node:test"
import assert from "node:assert/strict"

import { contractHint, validateDesignCriticContract, validateDeveloperTaskContract, validateReadTaskContract, isReviewerVisualPrompt, validateReviewerVisualContract } from "../src/contracts.mjs"

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

test("removed design-task contract leaves no validator or review marker", async () => {
  const contracts = await import("../src/contracts.mjs")
  assert.equal(contracts.validateDesignTaskContract, undefined, "dead design-task validator remains")
  assert.equal(contracts.isDesignTaskReviewPrompt, undefined, "dead design-task review marker remains")
  assert.doesNotMatch(contractHint("design-task", false), /prototype requests require concrete/i)
})

test("reviewer visual-fidelity requests declare Mode visual-fidelity with no write paths and PNG evidence", async () => {
  const visual = "Objective: Review integrated checkout.\nScope: src/checkout, integrated diff vs approved artifact.\nMode: visual-fidelity\nAllowed write paths: none\nEvidence: approved artifact v3 plus integration diff baseline plus design-previews/checkout-desktop-1280x800.png desktop and design-previews/checkout-mobile-390x844.png mobile."
  assert.equal(isReviewerVisualPrompt(visual), true)
  assert.doesNotThrow(() => validateReviewerVisualContract({ prompt: visual }))
  assert.equal(isReviewerVisualPrompt("Objective: inspect\nScope: src\nEvidence: baseline and diff"), false)
  assert.throws(
    () => validateReviewerVisualContract({ prompt: visual.replace("Allowed write paths: none", "Allowed write paths: design-previews/x") }),
    /Allowed write paths: none/i,
  )
  assert.throws(
    () => validateReviewerVisualContract({ prompt: "Objective: Review.\nScope: src\nMode: visual-fidelity\nAllowed write paths: none\nEvidence: artifact v3 plus integration diff baseline plus design-previews/a-desktop-1280x800.png desktop only." }),
    /TWO|two PNG|desktop.*mobile|mobile/i,
  )
  const codeReview = "Objective: inspect\nScope: src\nEvidence: baseline and diff"
  assert.doesNotThrow(() => validateReadTaskContract("reviewer", { prompt: codeReview }))
})

test("reviewer visual repairs validate the visual marker when declared", async () => {
  assert.doesNotThrow(() => validateReviewerVisualContract({
    task_id: "ses_existing",
    prompt: "Mode: visual-fidelity\nAllowed write paths: none\nFailure: render blocked\nEvidence: approved artifact v3 plus integration diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.",
  }))
  assert.throws(
    () => validateReviewerVisualContract({
      task_id: "ses_existing",
      prompt: "Mode: visual-fidelity\nAllowed write paths: design-previews/x\nFailure: render blocked\nEvidence: approved artifact v3 plus diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.",
    }),
    /Allowed write paths: none/i,
  )
  assert.throws(
    () => validateReviewerVisualContract({
      task_id: "ses_existing",
      prompt: "Mode: review\nFailure: render blocked\nEvidence: approved artifact v3 plus diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.",
    }),
    /must not declare `Mode:`|visual-fidelity/i,
  )
})

test("ordinary reviewer rejects any stray/malformed/duplicate Mode line fail-closed", () => {
  const base = "Objective: inspect\nScope: src\nEvidence: baseline and diff"
  const capture = (prompt) => {
    try { validateReadTaskContract("reviewer", { prompt }) } catch (error) { return String(error) }
    assert.fail(`expected ordinary reviewer rejection for: ${prompt}`)
  }
  for (const prompt of [
    `${base}\nMode: visual_fidelity`,
    `${base}\nMode: review`,
    `${base}\nMode: visual-fidelity`,
    `${base}\nMode: visual-fidelity\nMode: visual-fidelity`,
    `${base}\nMode: review\nMode: visual_fidelity`,
  ]) {
    const message = capture(prompt)
    assert.match(message, /must not declare `Mode:`|visual-fidelity/i)
    assert.match(message, /Mode: visual-fidelity/)
    assert.match(message, /Allowed write paths: none/)
    assert.match(message, /approved artifact\/version/i)
    assert.match(message, /diff/i)
    assert.match(message, /TWO.*PNG|two PNG/i)
  }
  assert.throws(
    () => validateReviewerVisualContract({ prompt: `${base}\nMode: review\nAllowed write paths: none\nEvidence: approved artifact v3 plus integration diff baseline plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.` }),
    /visual-fidelity/i,
  )
  assert.throws(
    () => validateReviewerVisualContract({ prompt: "Objective: Review.\nScope: src\nMode: visual-fidelity\nMode: visual-fidelity\nAllowed write paths: none\nEvidence: approved artifact v3 plus integration diff baseline plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile." }),
    /single|duplicate|ambiguous|multiple/i,
  )
  assert.doesNotThrow(() => validateReadTaskContract("reviewer", { prompt: base }))
  assert.doesNotThrow(() => validateReadTaskContract("reviewer", { prompt: "Objective: critique plan\nScope: plan\nEvidence: agreed requirement in visual mode prose without a formal marker" }))
  const visual = "Objective: Review integrated checkout.\nScope: src/checkout, integrated diff vs approved artifact.\nMode: visual-fidelity\nAllowed write paths: none\nEvidence: approved artifact v3 plus integration diff baseline plus design-previews/checkout-desktop-1280x800.png desktop and design-previews/checkout-mobile-390x844.png mobile."
  assert.equal(isReviewerVisualPrompt(visual), true)
  assert.doesNotThrow(() => validateReviewerVisualContract({ prompt: visual }))
  assert.doesNotThrow(() => validateReviewerVisualContract({
    task_id: "ses_existing",
    prompt: "Mode: visual-fidelity\nAllowed write paths: none\nFailure: render blocked\nEvidence: approved artifact v3 plus integration diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.",
  }))
})

test("design-critic requires artifact/version plus actual PNG capture evidence", () => {
  const valid = "Objective: Critique the empty state.\nScope: design-previews/empty, desktop/mobile viewports, no fixes.\nEvidence: artifact v3 brief v2 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile viewports inspected."
  assert.doesNotThrow(() => validateDesignCriticContract({ prompt: valid }))
  assert.throws(() => validateDesignCriticContract({ prompt: "Objective: Critique.\nScope: previews" }), /Evidence/)
  assert.throws(
    () => validateDesignCriticContract({ prompt: "Objective: Critique.\nScope: previews\nEvidence: artifact v3 brief v2, no captures yet" }),
    /PNG|viewport|capture/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: "Objective: Critique.\nScope: previews\nEvidence: placeholder" }),
    /PNG|viewport|capture|placeholder/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${valid}\n${"x".repeat(12 * 1024)}` }),
    /12 KiB/i,
  )
})

test("design-critic rejects fake, absolute, traversal, single, and multiline Evidence", () => {
  const base = "Objective: Critique the empty state.\nScope: design-previews/empty, desktop/mobile viewports, no fixes."
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus fake.png desktop` }),
    /workspace-relative|two PNG|desktop.*mobile|claims/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus /tmp/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile` }),
    /absolute|workspace-relative/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus ../outside-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile` }),
    /traversal|workspace-relative/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus design-previews/empty-desktop-1280x800.png desktop viewport inspected.` }),
    /two PNG|desktop.*mobile|mobile/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus design-previews/a-desktop-1280x800.png and design-previews/b-desktop-1280x800.png desktop viewports` }),
    /mobile/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ prompt: `${base}\nEvidence: artifact v3 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile\nEvidence: extra line` }),
    /single-line|ambiguous|multiple/i,
  )
})

test("design-critic Evidence paths are claims, not proof of file existence or approval", () => {
  assert.match(contractHint("design-critic", false), /claims.*not proof|not proof/i);
})

test("design-critic repair resumes with failure plus PNG evidence", () => {
  assert.doesNotThrow(() => validateDesignCriticContract({
    task_id: "ses_existing",
    prompt: "Failure: render blocked\nEvidence: artifact v3 plus design-previews/empty-desktop-1280x800.png and design-previews/empty-mobile-390x844.png desktop/mobile viewports inspected.",
  }))
  assert.throws(
    () => validateDesignCriticContract({ task_id: "ses_existing", prompt: "Please revise." }),
    /repair requests require/i,
  )
  assert.throws(
    () => validateDesignCriticContract({ task_id: "ses_existing", prompt: "Failure: blocked\nEvidence: placeholder" }),
    /PNG|viewport|capture|placeholder/i,
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

  const visualHint = contractHint("reviewer", false)
  for (const label of ["Objective:", "Scope:", "Evidence:"]) {
    assert.match(visualHint, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
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

test("every read-role and reviewer-visual rejection appends its template once", () => {
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

  const visualError = capture(() => validateReviewerVisualContract({ prompt: "Objective: Review." }))
  assert.match(String(visualError), /Scope:/)
  assert.match(String(visualError), /Evidence:/)

  const visualRepairError = capture(() => validateReviewerVisualContract({ task_id: "ses_existing", prompt: "Please revise." }))
  assert.match(String(visualRepairError), /task_id/)
  assert.match(String(visualRepairError), /Failure:/)
  assert.match(String(visualRepairError), /Evidence:/)
})

test("reviewer visual-fidelity rejects duplicate Evidence or Allowed write paths even when first is valid", () => {
  const visual = "Objective: Review integrated checkout.\nScope: src/checkout, integrated diff vs approved artifact.\nMode: visual-fidelity\nAllowed write paths: none\nEvidence: approved artifact v3 plus integration diff baseline plus design-previews/checkout-desktop-1280x800.png desktop and design-previews/checkout-mobile-390x844.png mobile."
  assert.doesNotThrow(() => validateReviewerVisualContract({ prompt: visual }))
  const capture = (prompt, repair = false) => {
    try {
      if (repair) validateReviewerVisualContract({ task_id: "ses_existing", prompt })
      else validateReviewerVisualContract({ prompt })
    } catch (error) { return String(error) }
    assert.fail(`expected visual duplicate rejection for: ${prompt}`)
  }
  for (const prompt of [
    `${visual}\nEvidence: contradictory second evidence without png`,
    `${visual}\nAllowed write paths: src/evil`,
    `${visual}\nEvidence:\nAllowed write paths:`,
  ]) {
    const message = capture(prompt)
    assert.match(message, /single|duplicate|ambiguous|multiple|empty|nonempty|required/i)
    assert.match(message, /Mode: visual-fidelity/)
    assert.match(message, /Allowed write paths: none/)
    assert.match(message, /approved artifact\/version/i)
    assert.match(message, /TWO.*PNG|two PNG/i)
  }
  for (const prompt of [
    "Mode: visual-fidelity\nAllowed write paths: none\nFailure: render blocked\nEvidence: approved artifact v3 plus integration diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.\nEvidence: contradictory second line",
    "Mode: visual-fidelity\nAllowed write paths: none\nAllowed write paths: src/evil\nFailure: render blocked\nEvidence: approved artifact v3 plus diff plus design-previews/a-desktop-1280x800.png desktop and design-previews/a-mobile-390x844.png mobile.",
  ]) {
    const message = capture(prompt, true)
    assert.match(message, /single|duplicate|ambiguous|multiple|empty|nonempty|required/i)
  }
  assert.throws(
    () => validateReviewerVisualContract({ prompt: visual.replace("Evidence: approved artifact v3 plus integration diff baseline plus design-previews/checkout-desktop-1280x800.png desktop and design-previews/checkout-mobile-390x844.png mobile.", "Evidence:") }),
    /Evidence/i,
  )
  assert.throws(
    () => validateReviewerVisualContract({ prompt: visual.replace("Allowed write paths: none", "Allowed write paths:") }),
    /Allowed write paths/i,
  )
  assert.doesNotThrow(() => validateReadTaskContract("reviewer", { prompt: "Objective: critique plan\nScope: plan\nEvidence: agreed requirement in visual mode prose without a formal marker\nThe evidence discussed above stays in narrative prose and allowed write paths are described without labels." }))
})
