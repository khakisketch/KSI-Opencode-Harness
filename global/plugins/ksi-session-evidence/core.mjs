// session-audit-core.mjs — the single shared audit core for execution evidence.
// Used by both scripts/session-audit.mjs (CLI/file auditing, re-exported API)
// and the managed Native plugin in this directory (current-session-only reads
// of ctx.session.context). Do not duplicate this logic: fix ordering, counting,
// or honesty bugs here so every consumer inherits them.
//
// Input-array order follows the caller-declared `order` option
// ('oldest-first' default, 'newest-first' explicit). The Native V2
// /api/session/{id}/message surface was operator-observed newest-first while
// ctx.session.context order is unconfirmed in-repo, so the core never infers
// order: a wrong declaration flips after-last-change results. When array order
// is unconfirmed, callers must treat the result as unknown instead of guessing.
// (explicit completed tool status, role-scoped evidence plus a snapshot-wide
// cross-role summary, optional visual tool-completion counts, and honest
// failure/incomplete/ambiguous separation).
// Describes traces only; never proves understanding, design success, test
// success, session independence, or model quality. Node stdlib only; never
// mutates sessions, config, or project files.
import { promises as fsp } from 'node:fs';
import path from 'node:path';

const AUTHORITY_RE = /(?:^|\/)(?:AGENTS\.md|00_READ_FIRST\.md|PRODUCT_CONSTITUTION\.md|DOMAIN_INVARIANTS\.md|FINAL_DECISION_LEDGER[^/]*\.md|MASTER_PRD[^/]*\.md|product-state\.md|DESIGN-SYSTEM\.md|ADR-[^/]+\.md|openspec\/[^/]+\/.+|contracts\/[^/]+\..+)$/i;
const CRAFT_RE = /(?:^|\/)(?:craft-floor\.md|operate\.md|new-work\.md|critique\.md|polish\.md|typeset\.md|layout\.md|colorize\.md)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif)$/i;
const DETECT_RE = /\bimpeccable\b[^\n]*\bdetect\b|\bdetect\s+--json\b/i;
const OPENSPEC_CMD_RE = /\bopenspec\s+(?:validate|status|list|show|init|new|archive)\b/i;
const VERIFY_CMD_RE = /\b(?:node\s+--test|pytest|vitest|jest|mocha|gradle\w*|cargo\s+(?:test|check|build)|(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+(?:test|build|check|lint|typecheck|verify))|tsc\b|mypy\b|ruff\b|eslint\b|python3?\s+[^\n]*check[^\n]*\.py|bash\s+scripts\/(?:run_all_tests|android_host_tests|run_local_verification)\b|playwright\s+test)\b/i;

const COMPLETED_RE = /^completed$/i;
// Obvious nonzero-exit hints in visible tool output text: explicit exit-code
// wording only ("exit 1", "exit code 1", the opencode wrapper wording
// "Exited with code 1" observed live, "exitcode: 1"). Narrow on purpose: not
// a log classifier, and broad fail-words ("1 failed") stay candidates.
const NONZERO_EXIT_RE = /\bexit(?:ed)?(?:\s+code)?\s*[:=]?\s*[1-9]\d*\b|\bexited\s+with\s+code\s*[:=]?\s*[1-9]\d*\b|exitcode\s*[:=]\s*[1-9]/i;
const ECHO_LEAD_RE = /^\s*echo(?:\s|$)/i;
const SHELL_CHAIN_RE = /[;&|]|\$\(/;
// External JSON strings are NEVER trusted as object keys: every map keyed by
// agent/role/tool/skill names uses a null-prototype object internally, so
// inherited members (toString, hasOwnProperty, valueOf, __defineGetter__,
// __proto__, constructor, ...) can neither resolve nor pollute. See
// freshCounts and toPlain: boundaries convert back to plain JSON-safe objects
// without inventing or dropping keys.
const freshCounts = () => Object.create(null);

// Deep copy that converts null-prototype maps back to plain objects.
// defineProperty is used for every key so an own '__proto__' entry becomes a
// real data property (JSON-serializable, shadowing-safe) instead of
// triggering the prototype setter.
function toPlain(value) {
  if (Array.isArray(value)) return value.map(toPlain);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) {
      Object.defineProperty(out, k, { value: toPlain(value[k]), enumerable: true, writable: true, configurable: true });
    }
    return out;
  }
  return value;
}
// Conservative file-mutation candidate: shell can change files outside
// edit/write/patch (redirects, mv/cp/rm/mkdir/touch/tee, patch pipelines).
// Pattern candidate only; absence is not proof of no file change. Echo-only
// commands are NOT excluded here: `echo x > file` still mutates via redirect.
const SHELL_MAYBE_MUTATE_RE = /(^|[\s;&|])(sed\s+[^\n]*-i|perl\s+[^\n]*-pi|apply_patch\b|git\s+apply\b|patch\s+[^\n]*-p|(mv|cp|rm|mkdir|touch|tee)\s+\S)|(^|[^->=])>\s*\S/i;

const LIMITATIONS = [
  'trace-observation-only: a missing skill/read is not proof it never happened (other channels, redaction, or trace gaps).',
  'status-basis: only an explicit `completed` status counts as completed; pending/running/missing/unknown counts as incomplete, never as done.',
  'verification-basis: shell matches are command-pattern candidates only (echo-only excluded); obvious nonzero-exit output is counted separately and is not a passing run.',
  'visual-basis: image-extension reads are observed path reads only; not proof of task relevance, rendering, or inspection.',
  'order-basis: sequence is input-array order as observed only; not timestamp or concurrency proof.',
  'identity-basis: file basenames are labels, not session identity; exact repeated message windows are grouped, not a complete census.',
  'no-quality-attribution: no version, prompt, or model quality claims; not a product or design certifier.',
  'child-session-basis: each snapshot is audited alone; a subagent delegation is observed as a call only, child file changes/verification stay unobserved unless that child snapshot is audited too.',
  'concurrency-basis: non-atomic concurrent changes may reorder real execution; last-change-after evidence is order-as-observed only, not a linear history proof.',
  'shell-mutation-basis: shell may change files outside edit/write/patch; possibleShellEdits is a pattern candidate only, and its absence is not proof of no file change.',
  'completion-basis: failed vs incomplete vs unverified stay distinct; candidates carry unknown outcome with passedProof none; real test success needs structural end-state proof, never claimed here.',
  'cross-role-basis: role-scoped evidence never covers another role’s later change; snapshot freshness needs completionAcrossRoles (one role’s verification never proves another role’s change).',
  'mixed-shell-basis: a single shell call matching both verification and mutation patterns is order-ambiguous (command-internal order unprovable): counted as a pattern candidate and a potential change, never as after-last-change verification.',
  'partial-change-basis: failed/incomplete shell (mutation-pattern) or delegation may have partially changed files; prior verification freshness is discarded while the failure/incompleteness record is preserved.',
  'change-naming-basis: changesObserved/withChange count confirmed edits plus potential-change signals for backward compatibility only; editsObserved vs potentialChangesObserved separate confirmed edit/write/patch calls from unconfirmed delegation/possible-shell-edit signals.',
  'input-order-basis: input-array order follows the caller-declared order option (default oldest-first); a wrongly declared newest-first/oldest-first flips after-last-change results; relevant tied runs (tool-bearing parts in at least two messages of one timestamp block) are enumerated exactly and confirmation requires invariance — full-array reversal alone would miss partial ties; the Native V2 message API was operator-observed newest-first while ctx.session.context was isolated-fixture-observed oldest-first, so callers must verify and declare explicitly instead of guessing.',
  'unsafe-key-basis: external agent/tool/skill strings are never trusted as object keys: every externally-keyed map uses a null-prototype object internally, so inherited members (toString, hasOwnProperty, __proto__, constructor, ...) can neither resolve nor pollute; boundaries convert back to plain JSON-safe objects without inventing or dropping keys.',
  'budget-basis: pre-processing caps (messages, tool parts, scanned string chars, duplicate-window chars) bound CPU/memory before analysis; over-budget input yields no summary (valid:false + overBudget), never a partial result. Caps bound analysis work only, never the context API fetch itself.',
];

const COVERAGE = {
  statusBasis: 'explicit `completed` status only; failed vs incomplete counted separately',
  verificationBasis: 'command-pattern candidate only: verificationRuns counts candidates, not passed tests; nonzero-exit hints separated; not exit-success proof',
  visualBasis: 'observed image-path reads only; not task-relevance proof',
  orderBasis: 'input-array order only; not timestamp/concurrency proof',
  skillTimingBasis: 'first completed skill load per role, before or after its first observed completed edit/delegation in this snapshot; not task relevance, decision timing, or compliance proof',
  identityBasis: 'explicit in-payload session id only; basename labels stay anonymous:<file>; exact message-window duplicates grouped',
  qualityScope: 'visible tool traces only; no version/prompt/model quality attribution',
  childSessionBasis: 'per-snapshot only; delegation calls do not link to child snapshots',
  concurrencyBasis: 'non-atomic concurrent changes may reorder; last-change-after is order-as-observed only',
  shellMutationBasis: 'possibleShellEdits is a pattern candidate only; absence is not proof of no file change; shell-maybe resets after-last-change evidence like an edit',
  completionBasis: 'after latest observed edit/delegation/possible-shell-edit in input-array order; candidate-unknown vs ambiguous vs failure-signal vs unverified stay distinct; mixed verify+mutate shell calls never count as after-last-change verification; passedProof is always none here',
  completionScopeBasis: 'per-role evidence is role-scoped input-array order only; cross-role staleness needs completionAcrossRoles; one role’s verification never proves another role’s change',
  mixedShellBasis: 'a single shell call matching both verification and mutation patterns is order-ambiguous: counted as a pattern candidate and a potential change, never as after-last-change verification (see verificationAmbiguous*)',
  partialChangeBasis: 'failed/incomplete shell (mutation-pattern) or delegation may have partially changed files: prior clean/ambiguous verification freshness is discarded while the failure/incompleteness record is preserved',
  changeBasis: 'editsObserved are confirmed edit/write/patch calls; delegations/possibleShellEdits are potential-change signals only, never confirmed file changes; changesObserved/withChange sum both for backward compatibility only',
  inputOrderBasis: 'input-array order follows the caller-declared order option (default oldest-first, explicit newest-first); never inferred; a wrong declaration flips after-last-change results; relevant tied timestamp runs are enumerated exactly and confirmation requires invariance under every tied order; when array order is unconfirmed, treat the result as unknown',
  unsafeKeyBasis: 'external agent/tool/skill strings are never trusted as object keys: null-prototype maps internally, plain JSON-safe objects at boundaries',
  budgetBasis: 'pre-processing caps bound analysis work only (messages, parts, scanned chars, duplicate-window chars); over-budget yields no summary; caps never limit the context API fetch itself',
};
const UX_IA_SKILLS = new Set([
  'designing-user-experience',
  'journey',
  'organize',
  'wireframe',
  'ux-heuristics-audit',
  'building-accessible-interfaces',
]);

const CRAFT_COPY_SKILLS = new Set([
  'impeccable',
  'ux-copy',
  // Retain classification of this removed skill in historical session traces.
  'emilkowalski-motion',
]);

export function extractMessages(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.messages)) return payload.messages;
    if (Array.isArray(payload.data)) return payload.data;
  }
  return null;
}

function toolStatus(part) {
  return part?.state?.status ?? part?.status ?? null;
}

function isFailedTool(part) {
  const status = toolStatus(part);
  if (status === 'error' || status === 'failed') return true;
  if (part?.state?.error || part?.error) return true;
  return false;
}

// Strict Native status: only a literal `completed` counts as completed.
// Anything else (pending, running, missing, unknown, or any other alias)
// is incomplete (not failed, not done).
function isCompletedTool(part) {
  const status = toolStatus(part);
  return typeof status === 'string' && COMPLETED_RE.test(status.trim());
}

function inlineTextParts(holder) {
  const list = Array.isArray(holder?.content) ? holder.content : null;
  if (!list) return [];
  const out = [];
  for (const c of list) {
    if (c && c.type === 'text' && typeof c.text === 'string') out.push(c.text);
  }
  return out;
}

// Real Native V2 completed tools carry result text in state.content as
// {type:'text', text} items (isolated-fixture-observed), alongside the
// historical state.output/result fields. Both are read; file/base64 payloads
// ({type:'file', uri, ...}) are never collected, for privacy and to keep
// hostile payloads out of budgets and blobs.
function shellOutputBlob(part) {
  const vals = [...inlineTextParts(part?.state), ...inlineTextParts(part), part?.state?.output, part?.state?.result, part?.output, part?.result, part?.state?.text, part?.text];
  const err = part?.state?.error?.message ?? part?.error?.message ?? part?.error;
  if (typeof err === 'string') vals.push(err);
  return vals.filter((v) => typeof v === 'string').join('\n');
}

// Obvious nonzero-exit hints in visible tool output text (e.g. "exit 1").
// Narrow on purpose: not a log classifier, just avoids counting a visibly
// failed run as a verification candidate.
function hasNonzeroExitHint(part) {
  return NONZERO_EXIT_RE.test(shellOutputBlob(part));
}

// `echo "npm test"` merely prints the words; without chaining it runs nothing.
function isEchoOnlyCommand(cmd) {
  return ECHO_LEAD_RE.test(cmd) && !SHELL_CHAIN_RE.test(cmd);
}

// Shell may change files outside edit/write/patch. Conservative candidate
// only; echo-only is intentionally NOT excluded (redirects still mutate).
function isMaybeShellEdit(cmd) {
  return typeof cmd === 'string' && cmd.length > 0 && SHELL_MAYBE_MUTATE_RE.test(cmd);
}

function toolInputOf(part) {
  return part?.state?.input ?? part?.input ?? part?.args ?? {};
}

// Failed/running mutating-capable calls may have partially changed files even
// though their transport never completed: a mutation-pattern shell, or any
// delegation (child work is unobservable). Reads/skills cannot mutate, so they
// never count here. Used to discard verification freshness while preserving
// the failure/incompleteness record (never conflated, never swallowed).
function isPartialChangeRisk(toolName, part) {
  if (toolName === 'subagent') return true;
  if (toolName === 'shell') {
    return isMaybeShellEdit(String(toolInputOf(part).command ?? ''));
  }
  return false;
}

function explicitSessionIdOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cands = [raw.sessionId, raw.sessionID, raw.session_id, raw?.metadata?.sessionId, raw?.metadata?.sessionID, raw?.session?.id];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

const ORDERINGS = new Set(['oldest-first', 'newest-first']);

const shownOrder = (order) => (typeof order === 'string' ? JSON.stringify(order.slice(0, 80)) : typeof order);

function checkOrder(order) {
  if (!ORDERINGS.has(order)) {
    throw new Error(`session-audit-core: unknown message order ${shownOrder(order)}; use 'oldest-first' (default) or 'newest-first'`);
  }
  return order;
}

// Stable time evidence for array-order validation. Isolated Native V2 fixture
// (own server, scripted model, synthetic session) observed every context
// message carrying time.created as finite epoch milliseconds, monotonic with
// the context array order — while the REST message surface returned the same
// history newest-first. Only this field shape is honored; anything else is
// missing evidence, never guessed.
export function messageTimeOf(m) {
  if (!m || typeof m !== 'object') return undefined;
  const t = (m.time && typeof m.time === 'object' ? m.time.created : undefined) ?? m.time;
  if (typeof t === 'number' && Number.isFinite(t)) return t;
  if (typeof t === 'string' && t.trim() !== '') {
    const n = Date.parse(t);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

// Validate a declared array order against timestamp evidence. Fail closed:
// missing/unusable timestamps on ANY message -> unverifiable (never guess);
// a monotonicity violation of the declared direction -> contradicted.
// Consistent timestamps only corroborate the declaration; timestamp order is
// not concurrent-completion proof (see limits).
// Empty/single-message input is vacuously consistent.
// Tied timestamps carry no tiebreak information: `tie` is true when no strict
// step exists in the declared direction, and `tiedRuns` lists every maximal
// adjacent equal-time block as { start, end, relevant }. A run is relevant
// when tool-bearing parts sit in at least two of its messages — only then can
// the unknown internal order change tool-trace evidence. Idle/user or
// single-tooled ties are reported but never block confirmation by themselves;
// callers must enumerate the relevant runs or fail closed.
export function checkDeclaredOrder(messages, order) {
  if (!ORDERINGS.has(order)) {
    return { verdict: 'unverifiable', reason: 'unknown-order', tie: false, strictSteps: 0, tiedRuns: [] };
  }
  if (!Array.isArray(messages) || messages.length < 2) {
    return { verdict: 'consistent', reason: 'too-few-messages', tie: false, strictSteps: 0, tiedRuns: [] };
  }
  let prev = order === 'oldest-first' ? -Infinity : Infinity;
  let strictSteps = 0;
  const times = [];
  for (let i = 0; i < messages.length; i++) {
    const t = messageTimeOf(messages[i]);
    if (t === undefined) {
      return { verdict: 'unverifiable', reason: 'timestamps-missing', tie: false, strictSteps, tiedRuns: [], detail: { atIndex: i } };
    }
    times.push(t);
    if (i > 0) {
      if (t === prev) continue;
      else if (order === 'oldest-first' ? t > prev : t < prev) strictSteps += 1;
      else return { verdict: 'contradicted', reason: 'timestamps-contradict-declared-order', tie: false, strictSteps, tiedRuns: [], detail: { atIndex: i } };
    }
    prev = t;
  }
  const tiedRuns = [];
  let start = -1;
  for (let i = 1; i <= times.length; i++) {
    const tied = i < times.length && times[i] === times[i - 1];
    if (tied && start < 0) start = i - 1;
    if (!tied && start >= 0) {
      tiedRuns.push(describeTiedRun(messages, start, i - 1));
      start = -1;
    }
  }
  void prev;
  // All-equal timestamps are consistent with both declarations: without a
  // strict step there is no tiebreak information, so callers must either fail
  // closed or confirm order-invariance explicitly (never guess the order).
  return { verdict: 'consistent', reason: 'timestamps-consistent', tie: strictSteps === 0, strictSteps, tiedRuns };
}

function hasToolPart(msg) {
  const list = Array.isArray(msg?.content) ? msg.content : (Array.isArray(msg?.parts) ? msg.parts : null);
  return !!list && list.some((p) => p && p.type === 'tool');
}

function describeTiedRun(messages, start, end) {
  let tooled = 0;
  for (let i = start; i <= end; i++) {
    if (hasToolPart(messages[i])) tooled += 1;
  }
  return { start, end, relevant: tooled >= 2 };
}

// Pre-processing budgets: bound analysis CPU/memory BEFORE any regex,
// concatenation, or summary work. The pre-scan itself only reads lengths
// (O(1) per string) and counts elements, so it cannot blow up. Over-budget
// input yields no summary (valid:false + numeric overBudget detail), never a
// partial result. These caps bound analysis work only, never the context API
// fetch itself (callers fetch first, then analyze within budget).
export const AUDIT_BUDGETS = {
  maxMessages: 20000,
  maxParts: 100000,
  maxStringChars: 20000000,
  maxWindowChars: 5000000,
};

// Every string the analyzer actually reads, copies, regex-tests, or uses as
// a key for one (message, part) pair — paths, skill ids, agent names, role
// and tool names included, not just commands/outputs. File/base64 payloads
// are never read and never counted; their item count still bounds loop work.
// Returns { length, items } where items counts nested content entries.
function analyzedUsage(msg, part) {
  let length = 0, items = 0;
  const add = (v) => { if (typeof v === 'string') length += v.length; };
  add(msg?.agent); add(msg?.role); add(msg?.type);
  if (!part || typeof part !== 'object') return { length, items };
  add(part.type); add(part.name); add(part.tool);
  const st = part.state;
  add(st?.status); add(part.status);
  const inp = st?.input ?? part.input ?? part.args;
  if (inp && typeof inp === 'object') {
    add(inp.command); add(inp.path); add(inp.filePath);
    add(inp.id); add(inp.name); add(inp.agent);
  }
  add(st?.output); add(st?.result); add(st?.text);
  add(part.output); add(part.result); add(part.text);
  add(st?.error?.message ?? part?.error?.message ?? part?.error);
  for (const holder of [st, part]) {
    const list = Array.isArray(holder?.content) ? holder.content : null;
    if (!list) continue;
    items += list.length;
    for (const c of list) {
      if (c && c.type === 'text' && typeof c.text === 'string') length += c.text.length;
    }
  }
  return { length, items };
}

function checkInputBudgets(ordered, { maxMessages, maxParts, maxStringChars }) {
  if (ordered.length > maxMessages) {
    return { over: true, summary: { reason: 'too-many-messages', messages: ordered.length, parts: 0, chars: 0 } };
  }
  let parts = 0, chars = 0;
  for (const msg of ordered) {
    const list = Array.isArray(msg?.content) ? msg.content : (Array.isArray(msg?.parts) ? msg.parts : null);
    if (!list) continue;
    for (const part of list) {
      parts += 1;
      if (parts > maxParts) {
        return { over: true, summary: { reason: 'too-many-parts', messages: ordered.length, parts, chars } };
      }
      const use = analyzedUsage(msg, part);
      chars += use.length;
      parts += use.items;
      if (parts > maxParts) {
        return { over: true, summary: { reason: 'too-many-parts', messages: ordered.length, parts, chars } };
      }
      if (chars > maxStringChars) {
        return { over: true, summary: { reason: 'string-chars-exceeded', messages: ordered.length, parts, chars } };
      }
    }
  }
  return { over: false };
}

export function auditMessages(messages, { sessionId = 'unknown', order = 'oldest-first', maxMessages = AUDIT_BUDGETS.maxMessages, maxParts = AUDIT_BUDGETS.maxParts, maxStringChars = AUDIT_BUDGETS.maxStringChars } = {}) {
  if (!Array.isArray(messages)) {
    return { sessionId, valid: false, roles: {}, gaps: ['invalid-message-array'] };
  }
  checkOrder(order);
  // Newest-first input (operator-observed for /api/session/{id}/message) is
  // normalized to oldest-first processing order on a copy; the caller's array
  // is never mutated. Normalization is positional only: concurrency and
  // child-session limits still apply (see limitations).
  const ordered = order === 'newest-first' ? [...messages].reverse() : messages;
  const budget = checkInputBudgets(ordered, { maxMessages, maxParts, maxStringChars });
  if (budget.over) {
    return { sessionId, valid: false, roles: {}, gaps: ['over-budget'], overBudget: budget.summary };
  }
  const byRole = Object.create(null);
  const ensureRole = (role) => {
    if (!byRole[role]) {
      byRole[role] = {
        turns: 0,
        tools: freshCounts(),
        failedTools: freshCounts(),
        incompleteTools: freshCounts(),
        skillsLoaded: [],
        skillsLoadedBeforeAction: [],
        skillsFirstLoadedAfterAction: [],
        uxSkillsLoaded: [],
        craftSkillsLoaded: [],
        authorityReads: [],
        authorityReadBeforeAction: false,
        actedYet: false,
        openspecReads: [],
        craftReads: [],
        visualReads: [],
        postEditVisualReads: [],
        subagentsCalled: [],
        detectorRuns: 0,
        openspecCommands: 0,
        verificationRuns: 0,
        verificationNonzeroHints: 0,
        postEditVerificationRuns: 0,
        edits: 0,
        reads: 0,
        shells: 0,
        // Completion-time evidence (additive; legacy edit-only postEdit* kept).
        possibleShellEdits: 0,
        delegations: 0,
        lastChangeKind: null,
        verificationAfterLastChange: 0,
        verificationAmbiguousCalls: 0,
        verificationAmbiguousAfterLastChange: 0,
        nonzeroHintAfterLastChange: 0,
        failedAfterLastChange: 0,
        incompleteAfterLastChange: 0,
        completionEvidence: null,
      };
    }
    return byRole[role];
  };

  const pushUnique = (arr, val) => {
    if (val && !arr.includes(val)) arr.push(val);
  };

  // Snapshot-wide input-array order across roles. One role's verification
  // never proves another role's change; positions below only order
  // observations, never timestamps or concurrency.
  let seq = 0;
  const cross = {
    lastChange: null, // { kind, role, seq, isPotentialOnly }
    lastCleanVerify: null, // { role, seq }
    lastAmbiguous: null, // { role, seq }
    lastFailure: null, // { role, tool, seq } failed transport or nonzero hint
    lastIncomplete: null, // { role, tool, seq }
    visual: { captures: 0, reviews: 0, captureSeqs: [], reviewSeqs: [] }, // completed visual_capture/visual_review only, exact names
  };
  // Per-tool-part event positions (sequence numbers only, no content) so the
  // snapshot summary can count observations after the snapshot's last change
  // without re-reading tool inputs, commands, paths, or names.
  const eventSeqs = { changes: [], cleanVerifies: [], ambiguous: [], failures: [], incompletes: [] };
  const roleVerifySeq = Object.create(null); // role -> seq of its latest clean verification

  for (const msg of ordered) {
    if (!msg || (msg.type !== 'assistant' && msg.role !== 'assistant')) continue;
    // Null-prototype byRole makes any agent string safe as a key; unknown
    // or missing identity still merges into the 'unknown' role as before.
    const role = typeof msg.agent === 'string' && msg.agent ? msg.agent : 'unknown';
    const stat = ensureRole(role);
    stat.turns += 1;
    const parts = Array.isArray(msg.content) ? msg.content : (Array.isArray(msg.parts) ? msg.parts : []);
    for (const part of parts) {
      if (!part || part.type !== 'tool') continue;
      // Null-prototype tool maps make any tool name safe as a key.
      const toolName = typeof part.name === 'string' && part.name ? part.name : (typeof part.tool === 'string' ? part.tool : 'unknown');
      seq += 1;

      if (isFailedTool(part)) {
        stat.failedTools[toolName] = (stat.failedTools[toolName] ?? 0) + 1;
        // Failure observed after the latest change (if any). Totals keep all
        // failures; this counter resets on completed change so it means
        // "after last observed change" only. Failed transport is never a
        // pass, never conflated with unverified or unobserved.
        stat.failedAfterLastChange += 1;
        cross.lastFailure = { role, tool: toolName, seq };
        eventSeqs.failures.push(seq);
        // A failed mutating-capable call may have partially changed files:
        // prior verification (clean or ambiguous) is no longer fresh. The
        // failure record above is preserved, and no unconfirmed change is
        // counted (lastChangeKind/possibleShellEdits/delegations untouched).
        if (isPartialChangeRisk(toolName, part)) {
          stat.verificationAfterLastChange = 0;
          stat.verificationAmbiguousAfterLastChange = 0;
        }
        continue;
      }
      // Pending/running/missing status: observed but not completed. Never
      // counted as a completed tool call (authority read, skill, verify, ...).
      // Incomplete is unobserved transport, not failure and not verification.
      if (!isCompletedTool(part)) {
        stat.incompleteTools[toolName] = (stat.incompleteTools[toolName] ?? 0) + 1;
        stat.incompleteAfterLastChange += 1;
        cross.lastIncomplete = { role, tool: toolName, seq };
        eventSeqs.incompletes.push(seq);
        // A running mutating-capable call may change files concurrently:
        // prior verification is no longer fresh, while the incompleteness
        // record above is preserved.
        if (isPartialChangeRisk(toolName, part)) {
          stat.verificationAfterLastChange = 0;
          stat.verificationAmbiguousAfterLastChange = 0;
        }
        continue;
      }

      stat.tools[toolName] = (stat.tools[toolName] ?? 0) + 1;
      const inp = part.state?.input ?? part.input ?? part.args ?? {};
      // Completed visual tool observations only (exact tool names, any role).
      // Counts, never content: no image, path, relevance claim, or verdict
      // (see limits). Sequence numbers allow after-last-change separation.
      if (toolName === 'visual_capture') { cross.visual.captures += 1; cross.visual.captureSeqs.push(seq); }
      else if (toolName === 'visual_review') { cross.visual.reviews += 1; cross.visual.reviewSeqs.push(seq); }

      if (toolName === 'skill') {
        const skillId = typeof inp.id === 'string' ? inp.id : (typeof inp.name === 'string' ? inp.name : '');
        if (skillId && !stat.skillsLoaded.includes(skillId)) {
          pushUnique(stat.actedYet ? stat.skillsFirstLoadedAfterAction : stat.skillsLoadedBeforeAction, skillId);
        }
        pushUnique(stat.skillsLoaded, skillId);
        if (UX_IA_SKILLS.has(skillId)) pushUnique(stat.uxSkillsLoaded, skillId);
        if (CRAFT_COPY_SKILLS.has(skillId)) pushUnique(stat.craftSkillsLoaded, skillId);
      } else if (toolName === 'subagent') {
        stat.actedYet = true;
        stat.delegations += 1;
        // Delegation may change files via the child; prior verification no
        // longer covers the latest observed change. Child work itself stays
        // unobserved in this snapshot (see child-session-basis).
        stat.lastChangeKind = 'delegation';
        stat.verificationAfterLastChange = 0;
        stat.verificationAmbiguousAfterLastChange = 0;
        stat.nonzeroHintAfterLastChange = 0;
        stat.failedAfterLastChange = 0;
        stat.incompleteAfterLastChange = 0;
        cross.lastChange = { kind: 'delegation', role, seq, isPotentialOnly: true };
        eventSeqs.changes.push(seq);
        const target = typeof inp.agent === 'string' ? inp.agent : '';
        pushUnique(stat.subagentsCalled, target);
      } else if (toolName === 'read') {
        stat.reads += 1;
        const rawPath = String(inp.path ?? inp.filePath ?? '');
        const shortPath = rawPath.split('/').slice(-2).join('/');
        // Observed image-path reads only; not proof of task relevance or inspection.
        if (IMAGE_RE.test(rawPath)) {
          pushUnique(stat.visualReads, shortPath);
          if (stat.edits > 0) pushUnique(stat.postEditVisualReads, shortPath);
        }
        if (AUTHORITY_RE.test(rawPath)) {
          pushUnique(stat.authorityReads, shortPath);
          if (!stat.actedYet) stat.authorityReadBeforeAction = true;
        }
        if (/\/openspec\//i.test(rawPath) || /^openspec\//i.test(rawPath)) pushUnique(stat.openspecReads, shortPath);
        if (CRAFT_RE.test(rawPath)) pushUnique(stat.craftReads, shortPath);
      } else if (toolName === 'edit' || toolName === 'write' || toolName === 'patch') {
        stat.actedYet = true;
        stat.edits += 1;
        // Latest observed change: reset both legacy edit-only trackers and the
        // broader after-last-change evidence (delegation/shell-maybe included).
        stat.lastChangeKind = 'edit';
        stat.verificationAfterLastChange = 0;
        stat.verificationAmbiguousAfterLastChange = 0;
        stat.nonzeroHintAfterLastChange = 0;
        stat.failedAfterLastChange = 0;
        stat.incompleteAfterLastChange = 0;
        cross.lastChange = { kind: 'edit', role, seq, isPotentialOnly: false };
        eventSeqs.changes.push(seq);
        // Reset post-edit trackers so verification/visual reads must happen AFTER the latest edit
        stat.postEditVisualReads = [];
        stat.postEditVerificationRuns = 0;
      } else if (toolName === 'shell') {
        stat.shells += 1;
        const cmd = String(inp.command ?? '');
        // Command-pattern candidates only: a regex match is not proof the
        // check ran or passed (echo-only commands excluded outright).
        const echoOnly = isEchoOnlyCommand(cmd);
        // Shell file-mutation blind spot: a matching command may have changed
        // files, so it invalidates after-last-change evidence like an edit.
        // Candidate only; absence is not proof of no file change. actedYet is
        // intentionally untouched: unconfirmed shell edits never satisfy the
        // authority-read trigger (edit/delegation only).
        if (isMaybeShellEdit(cmd)) {
          stat.possibleShellEdits += 1;
          stat.lastChangeKind = 'shell-maybe';
          stat.verificationAfterLastChange = 0;
          stat.verificationAmbiguousAfterLastChange = 0;
          stat.nonzeroHintAfterLastChange = 0;
          stat.failedAfterLastChange = 0;
          stat.incompleteAfterLastChange = 0;
          cross.lastChange = { kind: 'shell-maybe', role, seq, isPotentialOnly: true };
          eventSeqs.changes.push(seq);
        }
        if (!echoOnly && DETECT_RE.test(cmd)) stat.detectorRuns += 1;
        if (!echoOnly && OPENSPEC_CMD_RE.test(cmd)) stat.openspecCommands += 1;
        if (!echoOnly && (VERIFY_CMD_RE.test(cmd) || DETECT_RE.test(cmd))) {
          // Completed transport with visibly nonzero exit text is a failure
          // hint, not a passing verification run.
          if (hasNonzeroExitHint(part)) {
            stat.verificationNonzeroHints += 1;
            stat.nonzeroHintAfterLastChange += 1;
            cross.lastFailure = { role, tool: toolName, seq };
            eventSeqs.failures.push(seq);
          } else if (isMaybeShellEdit(cmd)) {
            // Order-ambiguous: this single call matches both verification and
            // mutation patterns, and command-internal order is unprovable (the
            // test part may have run before the write part). Counted as a
            // pattern candidate (verificationRuns, legacy gap basis) and as an
            // ambiguous candidate, but NEVER as after-last-change verification
            // and never as a post-edit run.
            stat.verificationRuns += 1;
            stat.verificationAmbiguousCalls += 1;
            stat.verificationAmbiguousAfterLastChange += 1;
            cross.lastAmbiguous = { role, seq };
            eventSeqs.ambiguous.push(seq);
          } else {
            stat.verificationRuns += 1;
            stat.verificationAfterLastChange += 1;
            cross.lastCleanVerify = { role, seq };
            eventSeqs.cleanVerifies.push(seq);
            roleVerifySeq[role] = seq;
            if (stat.edits > 0) stat.postEditVerificationRuns += 1;
          }
        }
      }
    }
  }

  const gaps = [];
  for (const [role, s] of Object.entries(byRole)) {
    if (role === 'build' && (s.edits > 0 || s.subagentsCalled.length > 0)) {
      if (s.authorityReads.length === 0) gaps.push('build-acted-without-authority-read');
      else if (!s.authorityReadBeforeAction) gaps.push('build-acted-before-authority-read');
    }
    // Owner-unit authority grounding: lead is the current whole-task owner and
    // acts through edits and delegation alike (build-style trigger/ids);
    // design/engineer branches below stay byte-stable for honest historical
    // trace parsing of sessions recorded before the five-profile migration.
    if (role === 'lead' && (s.edits > 0 || s.subagentsCalled.length > 0)) {
      if (s.authorityReads.length === 0) gaps.push('lead-acted-without-authority-read');
      else if (!s.authorityReadBeforeAction) gaps.push('lead-acted-before-authority-read');
    }
    if ((role === 'design' || role === 'engineer') && s.edits > 0) {
      if (s.authorityReads.length === 0) gaps.push(`${role}-edited-without-authority-read`);
      else if (!s.authorityReadBeforeAction) gaps.push(`${role}-edited-before-authority-read`);
    }
    if (role === 'plan' && s.turns > 0 && s.authorityReads.length === 0) {
      gaps.push('plan-advised-without-authority-read');
    }
    // Owner-unit verification candidates: lead mirrors engineer (required
    // verification always applies). Skill-lens, visual-capture and critic-lens
    // mandates are intentionally absent: optional lenses are observed as
    // loaded skills/reads, never as failure gaps.
    if ((role === 'lead' || role === 'engineer') && s.edits > 0) {
      if (s.verificationRuns === 0) {
        gaps.push(`${role}-no-observed-verification-candidate`);
      } else if (s.postEditVerificationRuns === 0) {
        gaps.push(`${role}-no-post-edit-verification-candidate`);
      }
    }
    if (role === 'critic' && s.turns > 0) {
      if (s.reads === 0) gaps.push('critic-reviewed-without-evidence-read');
    }
  }

  // Honest completion-time evidence per role: what (if anything) was observed
  // AFTER the latest observed change (edit/delegation/possible-shell-edit) in
  // input-array order. ROLE-SCOPED ONLY: another role's later change can stale
  // this (see completionAcrossRoles below). Failed vs incomplete vs unverified
  // vs ambiguous stay distinct; clean candidates carry unknown outcome with
  // passedProof 'none'. Real test success needs structural end-state proof and
  // is never claimed here.
  for (const s of Object.values(byRole)) {
    const hasChange = s.lastChangeKind !== null && s.lastChangeKind !== undefined;
    let outcome;
    if (!hasChange) {
      outcome = 'no-change-observed';
    } else if ((s.failedAfterLastChange ?? 0) > 0 || (s.nonzeroHintAfterLastChange ?? 0) > 0) {
      outcome = 'failure-signal-after-last-change';
    } else if ((s.verificationAfterLastChange ?? 0) > 0) {
      outcome = 'candidate-unknown-after-last-change';
    } else if ((s.verificationAmbiguousAfterLastChange ?? 0) > 0) {
      outcome = 'ambiguous-after-last-change';
    } else {
      outcome = 'unverified-after-last-change';
    }
    const lastChangeKind = s.lastChangeKind ?? null;
    s.completionEvidence = {
      scope: 'role-scoped input-array order only; another role’s later change can stale this; see completionAcrossRoles for snapshot-wide freshness',
      lastChangeKind,
      lastChangeIsPotentialOnly: lastChangeKind === 'delegation' || lastChangeKind === 'shell-maybe',
      // Backward-compatible sum (confirmed edits + potential-change signals).
      // NOT a count of confirmed file changes; use editsObserved vs
      // potentialChangesObserved for that distinction (see changeBasis).
      changesObserved: (s.edits ?? 0) + (s.delegations ?? 0) + (s.possibleShellEdits ?? 0),
      edits: s.edits ?? 0,
      editsObserved: s.edits ?? 0,
      delegations: s.delegations ?? 0,
      possibleShellEdits: s.possibleShellEdits ?? 0,
      potentialChangesObserved: (s.delegations ?? 0) + (s.possibleShellEdits ?? 0),
      verificationCandidatesAfterLastChange: s.verificationAfterLastChange ?? 0,
      verificationAmbiguousAfterLastChange: s.verificationAmbiguousAfterLastChange ?? 0,
      nonzeroHintsAfterLastChange: s.nonzeroHintAfterLastChange ?? 0,
      failedAfterLastChange: s.failedAfterLastChange ?? 0,
      incompleteAfterLastChange: s.incompleteAfterLastChange ?? 0,
      outcome,
      passedProof: 'none',
      passedNote: 'command-pattern candidates and completed transport never prove test success; structural end-state proof required (not observed here).',
    };
  }

  // Snapshot-wide freshness across roles: the per-role evidence above cannot
  // see other roles' later changes, so a role can look fresh while the
  // snapshot as a whole has a stale late change. Positions are input-array
  // order only. One role's verification never proves another role's change;
  // child sessions and concurrency stay unobserved (see limitations).
  const staleRoles = [];
  const freshCandidateRoles = [];
  const ambiguousRoles = [];
  const failureSignalRoles = [];
  const noChangeRoles = [];
  for (const [role, s] of Object.entries(byRole)) {
    const o = s.completionEvidence?.outcome;
    if (o === 'candidate-unknown-after-last-change') freshCandidateRoles.push(role);
    else if (o === 'ambiguous-after-last-change') {
      ambiguousRoles.push(role);
      staleRoles.push(role);
    } else if (o === 'failure-signal-after-last-change') failureSignalRoles.push(role);
    else if (o === 'no-change-observed') noChangeRoles.push(role);
    else staleRoles.push(role);
  }
  const snapshotLastChange = cross.lastChange;
  // Roles that look fresh role-scoped but whose latest clean verification
  // predates the snapshot's latest change (another role changed later).
  const freshRolesStaledByLaterCrossRoleChange = snapshotLastChange
    ? freshCandidateRoles.filter((r) => (roleVerifySeq[r] ?? -1) < snapshotLastChange.seq)
    : [];
  const failureAfterSnapshotLastChange = Boolean(
    snapshotLastChange && cross.lastFailure && cross.lastFailure.seq >= snapshotLastChange.seq,
  );
  const incompleteAfterSnapshotLastChange = Boolean(
    snapshotLastChange && cross.lastIncomplete && cross.lastIncomplete.seq >= snapshotLastChange.seq,
  );
  // Observation counts after the snapshot's last change (sequence numbers
  // only, never content). Clean verifications must strictly follow the last
  // change; failures, incompletes, and the trailing mixed call itself (>=)
  // are counted at-or-after it. No change means no after-last-change scope.
  const changeSeq = snapshotLastChange?.seq ?? null;
  const afterCount = (arr, strict) => (changeSeq === null ? 0 : arr.filter((s) => (strict ? s > changeSeq : s >= changeSeq)).length);
  const countsAfterSnapshotLastChange = {
    verificationCandidates: afterCount(eventSeqs.cleanVerifies, true),
    ambiguousCandidates: afterCount(eventSeqs.ambiguous, false),
    failureSignals: afterCount(eventSeqs.failures, false),
    incompletes: afterCount(eventSeqs.incompletes, false),
  };
  let snapshotOutcome;
  if (!snapshotLastChange) {
    snapshotOutcome = 'no-change-in-snapshot';
  } else if (failureAfterSnapshotLastChange) {
    snapshotOutcome = 'failure-signal-after-snapshot-last-change';
  } else if (cross.lastCleanVerify && cross.lastCleanVerify.seq > snapshotLastChange.seq) {
    snapshotOutcome = 'candidate-after-snapshot-last-change';
  } else if (cross.lastAmbiguous && cross.lastAmbiguous.seq >= snapshotLastChange.seq) {
    snapshotOutcome = 'ambiguous-after-snapshot-last-change';
  } else {
    snapshotOutcome = 'unverified-late-change';
  }
  const completionAcrossRoles = {
    scope: 'snapshot-wide input-array order across roles; one role’s verification never proves another role’s change; child sessions and concurrency stay unobserved',
    lastChange: snapshotLastChange,
    lastCleanVerification: cross.lastCleanVerify,
    lastAmbiguousVerification: cross.lastAmbiguous,
    lastFailureSignal: cross.lastFailure,
    lastIncomplete: cross.lastIncomplete,
    changeAfterLastCleanVerification: Boolean(
      snapshotLastChange && (!cross.lastCleanVerify || snapshotLastChange.seq > cross.lastCleanVerify.seq),
    ),
    failureAfterSnapshotLastChange,
    incompleteAfterSnapshotLastChange,
    countsAfterSnapshotLastChange,
    visualCompletions: {
      captures: cross.visual.captures,
      reviews: cross.visual.reviews,
      // After-last-change split follows the declared array order; both stay
      // tool-completion counts, never observation or verdict (see limits).
      capturesAfterLastChange: afterCount(cross.visual.captureSeqs, false),
      reviewsAfterLastChange: afterCount(cross.visual.reviewSeqs, false),
      note: 'completed visual_capture/visual_review counts only (exact names, whole snapshot vs after-last-change split); never proof of rendering, task relevance, inspection, or change verification',
    },
    staleRoles,
    freshCandidateRoles,
    freshRolesStaledByLaterCrossRoleChange,
    ambiguousRoles,
    failureSignalRoles,
    noChangeRoles,
    outcome: snapshotOutcome,
    passedProof: 'none',
    outcomeNote: 'candidate-after-snapshot-last-change carries unknown outcome and no cross-role coverage proof; unverified-late-change means some change (observed or potential) has no later clean verification; ambiguous means the latest evidence is a mixed verify+mutate shell call with unprovable internal order.',
  };

  return { sessionId, valid: true, roles: toPlain(byRole), gaps, completionAcrossRoles };
}

export function summarizeAudits(audits) {
  const roleTotals = Object.create(null);
  const gapCounts = {};
  const snapshotCompletionOutcomes = {
    noChange: 0,
    candidateAfterLastChange: 0,
    unverifiedLateChange: 0,
    ambiguousAfterLastChange: 0,
    failureSignal: 0,
    legacyWithoutEvidence: 0,
  };
  let validSessions = 0;

  for (const a of audits) {
    if (!a || !a.valid) continue;
    validSessions += 1;
    for (const g of a.gaps ?? []) {
      gapCounts[g] = (gapCounts[g] ?? 0) + 1;
    }
    const snap = a.completionAcrossRoles;
    if (!snap || typeof snap.outcome !== 'string') {
      snapshotCompletionOutcomes.legacyWithoutEvidence += 1;
    } else if (snap.outcome === 'no-change-in-snapshot') snapshotCompletionOutcomes.noChange += 1;
    else if (snap.outcome === 'candidate-after-snapshot-last-change') snapshotCompletionOutcomes.candidateAfterLastChange += 1;
    else if (snap.outcome === 'unverified-late-change') snapshotCompletionOutcomes.unverifiedLateChange += 1;
    else if (snap.outcome === 'ambiguous-after-snapshot-last-change') snapshotCompletionOutcomes.ambiguousAfterLastChange += 1;
    else if (snap.outcome === 'failure-signal-after-snapshot-last-change') snapshotCompletionOutcomes.failureSignal += 1;
    else snapshotCompletionOutcomes.legacyWithoutEvidence += 1;
    for (const [role, s] of Object.entries(a.roles ?? {})) {
      // Null-prototype roleTotals keeps even hand-crafted hostile role keys
      // structurally safe: no sanitization, no invented identities.
      if (!roleTotals[role]) {
        roleTotals[role] = {
          sessions: 0,
          turns: 0,
          edits: 0,
          reads: 0,
          shells: 0,
          verificationRuns: 0,
          verificationNonzeroHints: 0,
          failedTools: freshCounts(),
          incompleteTools: freshCounts(),
          visualReadSessions: 0,
          postEditVisualReadSessions: 0,
          skillLoadedSessions: 0,
          authorityReadSessions: 0,
          authorityBeforeActionSessions: 0,
          detectorRuns: 0,
          skillsById: freshCounts(),
          skillsBeforeActionById: freshCounts(),
          skillsFirstAfterActionById: freshCounts(),
          possibleShellEdits: 0,
          delegations: 0,
          verificationAmbiguousCalls: 0,
          completionAfterLastChange: {
            withChange: 0,
            noChange: 0,
            candidateUnknown: 0,
            unverified: 0,
            ambiguous: 0,
            failureSignal: 0,
            withConfirmedEditLast: 0,
            withPotentialChangeLast: 0,
            legacyWithoutEvidence: 0,
          },
        };
      }
      const rt = roleTotals[role];
      rt.sessions += 1;
      rt.turns += s.turns;
      rt.edits += s.edits;
      rt.reads += s.reads;
      rt.shells += s.shells;
      rt.verificationRuns += s.verificationRuns;
      rt.verificationNonzeroHints += s.verificationNonzeroHints ?? 0;
      rt.detectorRuns += s.detectorRuns;
      rt.possibleShellEdits += s.possibleShellEdits ?? 0;
      rt.delegations += s.delegations ?? (s.subagentsCalled?.length ?? 0);
      rt.verificationAmbiguousCalls += s.verificationAmbiguousCalls ?? 0;
      if (!rt.completionAfterLastChange) {
        rt.completionAfterLastChange = {
          withChange: 0,
          noChange: 0,
          candidateUnknown: 0,
          unverified: 0,
          ambiguous: 0,
          failureSignal: 0,
          withConfirmedEditLast: 0,
          withPotentialChangeLast: 0,
          legacyWithoutEvidence: 0,
        };
      }
      // Legacy stored audits without completionEvidence stay countable without
      // inventing an outcome.
      const ev = s.completionEvidence;
      if (!ev || typeof ev.outcome !== 'string') {
        rt.completionAfterLastChange.legacyWithoutEvidence += 1;
      } else {
        if (ev.lastChangeKind) {
          rt.completionAfterLastChange.withChange += 1;
          if (ev.lastChangeKind === 'edit') rt.completionAfterLastChange.withConfirmedEditLast += 1;
          else rt.completionAfterLastChange.withPotentialChangeLast += 1;
        } else rt.completionAfterLastChange.noChange += 1;
        if (ev.outcome === 'candidate-unknown-after-last-change') rt.completionAfterLastChange.candidateUnknown += 1;
        else if (ev.outcome === 'unverified-after-last-change') rt.completionAfterLastChange.unverified += 1;
        else if (ev.outcome === 'ambiguous-after-last-change') rt.completionAfterLastChange.ambiguous += 1;
        else if (ev.outcome === 'failure-signal-after-last-change') rt.completionAfterLastChange.failureSignal += 1;
      }
      for (const [t, n] of Object.entries(s.failedTools ?? {})) {
        rt.failedTools[t] = (rt.failedTools[t] ?? 0) + n;
      }
      for (const [t, n] of Object.entries(s.incompleteTools ?? {})) {
        rt.incompleteTools[t] = (rt.incompleteTools[t] ?? 0) + n;
      }
      if (s.visualReads.length > 0) rt.visualReadSessions += 1;
      if (s.postEditVisualReads.length > 0) rt.postEditVisualReadSessions += 1;
      if (s.skillsLoaded.length > 0) rt.skillLoadedSessions += 1;
      if (s.authorityReads.length > 0) rt.authorityReadSessions += 1;
      if (s.authorityReadBeforeAction) rt.authorityBeforeActionSessions += 1;
      // Null-prototype maps keep every skill string safe as a key; arrays
      // stay untouched.
      for (const sk of s.skillsLoaded ?? []) {
        if (typeof sk !== 'string') continue;
        rt.skillsById[sk] = (rt.skillsById[sk] ?? 0) + 1;
      }
      for (const sk of s.skillsLoadedBeforeAction ?? []) {
        if (typeof sk !== 'string') continue;
        rt.skillsBeforeActionById[sk] = (rt.skillsBeforeActionById[sk] ?? 0) + 1;
      }
      for (const sk of s.skillsFirstLoadedAfterAction ?? []) {
        if (typeof sk !== 'string') continue;
        rt.skillsFirstAfterActionById[sk] = (rt.skillsFirstAfterActionById[sk] ?? 0) + 1;
      }
    }
  }

  return {
    validSessions,
    auditedSnapshots: validSessions,
    countBasis: 'audited file snapshots in input-array order; not a count of independent sessions',
    gapBasis: 'gaps flag missing observations only; not quality or compliance verdicts',
    completionBasis: 'role evidence is role-scoped; snapshot freshness needs completionAcrossRoles/snapshotCompletionOutcomes; candidate-unknown vs ambiguous vs failure-signal vs unverified stay distinct; mixed verify+mutate shell calls never count as after-last-change verification; input order follows the caller-declared order option (default oldest-first); passedProof is always none here',
    roleTotals: toPlain(roleTotals),
    gapCounts,
    snapshotCompletionOutcomes,
    limitations: [...LIMITATIONS],
    coverage: { ...COVERAGE },
    notice: 'Heuristic execution anomaly detector (visible tool traces and input-array order only); not a product or design quality certifier.',
  };
}

export async function auditPath(targetPath, { order = 'oldest-first' } = {}) {
  checkOrder(order);
  const resolved = path.resolve(String(targetPath));
  const stat = await fsp.stat(resolved);
  const excludedFiles = [];
  const errorFiles = [];
  const sessions = [];
  const seenWindows = new Map(); // exact message-window JSON -> [file labels]
  const explicitIds = new Map(); // explicit in-payload session id -> [file labels]
  let anonymousSnapshots = 0;
  let scanned = 0;

  const ingest = (raw, label) => {
    const msgs = extractMessages(raw);
    if (!msgs) {
      excludedFiles.push({ file: label, reason: 'no-message-array' });
      return;
    }
    // Basename is a label only; identity comes from explicit in-payload ids.
    const explicitId = explicitSessionIdOf(raw);
    const audit = auditMessages(msgs, { sessionId: explicitId ?? `anonymous:${label}`, order });
    audit.label = label;
    audit.anonymous = explicitId ? false : true;
    audit.explicitSessionId = explicitId;
    sessions.push(audit);
    if (explicitId) {
      if (!explicitIds.has(explicitId)) explicitIds.set(explicitId, []);
      explicitIds.get(explicitId).push(label);
    } else {
      anonymousSnapshots += 1;
    }
    // Duplicate-window grouping is best-effort: stringify once and skip
    // grouping (never the audit itself) when the window exceeds budget.
    let key = null;
    try {
      const s = JSON.stringify(msgs);
      if (s.length <= AUDIT_BUDGETS.maxWindowChars) key = s;
    } catch {
      key = null;
    }
    if (key !== null) {
      if (!seenWindows.has(key)) seenWindows.set(key, []);
      seenWindows.get(key).push(label);
    }
  };

  if (stat.isFile()) {
    scanned = 1;
    const label = path.basename(resolved);
    try {
      ingest(JSON.parse(await fsp.readFile(resolved, 'utf8')), label);
    } catch {
      errorFiles.push({ file: label, reason: 'unparseable-json' });
    }
  } else if (stat.isDirectory()) {
    const entries = (await fsp.readdir(resolved)).sort();
    scanned = entries.length;
    for (const f of entries) {
      if (!f.endsWith('.json')) {
        excludedFiles.push({ file: f, reason: 'non-json-file' });
        continue;
      }
      try {
        ingest(JSON.parse(await fsp.readFile(path.join(resolved, f), 'utf8')), f);
      } catch {
        errorFiles.push({ file: f, reason: 'unparseable-json' });
      }
    }
  } else {
    throw new Error('Unsupported target path');
  }

  const duplicateWindows = [...seenWindows.values()].filter((g) => g.length > 1);
  const inventory = {
    target: resolved,
    scanned,
    sessionLike: sessions.length,
    excluded: excludedFiles.length,
    errors: errorFiles.length,
    excludedFiles,
    errorFiles,
    uniqueExplicitSessionIds: [...explicitIds.keys()],
    repeatedExplicitSessionIds: [...explicitIds.entries()].filter(([, v]) => v.length > 1).map(([id, files]) => ({ id, files })),
    anonymousSnapshots,
    duplicateWindows,
    note: 'Counts are audited file snapshots, not a census of independent sessions; basenames are labels, not identity.',
    observationScope: 'each file audited independently in input-array order; delegation calls do not link to child snapshots; non-atomic concurrent changes and shell file mutations outside edit/write/patch are blind spots (see limitations).',
  };
  return { summary: summarizeAudits(sessions), sessions, inventory };
}
