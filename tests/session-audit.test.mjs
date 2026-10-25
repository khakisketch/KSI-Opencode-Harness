// session-audit.test.mjs — unit tests for the session execution anomaly detector.
// Run: `node --test tests/session-audit.test.mjs`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditMessages, summarizeAudits, auditPath } from '../scripts/session-audit.mjs';

const AUDIT_SCRIPT = fileURLToPath(new URL('../scripts/session-audit.mjs', import.meta.url));

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
    assert.ok(res.gaps.includes('engineer-no-observed-verification-candidate'));
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
    assert.ok(res.gaps.includes('engineer-no-post-edit-verification-candidate'));
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

  it('counts only explicit completed status; pending/missing are incomplete, never done', () => {
    const pendingRead = { type: 'tool', name: 'read', state: { status: 'pending', input: { path: '/proj/AGENTS.md' } } };
    const pendingShell = { type: 'tool', name: 'shell', state: { status: 'pending', input: { command: 'npm test' } } };
    const missingStatusShell = { type: 'tool', name: 'shell', state: { input: { command: 'node --test tests/x.test.mjs' } } };
    const msgs = [
      assistantMsg('engineer', [
        pendingRead,
        toolPart('edit', { path: '/proj/src/api.ts' }),
        pendingShell,
        missingStatusShell,
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_pending' });
    // Pending authority read must not satisfy the authority requirement.
    assert.ok(res.gaps.includes('engineer-edited-without-authority-read'));
    // Pending/missing-status verify commands must not count as verification.
    assert.ok(res.gaps.includes('engineer-no-observed-verification-candidate'));
    assert.deepEqual(res.roles.engineer.incompleteTools, { read: 1, shell: 2 });
    assert.ok(!('read' in res.roles.engineer.tools));
    assert.ok(!('shell' in res.roles.engineer.tools));
  });

  it('excludes echo-only commands and separates nonzero-exit output from candidates', () => {
    const echoOnly = { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'echo "npm test"' } } };
    const nonzeroOut = {
      type: 'tool', name: 'shell',
      state: { status: 'completed', input: { command: 'npm test' }, output: 'some failures\nnpm ERR! exit 1' },
    };
    const msgs = [
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        echoOnly,
        nonzeroOut,
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_echo_nonzero' });
    assert.equal(res.roles.engineer.verificationRuns, 0);
    assert.equal(res.roles.engineer.verificationNonzeroHints, 1);
    assert.ok(res.gaps.includes('engineer-no-observed-verification-candidate'));
  });

  it('counts ambiguous suite output as a candidate with unknown outcome, never a pass verdict', () => {
    // No broad fail-word matching: '1 failed, 2 passed' carries no explicit
    // exit code, so it stays a command-pattern candidate with unknown outcome.
    const ambiguousOut = {
      type: 'tool', name: 'shell',
      state: { status: 'completed', input: { command: 'npm test' }, output: '1 failed, 2 passed' },
    };
    const msgs = [
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        ambiguousOut,
      ]),
    ];
    const res = auditMessages(msgs, { sessionId: 'ses_ambiguous_suite' });
    assert.equal(res.roles.engineer.verificationRuns, 1);
    assert.equal(res.roles.engineer.verificationNonzeroHints, 0);
    assert.equal(res.roles.engineer.postEditVerificationRuns, 1);
    assert.ok(!res.gaps.some((g) => g.includes('verification-candidate')));
    const summary = summarizeAudits([res]);
    assert.ok(summary.coverage.verificationBasis.includes('not passed tests'));
    assert.equal(summary.gapBasis, 'gaps flag missing observations only; not quality or compliance verdicts');
  });

  it('summary carries machine-readable limitations and coverage (no quality attribution)', () => {
    const a1 = auditMessages([
      assistantMsg('design', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('skill', { id: 'impeccable' }),
        toolPart('edit', { path: 'a.tsx' }),
        toolPart('read', { path: 'shot.png' }),
      ]),
    ], { sessionId: 's1' });
    const summary = summarizeAudits([a1]);
    assert.ok(Array.isArray(summary.limitations));
    const blob = summary.limitations.join('\n');
    assert.ok(blob.includes('not proof it never happened'));
    assert.ok(blob.includes('not proof of task relevance'));
    assert.ok(blob.includes('no version, prompt, or model quality claims'));
    assert.equal(summary.coverage.orderBasis, 'input-array order only; not timestamp/concurrency proof');
    assert.ok(summary.coverage.verificationBasis.includes('candidate only'));
  });

  it('auditPath returns a transparent inventory with identity labels and duplicate windows', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-'));
    try {
      const engMsgs = [assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ])];
      const otherMsgs = [assistantMsg('plan', [{ type: 'text', text: 'note' }])];
      await writeFile(path.join(dir, 'sesA.json'), JSON.stringify({ sessionId: 'ses-explicit-1', messages: engMsgs }));
      await writeFile(path.join(dir, 'sesA-dup.json'), JSON.stringify({ messages: engMsgs }));
      await writeFile(path.join(dir, 'anon.json'), JSON.stringify(otherMsgs));
      await writeFile(path.join(dir, 'empty.json'), JSON.stringify({ noMessages: true }));
      await writeFile(path.join(dir, 'bad.json'), '{not json');
      await writeFile(path.join(dir, 'notes.txt'), 'plain text\n');
      const report = await auditPath(dir);
      const inv = report.inventory;
      assert.equal(inv.scanned, 6);
      assert.equal(inv.sessionLike, 3);
      assert.equal(inv.excluded, 2);
      assert.equal(inv.errors, 1);
      assert.ok(inv.excludedFiles.some((e) => e.file === 'empty.json' && e.reason === 'no-message-array'));
      assert.ok(inv.excludedFiles.some((e) => e.file === 'notes.txt' && e.reason === 'non-json-file'));
      assert.ok(inv.errorFiles.some((e) => e.file === 'bad.json' && e.reason === 'unparseable-json'));
      assert.deepEqual(inv.uniqueExplicitSessionIds, ['ses-explicit-1']);
      assert.equal(inv.anonymousSnapshots, 2);
      assert.equal(inv.duplicateWindows.length, 1);
      assert.deepEqual([...inv.duplicateWindows[0]].sort(), ['sesA-dup.json', 'sesA.json']);
      const byLabel = new Map(report.sessions.map((s) => [s.label, s]));
      assert.equal(byLabel.get('sesA.json').anonymous, false);
      assert.equal(byLabel.get('sesA-dup.json').anonymous, true);
      assert.ok(byLabel.get('sesA-dup.json').sessionId.startsWith('anonymous:'));
      assert.ok(inv.note.includes('not a census'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('auditPath on a single file reports a one-row inventory without inventing identity', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-single-'));
    try {
      await mkdir(dir, { recursive: true });
      const msgs = [assistantMsg('plan', [{ type: 'text', text: 'note' }])];
      const file = path.join(dir, 'snap.json');
      await writeFile(file, JSON.stringify(msgs));
      const report = await auditPath(file);
      assert.equal(report.inventory.scanned, 1);
      assert.equal(report.inventory.sessionLike, 1);
      assert.equal(report.inventory.anonymousSnapshots, 1);
      assert.deepEqual(report.inventory.uniqueExplicitSessionIds, []);
      assert.equal(report.sessions[0].anonymous, true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('CLI prints summary plus inventory with incomplete/failed/nonzero counts; alias status not completed', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-cli-'));
    try {
      const goodMsgs = [assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ])];
      const aliasRead = { type: 'tool', name: 'read', state: { status: 'success', input: { path: '/proj/AGENTS.md' } } };
      const pendingRead = { type: 'tool', name: 'read', state: { status: 'pending', input: { path: '/proj/AGENTS.md' } } };
      const mixedMsgs = [assistantMsg('engineer', [
        aliasRead,
        pendingRead,
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test' }, 'error', 'exit 1'),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'npm test' }, output: 'FAIL\nexit 1' } },
      ])];
      await writeFile(path.join(dir, 'good.json'), JSON.stringify(goodMsgs));
      await writeFile(path.join(dir, 'mixed.json'), JSON.stringify({ messages: mixedMsgs }));
      await writeFile(path.join(dir, 'junk.txt'), 'plain text\n');
      const out = execFileSync(process.execPath, [AUDIT_SCRIPT, dir], { encoding: 'utf8', timeout: 30000 });
      const parsed = JSON.parse(out);
      // Denominator fix visible at CLI: inventory plus snapshot-basis alias.
      assert.equal(parsed.inventory.scanned, 3);
      assert.equal(parsed.inventory.sessionLike, 2);
      assert.equal(parsed.inventory.excluded, 1);
      assert.equal(parsed.auditedSnapshots, 2);
      assert.equal(parsed.validSessions, 2);
      assert.ok(parsed.countBasis.includes('not a count of independent sessions'));
      // Full per-file sessions payload stays out of CLI output.
      assert.ok(!('sessions' in parsed));
      const eng = parsed.roleTotals.engineer;
      // Guessed `success` alias and pending reads are incomplete, never completed.
      assert.deepEqual(eng.incompleteTools, { read: 2 });
      assert.equal(eng.reads, 1);
      assert.equal(eng.authorityReadSessions, 1);
      // Failed vs nonzero-hint shells stay separated from candidates.
      assert.deepEqual(eng.failedTools, { shell: 1 });
      assert.equal(eng.verificationNonzeroHints, 1);
      assert.equal(eng.verificationRuns, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
