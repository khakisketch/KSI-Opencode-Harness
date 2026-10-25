// session-audit.test.mjs — unit tests for the session execution anomaly detector.
// Run: `node --test tests/session-audit.test.mjs`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditMessages, summarizeAudits } from '../scripts/session-audit.mjs';

const toolPart = (name, input, status = 'completed', error = null) => ({
  type: 'tool',
  name,
  state: { status, input, ...(error ? { error: { message: error } } : {}) },
});

const assistantMsg = (agent, parts) => ({
  type: 'assistant',
  agent,
  content: parts,
});

describe('session-audit behavioral and temporal verification', () => {
  it('passes a well-ordered design session (authority -> UX/craft skill -> edit -> detect -> post-edit visual read)', () => {
    const msgs = [
      assistantMsg('design', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('skill', { id: 'designing-user-experience' }),
        toolPart('skill', { id: 'impeccable' }),
        toolPart('read', { path: '/home/user/.config/opencode/skills/impeccable/reference/craft-floor.md' }),
        toolPart('edit', { path: '/proj/app/page.tsx' }),
        toolPart('shell', { command: '.opencode/skills/impeccable/scripts/impeccable detect --json app/page.tsx' }),
        toolPart('read', { path: '/tmp/opencode/entry-1440.png' }),
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_good_design' });
    assert.equal(res.valid, true);
    assert.deepEqual(res.gaps, []);
    assert.equal(res.roles.design.authorityReadBeforeAction, true);
    assert.deepEqual(res.roles.design.uxSkillsLoaded, ['designing-user-experience']);
    assert.deepEqual(res.roles.design.craftSkillsLoaded, ['impeccable']);
    assert.deepEqual(res.roles.design.postEditVisualReads, ['opencode/entry-1440.png']);
    assert.equal(res.roles.design.detectorRuns, 1);
  });

  it('flags out-of-order authority reads, non-design skill only, and pre-edit-only visual reads', () => {
    const msgs = [
      assistantMsg('design', [
        // Read image BEFORE edit, never after
        toolPart('read', { path: '/tmp/opencode/before.png' }),
        // Loaded only playwright-cli, no UX or craft skill
        toolPart('skill', { id: 'playwright-cli' }),
        // Edited BEFORE reading AGENTS.md
        toolPart('edit', { path: '/proj/app/page.tsx' }),
        toolPart('read', { path: '/proj/AGENTS.md' }),
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_order_gaps' });
    assert.ok(res.gaps.includes('design-edited-before-authority-read'));
    assert.ok(res.gaps.includes('design-edited-without-ux-or-craft-skill'));
    assert.ok(res.gaps.includes('design-no-post-edit-visual-read'));
  });

  it('ignores failed (status:error) tool calls and non-test shell commands', () => {
    const msgs = [
      assistantMsg('engineer', [
        // Failed authority read must not count
        toolPart('read', { path: '/proj/AGENTS.md' }, 'error', 'ENOENT'),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        // Non-verification shell command (ls) must not count as test/build check
        toolPart('shell', { command: 'ls -la' }),
        // Failed test run must not count as completed verification
        toolPart('shell', { command: 'npm test' }, 'error', 'exit 1'),
      ]),
      assistantMsg('build', [
        toolPart('subagent', { agent: 'engineer', prompt: 'do work' }),
      ]),
      assistantMsg('plan', [
        { type: 'text', text: 'Do X next.' },
      ]),
      assistantMsg('critic', [
        toolPart('skill', { id: 'ux-heuristics-audit' }, 'error', 'denied'),
        { type: 'text', text: 'Looks good to me.' },
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_strict_gaps' });
    assert.ok(res.gaps.includes('engineer-edited-without-authority-read'));
    assert.ok(res.gaps.includes('engineer-edited-without-verification-run'));
    assert.ok(res.gaps.includes('build-acted-without-authority-read'));
    assert.ok(res.gaps.includes('plan-advised-without-authority-read'));
    assert.ok(res.gaps.includes('critic-reviewed-without-evidence-read'));
    assert.ok(res.gaps.includes('critic-reviewed-without-skill-lens'));
  });

  it('requires verification run AFTER the latest engineer edit', () => {
    const msgs = [
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/api.test.mjs' }),
        // Second edit with no subsequent test run
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_stale_verify' });
    assert.ok(res.gaps.includes('engineer-no-post-edit-verification-run'));
  });

  it('summarizes multi-session metrics and includes the anomaly-detector notice', () => {
    const a1 = auditMessages([
      assistantMsg('design', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('skill', { id: 'impeccable' }),
        toolPart('edit', { path: 'a.tsx' }),
        toolPart('read', { path: 'shot.png' }),
      ]),
    ], { sessionId: 's1' });
    const summary = summarizeAudits([a1]);
    assert.equal(summary.validSessions, 1);
    assert.equal(summary.roleTotals.design.authorityBeforeActionSessions, 1);
    assert.equal(summary.roleTotals.design.postEditVisualReadSessions, 1);
    assert.ok(summary.notice.includes('anomaly detector'));
  });
});
