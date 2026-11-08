#!/usr/bin/env node
// Installs selected Anthropic Knowledge Work skills into a project's
// .opencode/skills so OpenCode's Native skill loader can discover them.
// Project-local only: no global install, no MCP, no plugin manifest.
import { readdir, readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.resolve(HERE, '../external/anthropic-knowledge-work-plugins/skills');
const SETS = ['engineering', 'design'];
const usage = 'Usage: node scripts/install-external-skills.mjs --list | --project <absolute-dir> [--set engineering|design|all] [--skill <name> ...] [--verify]';

const args = process.argv.slice(2);
let project, set = 'all', verify = false, list = false;
const skills = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--list') list = true;
  else if (a === '--verify') verify = true;
  else if (a === '--project' && args[i + 1] && !args[i + 1].startsWith('--')) project = args[++i];
  else if (a === '--set' && args[i + 1] && !args[i + 1].startsWith('--')) set = args[++i];
  else if (a === '--skill' && args[i + 1] && !args[i + 1].startsWith('--')) skills.push(args[++i]);
  else if (a === '--help') { console.log(usage); process.exit(0); }
  else throw new Error(usage);
}
if (!list && !project) throw new Error(usage);
if (project && !path.isAbsolute(project)) throw new Error('--project must be an absolute directory');

async function inventory() {
  const out = [];
  for (const s of SETS) {
    for (const entry of await readdir(path.join(LIB, s), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push({ set: s, name: entry.name });
    }
  }
  return out.sort((a, b) => a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
}

const all = await inventory();
if (list) {
  for (const item of all) console.log(`${item.set}\t${item.name}`);
  process.exit(0);
}
if (!SETS.includes(set) && set !== 'all') throw new Error(`unknown set: ${set}`);

const selected = all.filter((item) =>
  (set === 'all' || item.set === set) && (skills.length === 0 || skills.includes(item.name)));
if (selected.length === 0) throw new Error('no skills selected');
const missing = skills.filter((name) => !all.some((item) => item.name === name));
if (missing.length) throw new Error(`unknown skill: ${missing.join(', ')}`);

async function assertNoSymlink(file) {
  try {
    if ((await lstat(file)).isSymbolicLink()) throw new Error(`refusing symlinked target: ${file}`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

const targetRoot = path.join(project, '.opencode/skills');
for (const dir of [path.join(project, '.opencode'), targetRoot]) await assertNoSymlink(dir);

let written = 0, unchanged = 0;
for (const item of selected) {
  const source = path.join(LIB, item.set, item.name, 'SKILL.md');
  const bytes = await readFile(source);
  const targetDir = path.join(targetRoot, item.name);
  const target = path.join(targetDir, 'SKILL.md');
  await assertNoSymlink(targetDir);
  await assertNoSymlink(target);
  try {
    const existing = await readFile(target);
    if (!existing.equals(bytes)) throw new Error(`refusing to overwrite a different ${target}`);
    unchanged++;
    continue;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (verify) throw new Error(`missing ${target}`);
  await mkdir(targetDir, { recursive: true });
  await writeFile(target, bytes, { flag: 'wx' });
  written++;
}
console.log(`${verify ? 'verified' : 'installed'} ${selected.length} skill(s) in ${targetRoot}: ${written} written, ${unchanged} unchanged`);
