// session-audit.test.mjs — pure unit tests for the session execution auditor.
// Run: `node --test tests/session-audit.test.mjs`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { auditMessages, summarizeAudits } from '../scripts/session-audit.mjs';

const toolPart = (name, input) => ({
  type: 'tool',
  name,
  state: { status: 'completed', input },
});

const assistantMsg = (agent, parts) => ({
  type: 'assistant',
  agent,
  content: parts,
});

describe('session-audit behavioral verification', () => {
  it('tracks skill loads, authority reads, craft reads, visual reads, and detector runs', () => {
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
    assert.deepEqual(res.roles.design.skillsLoaded, ['designing-user-experience', 'impeccable']);
    assert.deepEqual(res.roles.design.authorityReads, ['proj/AGENTS.md']);
    assert.deepEqual(res.roles.design.craftReads, ['reference/craft-floor.md']);
    assert.deepEqual(res.roles.design.visualReads, ['opencode/entry-1440.png']);
    assert.equal(res.roles.design.detectorRuns, 1);
  });

  it('flags design editing UI without loading skills or reading rendered captures', () => {
    const msgs = [
      assistantMsg('design', [
        toolPart('read', { path: '/proj/app/page.tsx' }),
        toolPart('edit', { path: '/proj/app/page.tsx' }),
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_bad_design' });
    assert.ok(res.gaps.includes('design-edited-without-authority-read'));
    assert.ok(res.gaps.includes('design-edited-without-skill-or-craft-reference'));
    assert.ok(res.gaps.includes('design-edited-without-visual-capture-read'));
  });

  it('flags engineer editing without authority or checks, plan without authority, and critic without evidence or skill lens', () => {
    const msgs = [
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
      assistantMsg('plan', [
        { type: 'text', text: 'Do X next.' },
      ]),
      assistantMsg('critic', [
        { type: 'text', text: 'Looks good to me.' },
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_gaps' });
    assert.ok(res.gaps.includes('engineer-edited-without-authority-read'));
    assert.ok(res.gaps.includes('engineer-edited-without-runtime-or-test-check'));
    assert.ok(res.gaps.includes('plan-advised-without-authority-read'));
    assert.ok(res.gaps.includes('critic-reviewed-without-evidence-read'));
    assert.ok(res.gaps.includes('critic-reviewed-without-skill-lens'));
  });

  it('summarizes multi-session skill adoption and gap frequencies accurately', () => {
    const a1 = auditMessages([
      assistantMsg('design', [
        toolPart('skill', { id: 'impeccable' }),
        toolPart('edit', { path: 'a.tsx' }),
        toolPart('read', { path: 'shot.png' }),
      ]),
    ], { sessionId: 's1' });
    const a2 = auditMessages([
      assistantMsg('design', [
        toolPart('edit', { path: 'b.tsx' }),
      ]),
    ], { sessionId: 's2' });
    const summary = summarizeAudits([a1, a2]);
    assert.equal(summary.validSessions, 2);
    assert.equal(summary.roleTotals.design.sessions, 2);
    assert.equal(summary.roleTotals.design.skillLoadedSessions, 1);
    assert.equal(summary.roleTotals.design.visualReadSessions, 1);
    assert.equal(summary.roleTotals.design.skillsById.impeccable, 1);
    assert.equal(summary.gapCounts['design-edited-without-skill-or-craft-reference'], 1);
    assert.equal(summary.gapCounts['design-edited-without-visual-capture-read'], 1);
  });
});
