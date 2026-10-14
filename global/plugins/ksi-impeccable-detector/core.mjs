/**
 * ksi-impeccable-detector core: dependency-free Node ESM, Native-first.
 * Parent owns permissions, concurrency, annotation, deployment, and passes
 * projectDir (required), cacheKeyExtra=<sessionID+agent> (required to
 * cache), launcher (engine derived from its dirname), and authorizeRun.
 * Core never execs the launcher (no download); only bin/<os>-<arch>/
 * impeccable via shell:false with a fixed argv allowlist. HTML scans as
 * a .tsx snapshot, cwd=temp dir: linked CSS/config/design never load.
 * Temp dirs (0700) and snapshots (0600, generated names) under
 * /tmp/opencode or tempRoot are always removed in finally.
 */
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fsp, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_ARGV_PREFIX = Object.freeze(['detect', '--json', '--no-config', '--no-design-system']);
export const UI_EXTENSIONS = Object.freeze(['.css', '.scss', '.sass', '.less', '.html', '.htm', '.jsx', '.tsx', '.vue', '.svelte', '.astro']);
const UI_EXT = new Set(UI_EXTENSIONS);
const CSS_FAMILY = new Set(['.css', '.scss', '.sass', '.less']);
export const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
export const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_TEMP_ROOT = '/tmp/opencode';
export const MAX_CACHE_ENTRIES = 200;
export const MAX_FINDINGS = 50;
export const DEFAULT_EXCLUDE_DIRS = Object.freeze(['node_modules', '.git', 'vendor', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt', '__pycache__', '.cache', '.parcel-cache', '.turbo', 'target', 'generated', 'tmp', 'temp']);
const EXCLUDE_DIRS = new Set(DEFAULT_EXCLUDE_DIRS);
export const SOURCE_ONLY_LIMITATIONS = 'Source-only snapshot scan: single permitted target copied to an isolated temp file (.css for CSS-family, .tsx otherwise; HTML scanned as .tsx regex mode) with --no-config --no-design-system, cwd=temp dir. Linked stylesheets, absolute-link fetches, project config and design-system context are not applied.';
const MAX_PATH_LEN = 4096;
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;
const KNOWN_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;
const FAILURE_RE = /fail|error|den|block|cancel|abort/i;

/** Reject URLs, flags, and control-char values. Drive paths (C:\…) pass. */
export function looksLikeUrlOrCommand(v) {
  if (typeof v !== 'string') return true;
  const s = v.trim();
  if (!s || s.length > MAX_PATH_LEN || /[\0\n\r]/.test(s)) return true;
  if (s.startsWith('-') || s.startsWith('//') || URL_SCHEME_RE.test(s)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(s)) return false;
  const m = s.match(KNOWN_SCHEME_RE);
  return !!m && ['http', 'https', 'file', 'data', 'ftp', 'ws', 'wss', 'blob'].includes(m[0].slice(0, -1).toLowerCase());
}

/** Snapshot extension: CSS-family stays .css, everything else .tsx. */
export function classifySnapshotExt(ext) {
  return CSS_FAMILY.has(String(ext || '').toLowerCase()) ? '.css' : '.tsx';
}

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
/** Parse apply-patch headers: Add/Update/Move-to included, Delete excluded. */
export function parsePatchTextHeaders(t) {
  const out = [];
  if (typeof t !== 'string') return out;
  for (const line of t.split(/\r?\n/)) {
    let m = line.match(/^\*\*\*\s+(?:Add File|Update File)\s*:\s*(.+?)\s*$/i) || line.match(/^\*\*\*\s+Move to\s*:\s*(.+?)\s*$/i);
    if (m) out.push(m[1].replace(/^["']|["']$/g, '').trim());
  }
  return out.filter(Boolean);
}
function failedEvent(e) {
  if (!e || typeof e !== 'object') return false;
  if (e.success === false || e.ok === false) return true;
  for (const s of [e.status, e.result?.status, e.outcome]) {
    if (typeof s === 'string' && FAILURE_RE.test(s)) return true;
  }
  return !!(e.error && e.success !== true && e.ok !== true);
}

/**
 * Candidate paths from a harness event. Pure. Only write/edit/patch with
 * input.path|filePath|file_path (or patchText headers); shell/exec,
 * unknown tools and explicit failures yield [].
 */
export function extractPaths(event) {
  const out = [], seen = new Set();
  const add = (v) => {
    if (typeof v !== 'string') return;
    const s = v.trim();
    if (s && !looksLikeUrlOrCommand(s) && !seen.has(s)) { seen.add(s); out.push(s); }
  };
  if (!event || typeof event !== 'object' || failedEvent(event)) return out;
  const tool = typeof event.tool === 'string' ? event.tool.trim().toLowerCase() : null;
  if (!tool || !['write', 'edit', 'patch'].includes(tool)) return out;
  const input = event.input;
  if (input && typeof input === 'object') {
    for (const k of ['path', 'filePath', 'file_path']) add(input[k]);
    if (Array.isArray(input.files)) for (const f of input.files) add(typeof f === 'string' ? f : (f?.path ?? f?.filePath ?? f?.file_path));
    if (tool === 'patch') for (const k of ['patchText', 'patch']) for (const h of parsePatchTextHeaders(input[k])) add(h);
  }
  for (const k of ['path', 'filePath', 'file_path']) add(event[k]);
  return out;
}

async function judgeOne(original, rootReal, maxFileBytes) {
  const no = (reason) => ({ original: String(original), ok: false, reason });
  const s = typeof original === 'string' ? original.trim() : '';
  if (!s) return no('empty');
  if (looksLikeUrlOrCommand(s)) return no(s.length > MAX_PATH_LEN ? 'too-long' : 'url-or-command');
  const joined = path.isAbsolute(s) ? path.normalize(s) : path.join(rootReal, s);
  const lexical = path.relative(rootReal, joined);
  if (!lexical || lexical === '..' || lexical.startsWith(`..${path.sep}`) || path.isAbsolute(lexical)) return no('outside-boundary');
  const lexicalSegments = lexical.split(path.sep);
  if (lexicalSegments.some((segment) => segment.startsWith('.'))) return no('hidden-segment');
  if (lexicalSegments.some((segment) => EXCLUDE_DIRS.has(segment.toLowerCase()))) return no('excluded-dir');
  let real;
  try { real = await fsp.realpath(joined); } catch { return no('unresolvable'); }
  if (real !== rootReal && !real.startsWith(rootReal + path.sep)) return no('outside-boundary');
  let st;
  try { st = await fsp.stat(real); } catch { return no('unstatable'); }
  if (!st.isFile()) return no('not-a-file');
  const rel = path.relative(rootReal, real);
  if (!rel || rel.startsWith('..')) return no('outside-boundary');
  const segs = rel.split(path.sep);
  if (segs.some((g) => g.startsWith('.') && g.length > 1)) return no('hidden-segment');
  if (segs.some((g) => EXCLUDE_DIRS.has(g.toLowerCase()))) return no('excluded-dir');
  const ext = path.extname(real).toLowerCase();
  if (!UI_EXT.has(ext)) return no('non-ui-extension');
  if (st.size > maxFileBytes) return no('too-large');
  return { original: String(original), path: real, ext, size: st.size, ok: true, reason: 'ok' };
}

/**
 * Canonical UI targets inside directory. realpath/lstat/stat only —
 * no content reads, safe before the parent permission check.
 */
export async function selectTargets(paths, directory, options = {}) {
  return (await selectTargetsDetailed(paths, directory, options)).filter((v) => v.ok).map((v) => v.path);
}
export async function selectTargetsDetailed(paths, directory, options = {}) {
  if (typeof directory !== 'string' || !directory.trim()) throw new TypeError('selectTargets: directory required');
  let rootReal;
  try { rootReal = await fsp.realpath(path.resolve(directory)); }
  catch { throw new TypeError(`selectTargets: cannot resolve directory: ${directory}`); }
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const verdicts = [], seen = new Set();
  for (const p of Array.isArray(paths) ? paths : []) {
    const v = await judgeOne(p, rootReal, maxFileBytes);
    if (v.ok && seen.has(v.path)) verdicts.push({ original: String(p), ok: false, reason: 'duplicate' });
    else { if (v.ok) seen.add(v.path); verdicts.push(v); }
  }
  return verdicts;
}

function triple(platform, arch) {
  const p = platform ?? process.platform, a = arch ?? process.arch;
  return { os: p === 'win32' ? 'windows' : p, arch: a === 'arm64' ? 'arm64' : a === 'x64' ? 'x64' : a };
}
/**
 * Probe the vendored engine only: options.enginePath, options.engineDir,
 * options.launcher dirname (…/scripts → …/scripts/bin/<os>-<arch>), or the
 * sibling of this file. Never execs the launcher, downloads, or retries.
 */
export async function resolveEngine(options = {}) {
  const { os, arch } = triple(options.platform, options.arch);
  const exe = os === 'windows' ? 'impeccable.exe' : 'impeccable';
  let base = options.engineDir ?? null;
  if (!base && typeof options.launcher === 'string' && options.launcher.trim()) base = path.dirname(options.launcher.trim());
  base ??= path.dirname(fileURLToPath(import.meta.url));
  const candidate = options.enginePath ?? path.join(base, 'bin', `${os}-${arch}`, exe);
  try {
    if (!(await fsp.stat(candidate)).isFile()) return { ok: false, path: null, reason: 'not-a-file' };
    await fsp.access(candidate, fsConstants.X_OK);
    return { ok: true, path: candidate, reason: 'ok' };
  } catch (err) {
    return { ok: false, path: null, reason: err?.code === 'ENOENT' ? 'missing' : err?.code === 'EACCES' || err?.code === 'EPERM' ? 'not-executable' : 'unusable' };
  }
}

const cache = new Map();
let cacheHits = 0, cacheMisses = 0;
export function clearScanCache() { cache.clear(); cacheHits = 0; cacheMisses = 0; }
export function getScanCacheStats() { return { size: cache.size, max: MAX_CACHE_ENTRIES, hits: cacheHits, misses: cacheMisses }; }
function cachePut(map, k, v) {
  if (map.has(k)) map.delete(k);
  map.set(k, v);
  while (map.size > MAX_CACHE_ENTRIES) map.delete(map.keys().next().value);
}

function normalizeFindings(value) {
  const arr = Array.isArray(value) ? value : value?.findings ?? value?.issues ?? value?.results ?? null;
  if (!Array.isArray(arr)) return null;
  return arr.slice(0, MAX_FINDINGS).map((f) => {
    if (f && typeof f === 'object') {
      return {
        rule: String(f.rule ?? f.antipattern ?? f.name ?? f.id ?? 'unknown').slice(0, 128),
        line: Math.max(0, parseInt(f.line ?? f.lineNumber ?? 0, 10) || 0),
        severity: f.severity != null ? String(f.severity).slice(0, 32) : null,
      };
    }
    return { rule: String(f ?? 'unknown').slice(0, 128), line: 0, severity: null };
  });
}

/** Spawn engine shell:false, cwd=temp dir, byte-capped output, group kill on timeout. */
function runEngine(executable, args, cwd, timeoutMs, maxOutputBytes) {
  return new Promise((resolve) => {
    let done = false, totalBytes = 0, truncated = false, timedOut = false;
    const stdoutChunks = [], stderrChunks = [];
    let child = null;
    let timer, killFallback;
    const output = () => ({ stdout: Buffer.concat(stdoutChunks).toString('utf8'), stderr: Buffer.concat(stderrChunks).toString('utf8') });
    const finish = (v) => { if (!done) { done = true; clearTimeout(timer); clearTimeout(killFallback); resolve(v); } };
    const feed = (chunk, isErr) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      if (totalBytes + buf.length > maxOutputBytes) { truncated = true; return; }
      totalBytes += buf.length;
      (isErr ? stderrChunks : stdoutChunks).push(buf);
    };
    try {
      child = spawn(executable, args, { shell: false, cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    } catch (err) { return resolve({ exitCode: null, spawnError: String(err?.message ?? err), timedOut: false, stdout: '', stderr: '', truncated: false }); }
    killFallback = setTimeout(() => finish({ exitCode: null, spawnError: null, timedOut, ...output(), truncated }), Math.max(1, timeoutMs) + 250);
    timer = setTimeout(() => {
      timedOut = true;
      try { if (child?.pid) process.platform === 'win32' ? child.kill('SIGKILL') : process.kill(-child.pid, 'SIGKILL'); }
      catch { try { child?.kill('SIGKILL'); } catch { /* ignore */ } }
    }, Math.max(1, timeoutMs));
    if (timer.unref) timer.unref(); if (killFallback.unref) killFallback.unref();
    child.stdout.on('data', (c) => feed(c, false));
    child.stderr.on('data', (c) => feed(c, true));
    child.on('error', () => finish({ exitCode: null, spawnError: 'spawn-error', timedOut, ...output(), truncated }));
    child.on('close', (code) => finish({ exitCode: typeof code === 'number' ? code : null, spawnError: null, timedOut, ...output(), truncated }));
  });
}

/**
 * Isolated snapshot scan. Parent asserts Native read first and passes
 * projectDir (required), cacheKeyExtra (required to cache; uncached
 * otherwise, so no cross-session reuse), and authorizeRun gating the
 * exact temp-snapshot spawn (rejection propagates unchanged, temp
 * cleaned). Overflow/malformed JSON are operational errors, never
 * cached; only valid-findings JSON on exit 0/2 caches.
 */
export async function scanTarget(target, options = {}) {
  const startedAt = Date.now();
  const raw = typeof target === 'string' ? target : target?.path ?? '';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const sessionKey = typeof options.cacheKeyExtra === 'string' && options.cacheKeyExtra ? options.cacheKeyExtra : null;
  const base = {
    tool: 'ksi-impeccable-detector/core', target: typeof raw === 'string' ? raw : String(raw ?? ''),
    canonicalPath: null, engine: null, launcherExecuted: false, snapshotExt: null,
    htmlDowngraded: false, limitations: SOURCE_ONLY_LIMITATIONS, cached: false,
    authorized: typeof options.authorizeRun !== 'function', timeout: false,
    stdoutTruncated: false, durationMs: 0,
  };
  const fail = (reason, extra = {}) => ({ ...base, status: 'error', exitCode: 1, reason, findings: [], durationMs: Date.now() - startedAt, ...extra });
  if (typeof raw !== 'string' || !raw.trim() || looksLikeUrlOrCommand(raw.trim())) {
    return fail(!raw || !raw.trim() ? 'invalid-target' : 'rejected-url-or-command');
  }
  const trimmed = raw.trim();
  if (typeof options.projectDir !== 'string' || !options.projectDir.trim()) return fail('bad-project-dir');
  let rootReal;
  try { rootReal = await fsp.realpath(path.resolve(options.projectDir)); } catch { return fail('bad-project-dir'); }
  const abs = path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(rootReal, trimmed);

  const probe = await resolveEngine(options);
  if (!probe.ok) return { ...base, status: 'engine-missing', exitCode: null, reason: `engine-${probe.reason}`, findings: [], durationMs: Date.now() - startedAt };
  base.engine = probe.path;

  // Read stage: lstat rejects symlinks outright (never followed); parent
  // dir recheck forces canonical == passed selected canonical; O_NOFOLLOW
  // open; fd-vs-path inode/dev match; bounded max+1 read; post-read recheck.
  let parentReal;
  try { parentReal = await fsp.realpath(path.dirname(abs)); } catch { return fail('unresolvable'); }
  const canonical = path.join(parentReal, path.basename(abs));
  if (canonical !== abs) return fail('not-canonical');
  if (canonical !== rootReal && !canonical.startsWith(rootReal + path.sep)) return fail('outside-boundary');
  try {
    const lst = await fsp.lstat(canonical);
    if (lst.isSymbolicLink()) return fail('symlink');
    if (!lst.isFile()) return fail('not-a-file');
  } catch { return fail('unresolvable'); }
  base.canonicalPath = canonical;
  const originalExt = path.extname(canonical).toLowerCase();
  const snapshotExt = classifySnapshotExt(originalExt);
  base.snapshotExt = snapshotExt;
  base.htmlDowngraded = originalExt === '.html' || originalExt === '.htm';

  let handle = null, content;
  try {
    try {
      const flags = fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0);
      handle = await fsp.open(canonical, flags);
    } catch (err) {
      return fail(err?.code === 'ELOOP' ? 'symlink' : 'unreadable');
    }
    const [fst, pst, llst] = await Promise.all([handle.stat(), fsp.stat(canonical), fsp.lstat(canonical)]);
    if (llst.isSymbolicLink() || fst.ino !== pst.ino || fst.dev !== pst.dev) return fail('symlink-swap');
    if (await fsp.realpath(canonical).catch(() => null) !== canonical) return fail('symlink-swap');
    if (!fst.isFile()) return fail('not-a-file');
    if (fst.size > maxFileBytes) return fail('too-large');
    const chunks = [];
    let remaining = maxFileBytes + 1, bytes = 0;
    while (remaining > 0) {
      const buf = Buffer.alloc(Math.min(65536, remaining));
      const { bytesRead } = await handle.read(buf, 0, buf.length, bytes);
      if (bytesRead === 0) break;
      chunks.push(buf.subarray(0, bytesRead));
      bytes += bytesRead; remaining -= bytesRead;
    }
    if (bytes > maxFileBytes) return fail('too-large');
    content = Buffer.concat(chunks).toString('utf8');
    const recheck = await fsp.realpath(canonical).catch(() => null);
    if (recheck !== canonical) return fail('symlink-swap');
  } finally {
    if (handle) await handle.close().catch(() => {});
  }

  // Cache is session/agent-scoped only: no key, no cache. Cached hits skip
  // spawn, but the parent still asserted Native read for this call.
  const contentHash = sha256(content);
  let engineId = probe.path;
  try { const es = await fsp.stat(probe.path); engineId = `${probe.path}:${Math.round(es.mtimeMs)}:${es.size}`; } catch { /* path-only */ }
  const key = sessionKey ? sha256(`${canonical}\0${contentHash}\0${engineId}\0${snapshotExt}\0${sessionKey}`) : null;
  const map = options.cache instanceof Map ? options.cache : cache;
  const useCache = options.cache !== false && !!key;
  if (useCache && map.get(key)) { cacheHits += 1; return { ...map.get(key), cached: true, durationMs: Date.now() - startedAt }; }
  if (useCache) cacheMisses += 1;

  const tempRoot = options.tempRoot ?? DEFAULT_TEMP_ROOT;
  let tempDir = null;
  try {
    await fsp.mkdir(tempRoot, { recursive: true });
    tempDir = await fsp.mkdtemp(path.join(tempRoot, 'ksi-det-'));
    await fsp.chmod(tempDir, 0o700).catch(() => {});
    const snapshotPath = path.join(tempDir, `snapshot-${randomBytes(8).toString('hex')}${snapshotExt}`);
    await fsp.writeFile(snapshotPath, content, { mode: 0o600 });
    const argv = [...ENGINE_ARGV_PREFIX, '--', snapshotPath];
    if (typeof options.authorizeRun === 'function') {
      const decision = await options.authorizeRun({ executable: probe.path, args: [...argv], cwd: tempDir });
      if (decision === false) throw new Error('authorizeRun denied spawn');
      base.authorized = true;
    }
    const run = await runEngine(probe.path, argv, tempDir, timeoutMs, maxOutputBytes);
    const doneMs = Date.now() - startedAt;
    if (run.timedOut) return { ...base, status: 'error', exitCode: null, reason: 'timeout', timeout: true, findings: [], stdoutTruncated: run.truncated, durationMs: doneMs };
    if (run.spawnError) return { ...base, status: 'error', exitCode: 1, reason: 'spawn-error', findings: [], stdoutTruncated: run.truncated, durationMs: doneMs };
    if (run.truncated) return { ...base, status: 'error', exitCode: 1, reason: 'output-overflow', findings: [], stdoutTruncated: true, durationMs: doneMs };
    const exitCode = run.exitCode;
    if (exitCode !== 0 && exitCode !== 2) {
      return { ...base, status: 'error', exitCode, reason: `exit-${exitCode ?? 'null'}`, findings: [], stdoutTruncated: run.truncated, durationMs: doneMs };
    }
    let parsed;
    try { parsed = JSON.parse(run.stdout); } catch { return { ...base, status: 'error', exitCode: 1, reason: 'malformed-json', findings: [], stdoutTruncated: run.truncated, durationMs: doneMs }; }
    const findings = normalizeFindings(parsed);
    if (!findings) return { ...base, status: 'error', exitCode: 1, reason: 'malformed-json', findings: [], stdoutTruncated: run.truncated, durationMs: doneMs };
    const result = {
      ...base, status: exitCode === 0 ? 'pass' : 'issues', exitCode,
      reason: exitCode === 0 ? 'clean' : 'findings', findings,
      stdoutTruncated: run.truncated, durationMs: doneMs,
    };
    if (useCache) cachePut(map, key, { ...result, cached: false });
    return result;
  } finally {
    if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
