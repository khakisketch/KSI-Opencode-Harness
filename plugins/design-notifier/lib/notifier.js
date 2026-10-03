// Core notifier logic. All side effects (state store, daemon client, session
// delivery, clock, logging) are injected so the same module runs inside the
// OpenCode plugin and under node:test with fakes.
//
// Lifecycle:
//   execute.before(opendesign_start_run) → record {requestId, sessionID}
//   execute.after(opendesign_start_run)  → attach {runId} (or leave for recovery)
//   poll tick                            → terminal run ⇒ one session delivery
//
// Policies:
//   paused          → admit the notification with resume:false (no auto wake)
//   active          → queue delivery with resume:true (do not interrupt work)
//   session missing → orphaned; never deliver elsewhere or spawn an agent
//   invalid output  → message instructs verification, never claims success
//   restart         → state is re-read from disk; delivered runs are not resent

import { buildDelivery, isTerminalStatus, summarizeRun } from "./messages.js";
import { reapBindings } from "./state.js";

const REQUEST_KEY_PREFIX = "req:";
const RUN_KEY_PREFIX = "run:";
const RECOVERY_MIN_AGE_MS = 10 * 1000;
const RECOVERY_RETRY_MS = 5 * 60 * 1000;
const RECOVERY_GIVE_UP_MS = 24 * 60 * 60 * 1000;
const DELIVERY_BASE_BACKOFF_MS = 15 * 1000;
const DELIVERY_MAX_BACKOFF_MS = 15 * 60 * 1000;

function describeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

function isSessionMissingError(error) {
  const status = error?.status ?? error?.data?.status ?? error?.response?.status ?? error?.cause?.status;
  if (status === 404) return true;
  const text = String(error?.message ?? error ?? "");
  return /session/i.test(text) && /(not.?found|404|missing|deleted)/i.test(text);
}

function isStartRunTool(name) {
  if (typeof name !== "string" || !name) return false;
  if (!name.toLowerCase().includes("opendesign")) return false;
  return /(^|[_.])start_run$/i.test(name);
}

// The start_run MCP result carries the created run record; be defensive about
// wrapping (content text vs structured output) and prefer a candidate whose
// requestId matches the recorded request.
export function extractRunId(result, requestId, isValidRunId) {
  const valid = typeof isValidRunId === "function" ? isValidRunId : (value) => typeof value === "string" && value.length >= 8;
  const objects = [];
  const texts = [];
  const content = result?.content;
  if (typeof content === "string") texts.push(content);
  else if (Array.isArray(content)) {
    for (const part of content) {
      if (part && part.type === "text" && typeof part.text === "string") texts.push(part.text);
    }
  }
  if (result && typeof result.output === "object" && result.output) objects.push(result.output);
  for (const text of texts) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") objects.push(parsed);
    } catch {}
  }

  const matchesRequest = (object) =>
    typeof requestId === "string" &&
    requestId !== "" &&
    (object.requestId === requestId || object.clientRequestId === requestId);

  for (const object of objects) {
    if (typeof object.runId === "string" && valid(object.runId)) {
      if (matchesRequest(object) || !requestId) return object.runId;
    }
  }
  for (const object of objects) {
    if (typeof object.id === "string" && object.id !== object.projectId && valid(object.id) && matchesRequest(object)) {
      return object.id;
    }
  }
  for (const object of objects) {
    if (typeof object.runId === "string" && valid(object.runId)) return object.runId;
  }
  for (const object of objects) {
    if (typeof object.id === "string" && object.id !== object.projectId && valid(object.id)) return object.id;
  }
  // Regex fallback: only when a single run-id-shaped token exists in the text.
  const found = new Set();
  for (const text of texts) {
    for (const match of text.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9A-HJKMNP-TV-Z]{26}/g) ?? []) {
      if (valid(match)) found.add(match);
    }
  }
  return found.size === 1 ? [...found][0] : null;
}

export function createNotifier({
  store,
  daemon,
  deliver,
  pollMs = 60_000,
  clock = () => Date.now(),
  log = () => {},
  quickPollMs = 4_000,
  initialDelayMs = 1_500,
} = {}) {
  const sightings = new Map();
  let running = false;
  let stopped = true;
  let intervalTimer = null;
  let startupTimer = null;
  let kickTimer = null;

  const requestKey = (requestId) => `${REQUEST_KEY_PREFIX}${requestId}`;
  const runKey = (runId, sessionID) => `${RUN_KEY_PREFIX}${runId}@${sessionID}`;

  function recordSighting(tool) {
    const entry = sightings.get(tool);
    sightings.set(tool, { count: (entry?.count ?? 0) + 1, lastAt: clock() });
    if (!entry) log("tool-sighting", { tool });
  }

  async function patch(key, fields) {
    await store.mutate((bindings) => {
      if (bindings[key]) bindings[key] = { ...bindings[key], ...fields };
    });
  }

  async function handleToolBefore(event) {
    if (!isStartRunTool(event?.tool)) return;
    recordSighting(event.tool);
    const input = event.input && typeof event.input === "object" ? event.input : {};
    const requestId = typeof input.requestId === "string" && input.requestId ? input.requestId : null;
    if (!requestId) return;
    const now = clock();
    await store.mutate((bindings) => {
      const key = requestKey(requestId);
      const existing = bindings[key];
      if (existing && (existing.state === "tracking" || existing.state === "delivered")) return;
      bindings[key] = {
        ...(existing ?? {}),
        key,
        kind: "request",
        requestId,
        projectId: typeof input.project === "string" && input.project ? input.project : existing?.projectId ?? null,
        sessionID: event.sessionID ?? existing?.sessionID ?? null,
        agent: event.agent ?? existing?.agent ?? null,
        toolCallId: event.id ?? existing?.toolCallId ?? null,
        source: existing?.source ?? "hook",
        state: existing?.runId ? "tracking" : "requested",
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
    });
    log("request-recorded", { requestId, sessionID: event.sessionID ?? null });
  }

  async function attachRun({ runId, requestId, sessionID, agent, projectId, source = "hook" }) {
    if (!daemon.isValidRunId(runId)) return false;
    const now = clock();
    let created = false;
    await store.mutate((bindings) => {
      const reqKey = requestId ? requestKey(requestId) : null;
      const previous = reqKey ? bindings[reqKey] : null;
      if (reqKey && previous) delete bindings[reqKey];
      const targetKey = runKey(runId, sessionID ?? previous?.sessionID ?? "unknown");
      const existing = bindings[targetKey];
      if (existing && existing.state === "delivered") return;
      bindings[targetKey] = {
        ...(existing ?? {}),
        key: targetKey,
        kind: "run",
        runId,
        requestId: requestId ?? existing?.requestId ?? null,
        projectId: projectId ?? previous?.projectId ?? existing?.projectId ?? null,
        sessionID: sessionID ?? previous?.sessionID ?? existing?.sessionID ?? null,
        agent: agent ?? previous?.agent ?? existing?.agent ?? null,
        toolCallId: previous?.toolCallId ?? existing?.toolCallId ?? null,
        source: existing?.source ?? previous?.source ?? source,
        state: "tracking",
        createdAt: existing?.createdAt ?? previous?.createdAt ?? now,
        updatedAt: now,
      };
      created = !existing;
    });
    if (created) log("run-attached", { runId, requestId: requestId ?? null, sessionID: sessionID ?? null });
    return true;
  }

  async function handleToolAfter(event) {
    if (!isStartRunTool(event?.tool)) return;
    recordSighting(event.tool);
    const input = event.input && typeof event.input === "object" ? event.input : {};
    const requestId = typeof input.requestId === "string" && input.requestId ? input.requestId : null;
    if (event.status === "completed") {
      const runId = extractRunId(event.result, requestId, daemon.isValidRunId);
      if (runId) {
        await attachRun({
          runId,
          requestId,
          sessionID: event.sessionID,
          agent: event.agent,
          projectId: typeof input.project === "string" && input.project ? input.project : null,
        });
      } else if (requestId) {
        await patch(requestKey(requestId), {
          lastError: "run id not found in start_run result; will reconcile by request id",
          updatedAt: clock(),
        });
        log("run-id-missing", { requestId });
      }
    } else if (requestId) {
      await patch(requestKey(requestId), {
        lastError: `start_run failed: ${describeError(event.error)}`,
        updatedAt: clock(),
      });
      log("start-failed", { requestId });
    }
    kick();
  }

  async function watchRun({ runId, sessionID, agent }) {
    if (!daemon.isValidRunId(runId)) throw new Error(`invalid run id: ${String(runId).slice(0, 80)}`);
    if (typeof sessionID !== "string" || !sessionID) throw new Error("watch requires a session");
    const run = await daemon.getRun(runId);
    const key = runKey(runId, sessionID);
    const now = clock();
    let alreadyDelivered = false;
    await store.mutate((bindings) => {
      for (const record of Object.values(bindings)) {
        if (record && record.runId === runId && record.sessionID === sessionID && record.state === "delivered") {
          alreadyDelivered = true;
          break;
        }
      }
      const previous = bindings[key];
      bindings[key] = {
        ...(previous ?? {}),
        key,
        kind: "run",
        runId,
        sessionID,
        projectId: previous?.projectId ?? run.projectId ?? null,
        requestId: previous?.requestId ?? (typeof run.clientRequestId === "string" ? run.clientRequestId : null),
        agent: agent ?? previous?.agent ?? null,
        source: previous?.source ?? "manual",
        state: alreadyDelivered || previous?.state === "delivered" ? "delivered" : "tracking",
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
    });
    log("manual-watch", { runId, sessionID, alreadyDelivered });
    kick();
    return { runId, status: run.status ?? null, alreadyDelivered };
  }

  async function attemptDelivery(binding, run, paused) {
    const current = (await store.get(binding.key)) ?? binding;
    if (current.state !== "tracking") return;
    const now = clock();
    if (current.deliveryNextAttemptAt && now < current.deliveryNextAttemptAt) return;
    const message = buildDelivery({
      run,
      sessionID: current.sessionID,
      requestId: current.requestId,
      source: current.source,
      paused,
    });
    try {
      await deliver({ sessionID: current.sessionID, message });
      await patch(current.key, {
        state: "delivered",
        deliveredAt: now,
        delivery: { messageId: message.id, resume: message.resume, classification: message.classification },
        lastStatus: summarizeRun(run),
        lastError: null,
        updatedAt: now,
      });
      log("delivered", {
        runId: current.runId,
        sessionID: current.sessionID,
        messageId: message.id,
        resume: message.resume,
        classification: message.classification,
      });
    } catch (error) {
      if (isSessionMissingError(error)) {
        await patch(current.key, {
          state: "orphaned",
          lastError: "target session not found; not delivered elsewhere",
          updatedAt: now,
        });
        log("orphaned", { runId: current.runId, sessionID: current.sessionID });
        return;
      }
      const attempts = (current.deliveryAttempts ?? 0) + 1;
      const backoff = Math.min(DELIVERY_BASE_BACKOFF_MS * 2 ** Math.min(attempts, 6), DELIVERY_MAX_BACKOFF_MS);
      await patch(current.key, {
        deliveryAttempts: attempts,
        deliveryNextAttemptAt: now + backoff,
        lastError: `delivery failed: ${describeError(error)}`,
        updatedAt: now,
      });
      log("delivery-error", { runId: current.runId, sessionID: current.sessionID, attempts, error: describeError(error) });
    }
  }

  async function progressRequested(binding) {
    const now = clock();
    if (!binding.requestId) {
      await patch(binding.key, { state: "unresolved", lastError: "no request id recorded", updatedAt: now });
      return;
    }
    const age = now - (binding.createdAt ?? now);
    if (age < RECOVERY_MIN_AGE_MS) return;
    if (now - (binding.lastRecoveryAttemptAt ?? 0) < RECOVERY_RETRY_MS) return;
    await patch(binding.key, { lastRecoveryAttemptAt: now });
    try {
      const run = await daemon.findByRequestId({ requestId: binding.requestId, projectId: binding.projectId ?? undefined });
      if (run) {
        await attachRun({
          runId: run.id,
          requestId: binding.requestId,
          sessionID: binding.sessionID,
          agent: binding.agent,
          projectId: run.projectId ?? binding.projectId ?? null,
          source: binding.source ?? "hook",
        });
        log("recovered-run", { requestId: binding.requestId, runId: run.id });
      } else if (age > RECOVERY_GIVE_UP_MS) {
        await patch(binding.key, {
          state: "unresolved",
          lastError: "no matching run found within 24h; no blind retry",
          updatedAt: clock(),
        });
      }
    } catch (error) {
      await patch(binding.key, { lastError: describeError(error), updatedAt: clock() });
    }
  }

  async function progressTracking(binding, paused) {
    let run;
    try {
      run = await daemon.getRun(binding.runId);
    } catch (error) {
      if (error?.status === 404) {
        await patch(binding.key, { state: "orphaned", lastError: "run not found on daemon", updatedAt: clock() });
        log("run-missing", { runId: binding.runId });
        return;
      }
      await patch(binding.key, { lastPollAt: clock(), lastError: describeError(error), updatedAt: clock() });
      return;
    }
    const now = clock();
    const snapshot = summarizeRun(run);
    if (!isTerminalStatus(run.status)) {
      await patch(binding.key, {
        lastPollAt: now,
        lastStatus: snapshot,
        lastError: null,
        updatedAt: now,
      });
      return;
    }
    await patch(binding.key, { lastPollAt: now, lastStatus: snapshot, lastError: null, updatedAt: now });
    await attemptDelivery(binding, run, paused);
  }

  async function tick({ reason = "interval" } = {}) {
    if (running) return;
    running = true;
    try {
      const paused = await store.isPaused().catch(() => false);
      const bindings = await store.load();
      for (const binding of Object.values(bindings)) {
        try {
          if (binding.state === "requested") await progressRequested(binding);
          else if (binding.state === "tracking") await progressTracking(binding, paused);
        } catch (error) {
          log("tick-error", { key: binding.key, reason, error: describeError(error) });
        }
      }
      await store.mutate((current) => {
        reapBindings(current, clock());
      });
    } finally {
      running = false;
    }
  }

  function kick() {
    if (stopped || kickTimer) return;
    kickTimer = setTimeout(() => {
      kickTimer = null;
      void tick({ reason: "kick" });
    }, quickPollMs);
    if (typeof kickTimer.unref === "function") kickTimer.unref();
  }

  function start() {
    stopped = false;
    startupTimer = setTimeout(() => {
      startupTimer = null;
      void tick({ reason: "startup" });
    }, initialDelayMs);
    if (typeof startupTimer.unref === "function") startupTimer.unref();
    intervalTimer = setInterval(() => void tick({ reason: "interval" }), pollMs);
    if (typeof intervalTimer.unref === "function") intervalTimer.unref();
    return () => {
      stopped = true;
      if (startupTimer) clearTimeout(startupTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      if (kickTimer) clearTimeout(kickTimer);
      startupTimer = null;
      intervalTimer = null;
      kickTimer = null;
    };
  }

  function compactBinding(binding) {
    return {
      key: binding.key,
      state: binding.state,
      source: binding.source ?? null,
      sessionID: binding.sessionID ?? null,
      runId: binding.runId ?? null,
      projectId: binding.projectId ?? null,
      status: binding.lastStatus?.status ?? null,
      deliverableValid: binding.lastStatus?.deliverableValid ?? null,
      deliveredAt: binding.deliveredAt ?? null,
      updatedAt: binding.updatedAt ?? null,
      lastError: binding.lastError ? String(binding.lastError).slice(0, 160) : null,
    };
  }

  async function runTool(input, toolContext = {}) {
    const action = input && typeof input === "object" ? input.action : undefined;
    const text = (value) => ({ content: [{ type: "text", text: value }] });
    if (action === "list") {
      const bindings = await store.load();
      const paused = await store.isPaused().catch(() => false);
      const rows = Object.values(bindings).map(compactBinding);
      return text(JSON.stringify({ paused, stateDir: store.dir, daemon: daemon.baseUrl, bindings: rows }, null, 2));
    }
    if (action === "pause" || action === "resume") {
      await store.setPaused(action === "pause");
      log(action === "pause" ? "paused" : "resumed", {});
      return text(
        action === "pause"
          ? "Automatic wake-up paused. New completions are admitted into the target session without auto execution until resume."
          : "Automatic wake-up resumed. Completions will queue a session turn again.",
      );
    }
    if (action === "watch") {
      const runId = input.runId;
      try {
        const info = await watchRun({ runId, sessionID: toolContext.sessionID ?? null, agent: toolContext.agent ?? null });
        return text(JSON.stringify(info));
      } catch (error) {
        return text(`watch failed: ${describeError(error)}`);
      }
    }
    return text(`unknown action: ${String(action)}`);
  }

  return {
    handleToolBefore,
    handleToolAfter,
    watchRun,
    tick,
    start,
    runTool,
    sightings: () => Object.fromEntries(sightings),
  };
}
