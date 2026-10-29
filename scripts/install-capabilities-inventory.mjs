#!/usr/bin/env node
// Installs only KSI's Native capabilities-inventory adapter, never external
// skills, provider config, or model/MCP/service settings.
import { readFile, writeFile, mkdir, mkdtemp, copyFile, lstat, rename, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.some(a => !['--verify', '--help'].includes(a))) throw new Error('Usage: node scripts/install-capabilities-inventory.mjs [--verify]');
if (args.includes('--help')) {
  console.log('Install the KSI capabilities-inventory Native V2 plugin only. --verify checks installed file hashes without changing files. No skill/model/MCP/service changes.');
  process.exit(0);
}
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../global/plugins/ksi-capabilities-inventory');
const rawConfigHome = process.env.XDG_CONFIG_HOME;
if (rawConfigHome && !path.isAbsolute(rawConfigHome)) throw new Error('Refusing relative XDG_CONFIG_HOME; inspect the installation location before retrying.');
const target = path.join(rawConfigHome || path.join(homedir(), '.config'), 'opencode/plugins/ksi-capabilities-inventory');
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
// Native can load server.ts instead of index.ts; never install alongside an
// unknown entry or silently overwrite an interrupted install's staged files.
if (await exists(target)) {
  const allowed = new Set([...files, '.ksi-install.json']);
  const unknown = (await readdir(target)).filter(entry => !allowed.has(entry));
  if (unknown.length) throw new Error(`Unexpected unmanaged or partial entry in capabilities inventory target: ${unknown.sort().join(', ')}; inspect instead of installing.`);
}
let previous;
if (await exists(manifestPath)) {
  previous = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!previous || typeof previous !== 'object' || Array.isArray(previous) || Object.keys(previous).length !== files.length || files.some(file => !/^[0-9a-f]{64}$/.test(previous[file] ?? ''))) throw new Error('Invalid capabilities inventory install manifest; inspect instead of overwriting.');
}
const next = {};
const changed = [];
for (const file of files) {
  const contents = await readFile(path.join(source, file)); next[file] = digest(contents);
  const installed = path.join(target, file);
  const present = await exists(installed);
  if (previous && !present) throw new Error(`Managed ${installed} is missing (unexpected partial or possibly user-removed state); inspect instead of restoring.`);
  if (present) {
    const current = digest(await readFile(installed));
    if (!previous || previous[file] !== current) throw new Error(`Existing ${installed} is unmanaged or modified; inspect instead of overwriting.`);
    if (current === next[file]) continue;
  }
  changed.push(file);
}
if (args.includes('--verify')) {
  if (changed.length) throw new Error(`Capabilities inventory differs or is absent: ${changed.join(', ')}`);
  console.log('Capabilities inventory installed files match source. Runtime activation is checked separately.');
} else {
  let backup;
  if (changed.some(file => previous?.[file])) {
    const parent = process.platform === 'linux' ? '/tmp/opencode' : tmpdir();
    await mkdir(parent, { recursive: true });
    backup = await mkdtemp(path.join(parent, 'ksi-capabilities-install-'));
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
  console.log(`Capabilities inventory ${changed.length ? 'installed/updated' : 'already current'}: ${target}`);
  if (backup) console.log(`Backup: ${backup}`);
  console.log('OpenCode V2 watches plugins; no shared-service restart. External skills and model/MCP settings were left untouched.');
}
