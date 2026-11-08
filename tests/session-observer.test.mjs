import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySnapshot, observeChild, readChildSnapshot } from '../global/plugins/ksi-session-observer/runtime.mjs';

const id = 'ses_child1', parent = 'ses_parent1';
const session = (extra = {}) => ({ id, parentID: parent, projectID: 'p', time: { busy: 1, idle: 2 }, location: { directory: process.cwd() }, ...extra });
test('permission, active and terminal states are distinct; races fail closed', () => {
  const classify = (s, previous = s, permissions = []) => classifySnapshot({ session: s, previous, permissions });
  assert.equal(classify(session(), session(), [{}]), 'permission_wait');
  assert.equal(classify(session({ time: { busy: 3, idle: 2 } })), 'running_or_stalled');
  assert.equal(classify(session({ outcome: 'succeeded' })), 'completed');
  assert.equal(classify(session({ outcome: 'failed' })), 'failed');
  assert.equal(classify(session({ outcome: 'interrupted' })), 'interrupted');
  assert.equal(classify(session({ outcome: 'succeeded' }), session()), 'unknown');
  assert.equal(classify(session()), 'inactive_unknown');
});

function fixture({ eventSequence = [], otherParent = false } = {}) {
  let running = true;
  const current = () => session({ parentID: otherParent ? 'ses_other1' : parent, ...(running ? { time: { busy: 3, idle: 2 } } : { outcome: 'succeeded' }) });
  const ctx = {
    location: { directory: process.cwd() },
    session: {
      get: async ({ sessionID }) => sessionID === parent ? { id: parent, projectID: 'p', location: { directory: process.cwd() } } : current(),
    },
    permission: { list: async () => [] },
    event: { subscribe: () => ({ async *[Symbol.asyncIterator]() {
      for (const item of eventSequence) { if (item.complete) running = false; yield item.event; }
    } }) },
  };
  return ctx;
}
test('event hint never authorizes action and duplicate hints reconcile current state', async () => {
  const event = { type: 'session.execution.succeeded', data: { sessionID: id } };
  const result = await observeChild(fixture({ eventSequence: [{ event }, { event, complete: true }] }), parent, id, 1000);
  assert.equal(result.state, 'completed');
  assert.equal(result.eventHint, event.type);
  assert.match(result.advice, /No automatic resume/);
});
test('rejects an unrelated session before reading state', async () => {
  await assert.rejects(readChildSnapshot(fixture({ otherParent: true }), parent, id), /not an owned direct child/);
});
test('a missing event does not fabricate completion', async () => {
  const result = await observeChild(fixture(), parent, id, 100);
  assert.equal(result.state, 'running_or_stalled');
  assert.equal(result.streamError, true);
});
test('timeout reconciles even if the event source remains open and silent', async () => {
  const ctx = fixture();
  ctx.event.subscribe = ({ signal }) => ({ async *[Symbol.asyncIterator]() {
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
  } });
  const result = await observeChild(ctx, parent, id, 15);
  assert.equal(result.state, 'running_or_stalled');
  assert.equal(result.eventHint, null);
  assert.equal(result.streamError, false);
});

test('a lost completion event is reconciled from the final snapshot', async () => {
  let reads = 0;
  const ctx = fixture();
  ctx.session.get = async ({ sessionID }) => {
    if (sessionID === parent) return { id: parent, projectID: 'p', location: { directory: process.cwd() } };
    reads++;
    return reads <= 3 ? session({ time: { busy: 3, idle: 2 } }) : session({ outcome: 'succeeded' });
  };
  ctx.event.subscribe = ({ signal }) => ({ async *[Symbol.asyncIterator]() {
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
  } });
  const result = await observeChild(ctx, parent, id, 15);
  assert.equal(result.state, 'completed');
  assert.equal(result.eventHint, null);
  assert.equal(result.sessionID, id);
});

test('concurrent duplicate and stale event hints do not replace the session snapshot', async () => {
  const event = { id: 'evt_same', type: 'session.execution.succeeded', data: { sessionID: id } };
  const make = () => fixture({ eventSequence: [{ event }, { event }] });
  const outcomes = await Promise.all([observeChild(make(), parent, id, 100), observeChild(make(), parent, id, 100)]);
  for (const result of outcomes) {
    assert.equal(result.sessionID, id);
    assert.equal(result.state, 'running_or_stalled');
    assert.equal(result.eventHint, event.type);
    assert.match(result.advice, /No automatic resume or replacement/);
  }
});
