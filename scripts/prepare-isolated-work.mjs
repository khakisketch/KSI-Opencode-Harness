#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const run = (args, cwd, input, options = {}) => {
  const r = spawnSync('git', args, { cwd, input, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...options.env }, stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.error || r.status !== 0) throw new Error('Git operation failed; inspect any retained destination before retrying.');
  return r.stdout;
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
const under = (a, b) => a === b || a.startsWith(b + path.sep);
const sensitive = (name) => /(^|\/)(\.env(?:\.|$)|.*credential.*|.*secret.*|\.git|\.ssh|id_(?:rsa|ed25519)|.*\.(?:pem|key))(\/|$)/i.test(name);
const fail = (message) => { console.error(message); process.exitCode = 2; };

function main(argv) {
  const apply = argv.includes('--apply');
  const args = argv.filter((x) => x !== '--apply');
  if (args.includes('--help') || args.length < 2 || args[0] !== '--destination' || !args[1]) {
    console.log('Usage: node scripts/prepare-isolated-work.mjs [--apply] --destination PATH [--file PATH ...]');
    console.log('Preview is default. Each --file is an explicit tracked dirty file or safe untracked regular file.');
    return;
  }
  const destArg = args[1];
  const files = [];
  for (let i = 2; i < args.length; i++) {
    if (args[i] !== '--file' || !args[i + 1]) throw new Error('Use --file PATH for each explicitly selected file.');
    files.push(args[++i]);
  }
  // A changed cwd does not override GIT_INDEX_FILE/GIT_DIR/etc. Refuse routing
  // and injected-config environments before even discovering the repository.
  if (Object.keys(process.env).some(key => key.startsWith('GIT_') && !['GIT_OPTIONAL_LOCKS', 'GIT_TERMINAL_PROMPT'].includes(key))) throw new Error('Git environment overrides are unsupported; use a clean invocation environment.');
  const source = run(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  const head = run(['rev-parse', 'HEAD'], source).trim();
  const dest = path.resolve(destArg);
  const realSource = fs.realpathSync(source);
  const parent = path.dirname(dest);
  if (dest === realSource || dest.startsWith(realSource + path.sep) || realSource.startsWith(dest + path.sep)) throw new Error('Destination must be outside the source repository.');
  if (fs.existsSync(dest)) throw new Error('Destination already exists.');
  const realParent = fs.realpathSync(parent);
  const normalizedParent = (p) => process.platform === 'darwin' && p.startsWith('/var/') ? p.replace(/^\/var\//, '/private/var/') : p;
  if (normalizedParent(realParent) !== normalizedParent(parent)) throw new Error('Destination parent may not be reached through a symlink.');
  const parentStat = fs.statSync(realParent);
  if (parentStat.uid !== process.getuid?.() || (parentStat.mode & 0o077) !== 0) throw new Error('Destination parent must be owned by you and private (no group/other access).');
  const safeDest = path.join(realParent, path.basename(dest));
  if (under(safeDest, realSource) || under(realSource, safeDest)) throw new Error('Unsafe destination ancestor.');
  const gitDir = path.resolve(run(['rev-parse', '--absolute-git-dir'], source).trim());
  if (under(safeDest, gitDir) || under(gitDir, safeDest)) throw new Error('Destination overlaps Git metadata.');
  const commonArg = run(['rev-parse', '--git-common-dir'], source).trim();
  const commonDir = fs.realpathSync(path.resolve(source, commonArg));
  if (under(safeDest, commonDir) || under(commonDir, safeDest)) throw new Error('Destination overlaps shared Git metadata.');

  const selected = files.map((f) => {
    if (path.isAbsolute(f) || f.includes('\\') || f.split('/').some((s) => !s || s === '.' || s === '..')) throw new Error('Selected paths must be safe repository-relative paths.');
    if (sensitive(f)) throw new Error('Sensitive or metadata paths cannot be selected.');
    const absolute = path.join(source, f);
    let cursor = source;
    for (const component of f.split('/')) {
      cursor = path.join(cursor, component);
      const st = fs.lstatSync(cursor);
      if (st.isSymbolicLink()) throw new Error('Selected paths may not have symlink components.');
    }
    const st = fs.lstatSync(absolute);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 16 * 1024 * 1024) throw new Error('Only regular files up to 16 MiB may be selected.');
    const real = fs.realpathSync(absolute);
    if (!real.startsWith(realSource + path.sep)) throw new Error('Selected path escapes the source repository.');
    return f;
  });
  if (!selected.length) throw new Error('Select at least one explicitly dirty file; empty capture is refused.');
  if (new Set(selected).size !== selected.length) throw new Error('Duplicate selected paths are not allowed.');
  const changed = new Set(run(['status', '--porcelain=v1', '-z', '--untracked-files=all'], source).split('\0').filter(Boolean).map((e) => e.slice(3)));
  const untracked = new Set(run(['ls-files', '--others', '--exclude-standard', '-z'], source).split('\0').filter(Boolean));
  for (const f of selected) if (!changed.has(f) && !untracked.has(f)) throw new Error('Every selected path must be dirty or untracked.');
  const treeEntries = run(['ls-tree', '-rz', '--full-tree', 'HEAD'], source).split('\0').filter(Boolean)
    .map((entry) => { const split = entry.indexOf('\t'); return [entry.slice(0, split), entry.slice(split + 1)]; });
  if (treeEntries.some(([, name]) => sensitive(name))) throw new Error('HEAD contains a sensitive-looking path; clean checkout would carry it. Review the baseline separately.');
  const treeLinks = treeEntries.filter(([meta]) => meta.startsWith('120000 ')).map(([, name]) => name);
  for (const file of selected) if (treeLinks.some((link) => file === link || file.startsWith(link + '/'))) throw new Error('Selected paths overlap a symlink in current HEAD.');
  const indexPath = run(['rev-parse', '--git-path', 'index'], source).trim();
  const absoluteIndex = path.isAbsolute(indexPath) ? indexPath : path.resolve(source, indexPath);
  const snapshot = () => ({ head: run(['rev-parse', 'HEAD'], source).trim(), index: fs.existsSync(absoluteIndex) ? digest(fs.readFileSync(absoluteIndex)) : 'missing', files: selected.map((f) => {
    const p = path.join(source, f);
    try { const st = fs.lstatSync(p); return `${f}:${st.isFile() && !st.isSymbolicLink() ? digest(fs.readFileSync(p)) : 'not-regular'}:${st.mode}:${st.mtimeNs ?? st.mtimeMs}`; }
    catch { return `${f}:missing`; }
  }) });
  const beforeCapture = snapshot();
  const diffPrefix = ['--literal-pathspecs', 'diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--binary'];
  const staged = run([...diffPrefix, '--cached', '--', ...selected], source);
  const unstaged = run([...diffPrefix, '--', ...selected], source);
  const indexEntries = cwd => run(['--literal-pathspecs', 'ls-files', '--stage', '-z', '--', ...selected], cwd);
  const stagedEntries = indexEntries(source);
  if (JSON.stringify(beforeCapture) !== JSON.stringify(snapshot())) throw new Error('Source, HEAD, or index changed during capture; retry from a stable checkout.');
  const untrackedFiles = selected.filter((f) => untracked.has(f));
  console.log(`${apply ? 'APPLY' : 'PREVIEW'}: new private worktree at ${safeDest}`);
  console.log(`Base: current HEAD; selected file count: ${selected.length}; untracked regular files: ${untrackedFiles.length}`);
  if (!apply) return;
  if (beforeCapture.head !== head || JSON.stringify(beforeCapture) !== JSON.stringify(snapshot())) throw new Error('Source, HEAD, or index changed before worktree creation.');
  fs.mkdirSync(safeDest, { mode: 0o700 });
  run(['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', safeDest, head], source);
  try {
    const applyPatch = (patch, cached = false) => run(['-c', 'apply.ignoreWhitespace=no', 'apply', '--whitespace=nowarn', ...(cached ? ['--cached'] : []), '--binary', '-'], safeDest, patch);
    if (staged) {
      try {
        applyPatch(staged, true);
        applyPatch(staged);
      } catch { throw new Error('Could not apply captured staged changes.'); }
    }
    if (unstaged) { try { applyPatch(unstaged); } catch { throw new Error('Could not apply captured unstaged changes.'); } }
    for (const f of untrackedFiles) {
      const target = path.join(safeDest, f);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      const st = fs.lstatSync(path.join(source, f));
      if (!st.isFile() || st.isSymbolicLink()) throw new Error('Untracked selection changed type during capture.');
      fs.copyFileSync(path.join(source, f), target, fs.constants.COPYFILE_EXCL);
      fs.chmodSync(target, st.mode & 0o777);
    }
    if (JSON.stringify(beforeCapture) !== JSON.stringify(snapshot())) throw new Error('Source, HEAD, or index changed during capture.');
    if (indexEntries(safeDest) !== stagedEntries || selected.some(f => {
      const from = path.join(source, f), to = path.join(safeDest, f);
      return digest(fs.readFileSync(from)) !== digest(fs.readFileSync(to)) || (fs.statSync(from).mode & 0o111) !== (fs.statSync(to).mode & 0o111);
    })) throw new Error('Destination content or selected staged entries differ; inspect the retained worktree.');
    console.log('Worktree created; inspect its diff and tests before integrating manually.');
  } catch (e) {
    console.error('Capture incomplete; worktree retained for manual inspection. Source was not intentionally modified.');
    throw e;
  }
}

try { main(process.argv.slice(2)); } catch (e) { fail(e.message); }
