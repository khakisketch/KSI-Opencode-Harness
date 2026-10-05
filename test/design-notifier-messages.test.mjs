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
