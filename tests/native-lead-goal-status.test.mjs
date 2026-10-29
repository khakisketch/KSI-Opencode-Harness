import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotate } from '../global/plugins/ksi-native-lead-goal/status.mjs';

const event = () => ({ tool: 'subagent', status: 'completed', agent: 'build', sessionID: 'parent', input: { agent: 'lead' }, result: { content: 'child output', metadata: { sessionID: 'child', status: 'completed' } } });
const session = async () => ({ parentID: 'parent', agent: 'lead' });
test('reports native state and reason without treating it as task success', async () => {
  for (const state of ['complete', 'paused', 'active']) {
    const e = event(); await annotate(e, { getSession: session, getGoal: async () => ({ status: state, reason: 'blocked: fixture' }) });
    assert.match(e.result.content, new RegExp(`Goal snapshot: ${state}`));
    assert.match(e.result.content, /blocked: fixture/); assert.match(e.result.content, /not task verification/);
  }
});
test('distinguishes absent from unknown', async () => {
  const a = event(); await annotate(a, { getSession: session, getGoal: async () => null }); assert.match(a.result.content, /not set/);
  const b = event(); await annotate(b, { getSession: session, getGoal: async () => { throw Error('unavailable'); } }); assert.match(b.result.content, /unknown/);
});
test('reads matching resumed foreground child without mutation', async () => {
  const e = event(); e.input.sessionID = 'child'; await annotate(e, { getSession: session, getGoal: async () => ({status:'paused', reason:'x'.repeat(400)}) });
  assert.match(e.result.content, /Goal snapshot: paused/); assert.match(e.result.content, /untrusted reason/); assert.match(e.result.content, /truncated/); assert.doesNotMatch(e.result.content, /x{301}/);
});
test('ignores mismatched resumed, background, unrelated and wrong-parent calls', async () => {
  for (const patch of [{input:{agent:'lead',sessionID:'existing'}},{input:{agent:'lead',background:true}},{input:{agent:'general'}},{agent:'lead'}]) {
    const e = Object.assign(event(), patch); await annotate(e, { getSession: () => { throw Error('must not read'); }, getGoal: () => null }); assert.equal(e.result.content, 'child output');
  }
  const e = event(); await annotate(e, { getSession: async () => ({ parentID: 'another', agent: 'lead' }), getGoal: () => { throw Error('must not read'); } }); assert.equal(e.result.content, 'child output');
});
