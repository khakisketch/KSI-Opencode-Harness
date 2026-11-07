#!/usr/bin/env node
// Installs only KSI's Native capabilities-inventory adapter into an explicitly
// selected project. Never installs globally or changes model/MCP/service settings.
import { readFile, writeFile, mkdir, mkdtemp, lstat, rename, link, readdir, unlink, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const usage = 'Usage: node scripts/install-capabilities-inventory.mjs --project <absolute-directory> [--verify]';
if (args.length === 1 && args[0] === '--help') {
  console.log(`${usage}\nProject-local only; no global installation. --verify checks hashes without changing files. No skill/model/MCP/service changes.`);
  process.exit(0);
}
let project;
let verify = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--project' && !project && args[i + 1] && !args[i + 1].startsWith('--')) project = args[++i];
  else if (args[i] === '--verify' && !verify) verify = true;
  else throw new Error(usage);
}
if (!project || !path.isAbsolute(project)) throw new Error(`${usage}; refusing an implicit, relative, or global destination.`);
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../global/plugins/ksi-capabilities-inventory');
const target = path.join(project, '.opencode/plugins/ksi-capabilities-inventory');
const files = ['runtime.mjs', 'index.ts'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { await lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const manifestPath = path.join(target, '.ksi-install.json');
// Lock/staging live outside Native's plugin discovery directory. Never steal a
// stale lock: an interrupted publication needs operator inspection, not retry.
const lock = path.join(project, '.opencode/.ksi-capabilities-inventory-install.lock');
const ancestors = [];
for (let dir = target; ; dir = path.dirname(dir)) { ancestors.push(dir); if (dir === path.dirname(dir)) break; }
async function checkTarget() {
  for (const item of [...ancestors, lock, manifestPath, ...files.map(file => path.join(target, file))]) {
    try { if ((await lstat(item)).isSymbolicLink()) throw new Error(`Refusing symlink install target: ${item}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  // Native can load server.ts instead of index.ts. Old staged files also need
  // inspection; do not silently clean up or overwrite someone else's files.
  if (await exists(target)) {
    const allowed = new Set([...files, '.ksi-install.json']);
    const unknown = (await readdir(target)).filter(entry => !allowed.has(entry));
    if (unknown.length) throw new Error(`Unexpected unmanaged or partial entry in capabilities inventory target: ${unknown.sort().join(', ')}; inspect instead of installing.`);
  }
}
const locked = () => new Error(`Installation lock exists (in progress or interrupted): ${lock}; inspect before retrying.`);
await checkTarget();
if (!(await lstat(project)).isDirectory()) throw new Error('Project must be an existing directory.');
if (await exists(lock)) throw locked();
let acquired = false, publishing = false, completed = false, failed = false;
const stagedFiles = [];
try {
  if (!verify) {
    await mkdir(path.dirname(lock), { recursive: true });
    await checkTarget();
    try { await mkdir(lock, { mode: 0o700 }); acquired = true; }
    catch (error) { if (error.code === 'EEXIST') throw locked(); throw error; }
  }
  await checkTarget();
  let previous;
  const expected = new Map();
  const manifestBytes = await exists(manifestPath) ? await readFile(manifestPath) : null;
  expected.set('.ksi-install.json', manifestBytes);
  if (manifestBytes) {
    previous = JSON.parse(manifestBytes.toString());
    if (!previous || typeof previous !== 'object' || Array.isArray(previous) || Object.keys(previous).length !== files.length || files.some(file => !/^[0-9a-f]{64}$/.test(previous[file] ?? ''))) throw new Error('Invalid capabilities inventory install manifest; inspect instead of overwriting.');
  }
  const next = {}, sourceBytes = new Map(), changed = [];
  for (const file of files) {
    // Exactly one source read supplies both the manifest hash and deployment.
    const contents = await readFile(path.join(source, file)); sourceBytes.set(file, contents); next[file] = digest(contents);
    const installed = path.join(target, file);
    const currentBytes = await exists(installed) ? await readFile(installed) : null;
    expected.set(file, currentBytes);
    if (previous && !currentBytes) throw new Error(`Managed ${installed} is missing (unexpected partial or possibly user-removed state); inspect instead of restoring.`);
    if (currentBytes) {
      const current = digest(currentBytes);
      if (!previous || previous[file] !== current) throw new Error(`Existing ${installed} is unmanaged or modified; inspect instead of overwriting.`);
      if (current === next[file]) continue;
    }
    changed.push(file);
  }
  const checkUnchanged = async () => {
    await checkTarget();
    for (const [file, bytes] of expected) {
      const installed = path.join(target, file);
      const current = await exists(installed) ? await readFile(installed) : null;
      if (bytes === null ? current !== null : current === null || !bytes.equals(current)) throw new Error(`Install target changed during installation: ${installed}; inspect instead of overwriting.`);
    }
  };
  if (verify) {
    await checkUnchanged();
    if (await exists(lock)) throw locked();
    if (changed.length) throw new Error(`Capabilities inventory differs or is absent: ${changed.join(', ')}`);
    console.log('Capabilities inventory installed files match source. Runtime activation is checked separately.');
  } else {
    let backup;
    if (changed.some(file => previous?.[file])) {
      backup = await mkdtemp(path.join(tmpdir(), 'ksi-capabilities-install-'));
      for (const [file, bytes] of expected) if (bytes !== null) await writeFile(path.join(backup, file), bytes, { flag: 'wx', mode: 0o600 });
      console.log(`Backup: ${backup}`);
    }
    if (changed.length || !previous) {
      const nextManifest = Buffer.from(JSON.stringify(next, null, 2) + '\n');
      for (const file of [...changed, '.ksi-install.json']) {
        const staged = path.join(lock, file);
        // Track before writing: writeFile can create partial bytes then fail.
        // EEXIST is not our file and must never be included in cleanup.
        stagedFiles.push(staged);
        try { await writeFile(staged, file === '.ksi-install.json' ? nextManifest : sourceBytes.get(file), { flag: 'wx', mode: 0o600 }); }
        catch (error) { if (error.code === 'EEXIST') stagedFiles.pop(); throw error; }
      }
      await checkUnchanged();
      await mkdir(target, { recursive: true });
      // All staging precedes publication; dependencies first, entrypoint last,
      // manifest last of all. Each publication is atomic, NOT the generation.
      // Native hot reload can still observe mixed versions between renames.
      for (const file of [...changed.filter(file => file !== 'index.ts'), ...changed.filter(file => file === 'index.ts'), '.ksi-install.json']) {
        await checkUnchanged();
        publishing = true;
        // Atomically preserve a destination created after the last check when
        // it was absent in the snapshot (manifest included). Never fall back
        // from link failure to a clobbering rename.
        // Managed replacements lack a portable Node/POSIX compare-and-swap:
        // this check/lock does not protect against non-cooperating late writes.
        if (expected.get(file) === null) await link(path.join(lock, file), path.join(target, file));
        else await rename(path.join(lock, file), path.join(target, file));
        expected.set(file, file === '.ksi-install.json' ? nextManifest : sourceBytes.get(file));
      }
    }
    completed = true;
    console.log(`Capabilities inventory ${changed.length ? 'installed/updated' : 'already current'}: ${target}`);
    console.log('Publication is per-file, not a transactional generation; Native hot reload may observe intermediate versions. Interrupted publication retains its inspection lock; no automatic recovery.');
    console.log('Absent targets use atomic no-clobber hard links; managed replacements use a final check and cooperating installer lock, not atomic compare-and-swap. Non-cooperating writes after that check can still be overwritten.');
    console.log('Project-local installation only. OpenCode V2 watches plugins; no shared-service restart. External skills and global/model/MCP settings were left untouched.');
  }
} catch (error) {
  failed = true;
  throw error;
} finally {
  // Remove only this run's staging on success or failure before publication.
  // SIGTERM/SIGKILL and publication failures intentionally leave evidence/lock.
  if (acquired && (!publishing || completed)) {
    const cleanupErrors = [];
    for (const staged of stagedFiles) { try { await unlink(staged); } catch (error) { if (error.code !== 'ENOENT') cleanupErrors.push(error); } }
    try { await rmdir(lock); } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) {
      // Report secondary cleanup failures but retain the original thrown error.
      if (failed) console.error(`Staging cleanup failed; inspect ${lock}: ${cleanupErrors.map(error => error.code ?? 'unknown').join(', ')}`);
      else throw new AggregateError(cleanupErrors, `Staging cleanup failed; inspect ${lock}`);
    }
  }
}
