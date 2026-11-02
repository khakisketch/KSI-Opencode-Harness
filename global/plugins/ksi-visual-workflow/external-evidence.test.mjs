import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, chmod, symlink, link, rm, unlink, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { externalEvidence } from './external-evidence.mjs';
import { setupVisualWorkflow } from './runtime.mjs';
import { fixturePng } from '../../../tests/helpers/visual-fixture.mjs';

if (!process.env.KSI_VISUAL_TEST_CHILD) {
  test('fixed operator configuration in an isolated HOME', async () => {
    const home = await mkdtemp(path.join(await realpath(os.homedir()), '.ksi-visual-test-'));
    try {
      const result = spawnSync(process.execPath, ['--test', fileURLToPath(import.meta.url)], { env: { ...process.env, HOME: home, KSI_VISUAL_TEST_CHILD: '1' }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    } finally { await rm(home, { recursive: true, force: true }); }
  });
} else {
  test('missing, malformed, insecure and revoked grants fail closed', async () => {
    const home = os.homedir(), configDir = path.join(home, '.config/opencode');
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    const config = path.join(configDir, 'ksi-visual-evidence.json');
    const dir = path.join(home, 'evidence'), file = path.join(dir, 'test.png');
    await mkdir(dir, { mode: 0o700 }); await writeFile(file, 'png', { mode: 0o600 });
    const calls = [], ctx = { options: { externalEvidence: [{ project: '/project', directory: dir }] }, permission: { assert: async x => calls.push(x) } };
    const tc = { sessionID: 'session', agent: 'build', messageID: 'message', id: 'tool' };
    const run = () => externalEvidence(ctx, tc, '/project', file, 8);
    const grant = JSON.stringify({ version: 1, externalEvidence: [{ project: '/project', directory: dir }] });
    await assert.rejects(run(), /operator must create/); // merged options alone do nothing
    await writeFile(config, '{', { mode: 0o600 }); await assert.rejects(run(), /malformed/);
    await writeFile(config, JSON.stringify({ version: 2, externalEvidence: [] })); await assert.rejects(run(), /invalid trusted configuration/);
    await writeFile(config, ' '.repeat(65537)); await assert.rejects(run(), /0600 regular file/);
    await writeFile(config, grant); await chmod(config, 0o644); await assert.rejects(run(), /0600/);
    await chmod(config, 0o600); await chmod(configDir, 0o777); await assert.rejects(run(), /parent is insecure/); await chmod(configDir, 0o700);
    await unlink(config); await symlink(file, config); await assert.rejects(run(), /not canonical/); await unlink(config);
    await writeFile(config, grant, { mode: 0o600 });
    const configAlias = path.join(home, 'config-alias'); await link(config, configAlias);
    await assert.rejects(run(), /no hard links/); await unlink(configAlias);
    const fileAlias = path.join(home, 'image-alias'); await link(file, fileAlias);
    await assert.rejects(run(), /no hard links/); await unlink(fileAlias);
    assert.equal((await run()).bytes.toString(), 'png');
    assert.deepEqual(calls.slice(-2).map(x => [x.action, x.resources[0]]), [['external_directory', dir + '/*'], ['read', file]]);
    await assert.rejects(externalEvidence(ctx, tc, '/other', file, 8), /not in the configured/);
    ctx.permission.assert = async x => { if (x.action === 'read') throw new Error('denied'); }; await assert.rejects(run(), /denied/);
    ctx.permission.assert = async x => { if (x.action === 'external_directory') throw new Error('directory denied'); }; await assert.rejects(run(), /directory denied/);
    ctx.permission.assert = async x => { if (x.action === 'read') await writeFile(config, grant + ' '); }; await assert.rejects(run(), /configuration changed/);
    await writeFile(config, grant);
    ctx.permission.assert = async x => { if (x.action === 'read') await unlink(config); }; await assert.rejects(run(), /operator must create/);
    await writeFile(config, grant, { mode: 0o600 });
    let live = true; ctx.permission.assert = async x => { if (x.action === 'read') live = false; };
    await assert.rejects(externalEvidence(ctx, tc, '/project', file, 8, () => { if (!live) throw new Error('disposed'); }), /disposed/);
    ctx.permission.assert = async () => {};
    await chmod(file, 0o644); await assert.rejects(run(), /0600/); await chmod(file, 0o600);
    const link = path.join(dir, 'link.png'); await symlink(file, link); await assert.rejects(externalEvidence(ctx, tc, '/project', link, 8), /canonical/);
    await chmod(dir, 0o755); await assert.rejects(run(), /0700/);
  });
  test('capture and reviews withhold cached images when a later permission revokes the grant', async () => {
    const home = os.homedir(), configDir = path.join(home, '.config/opencode');
    await mkdir(configDir, { recursive: true, mode: 0o700 });
    const config = path.join(configDir, 'ksi-visual-evidence.json');
    const project = path.join(home, 'project'), dir = path.join(home, 'evidence2');
    await mkdir(project, { mode: 0o700 }); await mkdir(dir, { mode: 0o700 });
    const target = path.join(project, 'screen.txt'), a = path.join(dir, 'a.png'), b = path.join(dir, 'b.png');
    await writeFile(target, 'screen'); await writeFile(a, fixturePng(), { mode: 0o600 }); await writeFile(b, fixturePng(32, 24, 90), { mode: 0o600 });
    const grant = JSON.stringify({ version: 1, externalEvidence: [{ project, directory: dir }] });
    const allow = () => writeFile(config, grant, { mode: 0o600 }); await allow();
    let revoke = null, imageSeen = false;
    const tools = new Map();
    const ctx = { location: { directory: project }, session: { get: async () => ({ location: { directory: project } }), context: async () => [{ id: 'user', type: 'user', text: 'Improve screen' }], hook: async () => ({ dispose: async () => {} }) },
      skill: { list: async () => [] }, tool: { transform: async f => { f({ add: t => tools.set(t.name, t) }); return { dispose: async () => {} }; } },
      permission: { assert: async x => { if (x.action !== 'read') return; const name = x.resources[0];
        if (revoke === 'target' && imageSeen && name === target) { revoke = null; await unlink(config); }
        if (revoke === 'second-image' && name === b) { revoke = null; await unlink(config); }
        if (name === a || name === b) imageSeen = true;
      } } };
    const close = await setupVisualWorkflow(ctx), tc = { sessionID: 'session', agent: 'build', messageID: 'message', id: 'tool' };
    const call = (name, input) => tools.get(name).execute(input, tc);
    const capture = file => call('visual_capture', { adapter: 'existing', path: file, state: 'screen', provenance: 'fixture', simulated: true });
    const packet = result => JSON.parse(result.content.find(item => item.type === 'text').text);
    try {
      await call('visual_prepare', { target: 'screen.txt' });
      revoke = 'target'; imageSeen = false; await assert.rejects(capture(a), /operator must create/);
      await allow(); imageSeen = false; const first = packet(await capture(a)); const second = packet(await capture(b));
      revoke = 'target'; imageSeen = false;
      await assert.rejects(call('visual_review_single', { receipt: first.id, problem: 'fixture' }), /operator must create/);
      await allow(); imageSeen = false; revoke = 'second-image';
      await assert.rejects(call('visual_review', { before: first.id, after: second.id, problem: 'fixture' }), /operator must create/);
    } finally { await close(); }
  });
}
