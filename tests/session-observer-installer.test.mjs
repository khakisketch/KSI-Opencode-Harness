import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('project-local observer install does not overwrite an existing target', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'ksi-observer-install-'));
  try {
    const run = () => spawnSync(process.execPath, ['scripts/install-session-observer.mjs', '--project', project], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    const installed = path.join(project, '.opencode/plugins/ksi-session-observer/runtime.mjs');
    const before = await readFile(installed);
    assert.notEqual(run().status, 0);
    assert.deepEqual(await readFile(installed), before);
  } finally { await rm(project, { recursive: true, force: true }); }
});

test('installer refuses a symlinked plugin parent', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'ksi-observer-link-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'ksi-observer-outside-'));
  try {
    await mkdir(path.join(project, '.opencode'));
    await symlink(outside, path.join(project, '.opencode/plugins'));
    const result = spawnSync(process.execPath, ['scripts/install-session-observer.mjs', '--project', project], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    await assert.rejects(readFile(path.join(outside, 'ksi-session-observer/index.ts')), { code: 'ENOENT' });
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
