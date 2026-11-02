import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('../scripts/prepare-isolated-work.mjs', import.meta.url));
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ksi-isolation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  git(repo, 'init', '-q'); git(repo, 'config', 'user.email', 'test@example.invalid'); git(repo, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'base\n'); fs.writeFileSync(path.join(repo, 'second.txt'), 'second base\n');
  git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'base');
  return { root, repo, dest: path.join(root, 'worktree') };
}
const invoke = (repo, ...args) => spawnSync(process.execPath, [helper, ...args], { cwd: repo, encoding: 'utf8' });

test('preview is read-only and apply retains staged and unstaged layers without changing source', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'base\nstaged\n'); git(repo, 'add', 'tracked.txt');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'base\nstaged\nunstaged\n');
  fs.writeFileSync(path.join(repo, 'new.txt'), 'untracked\n');
  const before = git(repo, 'status', '--porcelain');
  const preview = invoke(repo, '--destination', dest, '--file', 'tracked.txt', '--file', 'new.txt');
  assert.equal(preview.status, 0); assert.equal(fs.existsSync(dest), false); assert.match(preview.stdout, /PREVIEW/);
  const applied = invoke(repo, '--apply', '--destination', dest, '--file', 'tracked.txt', '--file', 'new.txt');
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(fs.readFileSync(path.join(dest, 'tracked.txt'), 'utf8'), 'base\nstaged\nunstaged\n');
  assert.equal(fs.readFileSync(path.join(dest, 'new.txt'), 'utf8'), 'untracked\n');
  assert.equal(git(dest, 'diff', '--cached', '--', 'tracked.txt'), git(repo, 'diff', '--cached', '--', 'tracked.txt'));
  assert.equal(git(dest, 'status', '--porcelain'), git(repo, 'status', '--porcelain'));
  assert.equal(git(repo, 'status', '--porcelain'), before);
});

test('refuses existing destination and selected symlink without changing source', (t) => {
  const { repo, dest } = fixture(t); fs.writeFileSync(path.join(repo, 'tracked.txt'), 'dirty\n');
  fs.mkdirSync(dest);
  assert.notEqual(invoke(repo, '--apply', '--destination', dest, '--file', 'tracked.txt').status, 0);
  fs.rmSync(dest, { recursive: true }); fs.symlinkSync('tracked.txt', path.join(repo, 'link.txt'));
  assert.notEqual(invoke(repo, '--apply', '--destination', dest, '--file', 'link.txt').status, 0);
  assert.equal(fs.existsSync(dest), false); assert.equal(fs.readFileSync(path.join(repo, 'tracked.txt'), 'utf8'), 'dirty\n');
});

test('rejects destination inside repo and refuses unselected dirty content implicitly', (t) => {
  const { repo } = fixture(t); fs.writeFileSync(path.join(repo, 'tracked.txt'), 'dirty\n');
  assert.notEqual(invoke(repo, '--apply', '--destination', path.join(repo, 'child'), '--file', 'tracked.txt').status, 0);
  const dest = path.join(path.dirname(repo), 'outside');
  assert.equal(invoke(repo, '--apply', '--destination', dest, '--file', 'second.txt').status, 2);
});

test('empty selection rejects instead of capturing dirty, staged, or credential files', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'staged secret-ish change\n'); git(repo, 'add', 'tracked.txt');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'also unstaged\n');
  fs.writeFileSync(path.join(repo, '.env'), 'DO_NOT_COPY=secret\n'); git(repo, 'add', '.env');
  const result = invoke(repo, '--apply', '--destination', dest);
  assert.notEqual(result.status, 0); assert.equal(fs.existsSync(dest), false);
  assert.equal(fs.readFileSync(path.join(repo, '.env'), 'utf8'), 'DO_NOT_COPY=secret\n');
  assert.equal(git(repo, 'status', '--porcelain').includes('.env'), true);
});

test('literal pathspec protects wildcard and Git magic-looking filenames', (t) => {
  const { repo, dest } = fixture(t);
  const literal = ':(glob)**';
  fs.writeFileSync(path.join(repo, literal), 'selected literal\n');
  fs.writeFileSync(path.join(repo, 'other.txt'), 'must stay out\n');
  const result = invoke(repo, '--apply', '--destination', dest, '--file', literal);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dest, literal), 'utf8'), 'selected literal\n');
  assert.equal(fs.existsSync(path.join(dest, 'other.txt')), false);
});

test('refuses symlink ancestors and symlink destination parent aliases', (t) => {
  const { root, repo, dest } = fixture(t);
  fs.mkdirSync(path.join(repo, 'realdir'));
  fs.symlinkSync('realdir', path.join(repo, 'alias'));
  fs.writeFileSync(path.join(repo, 'realdir', 'new.txt'), 'do not route through alias\n');
  const selectedThroughAlias = invoke(repo, '--apply', '--destination', dest, '--file', 'alias/new.txt');
  assert.notEqual(selectedThroughAlias.status, 0);
  fs.symlinkSync(root, path.join(root, 'alias-parent'));
  const throughParent = invoke(repo, '--apply', '--destination', path.join(root, 'alias-parent', 'worktree'), '--file', 'tracked.txt');
  assert.notEqual(throughParent.status, 0);
  assert.equal(fs.existsSync(dest), false);
  assert.equal(fs.existsSync(path.join(root, 'worktree')), false);
});

test('refuses secret-like selected paths and leaves the destination absent', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, 'service.credentials'), 'private\n');
  const result = invoke(repo, '--apply', '--destination', dest, '--file', 'service.credentials');
  assert.notEqual(result.status, 0); assert.equal(fs.existsSync(dest), false);
});

test('detects a selected source file changing after snapshot but during diff capture', (t) => {
  const { root, repo, dest } = fixture(t);
  const file = path.join(repo, 'tracked.txt');
  fs.writeFileSync(file, 'before capture\n');
  const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  const shimDir = path.join(root, 'shim'); fs.mkdirSync(shimDir);
  const shim = path.join(shimDir, 'git');
  fs.writeFileSync(shim, `#!/usr/bin/env node\nconst fs=require('node:fs');const {spawnSync}=require('node:child_process');const a=process.argv.slice(2);if(a.includes('diff'))fs.writeFileSync(process.env.TEST_MUTATE_FILE,'changed concurrently\\n');const r=spawnSync(process.env.TEST_REAL_GIT,a,{cwd:process.cwd(),stdio:'inherit',env:process.env});process.exit(r.status??1);\n`);
  fs.chmodSync(shim, 0o700);
  const result = spawnSync(process.execPath, [helper, '--destination', dest, '--file', 'tracked.txt'], { cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}`, TEST_REAL_GIT: realGit, TEST_MUTATE_FILE: file } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /changed during capture/);
  assert.equal(fs.existsSync(dest), false);
});

test('selected tracked changes exclude other staged and unstaged changes', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'selected\n');
  fs.writeFileSync(path.join(repo, 'second.txt'), 'unselected staged\n'); git(repo, 'add', 'second.txt');
  fs.writeFileSync(path.join(repo, 'second.txt'), 'unselected unstaged\n');
  const before = git(repo, 'status', '--porcelain');
  const result = invoke(repo, '--apply', '--destination', dest, '--file', 'tracked.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dest, 'second.txt'), 'utf8'), 'second base\n');
  assert.equal(git(dest, 'diff', '--cached'), '');
  assert.equal(git(repo, 'status', '--porcelain'), before);
  assert.equal(fs.statSync(dest).mode & 0o777, 0o700);
});

test('refuses sensitive HEAD content even when not selected', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, '.env'), 'synthetic baseline\n'); git(repo, 'add', '.env'); git(repo, 'commit', '-qm', 'synthetic baseline');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'selected\n');
  const result = invoke(repo, '--apply', '--destination', dest, '--file', 'tracked.txt');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /HEAD contains/);
  assert.equal(fs.existsSync(dest), false);
});

test('rejects Git routing environment before touching a source index', (t) => {
  const { repo, dest } = fixture(t);
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'selected staged\n'); git(repo, 'add', 'tracked.txt');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), 'selected unstaged\n');
  fs.writeFileSync(path.join(repo, 'second.txt'), 'unselected staged\n'); git(repo, 'add', 'second.txt');
  const index = path.join(repo, '.git/index'), before = fs.readFileSync(index);
  const result = spawnSync(process.execPath, [helper, '--apply', '--destination', dest, '--file', 'tracked.txt'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, GIT_INDEX_FILE: index },
  });
  assert.notEqual(result.status, 0);
  assert.deepEqual(fs.readFileSync(index), before);
  assert.equal(fs.existsSync(dest), false);
  assert.match(result.stderr, /Git environment/);
});

test('retains intentional whitespace despite transforming Git apply configuration', (t) => {
  const { repo, dest } = fixture(t);
  git(repo, 'config', 'apply.whitespace', 'fix'); git(repo, 'config', 'apply.ignoreWhitespace', 'change');
  const staged = 'staged hard break  \n', unstaged = 'unstaged hard break  \n';
  fs.writeFileSync(path.join(repo, 'tracked.txt'), staged); git(repo, 'add', 'tracked.txt');
  fs.writeFileSync(path.join(repo, 'tracked.txt'), unstaged);
  const result = invoke(repo, '--apply', '--destination', dest, '--file', 'tracked.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(path.join(dest, 'tracked.txt'), 'utf8'), unstaged);
  assert.equal(git(dest, 'show', ':tracked.txt'), staged.trimEnd());
  assert.equal(git(dest, 'diff', '--cached'), git(repo, 'diff', '--cached'));
});
