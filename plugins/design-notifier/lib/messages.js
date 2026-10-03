// Run classification and the notification message delivered into the
// originating OpenCode session.
//
// The message is deliberately advisory: it tells the receiving agent what
// happened, what to verify, and which decisions still belong to the user.
// It never claims a deliverable succeeded when the daemon verdict is invalid
// or missing, and it never instructs an automatic retry.

import { createHash } from "node:crypto";
import { TERMINAL_STATUSES } from "./daemon.js";

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

export function classifyRun(run) {
  const status = run?.status;
  if (status === "succeeded") {
    return run?.deliverableValid === true ? "valid" : "invalid";
  }
  if (status === "failed") return "failed";
  if (status === "canceled") return "canceled";
  return "pending";
}

export function messageIdFor({ runId, status, sessionID }) {
  const digest = createHash("sha256").update(`${runId}:${status}:${sessionID}`).digest("hex");
  return `msg_${digest.slice(0, 32)}`;
}

function short(value, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function buildLines(run) {
  const lines = [];
  lines.push(`Run: ${short(run.id)}  |  Project: ${short(run.projectId)}`);
  const verdict = run.deliverableValid === true ? "valid" : `invalid (${short(run.deliverableValidation, "unreported")})`;
  lines.push(`Status: ${short(run.status)}  |  Deliverable: ${verdict}`);
  const failure = [
    run.errorCode ? `error=${run.errorCode}` : null,
    run.failureCategory ? `category=${run.failureCategory}` : null,
    run.failureAction ? `action=${run.failureAction}` : null,
    run.error ? `message=${String(run.error).slice(0, 200)}` : null,
  ].filter(Boolean);
  if (failure.length) lines.push(`Failure: ${failure.join("  ")}`);
  const flags = [
    `retryable=${run.retryable === true}`,
    `resumable=${run.resumable === true}`,
    run.artifactCount !== undefined ? `artifacts=${run.artifactCount}` : null,
    run.deliverableEntryFile ? `entry=${run.deliverableEntryFile}` : null,
  ].filter(Boolean);
  lines.push(`Flags: ${flags.join("  ")}`);
  return lines;
}

const VERIFY_STEPS = [
  "1. Verify with OpenDesign tools before reporting: call get_run(runId) for the authoritative previewUrl/studioUrl and the inner agent's final message (agentMessage). Terminal status alone is execution-only.",
  "2. If the deliverable is invalid or the run failed: do not claim a design deliverable. Explain the concrete reason, relay a genuine question from agentMessage if present, and do not regenerate, replay or cancel-retry the run.",
  "3. If the deliverable is valid: summarize the output and preview link. Only continue into code integration for changes the user already approved; otherwise stop and ask for direction approval.",
  "4. If this session is in Plan mode, analyze and report only; do not implement.",
  "5. Report to the user in their language, keeping internal runtime identifiers out of product copy except the run reference needed for traceability.",
];

export function buildDelivery({ run, sessionID, requestId, source, paused = false }) {
  const classified = classifyRun(run);
  const status = short(run.status, "unknown");
  const header = "[ksi-design-notifier] OpenDesign run finished — automatic notification, not a user message.";
  const text = [
    header,
    "",
    ...buildLines(run),
    `Watch source: ${short(source, "hook")}  |  Request: ${short(requestId)}`,
    "",
    "Next steps for you (the receiving agent):",
    ...VERIFY_STEPS,
  ].join("\n");

  const metadata = {
    "ksi.design-notifier": {
      runId: run.id,
      projectId: run.projectId ?? null,
      status: run.status ?? null,
      classification: classified,
      deliverableValid: run.deliverableValid ?? null,
      deliverableValidation: run.deliverableValidation ?? null,
      requestId: requestId ?? null,
    },
  };

  return {
    id: messageIdFor({ runId: run.id, status: run.status ?? "unknown", sessionID }),
    text,
    description: `OpenDesign run ${String(run.id).slice(0, 8)} ${status}`,
    metadata,
    delivery: "queue",
    resume: !paused,
    classification: classified,
  };
}

// Compact, log-safe snapshot of a run (whitelisted fields only).
export function summarizeRun(run) {
  if (!run || typeof run !== "object") return null;
  return {
    status: run.status ?? null,
    deliverableValid: run.deliverableValid ?? null,
    deliverableValidation: run.deliverableValidation ?? null,
    deliverableEntryFile: run.deliverableEntryFile ?? null,
    failureCategory: run.failureCategory ?? null,
    failureAction: run.failureAction ?? null,
    errorCode: run.errorCode ?? null,
    retryable: run.retryable === true,
    resumable: run.resumable === true,
    artifactCount: run.artifactCount ?? null,
    terminalAt: run.terminalAt ?? null,
    updatedAt: run.updatedAt ?? null,
  };
}
