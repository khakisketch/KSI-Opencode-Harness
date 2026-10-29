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
  it('observes complementary skills before action and review skills first loaded after it', () => {
    const res = auditMessages([
      assistantMsg('build', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('skill', { id: 'designing-user-experience' }),
        toolPart('skill', { id: 'impeccable' }),
        toolPart('edit', { path: '/proj/page.tsx' }),
        toolPart('skill', { id: 'ux-heuristics-audit' }),
        toolPart('skill', { id: 'impeccable' }),
      ]),
    ]);
    const s = res.roles.build;
    assert.deepEqual(s.skillsLoadedBeforeAction, ['designing-user-experience', 'impeccable']);
    assert.deepEqual(s.skillsFirstLoadedAfterAction, ['ux-heuristics-audit']);
    const summary = summarizeAudits([res]);
    assert.deepEqual(summary.roleTotals.build.skillsBeforeActionById, { 'designing-user-experience': 1, impeccable: 1 });
    assert.deepEqual(summary.roleTotals.build.skillsFirstAfterActionById, { 'ux-heuristics-audit': 1 });
    assert.deepEqual(res.gaps, []); // Review-time loading is not a violation.
    assert.ok(summary.coverage.skillTimingBasis.includes('not task relevance'));
  });

  it('keeps skill timing local to each role and includes delegation as an observed action', () => {
    const res = auditMessages([
      assistantMsg('build', [
        toolPart('subagent', { agent: 'lead' }),
        toolPart('skill', { id: 'impeccable' }),
      ]),
      assistantMsg('lead', [toolPart('skill', { id: 'impeccable' })]),
    ]);
    assert.deepEqual(res.roles.build.skillsFirstLoadedAfterAction, ['impeccable']);
    assert.deepEqual(res.roles.lead.skillsLoadedBeforeAction, ['impeccable']);
    assert.deepEqual(res.roles.lead.skillsFirstLoadedAfterAction, []);
  });

  it('does not count failed or pending skills/actions as completed timing evidence', () => {
    const res = auditMessages([
      assistantMsg('general', [
        toolPart('skill', { id: 'diagnosing-bugs' }, 'error', 'unavailable'),
        toolPart('edit', { path: '/proj/x.js' }, 'error', 'denied'),
        toolPart('skill', { id: 'diagnosing-bugs' }, 'pending'),
        toolPart('subagent', { agent: 'general' }, 'pending'),
        toolPart('skill', { name: 'diagnosing-bugs' }), // Historical input shape.
        toolPart('edit', { path: '/proj/x.js' }),
      ]),
    ]);
    assert.deepEqual(res.roles.general.skillsLoadedBeforeAction, ['diagnosing-bugs']);
    assert.deepEqual(res.roles.general.skillsFirstLoadedAfterAction, []);
  });

  it('does not infer missing skills or task compliance from absent timing evidence', () => {
    const res = auditMessages([assistantMsg('general', [toolPart('edit', { path: '/proj/x.js' })])]);
    assert.deepEqual(res.roles.general.skillsLoadedBeforeAction, []);
    assert.deepEqual(res.roles.general.skillsFirstLoadedAfterAction, []);
    assert.deepEqual(res.gaps, []);
    // Existing stored audit results without the new optional fields still summarize.
    delete res.roles.general.skillsLoadedBeforeAction;
    delete res.roles.general.skillsFirstLoadedAfterAction;
    const summary = summarizeAudits([res]);
    assert.deepEqual(summary.roleTotals.general.skillsBeforeActionById, {});
    assert.deepEqual(summary.roleTotals.general.skillsFirstAfterActionById, {});
  });

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

  it('flags out-of-order authority reads only; optional skill/visual lenses are observed, never gaps', () => {
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
    // Normative optional-skill gap inference is retired: the loads/reads
    // above stay observable but never become failure gaps.
    assert.ok(!res.gaps.includes('design-edited-without-ux-or-craft-skill'));
    assert.ok(!res.gaps.includes('design-edited-without-visual-capture-read'));
    assert.ok(!res.gaps.includes('design-no-post-edit-visual-read'));
    assert.deepEqual(res.roles.design.skillsLoaded, ['playwright-cli']);
    assert.deepEqual(res.roles.design.visualReads, ['opencode/before.png']);
  });

  it('holds the lead owner to authority grounding and verification candidates', () => {
    const bad = auditMessages([
      assistantMsg('lead', [
        toolPart('subagent', { agent: 'general', prompt: 'do work' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
    ], { sessionId: 'ses_lead_gaps' });
    assert.ok(bad.gaps.includes('lead-acted-without-authority-read'));
    assert.ok(bad.gaps.includes('lead-no-observed-verification-candidate'));
    const good = auditMessages([
      assistantMsg('lead', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('subagent', { agent: 'general', prompt: 'do work' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/api.test.mjs' }),
      ]),
    ], { sessionId: 'ses_lead_good' });
    assert.deepEqual(good.gaps, []);
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
    // Critic skill-lens mandate is retired: a lens-less review with reads
    // is observed as-is, never a skill gap.
    assert.ok(!res.gaps.includes('critic-reviewed-without-skill-lens'));
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
      assert.deepEqual(eng.skillsBeforeActionById, {});
      assert.deepEqual(eng.skillsFirstAfterActionById, {});
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

  it('completion evidence reports unknown outcome after last edit, never a pass', () => {
    const verified = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
    ]);
    const v = verified.roles.engineer.completionEvidence;
    assert.equal(v.lastChangeKind, 'edit');
    assert.equal(v.verificationCandidatesAfterLastChange, 1);
    assert.equal(v.outcome, 'candidate-unknown-after-last-change');
    assert.equal(v.passedProof, 'none');

    const stale = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
    ]);
    const s = stale.roles.engineer.completionEvidence;
    assert.equal(s.lastChangeKind, 'edit');
    assert.equal(s.verificationCandidatesAfterLastChange, 0);
    assert.equal(s.outcome, 'unverified-after-last-change');
    assert.equal(s.passedProof, 'none');
    // Legacy edit-only tracker stays consistent with the new evidence.
    assert.equal(stale.roles.engineer.postEditVerificationRuns, 0);
  });

  it('delegation and possible-shell-edit invalidate prior verification (child work stays unobserved)', () => {
    const delegated = auditMessages([
      assistantMsg('lead', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('subagent', { agent: 'general' }),
      ]),
    ]);
    const d = delegated.roles.lead.completionEvidence;
    assert.equal(d.lastChangeKind, 'delegation');
    assert.equal(d.delegations, 1);
    assert.equal(d.verificationCandidatesAfterLastChange, 0);
    assert.equal(d.outcome, 'unverified-after-last-change');

    const mutated = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('shell', { command: 'mv old.ts new.ts' }),
      ]),
    ]);
    const m = mutated.roles.engineer.completionEvidence;
    assert.equal(m.lastChangeKind, 'shell-maybe');
    assert.equal(m.possibleShellEdits, 1);
    assert.equal(m.verificationCandidatesAfterLastChange, 0);
    assert.equal(m.outcome, 'unverified-after-last-change');
  });

  it('shell-mutation detection is a candidate only: echo words are not edits, redirects are', () => {
    const echoWords = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'echo "npm test"' }),
      ]),
    ]);
    assert.equal(echoWords.roles.engineer.possibleShellEdits, 0);
    assert.equal(echoWords.roles.engineer.completionEvidence.lastChangeKind, 'edit');
    // Echo-only never becomes a verification candidate either.
    assert.equal(echoWords.roles.engineer.verificationRuns, 0);

    const redirect = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'echo hi > out.txt' }),
      ]),
    ]);
    assert.equal(redirect.roles.engineer.possibleShellEdits, 1);
    assert.equal(redirect.roles.engineer.completionEvidence.lastChangeKind, 'shell-maybe');
    assert.equal(redirect.roles.engineer.verificationRuns, 0);

    const plainTest = auditMessages([
      assistantMsg('engineer', [toolPart('shell', { command: 'npm test' })]),
    ]);
    assert.equal(plainTest.roles.engineer.possibleShellEdits, 0);
    assert.equal(plainTest.roles.engineer.completionEvidence.lastChangeKind, null);
    assert.equal(plainTest.roles.engineer.completionEvidence.outcome, 'no-change-observed');
  });

  it('failure-signal after last change stays distinct from unverified and incomplete', () => {
    const hint = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'npm test' }, output: 'exit 1' } },
      ]),
    ]);
    const h = hint.roles.engineer.completionEvidence;
    assert.equal(h.outcome, 'failure-signal-after-last-change');
    assert.equal(h.nonzeroHintsAfterLastChange, 1);
    assert.equal(h.passedProof, 'none');

    const failedTransport = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test' }, 'error', 'exit 1'),
      ]),
    ]);
    const f = failedTransport.roles.engineer.completionEvidence;
    assert.equal(f.outcome, 'failure-signal-after-last-change');
    assert.equal(f.failedAfterLastChange, 1);
    assert.equal(f.incompleteAfterLastChange, 0);

    const pendingOnly = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'pending', input: { command: 'npm test' } } },
      ]),
    ]);
    const p = pendingOnly.roles.engineer.completionEvidence;
    // Unobserved transport is not failure and not verification.
    assert.equal(p.outcome, 'unverified-after-last-change');
    assert.equal(p.failedAfterLastChange, 0);
    assert.equal(p.incompleteAfterLastChange, 1);
    assert.equal(pendingOnly.roles.engineer.verificationRuns, 0);
  });

  it('summary rolls up completion evidence and declares blind spots honestly', () => {
    const verified = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
    ], { sessionId: 's-verified' });
    const stale = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
    ], { sessionId: 's-stale' });
    const failed = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test' }, 'error', 'exit 1'),
      ]),
    ], { sessionId: 's-failed' });
    const summary = summarizeAudits([verified, stale, failed]);
    const c = summary.roleTotals.engineer.completionAfterLastChange;
    assert.equal(c.withChange, 3);
    assert.equal(c.candidateUnknown, 1);
    assert.equal(c.unverified, 1);
    assert.equal(c.failureSignal, 1);
    assert.equal(summary.roleTotals.engineer.possibleShellEdits, 0);
    assert.ok(summary.completionBasis.includes('passedProof is always none'));
    assert.ok(summary.coverage.shellMutationBasis.includes('not proof of no file change'));
    assert.ok(summary.coverage.childSessionBasis.includes('do not link'));
    assert.ok(summary.coverage.concurrencyBasis.includes('order-as-observed'));
    const blob = summary.limitations.join('\n');
    assert.ok(blob.includes('child-session-basis'));
    assert.ok(blob.includes('non-atomic concurrent'));
    assert.ok(blob.includes('failed vs incomplete vs unverified stay distinct'));
  });

  it('auditPath inventory states the per-snapshot observation scope', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-scope-'));
    try {
      const msgs = [assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })])];
      await writeFile(path.join(dir, 'snap.json'), JSON.stringify(msgs));
      const report = await auditPath(dir);
      assert.ok(report.inventory.observationScope.includes('audited independently'));
      assert.ok(report.inventory.observationScope.includes('blind spots'));
      assert.ok(report.summary.completionBasis.includes('passedProof is always none'));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('cross-role: another role’s later change stales role-scoped freshness at snapshot level', () => {
    const res = auditMessages([
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
      assistantMsg('design', [
        toolPart('edit', { path: '/proj/app/page.tsx' }),
      ]),
    ]);
    // Role-scoped evidence stays role-scoped: engineer still looks fresh alone.
    const eng = res.roles.engineer.completionEvidence;
    assert.equal(eng.outcome, 'candidate-unknown-after-last-change');
    assert.ok(eng.scope.includes('completionAcrossRoles'));
    // Snapshot-wide: design changed after the engineer's verification.
    const snap = res.completionAcrossRoles;
    assert.equal(snap.lastChange.role, 'design');
    assert.equal(snap.lastChange.kind, 'edit');
    assert.equal(snap.outcome, 'unverified-late-change');
    assert.equal(snap.changeAfterLastCleanVerification, true);
    assert.deepEqual(snap.freshRolesStaledByLaterCrossRoleChange, ['engineer']);
    assert.deepEqual(snap.staleRoles, ['design']);
    assert.ok(snap.scope.includes('never proves another'));
    assert.equal(snap.passedProof, 'none');
  });

  it('snapshot candidate-after-last-change still discloses missing cross-role coverage', () => {
    const res = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
      assistantMsg('design', [
        toolPart('edit', { path: '/proj/app/page.tsx' }),
        toolPart('shell', { command: 'node --test tests/y.test.mjs' }),
      ]),
    ]);
    const snap = res.completionAcrossRoles;
    assert.equal(snap.outcome, 'candidate-after-snapshot-last-change');
    assert.ok(snap.outcomeNote.includes('no cross-role coverage'));
    // The engineer's own verification predates the snapshot's latest change,
    // so it stays listed even though a later candidate exists.
    assert.deepEqual(snap.freshRolesStaledByLaterCrossRoleChange, ['engineer']);
    assert.deepEqual(snap.freshCandidateRoles.sort(), ['design', 'engineer']);
  });

  it('mixed verify+mutate shell never counts as after-last-change verification', () => {
    const res = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test && echo hi > out.txt' }),
      ]),
    ]);
    const s = res.roles.engineer;
    assert.equal(s.possibleShellEdits, 1);
    // The pattern was observed (legacy gap basis), but ordering is unprovable.
    assert.equal(s.verificationRuns, 1);
    assert.equal(s.verificationAfterLastChange, 0);
    assert.equal(s.verificationAmbiguousAfterLastChange, 1);
    assert.equal(s.postEditVerificationRuns, 0);
    assert.equal(s.completionEvidence.outcome, 'ambiguous-after-last-change');
    assert.equal(res.completionAcrossRoles.outcome, 'ambiguous-after-snapshot-last-change');

    // A prior clean verification is invalidated by the mixed call's write part.
    const stale = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('shell', { command: 'npm test && echo hi > out.txt' }),
      ]),
    ]);
    assert.equal(stale.roles.engineer.verificationAfterLastChange, 0);
    assert.equal(stale.roles.engineer.completionEvidence.outcome, 'ambiguous-after-last-change');

    // A later separate clean run restores candidate-unknown (history kept).
    const restored = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test && echo hi > out.txt' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
    ]);
    const r = restored.roles.engineer;
    assert.equal(r.completionEvidence.outcome, 'candidate-unknown-after-last-change');
    assert.equal(r.verificationAfterLastChange, 1);
    assert.equal(r.verificationAmbiguousAfterLastChange, 1);

    // Mixed output with a nonzero-exit hint is a failure hint, not a candidate.
    const failed = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'npm test && echo hi > out.txt' }, output: 'exit 1' } },
      ]),
    ]);
    const f = failed.roles.engineer;
    assert.equal(f.completionEvidence.outcome, 'failure-signal-after-last-change');
    assert.equal(f.nonzeroHintAfterLastChange, 1);
    assert.equal(f.verificationAmbiguousAfterLastChange, 0);
    assert.equal(f.verificationRuns, 0);
  });

  it('failed/running mutating-capable calls discard freshness but preserve the record', () => {
    const clean = [
      toolPart('read', { path: '/proj/AGENTS.md' }),
      toolPart('edit', { path: '/proj/src/api.ts' }),
      toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
    ];
    // Failed mutation-pattern shell: freshness discarded, failure preserved,
    // unconfirmed change never counted.
    const failedMv = auditMessages([
      assistantMsg('engineer', [...clean, toolPart('shell', { command: 'mv old.ts new.ts' }, 'error', 'denied')]),
    ]);
    const f = failedMv.roles.engineer;
    assert.equal(f.completionEvidence.outcome, 'failure-signal-after-last-change');
    assert.equal(f.verificationAfterLastChange, 0);
    assert.equal(f.failedAfterLastChange, 1);
    assert.equal(f.possibleShellEdits, 0);
    assert.equal(f.delegations, 0);
    assert.equal(f.completionEvidence.lastChangeKind, 'edit');

    // Running mutation-pattern shell: freshness discarded, incompleteness kept.
    const pendingMv = auditMessages([
      assistantMsg('engineer', [...clean, { type: 'tool', name: 'shell', state: { status: 'pending', input: { command: 'mv old.ts new.ts' } } }]),
    ]);
    const p = pendingMv.roles.engineer;
    assert.equal(p.completionEvidence.outcome, 'unverified-after-last-change');
    assert.equal(p.verificationAfterLastChange, 0);
    assert.equal(p.incompleteAfterLastChange, 1);
    assert.equal(p.failedAfterLastChange, 0);

    // Failed delegation: same conservative treatment, delegation unconfirmed.
    const failedDeleg = auditMessages([
      assistantMsg('lead', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('subagent', { agent: 'general' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('subagent', { agent: 'general' }, 'error', 'denied'),
      ]),
    ]);
    const d = failedDeleg.roles.lead;
    assert.equal(d.completionEvidence.outcome, 'failure-signal-after-last-change');
    assert.equal(d.verificationAfterLastChange, 0);
    assert.equal(d.failedAfterLastChange, 1);
    assert.equal(d.delegations, 1);

    // Controls: non-mutating failed/incomplete transport keeps freshness while
    // still recording the failure/incompleteness.
    const failedRead = auditMessages([
      assistantMsg('engineer', [...clean, toolPart('read', { path: '/proj/other.md' }, 'error', 'denied')]),
    ]);
    assert.equal(failedRead.roles.engineer.verificationAfterLastChange, 1);
    assert.equal(failedRead.roles.engineer.completionEvidence.outcome, 'failure-signal-after-last-change');

    const pendingLs = auditMessages([
      assistantMsg('engineer', [...clean, { type: 'tool', name: 'shell', state: { status: 'pending', input: { command: 'ls -la' } } }]),
    ]);
    assert.equal(pendingLs.roles.engineer.verificationAfterLastChange, 1);
    assert.equal(pendingLs.roles.engineer.incompleteAfterLastChange, 1);
    assert.equal(pendingLs.roles.engineer.completionEvidence.outcome, 'candidate-unknown-after-last-change');
  });

  it('confirmed edits and potential changes are named and counted distinctly', () => {
    const deleg = auditMessages([
      assistantMsg('lead', [toolPart('subagent', { agent: 'general' })]),
    ]);
    const d = deleg.roles.lead.completionEvidence;
    assert.equal(d.changesObserved, 1); // backward-compatible sum, not confirmed changes
    assert.equal(d.editsObserved, 0);
    assert.equal(d.potentialChangesObserved, 1);
    assert.equal(d.lastChangeIsPotentialOnly, true);
    assert.ok(d.scope.includes('role-scoped'));

    const edited = auditMessages([
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })]),
    ]);
    assert.equal(edited.roles.engineer.completionEvidence.lastChangeIsPotentialOnly, false);
    assert.equal(edited.roles.engineer.completionEvidence.editsObserved, 1);

    const summary = summarizeAudits([deleg, edited]);
    assert.equal(summary.roleTotals.lead.completionAfterLastChange.withPotentialChangeLast, 1);
    assert.equal(summary.roleTotals.lead.completionAfterLastChange.withConfirmedEditLast, 0);
    assert.equal(summary.roleTotals.lead.completionAfterLastChange.withChange, 1);
    assert.equal(summary.roleTotals.engineer.completionAfterLastChange.withConfirmedEditLast, 1);
    assert.equal(summary.roleTotals.engineer.completionAfterLastChange.ambiguous, 0);
    assert.ok(summary.coverage.changeBasis.includes('never confirmed file changes'));
    assert.ok(summary.limitations.join('\n').includes('change-naming-basis'));

    // Legacy stored audits without the new evidence still summarize.
    const legacyAudit = auditMessages([
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })]),
    ]);
    delete legacyAudit.roles.engineer.completionEvidence;
    delete legacyAudit.completionAcrossRoles;
    const legacySummary = summarizeAudits([legacyAudit]);
    assert.equal(legacySummary.roleTotals.engineer.completionAfterLastChange.legacyWithoutEvidence, 1);
    assert.equal(legacySummary.snapshotCompletionOutcomes.legacyWithoutEvidence, 1);
  });

  it('snapshot outcomes separate candidate-after, late change, failure and no-change', () => {
    const noChange = auditMessages([assistantMsg('plan', [{ type: 'text', text: 'note' }])]);
    assert.equal(noChange.completionAcrossRoles.outcome, 'no-change-in-snapshot');

    const candidate = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
      ]),
    ]);
    assert.equal(candidate.completionAcrossRoles.outcome, 'candidate-after-snapshot-last-change');
    assert.ok(candidate.completionAcrossRoles.outcomeNote.includes('no cross-role coverage'));

    const late = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'node --test tests/x.test.mjs' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
    ]);
    assert.equal(late.completionAcrossRoles.outcome, 'unverified-late-change');

    const failed = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        toolPart('shell', { command: 'npm test' }, 'error', 'exit 1'),
      ]),
    ]);
    assert.equal(failed.completionAcrossRoles.outcome, 'failure-signal-after-snapshot-last-change');

    const summary = summarizeAudits([noChange, candidate, late, failed]);
    assert.deepEqual(summary.snapshotCompletionOutcomes, {
      noChange: 1,
      candidateAfterLastChange: 1,
      unverifiedLateChange: 1,
      ambiguousAfterLastChange: 0,
      failureSignal: 1,
      legacyWithoutEvidence: 0,
    });
  });

  it('newest-first input normalizes to the same result without mutating the array', () => {
    const oldest = [
      assistantMsg('engineer', [
        toolPart('read', { path: '/proj/AGENTS.md' }),
        toolPart('edit', { path: '/proj/src/api.ts' }),
      ]),
      assistantMsg('engineer', [toolPart('shell', { command: 'node --test tests/x.test.mjs' })]),
    ];
    const newest = [...oldest].reverse();
    const viaNewest = auditMessages(newest, { order: 'newest-first' });
    const viaOldest = auditMessages(oldest, { order: 'oldest-first' });
    assert.deepEqual(viaNewest, viaOldest);
    assert.equal(viaNewest.completionAcrossRoles.outcome, 'candidate-after-snapshot-last-change');
    // The caller's array is never mutated by normalization.
    assert.deepEqual(newest, [...oldest].reverse());
    // Explicit oldest-first equals the preserved default.
    assert.deepEqual(auditMessages(oldest), viaOldest);
  });

  it('a wrongly declared order flips after-last-change results (declare, never guess)', () => {
    const oldest = [
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })]),
      assistantMsg('engineer', [toolPart('shell', { command: 'node --test tests/x.test.mjs' })]),
    ];
    const newest = [...oldest].reverse();
    // Newest-first data misread as oldest-first: verification looks stale.
    const flipped = auditMessages(newest);
    assert.equal(flipped.roles.engineer.completionEvidence.outcome, 'unverified-after-last-change');
    assert.equal(flipped.completionAcrossRoles.outcome, 'unverified-late-change');
    // Correctly declared: the candidate is fresh.
    assert.equal(auditMessages(newest, { order: 'newest-first' }).completionAcrossRoles.outcome, 'candidate-after-snapshot-last-change');
  });

  it('rejects unknown orders explicitly instead of inferring them', () => {
    assert.throws(() => auditMessages([], { order: 'chronological' }), /unknown message order/);
    assert.throws(() => auditMessages([], { order: null }), /unknown message order/);
  });

  it('auditPath passes the declared order through to each snapshot', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-order-'));
    try {
      const oldest = [
        assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })]),
        assistantMsg('engineer', [toolPart('shell', { command: 'node --test tests/x.test.mjs' })]),
      ];
      await writeFile(path.join(dir, 'newest.json'), JSON.stringify([...oldest].reverse()));
      const declared = await auditPath(dir, { order: 'newest-first' });
      assert.equal(declared.summary.snapshotCompletionOutcomes.candidateAfterLastChange, 1);
      const misread = await auditPath(dir);
      assert.equal(misread.summary.snapshotCompletionOutcomes.unverifiedLateChange, 1);
      await assert.rejects(auditPath(dir, { order: 'sideways' }), /unknown message order/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('documents the declared-order basis without changing the legacy order basis', () => {
    const summary = summarizeAudits([
      auditMessages([assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })])]),
    ]);
    // Legacy strings stay byte-identical for historical consumers.
    assert.equal(summary.coverage.orderBasis, 'input-array order only; not timestamp/concurrency proof');
    assert.ok(summary.coverage.inputOrderBasis.includes('never inferred'));
    assert.ok(summary.coverage.inputOrderBasis.includes('treat the result as unknown'));
    assert.ok(summary.completionBasis.includes('caller-declared order option'));
    assert.ok(summary.completionBasis.includes('passedProof is always none here'));
    assert.ok(summary.limitations.join('\n').includes('input-order-basis'));
  });

  it('CLI accepts --newest-first without changing the default', async () => {
    const dir = await mkdtemp(path.join('/tmp/opencode', 'session-audit-cli-order-'));
    try {
      const oldest = [
        assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })]),
        assistantMsg('engineer', [toolPart('shell', { command: 'node --test tests/x.test.mjs' })]),
      ];
      await writeFile(path.join(dir, 'newest.json'), JSON.stringify([...oldest].reverse()));
      const declared = JSON.parse(execFileSync(process.execPath, [AUDIT_SCRIPT, dir, '--newest-first'], { encoding: 'utf8', timeout: 30000 }));
      assert.equal(declared.snapshotCompletionOutcomes.candidateAfterLastChange, 1);
      const fallback = JSON.parse(execFileSync(process.execPath, [AUDIT_SCRIPT, dir], { encoding: 'utf8', timeout: 30000 }));
      assert.equal(fallback.snapshotCompletionOutcomes.unverifiedLateChange, 1);
      assert.throws(() => execFileSync(process.execPath, [AUDIT_SCRIPT, dir, '--sideways'], { encoding: 'utf8', timeout: 30000 }));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps inherited-member agent and tool names as own data without prototype access', () => {
    // Reported repro: agent 'toString' used to throw via Object.prototype.
    const repro = auditMessages([
      assistantMsg('toString', [toolPart('read', { path: 'fixture.txt' })]),
    ]);
    assert.equal(repro.valid, true);
    assert.equal(repro.roles.toString.reads, 1);
    const res = auditMessages([
      assistantMsg('__proto__', [toolPart('edit', { path: '/proj/a.ts' })]),
      assistantMsg('constructor', [toolPart('__proto__', { path: '/proj/b.ts' })]),
      assistantMsg('prototype', [toolPart('shell', { command: 'node --test t.mjs' })]),
      assistantMsg('hasOwnProperty', [toolPart('valueOf', { path: '/proj/c.ts' }, 'error', 'denied')]),
      assistantMsg('__defineGetter__', [toolPart('read', { path: '/proj/d.ts' }, 'pending')]),
      assistantMsg('engineer', [toolPart('toString', { command: 'ls' })]),
    ]);
    // Every external name survives as its own key with exact counts.
    assert.deepEqual(Object.keys(res.roles), ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', '__defineGetter__', 'engineer']);
    assert.equal(res.roles.__proto__.edits, 1);
    assert.deepEqual(res.roles.constructor.tools, JSON.parse('{"__proto__":1}'));
    assert.equal(res.roles.prototype.shells, 1);
    assert.deepEqual(res.roles.hasOwnProperty.failedTools, { valueOf: 1 });
    assert.deepEqual(res.roles.__defineGetter__.incompleteTools, { read: 1 });
    assert.deepEqual(res.roles.engineer.tools, { toString: 1 });
    // No prototype state was touched anywhere.
    assert.equal(({}).turns, undefined);
    assert.equal(({}).edits, undefined);
    assert.equal(({}).polluted, undefined);
    assert.equal(Object.prototype.turns, undefined);
    assert.equal(Object.turns, undefined);
    assert.equal(typeof res.roles.__proto__.completionEvidence.outcome, 'string');
    // Plain-object shape is preserved for existing consumers.
    assert.deepEqual(res.roles.engineer.incompleteTools, {});
    assert.equal(JSON.parse(JSON.stringify(res.roles)).engineer.tools.toString, 1);
    const summary = summarizeAudits([res]);
    assert.equal(summary.roleTotals.__proto__.sessions, 1);
    assert.equal(summary.roleTotals.engineer.sessions, 1);
    assert.ok(Object.hasOwn(summary.roleTotals, 'constructor'));
    assert.deepEqual(summary.roleTotals.constructor.failedTools ?? {}, {});
  });

  it('counts hostile skill names in maps without prototype access', () => {
    const res = auditMessages([
      assistantMsg('build', [
        toolPart('skill', { id: '__proto__' }),
        toolPart('skill', { id: 'toString' }),
        toolPart('skill', { id: 'impeccable' }),
      ]),
    ]);
    assert.deepEqual(res.roles.build.skillsLoaded, ['__proto__', 'toString', 'impeccable']);
    const summary = summarizeAudits([res]);
    assert.ok(Object.hasOwn(summary.roleTotals.build.skillsById, '__proto__'));
    assert.equal(summary.roleTotals.build.skillsById.toString, 1);
    assert.equal(summary.roleTotals.build.skillsById.impeccable, 1);
    assert.equal(({}).polluted, undefined);
  });

  it('keeps hand-crafted hostile role keys as own data at summarize time', () => {
    const crafted = JSON.parse('{"__proto__":{"turns":1,"edits":1,"reads":0,"shells":0,"verificationRuns":0,"detectorRuns":0,"failedTools":{},"incompleteTools":{},"visualReads":[],"postEditVisualReads":[],"skillsLoaded":[],"authorityReads":[],"subagentsCalled":[]}}');
    const summary = summarizeAudits([{ valid: true, gaps: [], roles: crafted }]);
    assert.ok(Object.hasOwn(summary.roleTotals, '__proto__'));
    assert.equal(summary.roleTotals.__proto__.sessions, 1);
    assert.equal(summary.roleTotals.__proto__.edits, 1);
    assert.equal(({}).sessions, undefined);
    assert.equal(Object.prototype.sessions, undefined);
  });

  it('refuses over-budget input without producing a summary', () => {
    const msgs = [
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })]),
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/b.ts' })]),
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/c.ts' })]),
    ];
    const tooMany = auditMessages(msgs, { maxMessages: 2 });
    assert.equal(tooMany.valid, false);
    assert.deepEqual(tooMany.gaps, ['over-budget']);
    assert.deepEqual(tooMany.overBudget, { reason: 'too-many-messages', messages: 3, parts: 0, chars: 0 });
    const tooManyParts = auditMessages(msgs, { maxParts: 2 });
    assert.equal(tooManyParts.valid, false);
    assert.equal(tooManyParts.overBudget.reason, 'too-many-parts');
    const tooLong = auditMessages(
      [assistantMsg('engineer', [toolPart('shell', { command: `npm test ${'x'.repeat(5000)}` })])],
      { maxStringChars: 100 },
    );
    assert.equal(tooLong.valid, false);
    assert.equal(tooLong.overBudget.reason, 'string-chars-exceeded');
    assert.ok(tooLong.overBudget.chars > 100);
    // Over-budget audits never reach summaries.
    const summary = summarizeAudits([tooMany, tooManyParts, tooLong]);
    assert.equal(summary.validSessions, 0);
    assert.deepEqual(summary.roleTotals, {});
  });

  it('validates declared order against timestamp evidence without inferring it', async () => {
    const { checkDeclaredOrder, messageTimeOf } = await import('../global/plugins/ksi-session-evidence/core.mjs');
    assert.equal(messageTimeOf({ time: { created: 42 } }), 42);
    assert.equal(messageTimeOf({ time: 42 }), 42);
    assert.equal(typeof messageTimeOf({ time: { created: new Date(0).toISOString() } }), 'number');
    assert.equal(messageTimeOf({}), undefined);
    assert.equal(messageTimeOf(null), undefined);
    assert.equal(messageTimeOf({ time: { created: 'not-a-date' } }), undefined);
    const t = (n) => ({ type: 'assistant', time: { created: n } });
    assert.deepEqual(checkDeclaredOrder([], 'oldest-first'), { verdict: 'consistent', reason: 'too-few-messages', tie: false, strictSteps: 0, tiedRuns: [] });
    assert.deepEqual(checkDeclaredOrder([t(1)], 'newest-first'), { verdict: 'consistent', reason: 'too-few-messages', tie: false, strictSteps: 0, tiedRuns: [] });
    const cleanOld = checkDeclaredOrder([t(1), t(2), t(2)], 'oldest-first');
    assert.equal(cleanOld.verdict, 'consistent');
    assert.equal(cleanOld.tie, false);
    assert.equal(cleanOld.strictSteps, 1);
    const cleanNew = checkDeclaredOrder([t(3), t(2), t(1)], 'newest-first');
    assert.equal(cleanNew.verdict, 'consistent');
    assert.equal(cleanNew.tie, false);
    assert.equal(checkDeclaredOrder([t(1), t(3), t(2)], 'oldest-first').verdict, 'contradicted');
    assert.equal(checkDeclaredOrder([t(1), t(3), t(2)], 'newest-first').verdict, 'contradicted');
    assert.equal(checkDeclaredOrder([t(1), {}], 'oldest-first').verdict, 'unverifiable');
    assert.equal(checkDeclaredOrder([t(2), t(1)], 'newest-first').reason, 'timestamps-consistent');
    assert.deepEqual(checkDeclaredOrder([t(1), t(2)], 'sideways'), { verdict: 'unverifiable', reason: 'unknown-order', tie: false, strictSteps: 0, tiedRuns: [] });
    // All-tied timestamps carry no tiebreak information in either direction.
    const tiedOld = checkDeclaredOrder([t(5), t(5)], 'oldest-first');
    assert.equal(tiedOld.verdict, 'consistent');
    assert.equal(tiedOld.tie, true);
    const tiedNew = checkDeclaredOrder([t(5), t(5)], 'newest-first');
    assert.equal(tiedNew.verdict, 'consistent');
    assert.equal(tiedNew.tie, true);
  });

  it('treats the isolated-observed wrapper wording as a nonzero-exit hint only', () => {
    // "Exited with code 1" is opencode's own failure trailer (observed in the
    // isolated live run), not a test-log classifier match: "1 failed" alone
    // stays a candidate with unknown outcome.
    const mk = (text) => auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/a.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test t.mjs' }, content: [{ type: 'text', text }] } },
      ]),
    ]);
    const nonzero = mk('pass 0\nfail 1\nExited with code 1');
    assert.equal(nonzero.roles.engineer.verificationRuns, 0);
    assert.equal(nonzero.roles.engineer.verificationNonzeroHints, 1);
    const zero = mk('pass 1\nfail 0\nExited with code 0');
    assert.equal(zero.roles.engineer.verificationRuns, 1);
    assert.equal(zero.roles.engineer.verificationNonzeroHints, 0);
    const bare = mk('1 failed, 2 passed');
    assert.equal(bare.roles.engineer.verificationRuns, 1);
    assert.equal(bare.roles.engineer.verificationNonzeroHints, 0);
  });

  it('reads completed tool text from state.content and ignores file payloads', () => {
    // Native-shaped completed shell: nonzero-exit text lives in
    // state.content text parts, not state.output.
    const hint = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test t.mjs' }, content: [{ type: 'text', text: 'failing\nnpm ERR! exit 1' }] } },
      ]),
    ]);
    assert.equal(hint.roles.engineer.verificationNonzeroHints, 1);
    assert.equal(hint.roles.engineer.verificationRuns, 0);
    assert.equal(hint.roles.engineer.completionEvidence.outcome, 'failure-signal-after-last-change');
    // File/base64 payloads are never collected: no hint from them, and a
    // multi-megabyte blob does not trip the chars budget.
    const withFile = auditMessages([
      assistantMsg('engineer', [
        toolPart('edit', { path: '/proj/src/api.ts' }),
        { type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test t.mjs' }, content: [{ type: 'file', mime: 'image/png', uri: `data:image/png;base64,${'A'.repeat(5_000_000)}` }, { type: 'text', text: 'ok' }] } },
      ]),
    ], { maxStringChars: 1000 });
    assert.equal(withFile.valid, true);
    assert.equal(withFile.roles.engineer.verificationRuns, 1);
    assert.equal(withFile.roles.engineer.verificationNonzeroHints, 0);
  });

  it('counts nested content text and items against the pre-processing budgets', () => {
    const big = (n, len) => Array.from({ length: n }, (_, i) => ({ type: 'text', text: `t${i}-`.padEnd(len, 'x') }));
    const over = auditMessages([
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })]),
      assistantMsg('engineer', [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test t.mjs' }, content: big(4, 1000) } }]),
    ], { maxStringChars: 1000 });
    assert.equal(over.valid, false);
    assert.equal(over.overBudget.reason, 'string-chars-exceeded');
    const many = auditMessages([
      assistantMsg('engineer', [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'ls' }, content: big(60, 2) } }]),
    ], { maxParts: 50 });
    assert.equal(many.valid, false);
    assert.equal(many.overBudget.reason, 'too-many-parts');
    // Within budget, nested content is processed normally.
    const fine = auditMessages([
      assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })]),
      assistantMsg('engineer', [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test t.mjs' }, content: [{ type: 'text', text: 'pass' }] } }]),
    ], { maxParts: 50, maxStringChars: 1000 });
    assert.equal(fine.valid, true);
    assert.equal(fine.roles.engineer.verificationRuns, 1);
  });

  it('counts every analyzed string against the chars budget, including paths and names', () => {
    // Reported repro: a 200-char read path with maxStringChars 10 stayed valid.
    const longPath = 'x'.repeat(200);
    const over = auditMessages([
      assistantMsg('engineer', [toolPart('read', { path: longPath })]),
    ], { maxStringChars: 10 });
    assert.equal(over.valid, false);
    assert.equal(over.overBudget.reason, 'string-chars-exceeded');
    assert.ok(over.overBudget.chars >= 200);
    const cases = [
      ['long skill id', [assistantMsg('general', [{ type: 'tool', name: 'skill', state: { status: 'completed', input: { id: `s-${'y'.repeat(120)}` } } }])]],
      ['long role name', [assistantMsg(`role-${'r'.repeat(120)}`, [toolPart('read', { path: 'a' })])]],
      ['long tool name', [assistantMsg('general', [{ type: 'tool', name: `tool-${'t'.repeat(120)}`, state: { status: 'completed', input: {} } }])]],
      ['long shell command', [assistantMsg('general', [toolPart('shell', { command: `ls ${'c'.repeat(120)}` })])]],
      ['long nested content', [assistantMsg('general', [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'ls' }, content: [{ type: 'text', text: 'z'.repeat(120) }] } }])]],
    ];
    for (const [label, fixture] of cases) {
      const r = auditMessages(fixture, { maxStringChars: 50 });
      assert.equal(r.valid, false, label);
      assert.equal(r.overBudget.reason, 'string-chars-exceeded', label);
    }
    // Short equivalents stay valid.
    const fine = auditMessages([
      assistantMsg('engineer', [toolPart('read', { path: 'a' })]),
    ], { maxStringChars: 50 });
    assert.equal(fine.valid, true);
  });

  it('detects tied runs at front, middle, and back with relevance', async () => {
    const { checkDeclaredOrder } = await import('../global/plugins/ksi-session-evidence/core.mjs');
    const t = (n) => ({ type: 'assistant', time: { created: n } });
    const tp = (n) => ({ type: 'assistant', time: { created: n }, content: [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'x' } } }] });
    assert.deepEqual(checkDeclaredOrder([t(1), t(1), t(2), t(3)], 'oldest-first').tiedRuns, [{ start: 0, end: 1, relevant: false }]);
    assert.deepEqual(checkDeclaredOrder([t(1), t(2), t(2), t(3)], 'oldest-first').tiedRuns, [{ start: 1, end: 2, relevant: false }]);
    assert.deepEqual(checkDeclaredOrder([t(1), t(2), t(3), t(3)], 'oldest-first').tiedRuns, [{ start: 2, end: 3, relevant: false }]);
    assert.deepEqual(checkDeclaredOrder([t(3), t(3), t(2), t(1)], 'newest-first').tiedRuns, [{ start: 0, end: 1, relevant: false }]);
    const multi = checkDeclaredOrder([t(1), t(1), t(2), t(3), t(3)], 'oldest-first');
    assert.deepEqual(multi.tiedRuns, [{ start: 0, end: 1, relevant: false }, { start: 3, end: 4, relevant: false }]);
    assert.deepEqual(checkDeclaredOrder([tp(1), tp(1)], 'oldest-first').tiedRuns, [{ start: 0, end: 1, relevant: true }]);
    assert.deepEqual(checkDeclaredOrder([tp(1), t(1)], 'oldest-first').tiedRuns, [{ start: 0, end: 1, relevant: false }]);
    assert.deepEqual(checkDeclaredOrder([t(1), t(2)], 'oldest-first').tiedRuns, []);
  });

  it('separates visual completions after the last change from snapshot totals', () => {    const res = auditMessages([
      assistantMsg('design', [toolPart('edit', { path: '/proj/a.tsx' })]),
      assistantMsg('design', [toolPart('visual_capture', { path: 'before.png' })]),
      assistantMsg('design', [toolPart('visual_review', { receipt: 'r' })]),
      assistantMsg('design', [toolPart('edit', { path: '/proj/b.tsx' })]),
      assistantMsg('design', [toolPart('visual_capture', { path: 'after.png' })]),
    ]);
    const visual = res.completionAcrossRoles.visualCompletions;
    assert.deepEqual(
      { captures: visual.captures, reviews: visual.reviews },
      { captures: 2, reviews: 1 },
    );
    assert.deepEqual(
      { captures: visual.capturesAfterLastChange, reviews: visual.reviewsAfterLastChange },
      { captures: 1, reviews: 0 },
    );
    assert.match(visual.note ?? '', /never|not proof/);
  });
});
