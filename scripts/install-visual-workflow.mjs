#!/usr/bin/env node
// Installs only KSI's Native adapter, never external skills or provider config.
import { readFile, writeFile, mkdir, mkdtemp, copyFile, lstat, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.some(a => !['--verify', '--help'].includes(a))) throw new Error('Usage: node scripts/install-visual-workflow.mjs [--verify]');
if (args.includes('--help')) {
  console.log('Install the KSI visual Native V2 plugin only. --verify checks installed file hashes without changing files. No skill/model/MCP/service changes.');
  process.exit(0);
}
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../global/plugins/ksi-visual-workflow');
const target = path.join(process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config'), 'opencode/plugins/ksi-visual-workflow');
const files = ['runtime.mjs', 'index.ts'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const manifestPath = path.join(target, '.ksi-install.json');
const ancestors = [];
for (let dir = target; ; dir = path.dirname(dir)) { ancestors.push(dir); if (dir === path.dirname(dir)) break; }
for (const item of [...ancestors, manifestPath, ...files.map(file => path.join(target, file))]) {
  try { if ((await lstat(item)).isSymbolicLink()) throw new Error(`Refusing symlink install target: ${item}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
let previous;
if (await exists(manifestPath)) {
  previous = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!previous || typeof previous !== 'object' || Array.isArray(previous) || Object.keys(previous).length !== files.length || files.some(file => !/^[0-9a-f]{64}$/.test(previous[file] ?? ''))) throw new Error('Invalid visual adapter install manifest; inspect instead of overwriting.');
}
const next = {};
const changed = [];
for (const file of files) {
  const contents = await readFile(path.join(source, file)); next[file] = digest(contents);
  const installed = path.join(target, file);
  if (await exists(installed)) {
    const current = digest(await readFile(installed));
    if (!previous || previous[file] !== current) throw new Error(`Existing ${installed} is unmanaged or modified; inspect instead of overwriting.`);
    if (current === next[file]) continue;
  }
  changed.push(file);
}
if (args.includes('--verify')) {
  if (changed.length) throw new Error(`Visual adapter differs or is absent: ${changed.join(', ')}`);
  console.log('Visual adapter installed files match source. Runtime activation is checked separately.');
} else {
  let backup;
  if (changed.some(file => previous?.[file])) {
    const parent = process.platform === 'linux' ? '/tmp/opencode' : tmpdir();
    await mkdir(parent, { recursive: true });
    backup = await mkdtemp(path.join(parent, 'ksi-visual-install-'));
    for (const file of [...files, '.ksi-install.json']) if (await exists(path.join(target, file))) await copyFile(path.join(target, file), path.join(backup, file));
  }
  await mkdir(target, { recursive: true });
  for (const file of changed) {
    const staged = path.join(target, `.${file}.ksi-next`);
    await writeFile(staged, await readFile(path.join(source, file)), { flag: 'wx', mode: 0o600 });
    await rename(staged, path.join(target, file));
  }
  if (changed.length || !previous) {
    const staged = path.join(target, '.ksi-install.next.json');
    await writeFile(staged, JSON.stringify(next, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(staged, manifestPath);
  }
  console.log(`Visual adapter ${changed.length ? 'installed/updated' : 'already current'}: ${target}`);
  if (backup) console.log(`Backup: ${backup}`);
  console.log('OpenCode V2 watches plugins; no shared-service restart. External skills and model/MCP settings were left untouched.');
}
