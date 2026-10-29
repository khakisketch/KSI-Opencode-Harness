// KSI session evidence: read-only, current-session-only execution summary.
// Registered on explicit setup; the context lookup runs only when the tool is
// explicitly called. Reads ONLY the calling tc.sessionID context (no sessionID
// input exists, no other session is ever addressed), keeps no state, and
// performs no network/CLI/command/model calls and no permission requests.
// Output carries counts, fixed enums, and static limit strings only: never raw
// message text, commands, paths, role names, tool names, or session IDs.
import { auditMessages, extractMessages, checkDeclaredOrder } from './core.mjs';
import { realpath } from 'node:fs/promises';

export const TOOL_NAME = 'session_evidence_summary';
// Analysis-input cap enforced by the shared core (no summary when exceeded).
// This bounds analysis work only, never the context API fetch itself: the
// context is read first, then analyzed within budget.
export const MAX_CONTEXT_MESSAGES = 2000;
// Cap on tied-order enumeration: a relevant tied run of length n admits n!
// possible internal orders. Beyond this total the invariance proof is
// refused as too large to check, failing closed to unknown.
export const MAX_TIED_PERMUTATIONS = 32;

function* indexPermutations(len) {
  // Heap's algorithm: every index order exactly once, lazily.
  const perm = [...Array(len).keys()];
  const generate = function* (k) {
    if (k === 1) {
      yield [...perm];
      return;
    }
    for (let i = 0; i < k; i++) {
      yield* generate(k - 1);
      const j = k % 2 === 0 ? i : 0;
      [perm[j], perm[k - 1]] = [perm[k - 1], perm[j]];
    }
  };
  yield* generate(len);
}

function enumerateTiedOrders(ordered, relevantRuns, cap) {
  let total = 1;
  for (const r of relevantRuns) {
    const len = r.end - r.start + 1;
    let f = 1;
    for (let i = 2; i <= len; i++) {
      f *= i;
      if (f > cap) return null;
    }
    total *= f;
    if (total > cap) return null;
  }
  let results = [ordered];
  for (const r of relevantRuns) {
    const len = r.end - r.start + 1;
    const next = [];
    for (const base of results) {
      for (const perm of indexPermutations(len)) {
        const copy = base.slice();
        for (let k = 0; k < len; k++) copy[r.start + k] = base[r.start + perm[k]];
        next.push(copy);
      }
    }
    results = next;
  }
  return results;
}

const fail = (message) => { throw new Error(`session-evidence: ${message}`); };

const LIMITS = [
  'current-session-only: reads only the calling tc.sessionID context; no other session ID is accepted, no bulk collection, no stored state.',
  'opt-in lookup: registration alone reads nothing; the context is read only on explicit tool call.',
  'compaction-and-gaps: compaction, summaries, redaction, or trace gaps can hide changes; absence of evidence is not proof nothing happened.',
  'child-sessions-unobserved: delegations are observed as calls only; child session work stays unobserved unless that child snapshot is audited too.',
  'concurrency: non-atomic concurrent changes may reorder real execution; results are input-array order as observed only, not timestamp or execution proof.',
  'tool-completion-is-not-success: completed transport and command-pattern candidates never prove test success; passedProof is always none. Real success needs structural end-state proof, not observed here.',
  'completed-edit-is-not-file-proof: a completed edit/write/patch tool observation is a transport record, never proof a file changed on disk.',
  'screen-unobserved: no image is inspected here; visual counts are completed-tool observations only, never proof of rendering, task relevance, or inspection.',
  'order-consistency-check: the declared order is checked against per-message time.created evidence; missing/non-monotonic timestamps fail closed to unknown (never guessed). Tied runs with tool-bearing parts in at least two messages are enumerated exactly (capped at 32 total tied orders); the result is confirmed only when it is identical under every tied order (timestamp-tied-but-order-invariant), otherwise unknown — full-array reversal alone would miss partial ties. Idle/user-only or single-tooled ties never block confirmation. Timestamp order corroborates the declaration only and is not concurrent-completion proof.',
  'order-declared-and-checked: array order is caller-declared and then checked against per-message time.created evidence; REST /api/session/{id}/message was operator-observed newest-first and ctx.session.context was isolated-fixture-observed oldest-first, but neither surface is assumed — the timestamp check decides, and a contradicted or unverifiable declaration fails closed to unknown.',
];

const TOOL_DESCRIPTION = 'Summarize execution evidence for the CURRENT session only (the calling tc.sessionID context): last observed change candidate and verification/failure/incomplete/ambiguous observations after it, plus optional completed visual_capture/visual_review counts (whole-snapshot vs after-last-change, never promoted to observation or verdict). Explicit call only. REQUIRED input: order (oldest-first|newest-first) declaring the context array order — never guessed; the declaration must survive per-message time.created evidence, and tied timestamp blocks with tool-bearing parts in at least two messages are enumerated exactly (capped) with confirmation only under every tied order; missing, contradicted, divergent, or uncapped ties fail closed to unknown. REST /api/session/{id}/message was operator-observed newest-first, ctx.session.context was isolated-fixture-observed oldest-first; neither surface is assumed — the timestamp check decides. Output carries counts, fixed enums, and static limits only — never raw text, commands, paths, role names, tool names, or session IDs. A completed edit observation is a transport record, never proof a file changed. Compaction/missing/child-session/concurrent changes, tool-completion≠success, and screen observation stay explicitly unconfirmed (see limits). No other session, storage, network, CLI, command, model, or permission effects.';

function toolInput() {
  return {
    type: 'object',
    properties: {
      order: {
        type: 'string',
        enum: ['oldest-first', 'newest-first'],
        description: 'REQUIRED: array order of the session context being read. Never guessed; when unconfirmed, do not call and report unknown.',
      },
      includeVisual: {
        type: 'boolean',
        description: 'When true, also report completed visual_capture/visual_review counts (tool-completion observations only, never proof of rendering or task relevance). Default false.',
      },
    },
    required: ['order'],
    additionalProperties: false,
  };
}

function unknownResult(reason, { order = null, messagesObserved = null } = {}) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'unknown',
        reason,
        sessionScope: 'current-session-only',
        order,
        messagesObserved,
        passedProof: 'none',
        limits: [...LIMITS],
      }, null, 2),
    }],
  };
}

const sumValues = (obj) => Object.values(obj ?? {}).reduce((acc, n) => acc + (typeof n === 'number' ? n : 0), 0);

async function execute(ctx, input, tc) {
  const raw = input == null || typeof input !== 'object' || Array.isArray(input) ? {} : input;
  const own = tc?.sessionID;
  if (typeof own !== 'string' || !own) return unknownResult('tc-session-unavailable', {});
  const order = raw.order;
  // Declared order only; never inferred. Validate before any context read.
  if (order !== 'oldest-first' && order !== 'newest-first') return unknownResult('order-undeclared-or-invalid', {});
  const includeVisual = raw.includeVisual ?? false;
  if (typeof includeVisual !== 'boolean') return unknownResult('malformed-input', { order });
  // Session-location check before any context read: a moved session must not
  // be summarized by a stale plugin instance from another checkout. Minimal
  // same-pattern check (current session directory vs this plugin location);
  // mismatch, missing info, or any I/O failure fails closed. Paths are
  // compared internally only, never output.
  let sessionDir, pluginDir;
  try {
    const info = await ctx.session.get({ sessionID: own });
    sessionDir = info?.data?.location?.directory ?? info?.location?.directory;
  } catch {
    return unknownResult('session-unavailable', { order });
  }
  if (typeof sessionDir !== 'string' || !sessionDir) {
    return unknownResult('session-location-unavailable', { order });
  }
  if (!ctx.location || typeof ctx.location.directory !== 'string' || !ctx.location.directory) {
    return unknownResult('plugin-location-unavailable', { order });
  }
  try {
    const [a, b] = await Promise.all([realpath(sessionDir), realpath(ctx.location.directory)]);
    if (a !== b) return unknownResult('session-location-mismatch', { order });
  } catch {
    return unknownResult('session-location-unverifiable', { order });
  }
  let payload;
  try {
    payload = await ctx.session.context({ sessionID: own });
  } catch {
    return unknownResult('context-unavailable', { order });
  }
  const messages = extractMessages(payload);
  if (!Array.isArray(messages)) return unknownResult('malformed-context', { order });
  // Declared order must survive timestamp evidence, or the tool refuses: a
  // wrong declaration flips after-last-change results. The check runs on the
  // normalized processing order (a newest-first declaration reverses a copy
  // first, exactly like the audit). Missing or non-monotonic timestamps fail
  // closed to unknown (never guessed, never inferred). Tied runs that can
  // change tool-trace evidence are enumerated exactly below; anything else
  // fails closed. Timestamp consistency corroborates the declaration only.
  const ordered = order === 'newest-first' ? [...messages].reverse() : messages;
  let orderCheck;
  try {
    orderCheck = checkDeclaredOrder(ordered, 'oldest-first');
  } catch {
    return unknownResult('audit-invalid', { order, messagesObserved: messages.length });
  }
  if (orderCheck.verdict === 'contradicted') {
    return unknownResult('order-contradicted', { order, messagesObserved: messages.length });
  }
  if (orderCheck.verdict !== 'consistent') {
    return unknownResult('order-unverifiable', { order, messagesObserved: messages.length });
  }
  let audit;
  try {
    audit = auditMessages(messages, { sessionId: 'current-session', order, maxMessages: MAX_CONTEXT_MESSAGES });
  } catch {
    return unknownResult('audit-invalid', { order, messagesObserved: messages.length });
  }
  if (!audit || audit.valid !== true) {
    if (audit && audit.overBudget && typeof audit.overBudget === 'object') {
      const detail = audit.overBudget;
      const numeric = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'unknown',
            reason: 'over-budget',
            sessionScope: 'current-session-only',
            order,
            messagesObserved: messages.length,
            detail: {
              reason: typeof detail.reason === 'string' ? detail.reason : 'over-budget',
              messages: numeric(detail.messages),
              parts: numeric(detail.parts),
              chars: numeric(detail.chars),
            },
            passedProof: 'none',
            limits: [...LIMITS],
          }, null, 2),
        }],
      };
    }
    return unknownResult('audit-invalid', { order, messagesObserved: messages.length });
  }

  const snap = audit.completionAcrossRoles ?? {};
  let orderEvidence = 'timestamp-consistent';
  // Partial ties are order-ambiguous exactly inside the tied runs: permuting
  // the whole array (full reverse) would miss them. Enumerate precisely the
  // relevant tied runs in processing order and confirm only when every tied
  // order yields the identical privacy-safe report. Idle/user-only or
  // single-tooled ties never reach here and never block. Anything else —
  // divergent results or an uncapped permutation space — fails closed.
  const relevantRuns = (orderCheck.tiedRuns ?? []).filter((r) => r && r.relevant);
  if (relevantRuns.length > 0) {
    const permutations = enumerateTiedOrders(ordered, relevantRuns, MAX_TIED_PERMUTATIONS);
    if (!permutations) {
      return unknownResult('order-unverifiable', { order, messagesObserved: messages.length });
    }
    const strip = (report) => {
      const copy = JSON.parse(JSON.stringify(report));
      delete copy.order;
      delete copy.orderEvidence;
      return JSON.stringify(copy);
    };
    const base = strip(buildOkReport(audit, { order, orderEvidence: 'timestamp-consistent', messagesObserved: messages.length, includeVisual }));
    for (const permuted of permutations) {
      let alt;
      try {
        alt = auditMessages(permuted, { sessionId: 'current-session', order: 'oldest-first', maxMessages: MAX_CONTEXT_MESSAGES });
      } catch {
        return unknownResult('audit-invalid', { order, messagesObserved: messages.length });
      }
      if (!alt || alt.valid !== true) {
        return unknownResult('order-unverifiable', { order, messagesObserved: messages.length });
      }
      if (strip(buildOkReport(alt, { order: 'oldest-first', orderEvidence: 'timestamp-consistent', messagesObserved: messages.length, includeVisual })) !== base) {
        return unknownResult('order-unverifiable', { order, messagesObserved: messages.length });
      }
    }
    orderEvidence = 'timestamp-tied-but-order-invariant';
  }
  return { content: [{ type: 'text', text: JSON.stringify(buildOkReport(audit, { order, orderEvidence, messagesObserved: messages.length, includeVisual }), null, 2) }] };
}

function buildOkReport(audit, { order, orderEvidence, messagesObserved, includeVisual }) {
  const snap = audit.completionAcrossRoles ?? {};
  const roles = Object.values(audit.roles ?? {});
  let completedTools = 0, failedTools = 0, incompleteTools = 0, rolesWithChange = 0;
  for (const s of roles) {
    completedTools += sumValues(s?.tools);
    failedTools += sumValues(s?.failedTools);
    incompleteTools += sumValues(s?.incompleteTools);
    if (s?.completionEvidence?.lastChangeKind) rolesWithChange += 1;
  }
  const after = snap.countsAfterSnapshotLastChange ?? {};
  const visual = snap.visualCompletions ?? {};
  return {
    status: 'ok',
    sessionScope: 'current-session-only',
    order,
    messagesObserved,
    orderBasis: 'caller-declared order corroborated by per-message time.created evidence (relevant tied runs enumerated; invariance required); this tool never infers array order; a contradicted or unverifiable declaration fails closed to unknown',
    orderEvidence,
    lastChange: {
      present: snap.lastChange != null,
      kindClass: snap.lastChange == null ? null : (snap.lastChange.isPotentialOnly ? 'potential-change-signal-only' : 'completed-edit-tool-observed'),
      kindNote: 'completed-edit-tool-observed is a completed edit/write/patch tool record, never proof a file changed on disk; potential-change-signal-only is an unconfirmed delegation/possible-shell-mutation signal',
    },
    afterSnapshotLastChange: {
      verificationCandidates: after.verificationCandidates ?? 0,
      ambiguousCandidates: after.ambiguousCandidates ?? 0,
      failureSignals: after.failureSignals ?? 0,
      incompletes: after.incompletes ?? 0,
    },
    outcome: typeof snap.outcome === 'string' ? snap.outcome : 'unknown: missing snapshot summary',
    roles: {
      withChange: rolesWithChange,
      freshCandidate: snap.freshCandidateRoles?.length ?? 0,
      stale: snap.staleRoles?.length ?? 0,
      ambiguous: snap.ambiguousRoles?.length ?? 0,
      failure: snap.failureSignalRoles?.length ?? 0,
      noChange: snap.noChangeRoles?.length ?? 0,
    },
    tools: { completed: completedTools, failed: failedTools, incomplete: incompleteTools },
    visual: includeVisual
      ? {
        completedCaptures: visual.captures ?? 0,
        completedReviews: visual.reviews ?? 0,
        afterLastChange: {
          captures: visual.capturesAfterLastChange ?? 0,
          reviews: visual.reviewsAfterLastChange ?? 0,
        },
        note: 'completed-tool observations only (exact names, whole snapshot vs after-last-change split); never proof of rendering, task relevance, inspection, or change verification',
      }
      : 'not-requested',
    passedProof: 'none',
    limits: [...LIMITS],
  };
}

export async function setupSessionEvidence(ctx) {
  if (!ctx || typeof ctx !== 'object') fail('plugin context is unavailable');
  if (!ctx.session || typeof ctx.session.context !== 'function') fail('session context is unavailable');
  if (typeof ctx.session.get !== 'function') fail('session info is unavailable');
  if (!ctx.tool || typeof ctx.tool.transform !== 'function') fail('tool registration is unavailable');
  // Exactly one read-only tool; no hooks, no session writes, no permission
  // requests, no model/network/command effects.
  const registration = await ctx.tool.transform((editor) => {
    editor.add({
      name: TOOL_NAME,
      description: TOOL_DESCRIPTION,
      input: toolInput(),
      options: { codemode: false },
      execute: (input, tc) => execute(ctx, input, tc),
    });
  });
  return async () => { await registration.dispose(); };
}
