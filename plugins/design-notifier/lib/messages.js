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
  lines.push(run.status === "succeeded"
    ? "Product: verification required — execution and artifact validation are not product completion. An invalid entry verdict alone is not proof of product failure."
    : "Product: blocked or pending — inspect execution status and the concrete cause before continuing.");
  lines.push("Design quality: not assessed by this notification — neither artifact validation nor a completed run is a quality pass.");
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
  if (run?.strategyTask && run.strategyTask.terminal !== true) {
    lines.push("Strategy: intermediate stage — the task continues in a follow-up run; this is not the final completion.");
  }
  return lines;
}

const VERIFY_STEPS = [
  "1. Verify with OpenDesign tools before reporting: call get_run(runId) for the authoritative previewUrl/studioUrl and the inner agent's final message (agentMessage). Terminal status alone is execution-only.",
  "2. Resolve the original task and actual output first. If the deliverable is invalid or the run failed: do not claim a design deliverable merely from the status. Explain the concrete reason, relay a genuine question from agentMessage if present, and do not regenerate, replay or cancel-retry the run blindly. Successful entry_not_touched/no_artifact is not automatically product/task failure or success: source-direct work requires the actual source diff, build and changed-flow browser verification; a report-only result is not verified UI output. Missing required output remains unfinished. Do not blindly regenerate to change the entry verdict. For an intermediate strategy stage, follow the existing chain; do not start another design run just because this stage finished.",
  "3. For any verified UI output, regardless of the artifact verdict, run the design-quality loop: the design workspace owns UI analysis, source/style edits, rendered design review and refinement, including small CSS or other visual fixes. Write observable acceptance criteria first (what must be visible on the first screen, the primary action, the mobile scroll depth, and what counts as failure); avoid vague adjectives. Verify input access (references, assets, actual source) before commissioning; if an input is unreadable, do not commission — block and report the gap. Commission a design review run as a required stage, using a review skill distinct from the generator rather than the generator's own approval, and feed it the actual rendered states (the target viewports and empty/error/loading states) plus the source, references and criteria; confirm the review actually read those inputs. Require the review output as a concrete defect list: what is wrong, which screen/state, the user impact and the desired result, tracked fixed/open across rounds. Select the task-appropriate OpenDesign skill per stage and record it. OpenCode owns task contracts, coordination, functional verification and Git, not substitute visual fixes. Check the review's criterion/defect -> revision -> render evidence; do not infer a quality pass from tests or artifact validation. Commission concrete refinements within the authorized scope until the bar is met (no fixed round cap); no measurable improvement means quality unmet, with remaining defects and next options reported. Direct UI edits stay provisional until verified. Then default to finishing the job and report the real product preview. Stop and ask for direction only when the work introduces an unapproved new visual direction, is a client-facing deliverable, or goes beyond authorized scope — or when the user asked to review the direction first.",
  "4. Diagnose before redesigning, and settle an uncertain direction with options. For an existing screen or a vague dissatisfaction report, commission a read-only design audit first — a review skill on the actual current screens at the relevant viewports/states — and use its concrete defect list as the redesign's problem statement; the user should not have to enumerate the problems. When the direction is new or ambiguous, commission a lightweight direction options run (2-3 distinct direction boards, each with a rendered sample of the critical screen area) and let the user pick before full implementation; skip options when the approved direction already exists, and continue non-dependent work while the choice is pending.",
  "5. If this session is in Plan mode, analyze and report only; do not implement.",
  "6. Follow the existing task ledger and review gates: for an internal-tool visual-system pass keeping the existing brand, verify one representative screen and present definition, scope and actual result as a single review. Obtain user approval of that result before wider rollout; then use per-stage checks without per-screen approvals. This representative-result gate is distinct from new-direction/client/out-of-scope/review-first pre-approval.",
  "7. Respect explicit session pauses. Before continuing goal work, check the actual goal state; a paused, cancelled or closed goal cannot continue. Do not create or resume a goal because this notification arrived. Ordinary authorized work without a goal is separate from goal continuation; a notification never grants new scope or delivery permission.",
  "8. Report to the user in their language, keeping internal runtime identifiers out of product copy except the run reference needed for traceability.",
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
      productVerification: run.status === "succeeded" ? "required" : "blocked",
      designQuality: "not_assessed",
      deliverableValid: run.deliverableValid ?? null,
      deliverableValidation: run.deliverableValidation ?? null,
      requestId: requestId ?? null,
      strategyTerminal: run?.strategyTask ? run.strategyTask.terminal === true : null,
      strategyNextRunId: typeof run?.strategyTask?.nextRunId === "string" && run.strategyTask.nextRunId ? run.strategyTask.nextRunId : null,
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
    strategyTerminal: run.strategyTask ? run.strategyTask.terminal === true : null,
    strategyNextRunId: typeof run.strategyTask?.nextRunId === "string" && run.strategyTask.nextRunId ? run.strategyTask.nextRunId : null,
  };
}
