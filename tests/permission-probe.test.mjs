// permission-probe.test.mjs — injected/mock regression tests for the
// source-free ask-probe cleanup helper. No CLI, network, spawn, model calls,
// or permission-effect assertions; this guards test-cleanup code only, not a
// product evaluation framework.
// Run: `node --test tests/permission-probe.test.mjs` from the repository root.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOwnSessionNotFoundReply,
  settleSourceFreeAskProbe,
} from '../scripts/permission-probe.mjs';

const SID = 'ses_mock';
const PID = 'req_mock_1';

function mockApi({ listed = [], relist = null, replyBehavior = 'ok', calls = [] } = {}) {
  let lists = 0;
  return {
    calls,
    api: async (op, params = [], data = null) => {
      calls.push({ op, params, data });
      if (op === 'session.permission.list') {
        lists += 1;
        return lists >= 2 && relist !== null ? relist : listed;
      }
      if (op === 'session.permission.reply') {
        assert.equal(data?.decision, 'reject', 'cleanup must only reject, never approve');
        if (replyBehavior === 'ok') return { id: PID };
        throw replyBehavior;
      }
      throw new Error(`unexpected op ${op}`);
    },
  };
}

const structured404 = (id = PID) => Object.assign(new Error('gone'), {
  operation: 'session.permission.reply',
  nativeTag: 'PermissionNotFoundError',
  nativeRequestID: id,
});

describe('settleSourceFreeAskProbe (mock cleanup only)', () => {
  it('non-ask probes are noop with zero api calls', async () => {
    for (const probe of [{ effect: 'allow' }, { effect: 'deny' }]) {
      const m = mockApi();
      const res = await settleSourceFreeAskProbe({ sessionID: SID, probe, api: m.api });
      assert.equal(res.settled, 'noop');
      assert.equal(m.calls.length, 0);
    }
  });
  it('unknown probe effects fail before any API call', async () => {
    for (const effect of [undefined, null, 'unexpected']) {
      const m = mockApi();
      await assert.rejects(settleSourceFreeAskProbe({ sessionID: SID, probe: { effect }, api: m.api }));
      assert.equal(m.calls.length, 0);
    }
  });
  it('ask + listed + successful reject reports rejected', async () => {
    const m = mockApi({ listed: [{ id: PID }] });
    const res = await settleSourceFreeAskProbe({
      sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api, notice: 'n',
    });
    assert.equal(res.settled, 'rejected');
    assert.ok(m.calls.some((c) => c.op === 'session.permission.reply'));
  });
  it('ask + already absent reports already-gone without reply', async () => {
    const m = mockApi({ listed: [] });
    const res = await settleSourceFreeAskProbe({
      sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api,
    });
    assert.equal(res.settled, 'already-gone');
    assert.ok(!m.calls.some((c) => c.op === 'session.permission.reply'));
  });
  it('exact 404 + relist absent reports idempotent-cleanup', async () => {
    const m = mockApi({ listed: [{ id: PID }], relist: [], replyBehavior: structured404() });
    const res = await settleSourceFreeAskProbe({
      sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api,
    });
    assert.equal(res.settled, 'idempotent-cleanup');
  });
  it('wrong tag rethrows the reply error', async () => {
    const err = Object.assign(new Error('x'), {
      operation: 'session.permission.reply', nativeTag: 'OtherError', nativeRequestID: PID,
    });
    const m = mockApi({ listed: [{ id: PID }], replyBehavior: err });
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }),
      (e) => e === err,
    );
  });
  it('404 for another request id rethrows without relist', async () => {
    const err = structured404('req_other');
    const m = mockApi({ listed: [{ id: PID }], replyBehavior: err });
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }),
      (e) => e === err,
    );
    assert.ok(!m.calls.some((c, i) => i > 1 && c.op === 'session.permission.list'));
  });
  it('untyped 404 rethrows', async () => {
    const err = new Error('404');
    err.code = 404;
    const m = mockApi({ listed: [{ id: PID }], replyBehavior: err });
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }),
      (e) => e === err,
    );
  });
  it('wrong operation field rethrows', async () => {
    const err = Object.assign(new Error('x'), {
      operation: 'session.permission.list', nativeTag: 'PermissionNotFoundError', nativeRequestID: PID,
    });
    const m = mockApi({ listed: [{ id: PID }], replyBehavior: err });
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }),
      (e) => e === err,
    );
  });
  it('target still present after relist rethrows', async () => {
    const err = structured404();
    const m = mockApi({ listed: [{ id: PID }], relist: [{ id: PID }], replyBehavior: err });
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }),
      (e) => e === err,
    );
  });
  it('relist failure propagates', async () => {
    const boom = new Error('relist-boom');
    const api = (() => {
      let n = 0;
      return async (op, params = [], data = null) => {
        if (op === 'session.permission.list' && ++n >= 2) throw boom;
        if (op === 'session.permission.list') return [{ id: PID }];
        if (op === 'session.permission.reply') throw structured404();
        throw new Error('unexpected');
      };
    })();
    await assert.rejects(
      settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api }),
      (e) => e === boom,
    );
  });
  it('foreign-session and malformed probes throw without api calls', async () => {
    for (const probe of [
      { effect: 'ask', id: PID, sessionID: 'ses_other' },
      { effect: 'ask' },
      { effect: 'ask', id: 42 },
      null,
    ]) {
      const m = mockApi();
      await assert.rejects(settleSourceFreeAskProbe({ sessionID: SID, probe, api: m.api }));
      assert.equal(m.calls.length, 0);
    }
  });
  it('non-array list shapes throw', async () => {
    const m = mockApi({ listed: { nope: 1 } });
    await assert.rejects(settleSourceFreeAskProbe({
      sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api,
    }));
  });
  it('malformed pending entries cannot prove request absence', async () => {
    for (const listed of [[{}], [null], [{ id: '' }], [{ id: 42 }], [[]]]) {
      const m = mockApi({ listed });
      await assert.rejects(settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }));
      assert.equal(m.calls.length, 1);
    }
  });
  it('foreign listed requests are never rejected', async () => {
    const m = mockApi({ listed: [{ id: PID, sessionID: 'ses_other' }] });
    await assert.rejects(settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }));
    assert.equal(m.calls.length, 1);
  });
  it('malformed or foreign recheck entries cannot settle a missing request', async () => {
    for (const relist of [[{}], [{ id: 'other', sessionID: 'ses_other' }]]) {
      const m = mockApi({ listed: [{ id: PID }], relist, replyBehavior: structured404() });
      await assert.rejects(settleSourceFreeAskProbe({ sessionID: SID, probe: { effect: 'ask', id: PID }, api: m.api }));
    }
  });
  it('isOwnSessionNotFoundReply matches exactly one shape', () => {
    assert.equal(isOwnSessionNotFoundReply(structured404(), PID), true);
    assert.equal(isOwnSessionNotFoundReply(structured404('other'), PID), false);
    assert.equal(isOwnSessionNotFoundReply(new Error('x'), PID), false);
    assert.equal(isOwnSessionNotFoundReply(null, PID), false);
    assert.equal(isOwnSessionNotFoundReply(structured404(undefined), undefined), false);
  });
});
