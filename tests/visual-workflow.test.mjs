import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, symlink, mkdir, unlink } from 'node:fs/promises';
import { renameSync, symlinkSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { routeVisualRequest, pngInfo, setupVisualWorkflow, adbScreenshot } from '../global/plugins/ksi-visual-workflow/runtime.mjs';
import { fixturePng } from './helpers/visual-fixture.mjs';

describe('visual task routing, not a quality evaluator', () => {
  for (const request of ['이 임무 화면 디자인 개선해줘', 'Improve this dashboard', 'Polish app/page.tsx', '화면의 정보 구조를 개선해줘']) {
    it(`activates the visual path: ${request}`, () => assert.ok(routeVisualRequest(request)?.skills.includes('impeccable')));
  }
  for (const request of ['서버를 개선해줘', '디자인 스킬 활용 하네스를 개선해줘', 'Explain this design workflow', 'UI runtime agent configuration', '', null]) {
    it(`does not route unrelated/meta requests: ${request}`, () => assert.equal(routeVisualRequest(request), null));
  }
  it('keeps analysis-only intent and selects complementary concerns', () => {
    assert.deepEqual(routeVisualRequest('화면 온보딩 흐름을 분석만 해줘'), { mode: 'analysis', skills: ['impeccable', 'journey'] });
    assert.deepEqual(routeVisualRequest('화면 정보 구조를 개선해줘')?.skills, ['impeccable', 'organize']);
  });
  it('rejects oversized routing input without guessing', () => assert.equal(routeVisualRequest('디자인 개선'.repeat(10_000)), null));
});

describe('bounded PNG evidence', () => {
  it('records dimensions and content hashes, not a visual verdict', () => {
    const a = pngInfo(fixturePng()), b = pngInfo(fixturePng(32, 24, 90));
    assert.equal(a.width, 32); assert.equal(a.height, 24); assert.notEqual(a.sha256, b.sha256);
  });
  for (const [name, image] of [['not an image', Buffer.from('secret')], ['truncated', fixturePng().subarray(0, 40)], ['oversized', Buffer.alloc(9 * 1024 * 1024)]]) {
    it(`rejects ${name}`, () => assert.throws(() => pngInfo(image)));
  }
});

async function harness({ deny, capture } = {}) {
  const root = await mkdtemp('/tmp/opencode/ksi-visual-unit-');
  await writeFile(path.join(root, 'Screen.kt'), 'fun screen() = "original"\n');
  await writeFile(path.join(root, 'tokens.xml'), '<color name="primary">#123456</color>');
  await writeFile(path.join(root, 'before.png'), fixturePng());
  await writeFile(path.join(root, 'after.png'), fixturePng(32, 24, 90));
  const hooks = new Map(), tools = new Map(), permissions = [], disposed = [];
  const messages = [{ id: 'msg_visual', type: 'user', text: '이 임무 화면 디자인을 개선해줘', metadata: {} }];
  let directory = root;
  const skills = ['impeccable', 'journey', 'organize'].map(id => ({ id, path: `/official/${id}/SKILL.md`, content: `Official ${id}` }));
  const ctx = { location: { directory: root },
    session: { get: async () => ({ data: { location: { directory } } }), context: async () => ({ data: messages }),
      hook: async (name, fn) => { hooks.set(name, fn); return { dispose: async () => disposed.push(name) }; } },
    skill: { list: async () => ({ data: skills }) },
    permission: { assert: async input => { permissions.push(input); if (deny?.(input)) throw new Error('Native permission denied'); } },
    tool: { transform: async fn => { fn({ add: tool => tools.set(tool.name, tool) }); return { dispose: async () => disposed.push('tools') }; } },
  };
  const close = await setupVisualWorkflow(ctx, capture ? { capture } : {});
  const tc = { sessionID: 'ses_visual', agent: 'build', messageID: 'msg_tool', id: 'call_visual', signal: new AbortController().signal };
  const call = (name, input, context = tc) => tools.get(name).execute(input, context);
  const data = result => JSON.parse(result.content.find(c => c.type === 'text').text);
  const prepare = () => call('visual_prepare', { target: 'Screen.kt', resources: ['tokens.xml'] });
  const evidence = (file, extra = {}, context = tc) => call('visual_capture', { adapter: 'existing', path: file, state: 'mission', simulated: true, provenance: 'Synthetic transport fixture, not native UI', ...extra }, context);
  return { root, ctx, tc, tools, hooks, permissions, disposed, messages, skills, close, call, data, prepare, evidence,
    move: value => { directory = value; } };
}

describe('visual runtime tools and Native boundaries', () => {
  it('attaches official skills without rewriting user text, files, delivery or model', async () => {
    const h = await harness();
    const event = { sessionID: h.tc.sessionID, prompt: { text: h.messages[0].text }, metadata: { existing: true }, delivery: 'queue' };
    await h.hooks.get('prompt')(event);
    assert.equal(event.prompt.text, h.messages[0].text); assert.equal(event.delivery, 'queue');
    assert.deepEqual(event.prompt.skills, [{ id: 'impeccable' }]);
    assert.equal(event.metadata.existing, true); assert.equal(event.metadata['ksi.visual'].mode, 'implementation');
    assert.deepEqual(h.skills.map(s => s.content), ['Official impeccable', 'Official journey', 'Official organize']);
  });
  it('honors explicit skill selection and opt-in-only catalog entries', async () => {
    const h = await harness();
    const event = { prompt: { text: h.messages[0].text, skills: [{ id: 'ux-copy' }] } };
    await h.hooks.get('prompt')(event); assert.deepEqual(event.prompt.skills, [{ id: 'ux-copy' }]);
    h.skills[0].autoinvoke = false;
    const hidden = { prompt: { text: h.messages[0].text } };
    await h.hooks.get('prompt')(hidden); assert.equal(hidden.prompt.skills, undefined);
  });
  it('uses Native session messages rather than assuming outgoing model-message shape', async () => {
    const h = await harness();
    h.messages[0].metadata['ksi.visual'] = { mode: 'analysis' };
    const event = { sessionID: h.tc.sessionID, system: [], messages: [{ role: 'user', content: 'protocol-specific' }] };
    await h.hooks.get('context')(event); assert.equal(event.system.length, 1);
    h.messages.push({ type: 'user', text: 'Now fix the API' });
    event.system = []; await h.hooks.get('context')(event); assert.equal(event.system.length, 0);
  });
  it('returns the original request and actual token/component source, not invented design context', async () => {
    const h = await harness(), packet = h.data(await h.prepare());
    assert.equal(packet.originalRequest, h.messages[0].text);
    assert.match(packet.resources[0].content, /#123456/); assert.equal(packet.resources[0].truncated, false);
    assert.match(packet.targetContent, /original/);
  });
  it('supports a large native source with a bounded, visibly truncated excerpt', async () => {
    const h = await harness(); await writeFile(path.join(h.root, 'Screen.kt'), 'x'.repeat(150_000));
    const packet = h.data(await h.prepare()); assert.equal(packet.targetTruncated, true); assert.equal(packet.targetContent.length, 12_288);
  });
  it('directs a mistaken PNG resource to capture and permits a corrected preparation', async () => {
    const h = await harness();
    await assert.rejects(h.call('visual_prepare', { target: 'Screen.kt', resources: ['before.png'] }), /UTF-8 text only.*visual_capture/);
    await assert.rejects(h.evidence('before.png'), /visual_prepare/);
    assert.equal(h.data(await h.prepare()).target, 'Screen.kt');
  });
  it('does not bypass read permission for source assets', async () => {
    const h = await harness({ deny: p => p.action === 'read' });
    await assert.rejects(h.prepare, /Native permission denied/);
  });
  it('rejects traversal and symlink escapes', async () => {
    const h = await harness(), outside = await mkdtemp('/tmp/opencode/ksi-visual-outside-');
    await writeFile(path.join(outside, 'private.kt'), 'outside');
    await symlink(path.join(outside, 'private.kt'), path.join(h.root, 'escape.kt'));
    await assert.rejects(h.call('visual_prepare', { target: 'escape.kt' }), /inside the current project/);
    await assert.rejects(h.call('visual_prepare', { target: '../outside.kt' }));
  });
  it('rejects credential resources and records no packet for them', async () => {
    const h = await harness(); await writeFile(path.join(h.root, '.env'), 'API_KEY=do-not-read');
    await assert.rejects(h.call('visual_prepare', { target: '.env' }), /credential/);
  });
  it('rejects a parent-directory swap while permission is pending', async () => {
    let swap;
    const h = await harness({ deny: () => { swap?.(); swap = undefined; return false; } });
    const outside = await mkdtemp('/tmp/opencode/ksi-visual-race-');
    await mkdir(path.join(h.root, 'assets'));
    await writeFile(path.join(h.root, 'assets/tokens.xml'), 'allowed');
    await writeFile(path.join(outside, 'tokens.xml'), 'private');
    swap = () => { renameSync(path.join(h.root, 'assets'), path.join(h.root, 'original-assets')); symlinkSync(outside, path.join(h.root, 'assets')); };
    await assert.rejects(h.call('visual_prepare', { target: 'assets/tokens.xml' }), /path changed/);
  });
  it('rejects a session moved away from the plugin location', async () => {
    const h = await harness(); h.move(await mkdtemp('/tmp/opencode/ksi-visual-moved-'));
    await assert.rejects(h.prepare, /session moved/);
  });
  it('requires task preparation before recording evidence', async () => {
    const h = await harness(); await assert.rejects(h.evidence('before.png'), /visual_prepare/);
  });
  it('requires re-preparation after a new user request', async () => {
    const h = await harness(); await h.prepare();
    h.messages.push({ id: 'msg_new', type: 'user', text: 'Different screen now' });
    await assert.rejects(h.evidence('before.png'), /current task/);
  });
  it('invalidates old receipts even when re-preparing the same message', async () => {
    const h = await harness(); await h.prepare();
    const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('after.png'));
    await h.prepare();
    await assert.rejects(h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' }), /current task\/session/);
  });
  it('connects original request, source change, receipts and two actual image payloads', async () => {
    const h = await harness(); await h.prepare();
    const before = h.data(await h.evidence('before.png'));
    await writeFile(path.join(h.root, 'Screen.kt'), 'fun screen() = "revised"\n');
    const after = h.data(await h.evidence('after.png'));
    const result = await h.call('visual_review', { before: before.id, after: after.id, problem: 'Two plans are visually indistinguishable' });
    const packet = h.data(result);
    assert.equal(packet.originalRequest, h.messages[0].text); assert.equal(packet.acceptance, 'not-evaluated');
    assert.equal(packet.afterSourceStillCurrent, true); assert.equal(packet.sameImage, false);
    assert.notEqual(packet.before.sourceSha256, packet.after.sourceSha256);
    const images = result.content.filter(c => c.type === 'file');
    assert.equal(images.length, 2); assert.deepEqual(Buffer.from(images[0].uri.split(',')[1], 'base64'), await readFile(path.join(h.root, 'before.png')));
  });
  it('keeps identical screenshots visible rather than certifying improvement', async () => {
    const h = await harness(); await h.prepare();
    const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('before.png'));
    const packet = h.data(await h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy did not improve' }));
    assert.equal(packet.sameImage, true); assert.equal(packet.acceptance, 'not-evaluated');
  });
  it('flags stale source instead of passing an older after image', async () => {
    const h = await harness(); await h.prepare();
    const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('after.png'));
    await writeFile(path.join(h.root, 'Screen.kt'), 'edited again');
    assert.equal(h.data(await h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' })).afterSourceStillCurrent, false);
  });
  for (const extra of [{ state: 'another-screen' }, { simulated: false }]) {
    it(`refuses incomparable evidence: ${JSON.stringify(extra)}`, async () => {
      const h = await harness(); await h.prepare();
      const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('after.png', extra));
      await assert.rejects(h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' }), /comparison requires/);
    });
  }
  it('refuses changed captures and foreign-session receipt replay', async () => {
    const h = await harness(); await h.prepare();
    const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('after.png'));
    await assert.rejects(h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' }, { ...h.tc, sessionID: 'ses_foreign' }), /current task\/session/);
    await writeFile(path.join(h.root, 'after.png'), fixturePng(32, 24, 120));
    await assert.rejects(h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' }), /changed after receipt/);
  });
  it('rejects an imported image replaced by an outside-project symlink', async () => {
    const h = await harness(); await h.prepare();
    const a = h.data(await h.evidence('before.png')), b = h.data(await h.evidence('after.png'));
    const outside = await mkdtemp('/tmp/opencode/ksi-visual-replay-');
    await writeFile(path.join(outside, 'image.png'), fixturePng());
    await unlink(path.join(h.root, 'after.png'));
    await symlink(path.join(outside, 'image.png'), path.join(h.root, 'after.png'));
    await assert.rejects(h.call('visual_review', { before: a.id, after: b.id, problem: 'Hierarchy' }), /escaped/);
  });
  it('refuses physical-device serials before any capture permission or I/O', async () => {
    let called = false;
    const h = await harness({ capture: () => { called = true; } }); await h.prepare();
    await assert.rejects(h.call('visual_capture', { adapter: 'android-emulator', serial: 'RC_PLUS_2', state: 'flight', simulated: false, provenance: 'not approved' }), /local emulator/);
    assert.equal(called, false); assert.ok(!h.permissions.some(p => p.action === 'shell'));
  });
  it('does not bypass Native shell denial for an emulator capture', async () => {
    let called = false;
    const h = await harness({ deny: p => p.action === 'shell', capture: () => { called = true; } }); await h.prepare();
    await assert.rejects(h.call('visual_capture', { adapter: 'android-emulator', serial: 'emulator-5560', state: 'flight', simulated: true, provenance: 'bench' }), /permission denied/);
    assert.equal(called, false);
  });
  it('requires edit permission before storing emulator output', async () => {
    const h = await harness({ deny: p => p.action === 'edit', capture: async () => fixturePng() }); await h.prepare();
    await assert.rejects(h.call('visual_capture', { adapter: 'android-emulator', serial: 'emulator-5560', state: 'flight', simulated: true, provenance: 'synthetic test transport' }), /permission denied/);
  });
  it('stores multiple emulator captures privately without launching any app', async () => {
    const h = await harness({ capture: async () => fixturePng() }); await h.prepare();
    const input = { adapter: 'android-emulator', serial: 'emulator-5560', state: 'flight', simulated: true, provenance: 'synthetic test transport' };
    const a = h.data(await h.call('visual_capture', input)), b = h.data(await h.call('visual_capture', input));
    assert.notEqual(a.file, b.file); assert.deepEqual(await readFile(a.file), fixturePng());
    assert.match(a.sourceHashMeaning, /not proof/); assert.equal(typeof a.registeredAt, 'number');
  });
  it('disposes only its own registrations', async () => {
    const h = await harness(); await h.close(); assert.deepEqual(h.disposed, ['context', 'prompt', 'tools']);
  });
});

describe('read-only ADB emulator transport', () => {
  it('requests only the chosen emulator and fixed screencap service', async () => {
    const requests = [], image = fixturePng();
    const server = net.createServer(socket => {
      let buffer = Buffer.alloc(0);
      socket.on('data', data => {
        buffer = Buffer.concat([buffer, data]);
        while (buffer.length >= 4) {
          const length = parseInt(buffer.toString('ascii', 0, 4), 16);
          if (buffer.length < length + 4) return;
          const service = buffer.toString('utf8', 4, length + 4); buffer = buffer.subarray(length + 4); requests.push(service);
          if (requests.length === 1) socket.write('OKAY');
          else { socket.write('OKAY'); socket.end(image); }
        }
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const actual = await adbScreenshot('emulator-5560', new AbortController().signal, { port: server.address().port });
      assert.deepEqual(actual, image); assert.deepEqual(requests, ['host:transport:emulator-5560', 'exec:screencap -p']);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
  it('cancels before connecting and refuses physical serials', async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(adbScreenshot('emulator-5560', controller.signal), /cancelled/);
    assert.throws(() => adbScreenshot('physical-device', controller.signal), /local emulator/);
  });
  it('enforces a total deadline even while ADB keeps sending data', async () => {
    const server = net.createServer(socket => {
      let first = true;
      socket.on('error', () => {});
      socket.on('data', () => { socket.write('OKAY'); if (first) { first = false; return; }
        const timer = setInterval(() => socket.write(Buffer.from([1])), 10);
        socket.once('close', () => clearInterval(timer));
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await assert.rejects(adbScreenshot('emulator-5560', undefined, { port: server.address().port, timeoutMs: 100 }), /timed out/); }
    finally { await new Promise(resolve => server.close(resolve)); }
  });
  it('cancels an already-connected capture', async () => {
    const controller = new AbortController();
    const server = net.createServer(socket => { socket.on('error', () => {}); socket.resume(); controller.abort(); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { await assert.rejects(adbScreenshot('emulator-5560', controller.signal, { port: server.address().port }), /cancelled/); }
    finally { await new Promise(resolve => server.close(resolve)); }
  });
});
