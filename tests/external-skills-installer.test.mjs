import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = 'scripts/install-external-skills.mjs';
const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('lists both vendored skill sets', () => {
  const result = run(['--list']);
  assert.equal(result.status, 0);
  const rows = result.stdout.trim().split('\n');
  assert.equal(rows.length, 17);
  assert.ok(rows.includes('engineering\tdebug'));
  assert.ok(rows.includes('design\tdesign-critique'));
});

test('project install is idempotent and verifiable', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'ksi-ext-skills-'));
  try {
    const first = run(['--project', project, '--set', 'design']);
    assert.equal(first.status, 0, first.stderr);
    const skills = await readdir(path.join(project, '.opencode/skills'));
    assert.equal(skills.length, 7);
    const again = run(['--project', project, '--set', 'design']);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /0 written, 7 unchanged/);
    const verify = run(['--project', project, '--set', 'design', '--verify']);
    assert.equal(verify.status, 0, verify.stderr);
  } finally { await rm(project, { recursive: true, force: true }); }
});

test('refuses to overwrite a different existing skill', async () => {
  const project = await mkdtemp(path.join(tmpdir(), 'ksi-ext-conflict-'));
  try {
    assert.equal(run(['--project', project, '--set', 'engineering', '--skill', 'debug']).status, 0);
    const file = path.join(project, '.opencode/skills/debug/SKILL.md');
    const before = await readFile(file);
    await writeFile(file, Buffer.concat([before, Buffer.from('\nchanged\n')]));
    const result = run(['--project', project, '--set', 'engineering', '--skill', 'debug']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refusing to overwrite/);
  } finally { await rm(project, { recursive: true, force: true }); }
});

test('rejects relative project paths and symlinked targets', async () => {
  assert.notEqual(run(['--project', 'relative/dir']).status, 0);
  const project = await mkdtemp(path.join(tmpdir(), 'ksi-ext-link-'));
  const outside = await mkdtemp(path.join(tmpdir(), 'ksi-ext-outside-'));
  try {
    await mkdir(path.join(project, '.opencode'), { recursive: true });
    await symlink(outside, path.join(project, '.opencode/skills'));
    const result = run(['--project', project, '--set', 'design']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /symlink/i);
  } finally {
    await rm(project, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
