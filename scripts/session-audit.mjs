// session-audit.mjs — opt-in read-only heuristic anomaly detector for agent
// execution traces (tool status, temporal ordering of authority reads before
// edits/delegation, UX/IA vs visual-craft skill loads, post-edit visual capture
// reads, and post-edit verification runs).
// Node stdlib only; never mutates sessions, config, or project files, and does
// not certify product or design quality.
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORITY_RE = /(?:^|\/)(?:AGENTS\.md|00_READ_FIRST\.md|PRODUCT_CONSTITUTION\.md|DOMAIN_INVARIANTS\.md|FINAL_DECISION_LEDGER[^/]*\.md|MASTER_PRD[^/]*\.md|product-state\.md|DESIGN-SYSTEM\.md|ADR-[^/]+\.md|openspec\/[^/]+\/.+|contracts\/[^/]+\..+)$/i;
const CRAFT_RE = /(?:^|\/)(?:craft-floor\.md|operate\.md|new-work\.md|critique\.md|polish\.md|typeset\.md|layout\.md|colorize\.md)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif)$/i;
const DETECT_RE = /\bimpeccable\b[^\n]*\bdetect\b|\bdetect\s+--json\b/i;
const OPENSPEC_CMD_RE = /\bopenspec\s+(?:validate|status|list|show|init|new|archive)\b/i;
const VERIFY_CMD_RE = /\b(?:node\s+--test|pytest|vitest|jest|mocha|gradle\w*|cargo\s+(?:test|check|build)|(?:npm|pnpm|yarn|bun)\s+(?:test|run\s+(?:test|build|check|lint|typecheck|verify))|tsc\b|mypy\b|ruff\b|eslint\b|python3?\s+[^\n]*check[^\n]*\.py|bash\s+scripts\/(?:run_all_tests|android_host_tests|run_local_verification)\b|playwright\s+test)\b/i;

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

function isFailedTool(part) {
  const status = part?.state?.status ?? part?.status ?? null;
  if (status === 'error' || status === 'failed') return true;
  if (part?.state?.error || part?.error) return true;
  return false;
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
        if (DETECT_RE.test(cmd)) stat.detectorRuns += 1;
        if (OPENSPEC_CMD_RE.test(cmd)) stat.openspecCommands += 1;
        if (VERIFY_CMD_RE.test(cmd) || DETECT_RE.test(cmd)) {
          stat.verificationRuns += 1;
          if (stat.edits > 0) stat.postEditVerificationRuns += 1;
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
    if ((role === 'design' || role === 'engineer') && s.edits > 0) {
      if (s.authorityReads.length === 0) gaps.push(`${role}-edited-without-authority-read`);
      else if (!s.authorityReadBeforeAction) gaps.push(`${role}-edited-before-authority-read`);
    }
    if (role === 'plan' && s.turns > 0 && s.authorityReads.length === 0) {
      gaps.push('plan-advised-without-authority-read');
    }
    if (role === 'design' && s.edits > 0) {
      const hasDesignSkill = s.uxSkillsLoaded.length > 0 || s.craftSkillsLoaded.length > 0 || s.craftReads.length > 0;
      if (!hasDesignSkill) {
        gaps.push('design-edited-without-ux-or-craft-skill');
      }
      if (s.visualReads.length === 0) {
        gaps.push('design-edited-without-visual-capture-read');
      } else if (s.postEditVisualReads.length === 0) {
        gaps.push('design-no-post-edit-visual-read');
      }
    }
    if (role === 'engineer' && s.edits > 0) {
      if (s.verificationRuns === 0) {
        gaps.push('engineer-edited-without-verification-run');
      } else if (s.postEditVerificationRuns === 0) {
        gaps.push('engineer-no-post-edit-verification-run');
      }
    }
    if (role === 'critic' && s.turns > 0) {
      if (s.reads === 0) gaps.push('critic-reviewed-without-evidence-read');
      if (s.skillsLoaded.length === 0) gaps.push('critic-reviewed-without-skill-lens');
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
      rt.detectorRuns += s.detectorRuns;
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
    roleTotals,
    gapCounts,
    notice: 'Heuristic execution anomaly detector (tool sequence and status only); not a product or design quality certifier.',
  };
}

export async function auditPath(targetPath) {
  const resolved = path.resolve(String(targetPath));
  const stat = await fsp.stat(resolved);
  if (stat.isFile()) {
    const raw = JSON.parse(await fsp.readFile(resolved, 'utf8'));
    const msgs = extractMessages(raw);
    const single = auditMessages(msgs, { sessionId: path.basename(resolved, '.json') });
    return { summary: summarizeAudits([single]), sessions: [single] };
  }
  if (stat.isDirectory()) {
    const entries = (await fsp.readdir(resolved)).filter((f) => f.endsWith('.json')).sort();
    const sessions = [];
    for (const f of entries) {
      try {
        const raw = JSON.parse(await fsp.readFile(path.join(resolved, f), 'utf8'));
        const msgs = extractMessages(raw);
        if (msgs) sessions.push(auditMessages(msgs, { sessionId: path.basename(f, '.json') }));
      } catch {
        // skip non-session or unreadable files
      }
    }
    return { summary: summarizeAudits(sessions), sessions };
  }
  throw new Error('Unsupported target path');
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    process.stderr.write('Usage: node scripts/session-audit.mjs <session-json-file-or-directory>\n');
    process.exit(1);
  }
  try {
    const report = await auditPath(target);
    process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
  } catch {
    process.stdout.write('{"validSessions":0,"error":"targetUnavailable"}\n');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
