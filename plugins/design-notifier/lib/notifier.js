// Core notifier logic. All side effects (state store, daemon client, session
// delivery, clock, logging) are injected so the same module runs inside the
// OpenCode plugin and under node:test with fakes.
//
// Lifecycle:
//   execute.before(opendesign_start_run) → record {requestId, sessionID}
//   execute.after(opendesign_start_run)  → attach {runId} (or leave for recovery)
//   poll tick (leader only)              → session completion delivery
//
// Policies:
//   active          → delivery admitted with auto wake (resume:true, queue)
//   paused(session) → completion is stored in notifier state only; the session
//                     is not contacted. `resume` delivers held completions.
//   session missing → orphaned; never deliver elsewhere or spawn an agent
//   invalid output  → message instructs verification, never claims success
//   restart         → state is re-read from disk; delivered runs are not resent
//
// Delivery is performed by a single elected poller (a state-lock lease makes
// one plugin instance the poller; overlapping ticks during a slow-tick lease
// handover are possible and are fenced by the delivery claim). Every instance
// still captures its own sessions' start_run calls.

import { randomUUID } from "node:crypto";
import { buildDelivery, classifyRun, isTerminalStatus, summarizeRun } from "./messages.js";
import { reapBindings } from "./state.js";

const REQUEST_KEY_PREFIX = "req:";
const RUN_KEY_PREFIX = "run:";
const RECOVERY_MIN_AGE_MS = 10 * 1000;
const RECOVERY_RETRY_MS = 5 * 60 * 1000;
const RECOVERY_GIVE_UP_MS = 24 * 60 * 60 * 1000;
const DELIVERY_BASE_BACKOFF_MS = 15 * 1000;
const DELIVERY_MAX_BACKOFF_MS = 15 * 60 * 1000;
const CHAIN_START_GRACE_MS = 10 * 60 * 1000;

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

function isStartRunTool(name, prefix = "opendesign") {
  if (typeof name !== "string" || !name) return false;
  if (!name.toLowerCase().includes(prefix.toLowerCase())) return false;
  return /(^|[^a-z0-9])start_run$/i.test(name);
}

function looksLikeDesignTool(name, prefix = "opendesign") {
  return typeof name === "string" && name.toLowerCase().includes(prefix.toLowerCase());
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
  for (const key of ["structuredContent", "structuredOutput"]) {
    const value = result?.[key];
    if (value && typeof value === "object") objects.push(value);
  }
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
  toolNamePrefix = "opendesign",
  instanceId = randomUUID(),
  instanceLabel = null,
  renewEveryMs = Math.min(pollMs, 20_000),
  leaseTtlMs = Math.max(3 * Math.min(pollMs, 20_000), 60_000),
} = {}) {
  const sightingCounts = new Map();
  let running = false;
  let stopped = true;
  let leaderNow = false;
  let tickDue = false;
  let lastTickAt = 0;
  let startupTimer = null;
  let coordinationTimer = null;
  let kickTimer = null;

  const requestKey = (requestId) => `${REQUEST_KEY_PREFIX}${requestId}`;
  const runKey = (runId, sessionID) => `${RUN_KEY_PREFIX}${runId}@${sessionID}`;
  const shortId = (value) => String(value).slice(0, 8);

  function sightingsSnapshot() {
    return Object.fromEntries(sightingCounts);
  }

  function recordSighting(tool) {
    const entry = sightingCounts.get(tool);
    sightingCounts.set(tool, { count: (entry?.count ?? 0) + 1, lastAt: clock() });
    if (!entry) log("tool-sighting", { tool });
  }

  async function patch(key, fields) {
    await store.mutate((bindings) => {
      if (bindings[key]) bindings[key] = { ...bindings[key], ...fields };
    });
  }

  async function handleToolBefore(event) {
    try {
      await recordStartRunRequest(event);
    } catch (error) {
      // Hooks must not reject into the host tool pipeline; the after-hook can
      // still attach the run via its own session id.
      log("hook-error", { phase: "before", tool: event?.tool ?? null, error: describeError(error) });
    }
  }

  async function recordStartRunRequest(event) {
    const name = typeof event?.tool === "string" ? event.tool : "";
    if (looksLikeDesignTool(name, toolNamePrefix)) recordSighting(name);
    if (!isStartRunTool(name, toolNamePrefix)) return;
    const input = event.input && typeof event.input === "object" ? event.input : {};
    const requestId = typeof input.requestId === "string" && input.requestId ? input.requestId : null;
    if (!requestId) return;
    const now = clock();
    await store.mutate((bindings) => {
      const key = requestKey(requestId);
      const existing = bindings[key];
      if (existing && (existing.state === "tracking" || existing.state === "delivered" || existing.state === "held")) return;
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
    const previousSession = requestId ? (await store.get(requestKey(requestId)))?.sessionID ?? null : null;
    const resolvedSession = sessionID ?? previousSession ?? null;
    if (!resolvedSession) {
      if (requestId) {
        await patch(requestKey(requestId), {
          lastError: "run id resolved but no session id is available; cannot deliver",
          updatedAt: now,
        });
      }
      log("attach-missing-session", { runId, requestId: requestId ?? null });
      return false;
    }
    let created = false;
    await store.mutate((bindings) => {
      const reqKey = requestId ? requestKey(requestId) : null;
      const previous = reqKey ? bindings[reqKey] : null;
      if (reqKey && previous) delete bindings[reqKey];
      const targetKey = runKey(runId, resolvedSession);
      const existing = bindings[targetKey];
      if (existing && (existing.state === "delivered" || existing.state === "held")) return;
      bindings[targetKey] = {
        ...(existing ?? {}),
        key: targetKey,
        kind: "run",
        runId,
        requestId: requestId ?? existing?.requestId ?? null,
        projectId: projectId ?? previous?.projectId ?? existing?.projectId ?? null,
        sessionID: resolvedSession,
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
    try {
      await processStartRunResult(event);
      kick();
    } catch (error) {
      log("hook-error", { phase: "after", tool: event?.tool ?? null, error: describeError(error) });
    }
  }

  async function processStartRunResult(event) {
    const name = typeof event?.tool === "string" ? event.tool : "";
    if (looksLikeDesignTool(name, toolNamePrefix)) recordSighting(name);
    if (!isStartRunTool(name, toolNamePrefix)) return;
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
  }

  async function watchRun({ runId, sessionID, agent }) {
    if (!daemon.isValidRunId(runId)) throw new Error(`invalid run id: ${String(runId).slice(0, 80)}`);
    if (typeof sessionID !== "string" || !sessionID) throw new Error("watch requires a session");
    const run = await daemon.getRun(runId);
    const key = runKey(runId, sessionID);
    const now = clock();
    let resultState = null;
    await store.mutate((bindings) => {
      const existing = bindings[key];
      if (existing) {
        resultState = existing.state;
        if (existing.state === "tracking" || existing.state === "held") {
          bindings[key] = { ...existing, updatedAt: now };
          return true;
        }
        // Delivered or final: keep the record as-is.
        return false;
      }
      bindings[key] = {
        key,
        kind: "run",
        runId,
        sessionID,
        projectId: run.projectId ?? null,
        requestId: typeof run.clientRequestId === "string" ? run.clientRequestId : null,
        agent: agent ?? null,
        source: "manual",
        state: "tracking",
        createdAt: now,
        updatedAt: now,
      };
      resultState = "tracking";
      return true;
    });
    log("manual-watch", { runId, sessionID, state: resultState });
    if (resultState === "tracking" || resultState === "held") kick();
    return {
      runId,
      status: run.status ?? null,
      state: resultState,
      alreadyDelivered: resultState === "delivered",
    };
  }

  // Deliver a terminal run to its session, or store it as `held` while the
  // session's wake permission is paused. Delivery is claimed under the state
  // lock; the deterministic message id makes a re-send a session-level no-op.
  async function attemptDelivery(binding, run) {
    const current = (await store.get(binding.key)) ?? binding;
    if (current.state !== "tracking" && current.state !== "held") return;
    const now = clock();
    const paused = await store.isPausedFor(current.sessionID);
    if (paused) {
      if (current.state !== "held") {
        await patch(current.key, {
          state: "held",
          heldAt: now,
          lastStatus: summarizeRun(run),
          updatedAt: now,
        });
        log("held", {
          runId: current.runId,
          sessionID: current.sessionID,
          classification: classifyRun(run),
        });
      }
      return;
    }
    if (current.deliveryNextAttemptAt && now < current.deliveryNextAttemptAt) return;
    const claimToken = randomUUID();
    const claimed = await store.claimDelivery(current.key, { now, token: claimToken });
    if (!claimed) return; // another instance is delivering, or the state changed
    // Narrow the pause-vs-delivery window: a pause that landed while we were
    // claiming holds the completion instead of contacting the session. A pause
    // during the deliver() call itself still takes effect on the next tick.
    if (await store.isPausedFor(current.sessionID)) {
      await patch(current.key, {
        state: "held",
        heldAt: current.heldAt ?? now,
        lastStatus: summarizeRun(run),
        deliveryClaim: null,
        lastError: null,
        updatedAt: now,
      });
      log("held", {
        runId: current.runId,
        sessionID: current.sessionID,
        classification: classifyRun(run),
        afterClaim: true,
      });
      return;
    }
    const message = buildDelivery({
      run,
      sessionID: current.sessionID,
      requestId: current.requestId,
      source: current.source,
      paused: false,
    });
    try {
      await deliver({ sessionID: current.sessionID, message });
      await patch(current.key, {
        state: "delivered",
        deliveredAt: now,
        delivery: { messageId: message.id, resume: message.resume, classification: message.classification },
        lastStatus: summarizeRun(run),
        lastError: null,
        deliveryClaim: null,
        updatedAt: now,
      });
      log("delivered", {
        runId: current.runId,
        sessionID: current.sessionID,
        messageId: message.id,
        resume: message.resume,
        classification: message.classification,
        wasHeld: Boolean(current.heldAt),
      });
    } catch (error) {
      if (isSessionMissingError(error)) {
        await patch(current.key, {
          state: "orphaned",
          lastError: "target session not found; not delivered elsewhere",
          deliveryClaim: null,
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
        deliveryClaim: null,
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

  // Poll one watched (tracking) or stored (held) run.
  async function progressTracking(binding) {
    let run;
    try {
      run = await daemon.getRun(binding.runId);
    } catch (error) {
      if (error?.status === 404) {
        // A strategy chain may map the follow-up run before the daemon has
        // materialized it; keep polling within the grace window instead of
        // parking the chain as `missing`.
        if (binding.source === "strategy-chain" && clock() - (binding.createdAt ?? 0) < CHAIN_START_GRACE_MS) {
          await patch(binding.key, {
            lastPollAt: clock(),
            lastError: "follow-up run not visible yet; awaiting strategy chain",
            updatedAt: clock(),
          });
          return;
        }
        await patch(binding.key, {
          state: "missing",
          lastError: "run not found on daemon (kept for diagnosis; no delivery)",
          updatedAt: clock(),
        });
        log("run-missing", { runId: binding.runId });
        return;
      }
      await patch(binding.key, { lastPollAt: clock(), lastError: describeError(error), updatedAt: clock() });
      return;
    }
    const now = clock();
    const snapshot = summarizeRun(run);
    if (!isTerminalStatus(run.status)) {
      const fields = { lastPollAt: now, lastStatus: snapshot, lastError: null, updatedAt: now };
      // A held run that became active again (manual resume in OpenDesign)
      // goes back to tracking and will be delivered at its next terminal end.
      if (binding.state === "held") {
        fields.state = "tracking";
        fields.heldAt = null;
      }
      await patch(binding.key, fields);
      return;
    }
    await patch(binding.key, { lastPollAt: now, lastStatus: snapshot, lastError: null, updatedAt: now });
    await attemptDelivery(binding, run);
    await continueStrategyChain(binding, run);
  }

  // Follow a plan→execute style strategy chain: a terminal stage that maps a
  // follow-up run keeps the chain watched for the same session, so the final
  // stage still reaches it (the intermediate notification is worded as
  // non-final). Idempotent; existing records are never overwritten.
  async function continueStrategyChain(binding, run) {
    const nextRunId = run?.strategyTask?.nextRunId;
    if (run?.strategyTask?.terminal !== false || typeof nextRunId !== "string" || !nextRunId) return;
    if (!daemon.isValidRunId(nextRunId)) return;
    if (!binding.sessionID) return;
    const key = runKey(nextRunId, binding.sessionID);
    const now = clock();
    let created = false;
    await store.mutate((bindings) => {
      if (bindings[key]) return;
      bindings[key] = {
        key,
        kind: "run",
        runId: nextRunId,
        sessionID: binding.sessionID,
        projectId: run.projectId ?? binding.projectId ?? null,
        requestId: typeof run.clientRequestId === "string" ? run.clientRequestId : null,
        agent: binding.agent ?? null,
        source: "strategy-chain",
        state: "tracking",
        createdAt: now,
        updatedAt: now,
      };
      created = true;
    });
    if (created) log("strategy-next-run", { runId: binding.runId, nextRunId });
  }

  async function tick({ reason = "interval" } = {}) {
    if (running) return;
    running = true;
    try {
      const bindings = await store.load();
      for (const binding of Object.values(bindings)) {
        try {
          if (binding.state === "requested") await progressRequested(binding);
          else if (binding.state === "tracking" || binding.state === "held") await progressTracking(binding);
        } catch (error) {
          log("tick-error", { key: binding.key, reason, error: describeError(error) });
        }
      }
      // Skip the write when there is nothing to reap.
      await store.mutate((current) => reapBindings(current, clock()));
    } catch (error) {
      log("tick-fatal", { reason, error: describeError(error) });
    } finally {
      running = false;
    }
  }

  // One coordination beat: renew or acquire the poller lease, then tick when
  // this instance holds it and a tick is due. Followers only renew nothing and
  // stay cheap; they still capture bindings through the tool hooks.
  // Safe to call directly (tests) — timers are disposed by stop().
  async function coordination(reason) {
    let leader = false;
    try {
      leader = await store.tryAcquireLeadership(instanceId, { ttlMs: leaseTtlMs });
    } catch (error) {
      log("leadership-error", { error: describeError(error) });
      return;
    }
    if (leader && !leaderNow) {
      log("leader-claimed", { instanceId: shortId(instanceId), label: instanceLabel });
    }
    leaderNow = leader;
    if (!leader) return;
    const due = tickDue || reason === "startup" || clock() - lastTickAt >= pollMs;
    if (!due) return;
    tickDue = false;
    lastTickAt = clock();
    await tick({ reason });
  }

  function kick() {
    if (stopped || kickTimer) return;
    tickDue = true;
    kickTimer = setTimeout(() => {
      kickTimer = null;
      void coordination("kick");
    }, quickPollMs);
    if (typeof kickTimer.unref === "function") kickTimer.unref();
  }

  function start() {
    stopped = false;
    startupTimer = setTimeout(() => {
      startupTimer = null;
      void coordination("startup");
    }, initialDelayMs);
    if (typeof startupTimer.unref === "function") startupTimer.unref();
    coordinationTimer = setInterval(() => void coordination("interval"), renewEveryMs);
    if (typeof coordinationTimer.unref === "function") coordinationTimer.unref();
    return () => {
      stopped = true;
      if (startupTimer) clearTimeout(startupTimer);
      if (coordinationTimer) clearInterval(coordinationTimer);
      if (kickTimer) clearTimeout(kickTimer);
      startupTimer = null;
      coordinationTimer = null;
      kickTimer = null;
    };
  }

  // Best-effort: give the lease back so another instance takes over quickly
  // (used on plugin unload; a crash leaves the lease to expire by TTL).
  async function release() {
    try {
      return await store.releaseLeadership(instanceId);
    } catch {
      return false;
    }
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
      strategyTerminal: binding.lastStatus?.strategyTerminal ?? null,
      heldAt: binding.heldAt ?? null,
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
      const paused = await store.listPaused();
      const callerSession = typeof toolContext.sessionID === "string" ? toolContext.sessionID : null;
      const leadership = await store.readLeadership().catch(() => null);
      const rows = Object.values(bindings).map(compactBinding);
      return text(
        JSON.stringify(
          {
            paused: {
              global: paused.global,
              sessions: paused.sessions,
              forThisSession: callerSession ? await store.isPausedFor(callerSession) : null,
            },
            leadership: leadership
              ? { holder: shortId(leadership.instanceId), isSelf: leadership.instanceId === instanceId, at: leadership.at }
              : null,
            instanceId: shortId(instanceId),
            stateDir: store.dir,
            daemon: daemon.baseUrl,
            observedTools: sightingsSnapshot(),
            bindings: rows,
          },
          null,
          2,
        ),
      );
    }
    if (action === "pause" || action === "resume") {
      const scope = input.scope === "all" ? "all" : "session";
      const key = scope === "all" ? "*" : (typeof toolContext.sessionID === "string" && toolContext.sessionID) || null;
      if (!key) {
        return text("pause/resume with scope=session requires a calling session; use scope=all for the global switch");
      }
      try {
        await store.setPaused(key, action === "pause");
      } catch (error) {
        return text(`${action} failed: ${describeError(error)}`);
      }
      log(action === "pause" ? "paused" : "resumed", { scope });
      if (action === "resume") kick();
      const what = scope === "all" ? "all sessions" : "this session";
      return text(
        action === "pause"
          ? `Automatic wake-up paused for ${what}. Terminal runs are kept in notifier state (visible via design_runs list) and the session is not contacted until resume.`
          : `Automatic wake-up resumed for ${what}. Held completions are delivered with auto wake on the next poll tick.`,
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
    instanceId,
    handleToolBefore,
    handleToolAfter,
    watchRun,
    tick,
    coordination,
    start,
    release,
    runTool,
    sightings: sightingsSnapshot,
  };
}
