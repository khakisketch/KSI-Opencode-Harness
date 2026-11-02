// Project-only installer fixtures; never touches the real global installation.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat, symlink, unlink, readdir, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/install-capabilities-inventory.mjs', import.meta.url));
async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-installer-')));
  const target = path.join(root, '.opencode/plugins/ksi-capabilities-inventory');
  const run = (...args) => spawnSync(process.execPath, [script, '--project', root, ...args], { env: { ...process.env, XDG_CONFIG_HOME: path.join(root, 'global-config') }, encoding: 'utf8' });
  return { root, target, run };
}

it('installs and verifies only adapter files while preserving existing settings', async () => {
  const h = await fixture(); await mkdir(path.join(h.root, '.opencode/plugins'), { recursive: true });
  const unrelated = path.join(h.root, '.opencode/opencode.jsonc');
  await writeFile(unrelated, '{"personal":"preserve"}');
  assert.equal(h.run().status, 0); assert.equal(h.run('--verify').status, 0);
  assert.equal(await readFile(unrelated, 'utf8'), '{"personal":"preserve"}');
  await assert.rejects(stat(path.join(h.root, 'global-config')), { code: 'ENOENT' });
});
it('verification of a missing installation is read-only', async () => {
  const h = await fixture(); assert.notEqual(h.run('--verify').status, 0);
  await assert.rejects(stat(h.target), { code: 'ENOENT' });
});
it('reapplication is idempotent including manifest mtime', async () => {
  const h = await fixture(); assert.equal(h.run().status, 0);
  const before = await stat(path.join(h.target, '.ksi-install.json'));
  assert.equal(h.run().status, 0);
  assert.equal((await stat(path.join(h.target, '.ksi-install.json'))).mtimeMs, before.mtimeMs);
});
it('upgrades a hash-matched managed version after making a full backup', async () => {
  const h = await fixture(); assert.equal(h.run().status, 0);
  const manifestPath = path.join(h.target, '.ksi-install.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const previous = '// previous managed fixture\n';
  await writeFile(path.join(h.target, 'runtime.mjs'), previous);
  manifest['runtime.mjs'] = createHash('sha256').update(previous).digest('hex');
  await writeFile(manifestPath, JSON.stringify(manifest));
  const result = h.run(); assert.equal(result.status, 0, result.stderr);
  const backup = result.stdout.match(/Backup: (.+)/)?.[1]; assert.ok(backup);
  assert.equal(await readFile(path.join(backup, 'runtime.mjs'), 'utf8'), previous);
  assert.equal(h.run('--verify').status, 0);
});
it('refuses a modified managed file without partially changing other files', async () => {
  const h = await fixture(); assert.equal(h.run().status, 0);
  const index = await readFile(path.join(h.target, 'index.ts'));
  await writeFile(path.join(h.target, 'runtime.mjs'), '// user edit');
  assert.notEqual(h.run().status, 0); assert.notEqual(h.run('--verify').status, 0);
  assert.deepEqual(await readFile(path.join(h.target, 'index.ts')), index);
  assert.equal(await readFile(path.join(h.target, 'runtime.mjs'), 'utf8'), '// user edit');
});
it('does not recreate a missing manifest-recorded file or change other files', async () => {
  const h = await fixture(); assert.equal(h.run().status, 0);
  const index = await readFile(path.join(h.target, 'index.ts'));
  const manifest = await readFile(path.join(h.target, '.ksi-install.json'));
  await unlink(path.join(h.target, 'runtime.mjs'));
  const install = h.run();
  assert.notEqual(install.status, 0); assert.match(install.stderr, /missing/);
  assert.notEqual(h.run('--verify').status, 0);
  await assert.rejects(stat(path.join(h.target, 'runtime.mjs')), { code: 'ENOENT' });
  assert.deepEqual(await readFile(path.join(h.target, 'index.ts')), index);
  assert.deepEqual(await readFile(path.join(h.target, '.ksi-install.json')), manifest);
  assert.deepEqual((await readdir(h.target)).sort(), ['.ksi-install.json', 'index.ts']);
});
it('requires an explicit absolute project before writing anywhere', async () => {
  const h = await fixture(); const workdir = await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-installer-cwd-'));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    cwd: workdir, env: { ...process.env, HOME: h.root, XDG_CONFIG_HOME: 'relative-config' }, encoding: 'utf8',
  });
  const install = run(); assert.notEqual(install.status, 0); assert.match(install.stderr, /--project/);
  assert.notEqual(run('--verify').status, 0);
  assert.notEqual(run('--project', 'relative-project').status, 0);
  assert.notEqual(run('--project', path.join(h.root, 'missing')).status, 0);
  assert.deepEqual(await readdir(workdir), []);
  assert.deepEqual(await readdir(h.root), []);
});
it('ignores global configuration homes and installs only inside the explicit project', async () => {
  const h = await fixture(); const workdir = await realpath(await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-installer-project-')));
  const run = (...args) => spawnSync(process.execPath, [script, ...args], {
    cwd: workdir, env: { ...process.env, HOME: h.root, XDG_CONFIG_HOME: 'relative-config' }, encoding: 'utf8',
  });
  const install = run('--project', workdir); assert.equal(install.status, 0, install.stderr);
  assert.equal(run('--project', workdir, '--verify').status, 0);
  assert.ok((await stat(path.join(workdir, '.opencode/plugins/ksi-capabilities-inventory/runtime.mjs'))).isFile());
  assert.deepEqual(await readdir(workdir), ['.opencode']);
  assert.deepEqual(await readdir(h.root), []);
});
it('refuses to install or verify alongside unknown plugin entrypoints', async () => {
  for (const alreadyManaged of [false, true]) {
    const h = await fixture();
    if (alreadyManaged) assert.equal(h.run().status, 0);
    else await mkdir(h.target, { recursive: true });
    const extra = path.join(h.target, 'server.ts');
    await writeFile(extra, '// preserve unrelated entrypoint\n');
    const before = (await readdir(h.target)).sort();
    const install = h.run(); assert.notEqual(install.status, 0); assert.match(install.stderr, /unmanaged|partial/);
    assert.notEqual(h.run('--verify').status, 0);
    assert.equal(await readFile(extra, 'utf8'), '// preserve unrelated entrypoint\n');
    assert.deepEqual((await readdir(h.target)).sort(), before);
  }
});
it('refuses unmanaged files even when their bytes equal current source', async () => {
  const h = await fixture(); await mkdir(h.target, { recursive: true });
  await writeFile(path.join(h.target, 'index.ts'), await readFile(new URL('../global/plugins/ksi-capabilities-inventory/index.ts', import.meta.url)));
  assert.notEqual(h.run().status, 0);
  await assert.rejects(stat(path.join(h.target, 'runtime.mjs')), { code: 'ENOENT' });
});
it('refuses malformed manifests without replacing them or installing files', async () => {
  for (const value of ['null', '{}', '[]', '"unmanaged"']) {
    const h = await fixture(); await mkdir(h.target, { recursive: true });
    const manifest = path.join(h.target, '.ksi-install.json'); await writeFile(manifest, value);
    assert.notEqual(h.run().status, 0); assert.equal(await readFile(manifest, 'utf8'), value);
    await assert.rejects(stat(path.join(h.target, 'runtime.mjs')), { code: 'ENOENT' });
  }
});
for (const scope of ['directory', 'file', 'manifest', 'parent']) {
  it(`refuses symlink installation ${scope}`, async () => {
    const h = await fixture(); const outside = await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-install-outside-'));
    await mkdir(path.dirname(h.target), { recursive: true });
    if (scope === 'directory') await symlink(outside, h.target);
    else if (scope === 'parent') {
      await symlink(outside, path.join(h.root, 'linked'));
      const result = spawnSync(process.execPath, [script, '--project', path.join(h.root, 'linked')], { encoding: 'utf8' });
      assert.notEqual(result.status, 0); assert.match(result.stderr, /symlink/); return;
    } else {
      await mkdir(h.target); const name = scope === 'file' ? 'runtime.mjs' : '.ksi-install.json';
      const external = path.join(outside, name); await writeFile(external, 'preserve'); await symlink(external, path.join(h.target, name));
    }
    const result = h.run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /symlink/);
  });
}
