#!/usr/bin/env node
// First-install only, project-local and no-clobber. Existing or interrupted
// installations require inspection; never rewrite an unmanaged plugin.
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--project' || !path.isAbsolute(args[1])) {
  throw new Error('Usage: node scripts/install-session-observer.mjs --project <absolute-existing-directory>');
}
const project = await realpath(args[1]);
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../global/plugins/ksi-session-observer');
const files = ['runtime.mjs', 'index.ts'];
const bytes = await Promise.all(files.map((file) => readFile(path.join(source, file))));
let parent = project;
for (const component of ['.opencode', 'plugins']) {
  parent = path.join(parent, component);
  try { await mkdir(parent); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = await lstat(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(parent) !== parent) throw new Error(`Unsafe plugin parent: ${parent}`);
}
const target = path.join(parent, 'ksi-session-observer');
// mkdir fails atomically if any target already exists, including symlinks.
await mkdir(target);
try {
  for (let i = 0; i < files.length; i++) await writeFile(path.join(target, files[i]), bytes[i], { flag: 'wx', mode: 0o600 });
} catch (error) {
  throw new Error(`Partial first install retained for inspection at ${target}: ${error.message}`);
}
console.log(`Installed project-local session observer: ${target}`);
console.log('Native activation and actual calls must be verified separately; no global settings were changed.');
