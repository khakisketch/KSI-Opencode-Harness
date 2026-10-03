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
