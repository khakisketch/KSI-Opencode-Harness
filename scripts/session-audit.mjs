// session-audit.mjs — opt-in read-only observer of visible agent tool traces
// (explicit completed tool status, input-array order of authority reads before
// edits/delegation, UX/IA vs visual-craft skill loads, observed image-path
// reads, and shell command-pattern candidates).
// Describes traces only; never proves understanding, design success, test
// success, session independence, or model quality. Node stdlib only; never
// mutates sessions, config, or project files.
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORITY_RE = /(?:^|\/)(?:AGENTS\.md|00_READ_FIRST\.md|PRODUCT_CONSTITUTION\.md|DOMAIN_INVARIANTS\.md|FINAL_DECISION_LEDGER[^/]*\.md|MASTER_PRD[^/]*\.md|product-state\.md|DESIGN-SYSTEM\.md|ADR-[^/]+\.md|openspec\/[^/]+\/.+|contracts\/[^/]+\..+)$/i;
const CRAFT_RE = /(?:^|\/)(?:craft-floor\.md|operate\.md|new-work\.md|critique\.md|polish\.md|typeset\.md|layout\.md|colorize\.md)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif)$/i;
const DETECT_RE = /\bimpeccable\b[^\n]*\bdetect\b|\bdetect\s+--json\b/i;
const OPENSPEC_CMD_RE = /\bopenspec\s+(?:validate|status|list|show|init|new|archive)\b/i;
const VERIFY_CMD_RE = /\b(?:node\s+--test|pytest|vitest|jest|mocha|gradle\w*|cargo\s+(?:test|check|build)|(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+(?:test|build|check|lint|typecheck|verify))|tsc\b|mypy\b|ruff\b|eslint\b|python3?\s+[^\n]*check[^\n]*\.py|bash\s+scripts\/(?:run_all_tests|android_host_tests|run_local_verification)\b|playwright\s+test)\b/i;

const COMPLETED_RE = /^completed$/i;
const NONZERO_EXIT_RE = /\bexit(?:ed)?(?:\s+code)?\s*[:=]?\s*[1-9]\d*\b|exitcode\s*[:=]\s*[1-9]/i;
const ECHO_LEAD_RE = /^\s*echo(?:\s|$)/i;
const SHELL_CHAIN_RE = /[;&|]|\$\(/;

const LIMITATIONS = [
  'trace-observation-only: a missing skill/read is not proof it never happened (other channels, redaction, or trace gaps).',
  'status-basis: only an explicit `completed` status counts as completed; pending/running/missing/unknown counts as incomplete, never as done.',
  'verification-basis: shell matches are command-pattern candidates only (echo-only excluded); obvious nonzero-exit output is counted separately and is not a passing run.',
  'visual-basis: image-extension reads are observed path reads only; not proof of task relevance, rendering, or inspection.',
  'order-basis: sequence is input-array order as observed only; not timestamp or concurrency proof.',
  'identity-basis: file basenames are labels, not session identity; exact repeated message windows are grouped, not a complete census.',
  'no-quality-attribution: no version, prompt, or model quality claims; not a product or design certifier.',
];

const COVERAGE = {
  statusBasis: 'explicit `completed` status only; failed vs incomplete counted separately',
  verificationBasis: 'command-pattern candidate only: verificationRuns counts candidates, not passed tests; nonzero-exit hints separated; not exit-success proof',
  visualBasis: 'observed image-path reads only; not task-relevance proof',
  orderBasis: 'input-array order only; not timestamp/concurrency proof',
  identityBasis: 'explicit in-payload session id only; basename labels stay anonymous:<file>; exact message-window duplicates grouped',
  qualityScope: 'visible tool traces only; no version/prompt/model quality attribution',
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
  'emilkowalski-motion',
]);

function extractMessages(payload) {
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

function shellOutputBlob(part) {
  const vals = [part?.state?.output, part?.state?.result, part?.output, part?.result, part?.state?.text, part?.text];
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

function explicitSessionIdOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cands = [raw.sessionId, raw.sessionID, raw.session_id, raw?.metadata?.sessionId, raw?.metadata?.sessionID, raw?.session?.id];
  for (const c of cands) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

export function auditMessages(messages, { sessionId = 'unknown' } = {}) {
  if (!Array.isArray(messages)) {
    return { sessionId, valid: false, roles: {}, gaps: ['invalid-message-array'] };
  }
  const byRole = {};
  const ensureRole = (role) => {
    if (!byRole[role]) {
      byRole[role] = {
        turns: 0,
        tools: {},
        failedTools: {},
        incompleteTools: {},
        skillsLoaded: [],
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
      };
    }
    return byRole[role];
  };

  const pushUnique = (arr, val) => {
    if (val && !arr.includes(val)) arr.push(val);
  };

  for (const msg of messages) {
    if (!msg || (msg.type !== 'assistant' && msg.role !== 'assistant')) continue;
    const role = typeof msg.agent === 'string' && msg.agent ? msg.agent : 'unknown';
    const stat = ensureRole(role);
    stat.turns += 1;
    const parts = Array.isArray(msg.content) ? msg.content : (Array.isArray(msg.parts) ? msg.parts : []);
    for (const part of parts) {
      if (!part || part.type !== 'tool') continue;
      const toolName = typeof part.name === 'string' && part.name ? part.name : (typeof part.tool === 'string' ? part.tool : 'unknown');

      if (isFailedTool(part)) {
        stat.failedTools[toolName] = (stat.failedTools[toolName] ?? 0) + 1;
        continue;
      }
      // Pending/running/missing status: observed but not completed. Never
      // counted as a completed tool call (authority read, skill, verify, ...).
      if (!isCompletedTool(part)) {
        stat.incompleteTools[toolName] = (stat.incompleteTools[toolName] ?? 0) + 1;
        continue;
      }

      stat.tools[toolName] = (stat.tools[toolName] ?? 0) + 1;
      const inp = part.state?.input ?? part.input ?? part.args ?? {};

      if (toolName === 'skill') {
        const skillId = typeof inp.id === 'string' ? inp.id : (typeof inp.name === 'string' ? inp.name : '');
        pushUnique(stat.skillsLoaded, skillId);
        if (UX_IA_SKILLS.has(skillId)) pushUnique(stat.uxSkillsLoaded, skillId);
        if (CRAFT_COPY_SKILLS.has(skillId)) pushUnique(stat.craftSkillsLoaded, skillId);
      } else if (toolName === 'subagent') {
        stat.actedYet = true;
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
        // Reset post-edit trackers so verification/visual reads must happen AFTER the latest edit
        stat.postEditVisualReads = [];
        stat.postEditVerificationRuns = 0;
      } else if (toolName === 'shell') {
        stat.shells += 1;
        const cmd = String(inp.command ?? '');
        // Command-pattern candidates only: a regex match is not proof the
        // check ran or passed (echo-only commands excluded outright).
        const echoOnly = isEchoOnlyCommand(cmd);
        if (!echoOnly && DETECT_RE.test(cmd)) stat.detectorRuns += 1;
        if (!echoOnly && OPENSPEC_CMD_RE.test(cmd)) stat.openspecCommands += 1;
        if (!echoOnly && (VERIFY_CMD_RE.test(cmd) || DETECT_RE.test(cmd))) {
          // Completed transport with visibly nonzero exit text is a failure
          // hint, not a passing verification run.
          if (hasNonzeroExitHint(part)) {
            stat.verificationNonzeroHints += 1;
          } else {
            stat.verificationRuns += 1;
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

  return { sessionId, valid: true, roles: byRole, gaps };
}

export function summarizeAudits(audits) {
  const roleTotals = {};
  const gapCounts = {};
  let validSessions = 0;

  for (const a of audits) {
    if (!a || !a.valid) continue;
    validSessions += 1;
    for (const g of a.gaps ?? []) {
      gapCounts[g] = (gapCounts[g] ?? 0) + 1;
    }
    for (const [role, s] of Object.entries(a.roles ?? {})) {
      if (!roleTotals[role]) {
        roleTotals[role] = {
          sessions: 0,
          turns: 0,
          edits: 0,
          reads: 0,
          shells: 0,
          verificationRuns: 0,
          verificationNonzeroHints: 0,
          failedTools: {},
          incompleteTools: {},
          visualReadSessions: 0,
          postEditVisualReadSessions: 0,
          skillLoadedSessions: 0,
          authorityReadSessions: 0,
          authorityBeforeActionSessions: 0,
          detectorRuns: 0,
          skillsById: {},
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
      for (const [t, n] of Object.entries(s.failedTools ?? {})) rt.failedTools[t] = (rt.failedTools[t] ?? 0) + n;
      for (const [t, n] of Object.entries(s.incompleteTools ?? {})) rt.incompleteTools[t] = (rt.incompleteTools[t] ?? 0) + n;
      if (s.visualReads.length > 0) rt.visualReadSessions += 1;
      if (s.postEditVisualReads.length > 0) rt.postEditVisualReadSessions += 1;
      if (s.skillsLoaded.length > 0) rt.skillLoadedSessions += 1;
      if (s.authorityReads.length > 0) rt.authorityReadSessions += 1;
      if (s.authorityReadBeforeAction) rt.authorityBeforeActionSessions += 1;
      for (const sk of s.skillsLoaded) {
        rt.skillsById[sk] = (rt.skillsById[sk] ?? 0) + 1;
      }
    }
  }

  return {
    validSessions,
    auditedSnapshots: validSessions,
    countBasis: 'audited file snapshots in input-array order; not a count of independent sessions',
    gapBasis: 'gaps flag missing observations only; not quality or compliance verdicts',
    roleTotals,
    gapCounts,
    limitations: [...LIMITATIONS],
    coverage: { ...COVERAGE },
    notice: 'Heuristic execution anomaly detector (visible tool traces and input-array order only); not a product or design quality certifier.',
  };
}

export async function auditPath(targetPath) {
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
    const audit = auditMessages(msgs, { sessionId: explicitId ?? `anonymous:${label}` });
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
    const key = JSON.stringify(msgs);
    if (!seenWindows.has(key)) seenWindows.set(key, []);
    seenWindows.get(key).push(label);
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
  };
  return { summary: summarizeAudits(sessions), sessions, inventory };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write('Usage: node scripts/session-audit.mjs <session-json-file-or-directory>\n');
    process.exit(1);
  }
  try {
    const report = await auditPath(target);
    // Summary fields plus inventory; the full per-file sessions payload is
    // intentionally omitted to keep CLI output small.
    process.stdout.write(`${JSON.stringify({ ...report.summary, inventory: report.inventory }, null, 2)}\n`);
  } catch {
    process.stdout.write('{"validSessions":0,"auditedSnapshots":0,"error":"targetUnavailable"}\n');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
