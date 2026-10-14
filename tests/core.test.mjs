/**
 * core.test.mjs — dependency-free tests (Node built-ins).
 * Run: `node --test tests/core.test.mjs` from the repository root.
 * Test output never prints file content.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

import {
  extractPaths,
  selectTargets,
  selectTargetsDetailed,
  scanTarget,
  resolveEngine,
  looksLikeUrlOrCommand,
  classifySnapshotExt,
  parsePatchTextHeaders,
  clearScanCache,
  getScanCacheStats,
} from '../global/plugins/ksi-impeccable-detector/core.mjs';

let workRoot, projectDir, tempRoot;
const CTX = 'sess-test:agent-test';

before(async () => {
  const root = process.env.KSI_TEST_TMP ?? '/tmp/opencode';
  await fsp.mkdir(root, { recursive: true });
  workRoot = await fsp.mkdtemp(path.join(root, 'ksi-core-test-'));
  projectDir = path.join(workRoot, 'proj');
  tempRoot = path.join(workRoot, 'opencode');
  await fsp.mkdir(projectDir, { recursive: true });
  await fsp.mkdir(tempRoot, { recursive: true });
  clearScanCache();
});
after(async () => { await fsp.rm(workRoot, { recursive: true, force: true }); });

async function writeProj(rel, content = 'x') {
  const p = path.join(projectDir, rel);
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, content);
  return p;
}
async function makeFakeEngine(name, body) {
  const p = path.join(workRoot, name);
  await fsp.writeFile(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  await fsp.chmod(p, 0o755);
  return p;
}
async function tempSubdirs() {
  try { return (await fsp.readdir(tempRoot)).filter((e) => e.startsWith('ksi-det-')); }
  catch { return []; }
}
const scanOpts = (engine, extra = {}) => ({ enginePath: engine, tempRoot, projectDir, cacheKeyExtra: CTX, ...extra });

describe('extractPaths', () => {
  it('reads write/edit path variants', () => {
    assert.deepEqual(extractPaths({ tool: 'write', success: true, input: { path: 'src/a.tsx' } }), ['src/a.tsx']);
    assert.deepEqual(extractPaths({ tool: 'edit', success: true, input: { filePath: 'src/b.css' } }), ['src/b.css']);
    assert.deepEqual(extractPaths({ tool: 'edit', status: 'success', input: { file_path: 'src/c.html' } }), ['src/c.html']);
  });
  it('parses patch headers, excludes Delete, includes Move-to', () => {
    const patchText = ['*** Begin Patch', '*** Add File: src/new.tsx', '*** Update File: src/old.css', '*** Delete File: src/gone.tsx', '*** Move to: src/renamed.tsx', '*** End Patch'].join('\n');
    assert.deepEqual(extractPaths({ tool: 'patch', success: true, input: { patchText } }), ['src/new.tsx', 'src/old.css', 'src/renamed.tsx']);
  });
  it('returns [] for failures, shell, unknown tools, aliases', () => {
    assert.deepEqual(extractPaths({ tool: 'write', success: false, input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ tool: 'edit', status: 'failed', input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ tool: 'shell', success: true, input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ tool: 'exec', success: true, input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ tool: 'delete', success: true, input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ tool: 'create', success: true, input: { path: 'a.tsx' } }), []);
    assert.deepEqual(extractPaths({ success: true, input: { path: 'a.tsx' } }), []);
  });
  it('dedups and drops URLs', () => {
    assert.deepEqual(extractPaths({ tool: 'write', success: true, input: { path: 'a.tsx', files: ['a.tsx', 'https://x/y.tsx'] } }), ['a.tsx']);
  });
  it('reads path aliases in multi-file inputs', () => {
    assert.deepEqual(extractPaths({ tool: 'write', status: 'completed', input: { files: [{ path: 'a.tsx' }, { filePath: 'b.css' }, { file_path: 'c.html' }] } }), ['a.tsx', 'b.css', 'c.html']);
  });
});

describe('parsePatchTextHeaders', () => {
  it('handles quotes, ignores Delete and diff lines', () => {
    assert.deepEqual(parsePatchTextHeaders('*** Add File: "a b.tsx"\n*** Delete File: d.tsx\n+++ b/x'), ['a b.tsx']);
  });
});

describe('selectTargets', () => {
  before(async () => {
    await writeProj('src/app.tsx', 'export default 1;\n');
    await writeProj('src/style.css', '.a{color:red}\n');
    await writeProj('src/plain.js', 'c\n');
    await writeProj('src/plain.ts', 'x\n');
    await writeProj('src/page.html', '<html></html>\n');
    await writeProj('.hidden/secret.tsx', 'x\n');
    await writeProj('node_modules/pkg/index.tsx', 'x\n');
    await writeProj('.git/hooks/x.tsx', 'x\n');
    await writeProj('dist/bundle.css', 'x\n');
    await writeProj('vendor/lib.tsx', 'x\n');
    await fsp.writeFile(path.join(workRoot, 'outside.tsx'), 'outside\n');
    try { await fsp.symlink(path.join(workRoot, 'outside.tsx'), path.join(projectDir, 'src', 'escape-link.tsx')); } catch { /* no symlink privs */ }
    try { await fsp.symlink(path.join(projectDir, 'src', 'app.tsx'), path.join(projectDir, 'src', 'inside-link.tsx')); } catch { /* ignore */ }
  });
  it('keeps UI exts, excludes plain js/ts', async () => {
    const got = await selectTargets(['src/app.tsx', 'src/style.css', 'src/page.html', 'src/plain.js', 'src/plain.ts'], projectDir);
    assert.ok(got.includes(path.join(projectDir, 'src', 'app.tsx')));
    assert.ok(!got.some((p) => p.endsWith('plain.js') || p.endsWith('plain.ts')));
  });
  it('excludes hidden/vendor/cache/git pockets', async () => {
    const v = await selectTargetsDetailed(['.hidden/secret.tsx', 'node_modules/pkg/index.tsx', '.git/hooks/x.tsx', 'dist/bundle.css', 'vendor/lib.tsx'], projectDir);
    assert.ok(v.every((r) => !r.ok));
  });
  it('rejects traversal, outsiders, URLs, flags', async () => {
    const v = await selectTargetsDetailed(['../outside.tsx', path.join(workRoot, 'outside.tsx'), 'https://e.com/x.tsx', '--evil'], projectDir);
    assert.ok(v.every((r) => !r.ok));
  });
  it('rejects symlink escapes', async () => {
    const v = await selectTargetsDetailed(['src/escape-link.tsx'], projectDir);
    try { await fsp.lstat(path.join(projectDir, 'src', 'escape-link.tsx')); } catch { return; }
    assert.equal(v[0].ok, false);
    assert.equal(v[0].reason, 'outside-boundary');
  });
  it('enforces size bound', async () => {
    await writeProj('src/big.tsx', 'z'.repeat(2048));
    assert.deepEqual(await selectTargets(['src/big.tsx'], projectDir, { maxFileBytes: 16 }), []);
  });
  it('covers vue/svelte/astro/scss/less/jsx', async () => {
    const files = ['a/a.vue', 'a/b.svelte', 'a/c.astro', 'a/d.scss', 'a/e.less', 'a/f.jsx'];
    for (const f of files) await writeProj(f, 'x\n');
    assert.equal((await selectTargets(files, projectDir)).length, files.length);
  });
});

describe('resolveEngine', () => {
  it('derives bin from launcher dirname', async () => {
    const skillScripts = path.join(workRoot, 'skills', 'impeccable', 'scripts');
    const bindir = path.join(skillScripts, 'bin', `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch === 'arm64' ? 'arm64' : process.arch}`);
    await fsp.mkdir(bindir, { recursive: true });
    const launcher = path.join(skillScripts, 'impeccable');
    await fsp.writeFile(launcher, '#!/bin/sh\n');
    const engine = path.join(bindir, process.platform === 'win32' ? 'impeccable.exe' : 'impeccable');
    await fsp.writeFile(engine, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    await fsp.chmod(engine, 0o755);
    const r = await resolveEngine({ launcher });
    assert.equal(r.ok, true);
    assert.equal(r.path, engine);
  });
  it('reports missing without fallback', async () => {
    const r = await resolveEngine({ enginePath: path.join(workRoot, 'nope') });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing');
  });
});

describe('scanTarget', () => {
  let targetCss, targetHtml;
  before(async () => {
    targetCss = await writeProj('scan/main.css', '.a{color:red}\n');
    targetHtml = await writeProj('scan/page.html', '<html><head><link rel="stylesheet" href="https://example.com/x.css"></head></html>\n');
  });
  it('requires projectDir boundary', async () => {
    clearScanCache();
    const engine = await makeFakeEngine('fake-noproj', 'echo \'{}\'; exit 0');
    const r = await scanTarget(targetCss, { enginePath: engine, tempRoot });
    assert.equal(r.status, 'error');
    assert.equal(r.reason, 'bad-project-dir');
  });
  it('returns engine-missing without launcher exec', async () => {
    clearScanCache();
    const r = await scanTarget(targetCss, { enginePath: path.join(workRoot, 'nope'), tempRoot, projectDir, launcher: '/bin/sh' });
    assert.equal(r.status, 'engine-missing');
    assert.equal(r.exitCode, null);
    assert.equal(r.launcherExecuted, false);
  });
  it('maps exit 0/2/1', async () => {
    clearScanCache();
    const pass = await makeFakeEngine('fake-pass', 'echo \'{"findings":[]}\'; exit 0');
    const issues = await makeFakeEngine('fake-issues', 'echo \'{"findings":[{"rule":"r","line":3,"severity":"error"}]}\'; exit 2');
    const broken = await makeFakeEngine('fake-broken', 'echo oops >&2; exit 1');
    const t = await writeProj('scan/map.tsx', 'export const x = 1;\n');
    const r0 = await scanTarget(t, scanOpts(pass));
    assert.equal(r0.status, 'pass');
    assert.equal(r0.exitCode, 0);
    clearScanCache();
    const r2 = await scanTarget(t, scanOpts(issues));
    assert.equal(r2.status, 'issues');
    assert.equal(r2.exitCode, 2);
    assert.deepEqual(r2.findings, [{ rule: 'r', line: 3, severity: 'error' }]);
    clearScanCache();
    const r1 = await scanTarget(t, scanOpts(broken));
    assert.equal(r1.status, 'error');
    assert.equal(r1.exitCode, 1);
  });
  it('strips file/snippet/description (no temp leak)', async () => {
    clearScanCache();
    const engine = await makeFakeEngine('fake-strip', 'echo \'{"findings":[{"rule":"r","line":1,"file":"/tmp/ksi-det-xyz/snapshot-1.tsx","snippet":"<div>","description":"long text"}]}\'; exit 2');
    const t = await writeProj('scan/strip.tsx', 'export const x = 1;\n');
    const r = await scanTarget(t, scanOpts(engine));
    assert.equal(Object.keys(r.findings[0]).sort().join(','), 'line,rule,severity');
    assert.ok(!JSON.stringify(r.findings).includes('ksi-det-'));
  });
  it('malformed JSON is operational error, never cached as pass', async () => {
    clearScanCache();
    const countFile = path.join(workRoot, 'count-malformed');
    await fsp.writeFile(countFile, '');
    const engine = await makeFakeEngine('fake-malformed', `echo x >> "${countFile}"; echo 'not json'; exit 0`);
    const t = await writeProj('scan/malformed.tsx', 'export const x = 1;\n');
    const a = await scanTarget(t, scanOpts(engine));
    const b = await scanTarget(t, scanOpts(engine));
    assert.equal(a.reason, 'malformed-json');
    assert.equal(b.reason, 'malformed-json');
    assert.equal(b.status, 'error');
    assert.equal((await fsp.readFile(countFile, 'utf8')).split('\n').filter(Boolean).length, 2);
  });
  it('HTML downgrades to .tsx snapshot, CSS stays .css, cwd pinned', async () => {
    clearScanCache();
    const argvFile = path.join(workRoot, 'argv-seen'), pwdFile = path.join(workRoot, 'pwd-seen');
    await fsp.writeFile(argvFile, '');
    const rec = await makeFakeEngine('fake-rec', `printf '%s\\n' "$@" > "${argvFile}"; pwd > "${pwdFile}"; echo '{"findings":[]}'; exit 0`);
    const rh = await scanTarget(targetHtml, scanOpts(rec));
    assert.equal(rh.snapshotExt, '.tsx');
    assert.equal(rh.htmlDowngraded, true);
    const snap = (await fsp.readFile(argvFile, 'utf8')).trim().split('\n').pop();
    assert.match(snap, /\.tsx$/);
    assert.ok(!snap.includes('page.html'));
    assert.ok((await fsp.readFile(pwdFile, 'utf8')).trim().includes('ksi-det-'));
    clearScanCache();
    const rc = await scanTarget(targetCss, scanOpts(rec));
    assert.equal(rc.snapshotExt, '.css');
  });
  it('rejects URLs without spawning', async () => {
    clearScanCache();
    const countFile = path.join(workRoot, 'count-reject');
    await fsp.writeFile(countFile, '');
    const engine = await makeFakeEngine('fake-reject', `echo x >> "${countFile}"; echo '{}'; exit 0`);
    for (const bad of ['https://e.com/x.tsx', 'file:///etc/passwd', '--json']) {
      const r = await scanTarget(bad, scanOpts(engine));
      assert.equal(r.status, 'error');
    }
    assert.equal((await fsp.readFile(countFile, 'utf8')).length, 0);
  });
  it('rejects symlinks and non-canonical paths at read', async () => {
    clearScanCache();
    const engine = await makeFakeEngine('fake-sym', 'echo \'{}\'; exit 0');
    const inner = await writeProj('scan/real.tsx', 'export const x = 1;\n');
    const link = path.join(projectDir, 'scan', 'link.tsx');
    try { await fsp.unlink(link); } catch { /* fresh */ }
    try { await fsp.symlink(inner, link); } catch { return; }
    const r = await scanTarget(link, scanOpts(engine));
    assert.equal(r.status, 'error');
    assert.ok(['symlink', 'not-canonical'].includes(r.reason));
    await fsp.unlink(link);
  });
  it('rejects outside-boundary and swap-after-selection', async () => {
    clearScanCache();
    const engine = await makeFakeEngine('fake-bound', 'echo \'{}\'; exit 0');
    const outside = path.join(workRoot, 'bound-outside.tsx');
    await fsp.writeFile(outside, 'outside\n');
    assert.equal((await scanTarget(outside, scanOpts(engine))).reason, 'outside-boundary');
    const inner = await writeProj('scan/bound-inner.tsx', 'inner\n');
    const swap = path.join(projectDir, 'scan', 'bound-swap.tsx');
    try { await fsp.unlink(swap); } catch { /* fresh */ }
    await fsp.symlink(inner, swap);
    assert.equal((await selectTargets(['scan/bound-swap.tsx'], projectDir)).length, 1);
    await fsp.unlink(swap);
    await fsp.symlink(outside, swap);
    const r = await scanTarget(swap, scanOpts(engine));
    assert.ok(['symlink', 'not-canonical', 'outside-boundary', 'symlink-swap'].includes(r.reason));
    await fsp.unlink(swap);
  });
  it('timeout kills group, output overflow errors, temp cleaned', async () => {
    clearScanCache();
    const slow = await makeFakeEngine('fake-slow', 'sleep 5; echo \'{}\'; exit 0');
    const t = await writeProj('scan/slow.tsx', 'export const x = 1;\n');
    const rt = await scanTarget(t, scanOpts(slow, { timeoutMs: 300 }));
    assert.equal(rt.timeout, true);
    assert.equal(rt.exitCode, null);
    clearScanCache();
    let py = true;
    try { await fsp.stat('/usr/bin/python3'); } catch { py = false; }
    if (py) {
      const big = await makeFakeEngine('fake-big', 'python3 -c "print(\'x\'*300000)"; exit 0');
      const rb = await scanTarget(t, scanOpts(big, { maxOutputBytes: 1024 }));
      assert.equal(rb.reason, 'output-overflow');
      assert.equal(rb.stdoutTruncated, true);
    }
    assert.deepEqual(await tempSubdirs(), []);
  });
  it('caches only valid JSON per session key; failures never cache', async () => {
    clearScanCache();
    const countFile = path.join(workRoot, 'count-cache');
    await fsp.writeFile(countFile, '');
    const counting = await makeFakeEngine('fake-count', `echo x >> "${countFile}"; echo '{"findings":[]}'; exit 0`);
    const t = await writeProj('scan/cached.tsx', 'export const x = 1;\n');
    assert.equal((await scanTarget(t, scanOpts(counting))).cached, false);
    const second = await scanTarget(t, scanOpts(counting));
    assert.equal(second.cached, true);
    assert.equal((await fsp.readFile(countFile, 'utf8')).split('\n').filter(Boolean).length, 1);
    assert.ok(getScanCacheStats().hits >= 1);
    const otherCtx = await scanTarget(t, scanOpts(counting, { cacheKeyExtra: 'sess-other:agent-test' }));
    assert.equal(otherCtx.cached, false);
    const unkeyed = await scanTarget(t, { enginePath: counting, tempRoot, projectDir });
    assert.equal(unkeyed.cached, false);
    assert.equal((await fsp.readFile(countFile, 'utf8')).split('\n').filter(Boolean).length, 3);
    clearScanCache();
    const failCount = path.join(workRoot, 'count-fail');
    await fsp.writeFile(failCount, '');
    const failing = await makeFakeEngine('fake-fail', `echo x >> "${failCount}"; exit 1`);
    await scanTarget(t, scanOpts(failing));
    await scanTarget(t, scanOpts(failing));
    assert.equal((await fsp.readFile(failCount, 'utf8')).split('\n').filter(Boolean).length, 2);
    assert.deepEqual(await tempSubdirs(), []);
  });
});

describe('authorizeRun gate', () => {
  it('observes exact temp command; denial propagates unchanged', async () => {
    clearScanCache();
    const engine = await makeFakeEngine('fake-auth', 'echo \'{"findings":[]}\'; exit 0');
    const t = await writeProj('scan/auth.tsx', 'export const x = 1;\n');
    let seen = null;
    const r = await scanTarget(t, scanOpts(engine, {
      authorizeRun: async (cmd) => { seen = cmd; await fsp.stat(cmd.args[cmd.args.length - 1]); },
    }));
    assert.equal(r.status, 'pass');
    assert.equal(r.authorized, true);
    assert.equal(seen.executable, engine);
    assert.deepEqual(seen.args.slice(0, 4), ['detect', '--json', '--no-config', '--no-design-system']);
    assert.equal(seen.args[seen.args.length - 2], '--');
    assert.ok(seen.cwd.includes('ksi-det-'));

    clearScanCache();
    const countFile = path.join(workRoot, 'count-auth');
    await fsp.writeFile(countFile, '');
    const counting = await makeFakeEngine('fake-auth-count', `echo x >> "${countFile}"; echo '{}'; exit 0`);
    const deny = new Error('native deny');
    deny.code = 'E_NATIVE_DENY';
    let caught = null;
    try {
      await scanTarget(t, scanOpts(counting, { authorizeRun: async () => { throw deny; } }));
    } catch (err) { caught = err; }
    assert.equal(caught, deny);
    assert.equal((await fsp.readFile(countFile, 'utf8')).length, 0);
    assert.deepEqual(await tempSubdirs(), []);
  });
});

describe('pure helpers', () => {
  it('guards URLs/flags/controls, spares drive paths', () => {
    assert.equal(looksLikeUrlOrCommand('https://a/b'), true);
    assert.equal(looksLikeUrlOrCommand('file:///x'), true);
    assert.equal(looksLikeUrlOrCommand('//cdn/x.css'), true);
    assert.equal(looksLikeUrlOrCommand('--json'), true);
    assert.equal(looksLikeUrlOrCommand('ok.tsx'), false);
    assert.equal(looksLikeUrlOrCommand('C:\\proj\\a.tsx'), false);
  });
  it('classifies snapshot exts', () => {
    assert.equal(classifySnapshotExt('.css'), '.css');
    assert.equal(classifySnapshotExt('.SCSS'), '.css');
    assert.equal(classifySnapshotExt('.html'), '.tsx');
  });
});
