// session-evidence-native.test.mjs — offline fake-context tests for the managed
// Native session-evidence tool. No server, model, network, or filesystem use:
// ctx.session.context and ctx.tool.transform are scripted fakes.
// Run: `node --test tests/session-evidence-native.test.mjs`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { setupSessionEvidence, TOOL_NAME, MAX_CONTEXT_MESSAGES } from '../global/plugins/ksi-session-evidence/runtime.mjs';

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

// Isolated-fixture-observed context shape: every message carries
// time.created epoch milliseconds, monotonic with the array order.
let tick = 1000;
const stamp = (m) => { tick += 10; return { ...m, time: { created: tick } }; };
const resetClock = () => { tick = 1000; };

async function harness(contextPayload, { onContext, sessionDir, sessionGet } = {}) {
  const tools = new Map(), contextCalls = [], getCalls = [];
  let disposed = 0;
  // Real directory so the location check exercises actual path resolution.
  const root = await mkdtemp('/tmp/opencode/ksi-session-evidence-fake-');
  let currentSessionDir = sessionDir ?? root;
  // No permission/skill/agent surfaces on purpose: any such access by the
  // tool throws and fails the test (permission boundary).
  const ctx = {
    location: { directory: root },
    session: {
      get: sessionGet ?? (async (arg) => {
        getCalls.push(arg);
        return { data: { location: { directory: currentSessionDir } } };
      }),
      context: async (arg) => {
        contextCalls.push(arg);
        if (onContext) await onContext(arg);
        if (contextPayload instanceof Error) throw contextPayload;
        return contextPayload;
      },
    },
    tool: {
      transform: async (fn) => {
        fn({ add: (tool) => tools.set(tool.name, tool) });
        return { dispose: async () => { disposed += 1; } };
      },
    },
  };
  const close = await setupSessionEvidence(ctx);
  const tc = { sessionID: 'ses_own', agent: 'build', messageID: 'm0', id: 'call0' };
  const call = (input, ...rest) => tools.get(TOOL_NAME).execute(input, rest.length ? rest[0] : tc);
  const data = (result) => JSON.parse(result.content.find((c) => c.type === 'text').text);
  const textOf = (result) => result.content.find((c) => c.type === 'text').text;
  return { tools, contextCalls, getCalls, tc, call, data, textOf, close, wasDisposed: () => disposed,
    root, moveSession: (dir) => { currentSessionDir = dir; } };
}

const oldestFixture = () => {
  resetClock();
  return [
    stamp(assistantMsg('engineer', [toolPart('read', { path: '/proj/AGENTS.md' })])),
    stamp(assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })])),
    stamp(assistantMsg('engineer', [toolPart('shell', { command: 'node --test tests/x.test.mjs' })])),
  ];
};

describe('session evidence Native tool (fake context, current session only)', () => {
  it('registers exactly one read-only tool and disposes it', async () => {
    const h = await harness([]);
    assert.deepEqual([...h.tools.keys()], [TOOL_NAME]);
    assert.equal(h.tools.get(TOOL_NAME).options.codemode, false);
    await h.close();
    assert.equal(h.wasDisposed(), 1);
  });

  it('requires an explicit order before reading any context', async () => {
    const h = await harness(oldestFixture());
    for (const bad of [undefined, null, 'random', 42]) {
      const packet = h.data(await h.call({ order: bad }));
      assert.equal(packet.status, 'unknown');
      assert.equal(packet.reason, 'order-undeclared-or-invalid');
      assert.equal(packet.sessionScope, 'current-session-only');
      assert.equal(packet.passedProof, 'none');
    }
    assert.deepEqual(h.contextCalls, []);
  });

  it('reads only the calling session and ignores forged session inputs', async () => {
    const h = await harness(oldestFixture());
    const plain = h.data(await h.call({ order: 'oldest-first' }));
    const forged = h.data(await h.call({ order: 'oldest-first', sessionID: 'ses_forge', extra: 1 }));
    assert.deepEqual(h.contextCalls, [{ sessionID: 'ses_own' }, { sessionID: 'ses_own' }]);
    assert.deepEqual(forged, plain);
    assert.equal(plain.status, 'ok');
    assert.equal(plain.messagesObserved, 3);
    assert.equal(plain.outcome, 'candidate-after-snapshot-last-change');
    assert.ok(!h.textOf(await h.call({ order: 'oldest-first' })).includes('ses_own'));
    assert.ok(!h.textOf(await h.call({ order: 'oldest-first' })).includes('ses_forge'));
  });

  it('reports after-last-change evidence without raw text, commands, paths, or names', async () => {
    resetClock();
    const h = await harness([
      stamp(assistantMsg('engineer', [toolPart('read', { path: '/secret/path/SECRET_PATH_xyz' })])),
      stamp(assistantMsg('engineer', [toolPart('edit', { path: '/proj/src/api.ts' })])),
      stamp(assistantMsg('lead', [toolPart('shell', { command: 'npm test --secret=SECRET_CMD_xyz' })])),
    ]);
    const packet = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(packet.status, 'ok');
    assert.equal(packet.lastChange.present, true);
    assert.equal(packet.lastChange.kindClass, 'completed-edit-tool-observed');
    assert.match(packet.lastChange.kindNote, /never proof a file changed/);
    assert.deepEqual(packet.afterSnapshotLastChange, {
      verificationCandidates: 1,
      ambiguousCandidates: 0,
      failureSignals: 0,
      incompletes: 0,
    });
    assert.equal(packet.outcome, 'candidate-after-snapshot-last-change');
    assert.deepEqual(packet.roles, { withChange: 1, freshCandidate: 0, stale: 1, ambiguous: 0, failure: 0, noChange: 1 });
    assert.deepEqual(packet.tools, { completed: 3, failed: 0, incomplete: 0 });
    assert.equal(packet.passedProof, 'none');
    const blob = JSON.stringify(packet);
    for (const secret of ['SECRET_PATH_xyz', 'SECRET_CMD_xyz', 'ses_own', 'engineer', 'lead', 'npm test', '/secret/path', '/proj/src/api.ts']) {
      assert.ok(!blob.includes(secret), `output leaks ${secret}`);
    }
    // Output stays a fixed small shape well under budget.
    assert.ok(blob.length < 8192);
  });

  it('treats newest-first input identically once declared', async () => {
    const oldest = oldestFixture();
    const newest = [...oldest].reverse();
    const hOld = await harness(oldest);
    const hNew = await harness(newest);
    const viaOld = hOld.data(await hOld.call({ order: 'oldest-first' }));
    const viaNew = hNew.data(await hNew.call({ order: 'newest-first' }));
    assert.equal(viaOld.order, 'oldest-first');
    assert.equal(viaNew.order, 'newest-first');
    delete viaOld.order;
    delete viaNew.order;
    assert.deepEqual(viaNew, viaOld);
  });

  it('shows that a wrong declaration is refused by timestamp evidence', async () => {
    const h = await harness([...oldestFixture()].reverse());
    const packet = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(packet.status, 'unknown');
    assert.equal(packet.reason, 'order-contradicted');
    assert.equal(packet.order, 'oldest-first');
    assert.deepEqual(h.contextCalls, [{ sessionID: 'ses_own' }]);
  });

  it('fails closed when timestamps are missing, unparseable, or non-monotonic', async () => {
    resetClock();
    const base = oldestFixture();
    const missing = base.map((m, i) => (i === 1 ? { ...m, time: undefined } : m));
    const hMissing = await harness(missing);
    assert.equal(hMissing.data(await hMissing.call({ order: 'oldest-first' })).reason, 'order-unverifiable');
    const badString = base.map((m, i) => (i === 0 ? { ...m, time: { created: 'not-a-date' } } : m));
    const hBad = await harness(badString);
    assert.equal(hBad.data(await hBad.call({ order: 'oldest-first' })).reason, 'order-unverifiable');
    // Equal timestamps corroborate both declarations at once (no tiebreak):
    // an order-relevant layout stays unknown under both, while an
    // order-irrelevant one may confirm via order-invariance.
    resetClock();
    const flat = [stamp(assistantMsg('engineer', [toolPart('edit', { path: '/a.ts' })])), stamp(assistantMsg('engineer', [toolPart('edit', { path: '/b.ts' })]))]
      .map((m) => ({ ...m, time: { created: 5000 } }));
    for (const order of ['oldest-first', 'newest-first']) {
      const h = await harness(order === 'oldest-first' ? flat : [...flat].reverse());
      const packet = h.data(await h.call({ order }));
      assert.equal(packet.status, 'ok', order);
      assert.equal(packet.orderEvidence, 'timestamp-tied-but-order-invariant', order);
    }
  });

  it('maps malformed, unavailable, and over-budget context to unknown', async () => {
    for (const payload of [null, 'just-a-string', { data: {} }, { messages: 'nope' }]) {
      const h = await harness(payload);
      const packet = h.data(await h.call({ order: 'oldest-first' }));
      assert.equal(packet.status, 'unknown');
      assert.equal(packet.reason, 'malformed-context');
    }
    const hDown = await harness(new Error('transport gone'));
    assert.equal(hDown.data(await hDown.call({ order: 'oldest-first' })).reason, 'context-unavailable');
    const big = Array.from({ length: MAX_CONTEXT_MESSAGES + 1 }, (_, i) => ({ type: 'assistant', agent: 'x', content: [], id: `m${i}`, time: { created: 1000 + i } }));
    const hBig = await harness(big);
    const over = hBig.data(await hBig.call({ order: 'oldest-first' }));
    assert.equal(over.status, 'unknown');
    assert.equal(over.reason, 'over-budget');
    assert.equal(over.detail.reason, 'too-many-messages');
    assert.equal(over.detail.messages, MAX_CONTEXT_MESSAGES + 1);
  });

  it('reports an empty context as no observed change, not as verification', async () => {
    const h = await harness([]);
    const packet = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(packet.status, 'ok');
    assert.equal(packet.messagesObserved, 0);
    assert.equal(packet.outcome, 'no-change-in-snapshot');
    assert.equal(packet.lastChange.present, false);
    assert.equal(packet.lastChange.kindClass, null);
    assert.match(packet.lastChange.kindNote, /never proof a file changed/);
  });

  it('rejects calls without a calling session ID', async () => {
    const h = await harness(oldestFixture());
    for (const tc of [undefined, {}, { sessionID: '' }, { sessionID: 42 }]) {
      const packet = h.data(await h.call({ order: 'oldest-first' }, tc));
      assert.equal(packet.status, 'unknown');
      assert.equal(packet.reason, 'tc-session-unavailable');
    }
    assert.deepEqual(h.contextCalls, []);
  });

  it('counts visual tool completions only when requested, never as screen proof', async () => {
    resetClock();
    const fixture = [
      stamp(assistantMsg('design', [toolPart('edit', { path: '/proj/app/page.tsx' })])),
      stamp(assistantMsg('design', [toolPart('visual_capture', { path: 'before.png' })])),
      stamp(assistantMsg('design', [toolPart('visual_review', { receipt: 'r' })])),
      stamp(assistantMsg('design', [toolPart('visual_capture', { path: 'bad.png' }, 'error', 'denied')])),
      stamp(assistantMsg('design', [{ type: 'tool', name: 'visual_review', state: { status: 'pending', input: {} } }])),
      stamp(assistantMsg('design', [toolPart('edit', { path: '/proj/app/other.tsx' })])),
      stamp(assistantMsg('design', [toolPart('visual_capture', { path: 'after.png' })])),
    ];
    const h = await harness(fixture);
    const off = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(off.visual, 'not-requested');
    const on = h.data(await h.call({ order: 'oldest-first', includeVisual: true }));
    assert.deepEqual(on.visual, {
      completedCaptures: 2,
      completedReviews: 1,
      afterLastChange: { captures: 1, reviews: 0 },
      note: 'completed-tool observations only (exact names, whole snapshot vs after-last-change split); never proof of rendering, task relevance, inspection, or change verification',
    });
    assert.ok(!JSON.stringify(on).includes('visual_capture'));
    assert.ok(on.limits.join('\n').includes('screen-unobserved'));
    const malformed = h.data(await h.call({ order: 'oldest-first', includeVisual: 'yes' }));
    assert.equal(malformed.status, 'unknown');
    assert.equal(malformed.reason, 'malformed-input');
  });

  it('states current-session, gap, timestamp-check, and non-proof limits on every result', async () => {
    const h = await harness(oldestFixture());
    for (const packet of [h.data(await h.call({ order: 'oldest-first' })), h.data(await h.call({}))]) {
      const blob = packet.limits.join('\n');
      assert.ok(blob.includes('current-session-only'));
      assert.ok(blob.includes('compaction'));
      assert.ok(blob.includes('child-sessions-unobserved'));
      assert.ok(blob.includes('concurrency'));
      assert.ok(blob.includes('tool-completion-is-not-success'));
      assert.ok(blob.includes('completed-edit-is-not-file-proof'));
      assert.ok(blob.includes('order-declared-and-checked'));
      assert.ok(blob.includes('order-consistency-check'));
    }
  });

  it('refuses when the session moved away from the plugin location', async () => {
    const h = await harness(oldestFixture());
    assert.equal(h.data(await h.call({ order: 'oldest-first' })).status, 'ok');
    assert.deepEqual(h.getCalls, [{ sessionID: 'ses_own' }]);
    const elsewhere = await mkdtemp('/tmp/opencode/ksi-session-evidence-moved-');
    h.moveSession(elsewhere);
    const moved = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(moved.status, 'unknown');
    assert.equal(moved.reason, 'session-location-mismatch');
    assert.ok(!JSON.stringify(moved).includes(elsewhere), 'paths are never output');
    assert.ok(!JSON.stringify(moved).includes(h.root), 'paths are never output');
  });

  it('fails closed when session or plugin location info is missing or unreadable', async () => {
    const hMissing = await harness(oldestFixture(), { sessionGet: async () => ({}) });
    assert.equal(hMissing.data(await hMissing.call({ order: 'oldest-first' })).reason, 'session-location-unavailable');
    const hDown = await harness(oldestFixture(), { sessionGet: async () => { throw new Error('gone'); } });
    assert.equal(hDown.data(await hDown.call({ order: 'oldest-first' })).reason, 'session-unavailable');
    const tools = new Map();
    const ctx = {
      session: {
        get: async () => ({ data: { location: { directory: '/tmp' } } }),
        context: async () => [],
      },
      tool: { transform: async (fn) => { fn({ add: (t) => tools.set(t.name, t) }); return { dispose: async () => {} }; } },
    };
    await setupSessionEvidence(ctx); // plugin location missing entirely
    const out = JSON.parse((await tools.get(TOOL_NAME).execute({ order: 'oldest-first' }, { sessionID: 's' })).content[0].text);
    assert.equal(out.status, 'unknown');
    assert.equal(out.reason, 'plugin-location-unavailable');
    await assert.rejects(
      setupSessionEvidence({ session: { context: async () => [] }, tool: { transform: async () => ({ dispose: async () => {} }) } }),
      /session info is unavailable/,
    );
  });

  it('fails closed on relevant partial ties that can flip the summary', async () => {
    // Reported repro: user@1000, edit@2000, test@2000 reads consistent and
    // candidate-after under oldest-first, but swapping the tied edit/test
    // also reads consistent with an unverified outcome. Timestamps cannot
    // tell them apart, so both declarations stay unknown.
    resetClock();
    const partial = [
      { ...assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })]), time: { created: 1000 } },
      { ...assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })]), time: { created: 2000 } },
      { ...assistantMsg('engineer', [toolPart('shell', { command: 'node --test t.mjs' })]), time: { created: 2000 } },
    ];
    const hOld = await harness(partial);
    const oldPacket = hOld.data(await hOld.call({ order: 'oldest-first' }));
    assert.equal(oldPacket.status, 'unknown', 'tied edit/test block is order-relevant');
    assert.equal(oldPacket.reason, 'order-unverifiable');
    const hNew = await harness([...partial].reverse());
    const newPacket = hNew.data(await hNew.call({ order: 'newest-first' }));
    assert.equal(newPacket.status, 'unknown', 'reverse declaration also fails closed');
    assert.equal(newPacket.reason, 'order-unverifiable');
  });

  it('does not block on irrelevant ties among messages without tool parts', async () => {
    resetClock();
    const msgs = [
      { type: 'user', text: 'first', time: { created: 1000 } },
      { type: 'user', text: 'second', time: { created: 1000 } },
      stamp(assistantMsg('engineer', [toolPart('edit', { path: '/proj/a.ts' })])),
      stamp(assistantMsg('engineer', [toolPart('shell', { command: 'node --test t.mjs' })])),
    ];
    // Repair monotonic increasing times for the assistant messages.
    msgs[2] = { ...msgs[2], time: { created: 2000 } };
    msgs[3] = { ...msgs[3], time: { created: 3000 } };
    const h = await harness(msgs);
    const packet = h.data(await h.call({ order: 'oldest-first' }));
    assert.equal(packet.status, 'ok', 'user-only ties never block confirmation');
    assert.equal(packet.orderEvidence, 'timestamp-consistent');
    assert.equal(packet.outcome, 'candidate-after-snapshot-last-change');
  });
    resetClock();
    // Order-relevant with fully tied timestamps: oldest says candidate,
  it('locks the all-tied case: flipped conclusions stay unknown, invariant ones confirm', async () => {
    // newest says unverified — neither may be confirmed.
    const tied = oldestFixture().map((m) => ({ ...m, time: { created: 5000 } }));
    for (const order of ['oldest-first', 'newest-first']) {
      const h = await harness(order === 'oldest-first' ? tied : [...tied].reverse());
      const packet = h.data(await h.call({ order }));
      assert.equal(packet.status, 'unknown', order);
      assert.equal(packet.reason, 'order-unverifiable', order);
    }
    // Order-irrelevant with fully tied timestamps: identical under both
    // orders, so confirmation is safe and says so explicitly.
    resetClock();
    const same = [stamp(assistantMsg('engineer', [toolPart('edit', { path: '/a.ts' })])), stamp(assistantMsg('engineer', [toolPart('edit', { path: '/b.ts' })]))]
      .map((m) => ({ ...m, time: { created: 7000 } }));
    for (const order of ['oldest-first', 'newest-first']) {
      const h = await harness(order === 'oldest-first' ? same : [...same].reverse());
      const packet = h.data(await h.call({ order }));
      assert.equal(packet.status, 'ok', order);
      assert.equal(packet.orderEvidence, 'timestamp-tied-but-order-invariant', order);
      assert.equal(packet.outcome, 'unverified-late-change', order);
    }
  });
});
