// session-audit.mjs — opt-in read-only audit of actual agent execution behavior
// (skill invocations, authoritative doc/OpenSpec reads, visual capture reads,
// detector runs, and edit-vs-verification linkage) from session message JSON.
// Node stdlib only; never mutates sessions, config, or project files.
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const AUTHORITY_RE = /(?:^|\/)(?:AGENTS\.md|00_READ_FIRST\.md|PRODUCT_CONSTITUTION\.md|DOMAIN_INVARIANTS\.md|FINAL_DECISION_LEDGER[^/]*\.md|MASTER_PRD[^/]*\.md|product-state\.md|DESIGN-SYSTEM\.md|ADR-[^/]+\.md|openspec\/[^/]+\/.+|contracts\/[^/]+\..+)$/i;
const CRAFT_RE = /(?:^|\/)(?:craft-floor\.md|operate\.md|new-work\.md|critique\.md|polish\.md|typeset\.md|layout\.md|colorize\.md)$/i;
const IMAGE_RE = /\.(?:png|jpe?g|webp|gif)$/i;
const DETECT_RE = /\bimpeccable\b[^\n]*\bdetect\b|\bdetect\s+--json\b/i;
const OPENSPEC_CMD_RE = /\bopenspec\s+(?:validate|status|list|show|init|new|archive)\b/i;

function extractMessages(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.messages)) return payload.messages;
    if (Array.isArray(payload.data)) return payload.data;
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
        skillsLoaded: [],
        authorityReads: [],
        openspecReads: [],
        craftReads: [],
        visualReads: [],
        subagentsCalled: [],
        detectorRuns: 0,
        openspecCommands: 0,
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
      stat.tools[toolName] = (stat.tools[toolName] ?? 0) + 1;
      const inp = part.state?.input ?? part.input ?? part.args ?? {};

      if (toolName === 'skill') {
        const skillId = typeof inp.id === 'string' ? inp.id : (typeof inp.name === 'string' ? inp.name : '');
        pushUnique(stat.skillsLoaded, skillId);
      } else if (toolName === 'subagent') {
        const target = typeof inp.agent === 'string' ? inp.agent : '';
        pushUnique(stat.subagentsCalled, target);
      } else if (toolName === 'read') {
        stat.reads += 1;
        const rawPath = String(inp.path ?? inp.filePath ?? '');
        const shortPath = rawPath.split('/').slice(-2).join('/');
        if (IMAGE_RE.test(rawPath)) pushUnique(stat.visualReads, shortPath);
        if (AUTHORITY_RE.test(rawPath)) pushUnique(stat.authorityReads, shortPath);
        if (/\/openspec\//i.test(rawPath) || /^openspec\//i.test(rawPath)) pushUnique(stat.openspecReads, shortPath);
        if (CRAFT_RE.test(rawPath)) pushUnique(stat.craftReads, shortPath);
      } else if (toolName === 'edit' || toolName === 'write' || toolName === 'patch') {
        stat.edits += 1;
      } else if (toolName === 'shell') {
        stat.shells += 1;
        const cmd = String(inp.command ?? '');
        if (DETECT_RE.test(cmd)) stat.detectorRuns += 1;
        if (OPENSPEC_CMD_RE.test(cmd)) stat.openspecCommands += 1;
      }
    }
  }

  const gaps = [];
  for (const [role, s] of Object.entries(byRole)) {
    if ((role === 'design' || role === 'engineer') && s.edits > 0 && s.authorityReads.length === 0) {
      gaps.push(`${role}-edited-without-authority-read`);
    }
    if (role === 'plan' && s.turns > 0 && s.authorityReads.length === 0) {
      gaps.push('plan-advised-without-authority-read');
    }
    if (role === 'design' && s.edits > 0) {
      if (s.skillsLoaded.length === 0 && s.craftReads.length === 0) {
        gaps.push('design-edited-without-skill-or-craft-reference');
      }
      if (s.visualReads.length === 0) {
        gaps.push('design-edited-without-visual-capture-read');
      }
    }
    if (role === 'engineer' && s.edits > 0 && s.shells === 0) {
      gaps.push('engineer-edited-without-runtime-or-test-check');
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
          visualReadSessions: 0,
          skillLoadedSessions: 0,
          authorityReadSessions: 0,
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
      rt.detectorRuns += s.detectorRuns;
      if (s.visualReads.length > 0) rt.visualReadSessions += 1;
      if (s.skillsLoaded.length > 0) rt.skillLoadedSessions += 1;
      if (s.authorityReads.length > 0) rt.authorityReadSessions += 1;
      for (const sk of s.skillsLoaded) {
        rt.skillsById[sk] = (rt.skillsById[sk] ?? 0) + 1;
      }
    }
  }

  return { validSessions, roleTotals, gapCounts };
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
