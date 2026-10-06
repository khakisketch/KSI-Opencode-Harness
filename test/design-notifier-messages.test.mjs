import test from "node:test"
import assert from "node:assert/strict"

import { buildDelivery, classifyRun, messageIdFor, summarizeRun } from "../plugins/design-notifier/lib/messages.js"

const RUN = "11111111-1111-4111-8111-111111111111"
const SESSION = "ses_test000000000000000000000"

const validRun = {
  id: RUN,
  projectId: "proj-a",
  status: "succeeded",
  deliverableValid: true,
  deliverableValidation: "valid",
  deliverableEntryFile: "index.html",
  artifactCount: 3,
  retryable: false,
  resumable: false,
}

test("classifyRun follows the daemon verdict, not just terminal status", () => {
  assert.equal(classifyRun(validRun), "valid")
  assert.equal(classifyRun({ ...validRun, deliverableValid: false, deliverableValidation: "entry_not_touched" }), "invalid")
  assert.equal(classifyRun({ ...validRun, status: "failed" }), "failed")
  assert.equal(classifyRun({ ...validRun, status: "canceled" }), "canceled")
  assert.equal(classifyRun({ ...validRun, status: "running" }), "pending")
})

test("message ids are deterministic per run/status/session and differ across sessions", () => {
  const one = messageIdFor({ runId: RUN, status: "succeeded", sessionID: SESSION })
  const again = messageIdFor({ runId: RUN, status: "succeeded", sessionID: SESSION })
  const other = messageIdFor({ runId: RUN, status: "succeeded", sessionID: "ses_other" })
  const otherStatus = messageIdFor({ runId: RUN, status: "failed", sessionID: SESSION })
  assert.match(one, /^msg_[0-9a-f]{32}$/)
  assert.equal(one, again)
  assert.notEqual(one, other)
  assert.notEqual(one, otherStatus)
})

test("an invalid deliverable is never reported as success", () => {
  const delivery = buildDelivery({
    run: { ...validRun, deliverableValid: false, deliverableValidation: "entry_not_touched" },
    sessionID: SESSION,
    requestId: "req-1",
    source: "hook",
  })
  assert.equal(delivery.classification, "invalid")
  assert.equal(delivery.delivery, "queue")
  assert.equal(delivery.resume, true)
  assert.match(delivery.text, /Deliverable: invalid \(entry_not_touched\)/)
  assert.match(delivery.text, /do not claim a design deliverable/)
  assert.match(delivery.text, /do not regenerate, replay or cancel-retry/)
  assert.match(delivery.text, /not a user message/)
  assert.equal(delivery.metadata["ksi.design-notifier"].runId, RUN)
  assert.equal(delivery.metadata["ksi.design-notifier"].classification, "invalid")
})

test("a valid deliverable defaults to finishing within authorized scope with a gate for new direction", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION, requestId: "req-1", source: "hook" })
  assert.equal(delivery.classification, "valid")
  assert.match(delivery.text, /Deliverable: valid/)
  assert.match(delivery.text, /default to finishing the job/)
  assert.match(delivery.text, /Stop and ask for direction only when/)
  assert.match(delivery.text, /new visual direction/)
  assert.match(delivery.text, /client-facing deliverable/)
  assert.match(delivery.text, /design-quality loop/)
  assert.match(delivery.text, /task-appropriate OpenDesign skill/)
  assert.match(delivery.text, /no fixed round cap/)
  assert.match(delivery.text, /call get_run\(runId\)/)
})

test("paused mode admits the notification without auto wake", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION, paused: true })
  assert.equal(delivery.resume, false)
  assert.equal(delivery.delivery, "queue")
})

test("failure details and recharge action are surfaced verbatim", () => {
  const delivery = buildDelivery({
    run: {
      ...validRun,
      status: "failed",
      deliverableValid: false,
      deliverableValidation: "no_artifact",
      errorCode: "AMR_INSUFFICIENT_BALANCE",
      failureCategory: "billing",
      failureAction: "recharge",
      retryable: false,
      resumable: true,
    },
    sessionID: SESSION,
  })
  assert.equal(delivery.classification, "failed")
  assert.match(delivery.text, /error=AMR_INSUFFICIENT_BALANCE/)
  assert.match(delivery.text, /category=billing/)
  assert.match(delivery.text, /action=recharge/)
  assert.match(delivery.text, /resumable=true/)
})

test("summarizeRun keeps only whitelisted fields", () => {
  const summary = summarizeRun({ ...validRun, prompt: "secret prompt text", eventsLogPath: "/tmp/events.log" })
  assert.equal(summary.status, "succeeded")
  assert.equal(summary.deliverableValid, true)
  assert.equal(summary.deliverableEntryFile, "index.html")
  assert.ok(!("prompt" in summary))
  assert.ok(!("eventsLogPath" in summary))
})

// Catches conflating an entry-centric artifact verdict with product completion.
test("successful execution with untouched entry requires product verification, not an automatic failure or success", () => {
  const delivery = buildDelivery({
    run: { ...validRun, deliverableValid: false, deliverableValidation: "entry_not_touched" },
    sessionID: SESSION,
  })
  assert.equal(delivery.classification, "invalid", "preserve the daemon artifact verdict")
  assert.equal(delivery.metadata["ksi.design-notifier"].productVerification, "required")
  assert.match(delivery.text, /actual source diff.*build.*changed.flow/i)
  assert.match(delivery.text, /not.*(?:product|task) failure/i)
  assert.match(delivery.text, /do not.*(?:automatically|blindly).*regenerate/i)
})

test("failed execution is not upgraded to a source verification success exception", () => {
  const delivery = buildDelivery({ run: { ...validRun, status: "failed", deliverableValidation: "entry_not_touched" }, sessionID: SESSION })
  assert.equal(delivery.classification, "failed")
  assert.equal(delivery.metadata["ksi.design-notifier"].productVerification, "blocked")
})

test("even valid artifacts require verification and respect the representative review and pause boundaries", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.equal(delivery.metadata["ksi.design-notifier"].productVerification, "required")
  assert.match(delivery.text, /representative screen.*single review/i)
  assert.match(delivery.text, /approval.*before.*rollout/i)
  assert.match(delivery.text, /goal.*pause|paused.*goal/i)
  assert.match(delivery.text, /do not.*(?:create|resume).*goal/i)
})

test("an intermediate strategy stage is marked non-final with chain metadata", () => {
  const delivery = buildDelivery({
    run: { ...validRun, strategyTask: { terminal: false, nextRunId: "22222222-2222-4222-8222-222222222222" } },
    sessionID: SESSION,
  })
  assert.match(delivery.text, /intermediate stage/)
  assert.match(delivery.text, /not the final completion/)
  const meta = delivery.metadata["ksi.design-notifier"]
  assert.equal(meta.strategyTerminal, false)
  assert.equal(meta.strategyNextRunId, "22222222-2222-4222-8222-222222222222")
})

test("a terminal strategy stage carries no intermediate note", () => {
  const delivery = buildDelivery({ run: { ...validRun, strategyTask: { terminal: true } }, sessionID: SESSION })
  assert.doesNotMatch(delivery.text, /intermediate stage/)
  assert.equal(delivery.metadata["ksi.design-notifier"].strategyTerminal, true)
})

// These exercise the emitted notification contract, not agent obedience or taste.
for (const [verdict, valid] of [["valid", true], ["entry_not_touched", false], ["no_artifact", false]]) {
  test(`UI review advice is output-contract-based even with ${verdict}`, () => {
    const delivery = buildDelivery({
      run: { ...validRun, deliverableValid: valid, deliverableValidation: verdict },
      sessionID: SESSION,
    })
    assert.equal(delivery.classification, valid ? "valid" : "invalid")
    assert.equal(delivery.metadata["ksi.design-notifier"].designQuality, "not_assessed")
    assert.match(delivery.text, /any verified UI output.*regardless of.*artifact verdict/i)
    assert.doesNotMatch(delivery.text, /If the deliverable is valid: run the design-quality loop/)
    assert.match(delivery.text, /design workspace owns.*rendered.*review.*refinement/i)
    assert.match(delivery.text, /small CSS.*visual.*fixes/i)
    assert.match(delivery.text, /OpenCode owns.*functional.*verification.*Git/i)
  })
}

test("a report-only or intermediate stage does not authorize a UI refinement run", () => {
  const delivery = buildDelivery({
    run: { ...validRun, deliverableValid: false, deliverableValidation: "no_artifact", strategyTask: { terminal: false } },
    sessionID: SESSION,
  })
  assert.match(delivery.text, /report-only.*not.*UI output/i)
  assert.match(delivery.text, /intermediate.*follow.*chain.*do not.*start.*design run/i)
  assert.match(delivery.text, /notification.*(?:does not|never).*grant.*scope/i)
  assert.equal(delivery.metadata["ksi.design-notifier"].designQuality, "not_assessed")
})

test("stalled design refinement remains quality unmet rather than completed", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.match(delivery.text, /no measurable improvement.*quality unmet/i)
  assert.match(delivery.text, /criterion.*defect.*revision.*render evidence/i)
  assert.match(delivery.text, /not.*quality.*pass.*(?:tests|artifact)/i)
})

for (const status of ["failed", "canceled"]) {
  test(`${status} cannot be promoted to design quality success`, () => {
    const delivery = buildDelivery({ run: { ...validRun, status }, sessionID: SESSION })
    assert.equal(delivery.classification, status)
    assert.equal(delivery.metadata["ksi.design-notifier"].productVerification, "blocked")
    assert.equal(delivery.metadata["ksi.design-notifier"].designQuality, "not_assessed")
    assert.match(delivery.text, /do not regenerate, replay or cancel-retry/)
  })
}

// The emitted advice must pin the OD-usage loop: mandatory review run with real
// rendered inputs and a concrete fix list, not an optional self-check.
test("the design loop requires a review run fed with actual rendered states", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.match(delivery.text, /review run/i)
  assert.match(delivery.text, /review skill distinct from the generator/i)
  assert.match(delivery.text, /actual rendered states/i)
  assert.match(delivery.text, /viewport|390|768|1440/i)
  assert.match(delivery.text, /empty|error|loading/i)
  assert.match(delivery.text, /confirm the review (actually )?read/i)
  assert.match(delivery.text, /defect list|fix list/i)
  assert.match(delivery.text, /user impact/i)
  assert.match(delivery.text, /fixed.*open|open.*fixed/i)
})

test("the task contract requires observable acceptance criteria and input access", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.match(delivery.text, /observable/i)
  assert.match(delivery.text, /first screen|primary action/i)
  assert.match(delivery.text, /scroll depth/i)
  assert.match(delivery.text, /what counts as failure|failure definition|failed state/i)
  assert.match(delivery.text, /verify.*(input|reference|asset).*access/i)
  assert.match(delivery.text, /do not commission|block and report/i)
  assert.match(delivery.text, /record.*skill|skill.*record/i)
})

// OD-usage follow-on: diagnose existing screens before redesigning, and settle
// an uncertain direction with lightweight options instead of one full gamble.
test("an existing-screen redesign starts from a design audit, not a user defect list", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.match(delivery.text, /design audit/i)
  assert.match(delivery.text, /current screens/i)
  assert.match(delivery.text, /user should not have to enumerate/i)
  assert.match(delivery.text, /defect list.*redesign|redesign.*defect list/i)
})

test("an ambiguous or new direction gets lightweight options before full implementation", () => {
  const delivery = buildDelivery({ run: validRun, sessionID: SESSION })
  assert.match(delivery.text, /direction options/i)
  assert.match(delivery.text, /2-3|two or three/i)
  assert.match(delivery.text, /pick|choose/i)
  assert.match(delivery.text, /before full implementation/i)
  assert.match(delivery.text, /skip options/i)
})
