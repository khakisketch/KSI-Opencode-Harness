import test from 'node:test';
import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import { setupNativeDecision } from '../global/plugins/ksi-native-decision/runtime.mjs';

const directory = await realpath(process.cwd());
const model = { providerID: 'fixture', id: 'fake' };
const record = () => JSON.stringify([{ directory, ...model, allowDataTransfer: true }]);
const input = { question: 'Is delegation useful?', context: 'Synthetic task only.' };
const decoded = r => JSON.parse(r.content);
const tick = () => new Promise(resolve => setImmediate(resolve));

async function fixture({ enabled = true, consent = record(), assertPermission, generate, timeoutMs = 1000 } = {}) {
  const env = { KSI_NATIVE_DECISION_CONSENT: consent };
  const calls = { permission: [], generate: [] };
  let tool;
  const ctx = {
    options: { enabled, allowDataTransfer: true, model }, location: { directory },
    session: { get: async () => ({ data: { location: { directory } } }) },
    permission: { assert: async request => { calls.permission.push(request); return assertPermission?.(request); } },
    experimental: { generate: { decisions: async (request, options) => {
      calls.generate.push({ request, options });
      return generate ? generate(request, options) : { answers: [{ name: 'advice', type: 'predicate', probability: 0.81 }] };
    } } },
    tool: { transform: async fn => fn({ add: value => { tool = value; } }) },
  };
  const cleanup = await setupNativeDecision(ctx, { env, timeoutMs });
  const tc = (controller = new AbortController()) => ({ sessionID: 'ses_test', messageID: 'msg_test', id: 'call', agent: 'build', signal: controller.signal });
  return { tool, calls, env, ctx, tc, cleanup };
}

test('opt-in Native SDK path is advisory and bounded', async () => {
  const f = await fixture();
  const result = decoded(await f.tool.execute(input, f.tc()));
  assert.deepEqual(result.status, 'advisory'); assert.equal(result.probability, 0.81);
  assert.equal(f.calls.permission[0].action, 'decision.evaluate');
  assert.deepEqual(f.calls.permission[0].resources, ['fixture/fake']);
  assert.deepEqual(f.calls.generate[0].request.model, model);
  assert.equal(f.calls.generate[0].request.input[0].text, input.context);
  await f.tool.execute(input, f.tc()); await f.tool.execute(input, f.tc());
  assert.equal(decoded(await f.tool.execute(input, f.tc())).status, 'unavailable');
  assert.equal(f.calls.generate.length, 3);
});

test('unconfigured, absent or mismatched consent, and denied permission dispatch nothing', async () => {
  for (const opts of [{ enabled: false }, { consent: '' }, { consent: JSON.stringify([{ directory, ...model }]) }]) {
    const f = await fixture(opts);
    assert.equal(decoded(await f.tool.execute(input, f.tc())).status, 'unavailable');
    assert.equal(f.calls.generate.length, 0); assert.equal(f.calls.permission.length, 0);
  }
  const denial = new Error('native denied');
  const f = await fixture({ assertPermission: () => { throw denial; } });
  await assert.rejects(f.tool.execute(input, f.tc()), e => e === denial);
  assert.equal(f.calls.generate.length, 0);
});

test('cancelled permission wait cannot dispatch on later approval', async () => {
  let approve;
  const f = await fixture({ assertPermission: () => new Promise(r => { approve = r; }) });
  const controller = new AbortController();
  const pending = f.tool.execute(input, f.tc(controller));
  while (!approve) await tick();
  controller.abort();
  assert.equal(decoded(await pending).status, 'unavailable');
  approve(); await tick(); await tick();
  assert.equal(f.calls.generate.length, 0);
});

test('permission timeout returns unavailable and a late approval cannot dispatch', async () => {
  let approve;
  const f = await fixture({ timeoutMs: 10, assertPermission: () => new Promise(r => { approve = r; }) });
  const pending = f.tool.execute(input, f.tc());
  while (!approve) await tick();
  assert.equal(decoded(await pending).status, 'unavailable');
  approve(); await tick();
  assert.equal(f.calls.generate.length, 0);
});

test('plugin unload aborts a pending call and disables captured tool', async () => {
  let approve;
  const f = await fixture({ assertPermission: () => new Promise(r => { approve = r; }) });
  const pending = f.tool.execute(input, f.tc());
  while (!approve) await tick();
  f.cleanup();
  assert.equal(decoded(await pending).status, 'unavailable');
  approve(); await tick();
  assert.equal(f.calls.generate.length, 0);
  assert.equal(decoded(await f.tool.execute(input, f.tc())).status, 'unavailable');
});

test('revoked consent or changed location while waiting prevents dispatch', async () => {
  for (const change of ['consent', 'location']) {
    let approve;
    const f = await fixture({ assertPermission: () => new Promise(r => { approve = r; }) });
    const pending = f.tool.execute(input, f.tc());
    while (!approve) await tick();
    if (change === 'consent') f.env.KSI_NATIVE_DECISION_CONSENT = '';
    else f.ctx.session.get = async () => ({ data: { location: { directory: '/' } } });
    approve();
    assert.equal(decoded(await pending).status, 'unavailable');
    assert.equal(f.calls.generate.length, 0);
  }
});

test('cancellation and consent revocation withhold late provider results', async () => {
  for (const change of ['cancel', 'revoke']) {
    let resolve;
    const f = await fixture({ generate: () => new Promise(r => { resolve = r; }) });
    const controller = new AbortController();
    const pending = f.tool.execute(input, f.tc(controller));
    while (!resolve) await tick();
    if (change === 'cancel') controller.abort(); else f.env.KSI_NATIVE_DECISION_CONSENT = '';
    resolve({ answers: [{ name: 'advice', type: 'predicate', probability: 1 }] });
    assert.equal(decoded(await pending).status, 'unavailable');
    assert.equal(f.calls.generate.length, 1);
    if (change === 'cancel') assert.equal(f.calls.generate[0].options.signal.aborted, true);
  }
});

test('provider errors and malformed answers are unavailable, not no', async () => {
  for (const generate of [() => { throw Error('failure'); }, () => ({ answers: [{ name: 'advice', type: 'error' }] })]) {
    const f = await fixture({ generate });
    assert.equal(decoded(await f.tool.execute(input, f.tc())).status, 'unavailable');
  }
});
