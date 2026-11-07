// Project-only installer fixtures; never touches the real global installation.
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat, symlink, unlink, readdir, realpath, copyFile } from 'node:fs/promises';
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

async function faultFixture() {
  const h = await fixture();
  const repo = path.join(h.root, 'repo');
  const source = path.join(repo, 'global/plugins/ksi-capabilities-inventory');
  const localScript = path.join(repo, 'scripts/install-capabilities-inventory.mjs');
  await mkdir(source, { recursive: true }); await mkdir(path.dirname(localScript), { recursive: true });
  await copyFile(script, localScript);
  for (const file of ['runtime.mjs', 'index.ts']) await copyFile(new URL(`../global/plugins/ksi-capabilities-inventory/${file}`, import.meta.url), path.join(source, file));
  const run = (...args) => spawnSync(process.execPath, [localScript, '--project', h.root, ...args], { env: { ...process.env, XDG_CONFIG_HOME: path.join(h.root, 'global-config') }, encoding: 'utf8' });
  const inject = async body => {
    const preload = path.join(h.root, 'fault.mjs');
    await writeFile(preload, `import fs from 'node:fs/promises';\nimport { syncBuiltinESMExports } from 'node:module';\nimport { spawnSync } from 'node:child_process';\nconst source = ${JSON.stringify(source)}, target = ${JSON.stringify(h.target)}, script = ${JSON.stringify(localScript)}, root = ${JSON.stringify(h.root)};\n${body}\nsyncBuiltinESMExports();\n`);
    return spawnSync(process.execPath, ['--import', preload, localScript, '--project', h.root], { env: { ...process.env, XDG_CONFIG_HOME: path.join(h.root, 'global-config') }, encoding: 'utf8' });
  };
  return { ...h, source, run, inject, lock: path.join(h.root, '.opencode/.ksi-capabilities-inventory-install.lock') };
}

it('deploys the exact bytes hashed even when source changes after its first read', async () => {
  const h = await faultFixture();
  const result = await h.inject(`const original = fs.readFile; let changed = false;
fs.readFile = async (file, ...args) => {
  const bytes = await original(file, ...args);
  if (String(file) === source + '/runtime.mjs' && !changed) { changed = true; await fs.writeFile(file, '// later source version\\n'); }
  return bytes;
};`);
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(path.join(h.target, '.ksi-install.json'), 'utf8'));
  assert.equal(manifest['runtime.mjs'], createHash('sha256').update(await readFile(path.join(h.target, 'runtime.mjs'))).digest('hex'));
  assert.notEqual(await readFile(path.join(h.target, 'runtime.mjs'), 'utf8'), '// later source version\n');
});
it('excludes a concurrent installer and read-only verifier before source reads', async () => {
  const h = await faultFixture();
  const result = await h.inject(`const original = fs.readFile; let checked = false;
fs.readFile = async (file, ...args) => {
  if (String(file) === source + '/runtime.mjs' && !checked) {
    checked = true;
    const results = [[], ['--verify']].map(args => { const r = spawnSync(process.execPath, [script, '--project', root, ...args], { encoding: 'utf8', env: process.env }); return { status: r.status, stderr: r.stderr }; });
    await fs.writeFile(root + '/concurrency.json', JSON.stringify(results));
  }
  return original(file, ...args);
};`);
  const results = JSON.parse(await readFile(path.join(h.root, 'concurrency.json'), 'utf8'));
  for (const r of results) { assert.notEqual(r.status, 0); assert.match(r.stderr, /lock|in progress|interrupted/i); }
  assert.equal(result.status, 0, result.stderr);
  await assert.rejects(stat(h.lock), { code: 'ENOENT' });
});
it('stages every changed file before publishing and preserves the old manifest on staging failure', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  const before = new Map(await Promise.all(['runtime.mjs', 'index.ts', '.ksi-install.json'].map(async file => [file, await readFile(path.join(h.target, file))])));
  for (const file of ['runtime.mjs', 'index.ts']) await writeFile(path.join(h.source, file), '// next managed fixture\n');
  const result = await h.inject(`const original = fs.writeFile;
fs.writeFile = async (file, ...args) => { if (String(file).includes('index.ts') && String(file) !== target + '/index.ts') throw new Error('injected staging failure'); return original(file, ...args); };`);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /injected staging failure/);
  for (const [file, bytes] of before) assert.equal(createHash('sha256').update(await readFile(path.join(h.target, file))).digest('hex'), createHash('sha256').update(bytes).digest('hex'), file);
});
it('cleans partial staging bytes after EIO/ENOSPC without masking the original error', async () => {
  for (const [code, failedFile] of [['EIO', 'index.ts'], ['ENOSPC', '.ksi-install.json']]) {
    const h = await faultFixture(); assert.equal(h.run().status, 0);
    const before = new Map(await Promise.all(['runtime.mjs', 'index.ts', '.ksi-install.json'].map(async file => [file, await readFile(path.join(h.target, file))])));
    for (const file of ['runtime.mjs', 'index.ts']) await writeFile(path.join(h.source, file), '// next managed fixture\n');
    const result = await h.inject(`const original = fs.writeFile;
fs.writeFile = async (file, bytes, options) => {
  if (String(file) === root + '/.opencode/.ksi-capabilities-inventory-install.lock/' + ${JSON.stringify(failedFile)}) {
    await original(file, Buffer.from(bytes).subarray(0, 3), options);
    throw Object.assign(new Error('injected partial ${code} staging failure'), { code: '${code}' });
  }
  return original(file, bytes, options);
};`);
    assert.notEqual(result.status, 0); assert.match(result.stderr, new RegExp(`injected partial ${code} staging failure`));
    assert.doesNotMatch(result.stderr, /ENOTEMPTY/);
    await assert.rejects(stat(h.lock), { code: 'ENOENT' });
    for (const [file, bytes] of before) assert.equal(createHash('sha256').update(await readFile(path.join(h.target, file))).digest('hex'), createHash('sha256').update(bytes).digest('hex'), file);
    assert.equal(h.run().status, 0);
  }
});
it('preserves the partial staging error even if cleanup itself fails', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  const manifest = await readFile(path.join(h.target, '.ksi-install.json'));
  for (const file of ['runtime.mjs', 'index.ts']) await writeFile(path.join(h.source, file), '// next managed fixture\n');
  const result = await h.inject(`const originalWrite = fs.writeFile, originalUnlink = fs.unlink;
fs.writeFile = async (file, bytes, options) => {
  if (String(file) === root + '/.opencode/.ksi-capabilities-inventory-install.lock/index.ts') {
    await originalWrite(file, Buffer.from(bytes).subarray(0, 3), options);
    throw Object.assign(new Error('original partial staging EIO'), { code: 'EIO' });
  }
  return originalWrite(file, bytes, options);
};
fs.unlink = async file => { if (String(file) === root + '/.opencode/.ksi-capabilities-inventory-install.lock/runtime.mjs') throw Object.assign(new Error('injected cleanup denied'), { code: 'EACCES' }); return originalUnlink(file); };`);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /original partial staging EIO/);
  assert.match(result.stderr, /cleanup.*failed/i);
  assert.ok((await stat(h.lock)).isDirectory());
  await assert.rejects(stat(path.join(h.lock, 'index.ts')), { code: 'ENOENT' });
  assert.deepEqual(await readFile(path.join(h.target, '.ksi-install.json')), manifest);
});
it('preserves an unexpected staging file rejected by exclusive open', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  const manifest = await readFile(path.join(h.target, '.ksi-install.json'));
  await writeFile(path.join(h.source, 'index.ts'), '// next managed fixture\n');
  const result = await h.inject(`const original = fs.writeFile;
fs.writeFile = async (file, bytes, options) => {
  if (String(file) === root + '/.opencode/.ksi-capabilities-inventory-install.lock/index.ts') await original(file, '// unexpected foreign stage', { flag: 'wx' });
  return original(file, bytes, options);
};`);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /EEXIST/);
  assert.equal(await readFile(path.join(h.lock, 'index.ts'), 'utf8'), '// unexpected foreign stage');
  assert.deepEqual(await readFile(path.join(h.target, '.ksi-install.json')), manifest);
});
it('uses atomic no-clobber publication for absent files and manifest after the last check', async () => {
  for (const collision of ['runtime.mjs', 'index.ts', '.ksi-install.json']) {
    const h = await faultFixture();
    const result = await h.inject(`const originalWrite = fs.writeFile; let injected = false;
for (const method of ['rename', 'link']) {
  const original = fs[method];
  fs[method] = async (from, to) => {
    if (String(to) === target + '/' + ${JSON.stringify(collision)} && !injected) {
      injected = true; await originalWrite(to, '// user file created after last check', { flag: 'wx' });
    }
    return original(from, to);
  };
}`);
    assert.notEqual(result.status, 0, `must refuse late ${collision}`);
    assert.match(result.stderr, /EEXIST/);
    assert.equal(await readFile(path.join(h.target, collision), 'utf8'), '// user file created after last check');
    if (collision !== '.ksi-install.json') await assert.rejects(stat(path.join(h.target, '.ksi-install.json')), { code: 'ENOENT' });
    assert.ok((await stat(h.lock)).isDirectory());
  }
});
it('leaves a fail-closed inspection lock and old manifest after interruption during publication', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  const manifest = await readFile(path.join(h.target, '.ksi-install.json'));
  await writeFile(path.join(h.source, 'runtime.mjs'), '// next managed fixture\n');
  const result = await h.inject(`const original = fs.rename;
fs.rename = async (from, to) => { await original(from, to); if (String(to) === target + '/runtime.mjs') process.kill(process.pid, 'SIGTERM'); };`);
  assert.equal(result.signal, 'SIGTERM');
  assert.deepEqual(await readFile(path.join(h.target, '.ksi-install.json')), manifest);
  assert.ok((await stat(h.lock)).isDirectory());
  assert.match(h.run().stderr, /lock|in progress|interrupted/i);
  assert.match(h.run('--verify').stderr, /lock|in progress|interrupted/i);
});
it('publishes pre-staged dependencies then entrypoint then manifest, outside Native discovery', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  for (const file of ['runtime.mjs', 'index.ts']) await writeFile(path.join(h.source, file), '// next managed fixture\n');
  const result = await h.inject(`const original = fs.rename; const order = [];
fs.rename = async (from, to) => {
  if (String(from).startsWith(target + '/')) throw new Error('staging inside plugin target');
  if (!order.length) for (const file of ['runtime.mjs', 'index.ts', '.ksi-install.json']) await fs.stat(root + '/.opencode/.ksi-capabilities-inventory-install.lock/' + file);
  order.push(String(to).split('/').at(-1)); await fs.writeFile(root + '/publication.json', JSON.stringify(order));
  return original(from, to);
};`);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(path.join(h.root, 'publication.json'), 'utf8')), ['runtime.mjs', 'index.ts', '.ksi-install.json']);
});
it('refuses late user edits before publication without replacing the old manifest', async () => {
  const h = await faultFixture(); assert.equal(h.run().status, 0);
  const manifest = await readFile(path.join(h.target, '.ksi-install.json'));
  await writeFile(path.join(h.source, 'runtime.mjs'), '// next managed fixture\n');
  const result = await h.inject(`const original = fs.writeFile;
fs.writeFile = async (file, ...args) => { const result = await original(file, ...args); if (String(file).endsWith('/.ksi-install.json') && !String(file).startsWith(target + '/')) await original(target + '/runtime.mjs', '// concurrent user edit'); return result; };`);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /changed during/);
  assert.equal(await readFile(path.join(h.target, 'runtime.mjs'), 'utf8'), '// concurrent user edit');
  assert.deepEqual(await readFile(path.join(h.target, '.ksi-install.json')), manifest);
});
it('refuses a symlink lock without touching its external directory', async () => {
  const h = await faultFixture(); const outside = await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-lock-'));
  await mkdir(path.dirname(h.lock), { recursive: true }); await symlink(outside, h.lock);
  assert.match(h.run().stderr, /symlink/); assert.match(h.run('--verify').stderr, /symlink/);
  assert.deepEqual(await readdir(outside), []);
});

it('installs and verifies only adapter files while preserving existing settings', async () => {
  const h = await fixture(); await mkdir(path.join(h.root, '.opencode/plugins'), { recursive: true });
  const unrelated = path.join(h.root, '.opencode/opencode.jsonc');
  await writeFile(unrelated, '{"personal":"preserve"}');
  const install = h.run(); assert.equal(install.status, 0); assert.equal(h.run('--verify').status, 0);
  assert.match(install.stdout, /not atomic compare-and-swap/);
  assert.match(install.stdout, /Non-cooperating writes after that check can still be overwritten/);
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
