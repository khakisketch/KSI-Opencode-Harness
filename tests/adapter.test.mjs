import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setup, annotate } from '../global/plugins/ksi-impeccable-detector/adapter.mjs';

const event = (extra = {}) => ({ tool: 'write', status: 'completed', sessionID: 'ses_test', agent: 'build', messageID: 'msg_test', id: 'call_test', input: { path: 'view.css' }, result: { output: { success: true }, content: 'original', metadata: { kept: true } }, ...extra });

async function harness(extra = {}) {
  let hook;
  const permissions = [];
  const scans = [];
  let disposed = false;
  const ctx = {
    tool: { hook: async (name, callback) => { assert.equal(name, 'execute.after'); hook = callback; return { dispose: async () => { disposed = true; } }; } },
    session: { get: async () => ({ location: { directory: '/project' } }) },
    permission: { assert: async (input) => { permissions.push(input); } },
  };
  const deps = {
    extractPaths: (e) => ['write', 'edit', 'patch'].includes(e.tool) ? [e.input.path] : [],
    selectTargets: async (paths, directory) => paths.map((p) => ({ path: `${directory}/${p}` })),
    scanTarget: async (target, options) => {
      scans.push(target);
      await options.authorizeRun({ executable: '/engine', args: ['detect', '/temporary/snapshot.css'] });
      return { status: 'findings', findings: [{ antipattern: 'overused-font', line: 1 }] };
    },
    ...extra,
  };
  const cleanup = await setup(ctx, deps);
  return { hook, permissions, scans, ctx, cleanup, disposed: () => disposed };
}

test('native after hook preserves result and adds observable finding; disposal works', async () => {
  const h = await harness(); const e = event(); await h.hook(e);
  assert.deepEqual(e.result.output, { success: true });
  assert.equal(e.result.metadata.kept, true);
  assert.deepEqual(JSON.parse(JSON.stringify(e.result.metadata)), e.result.metadata);
  assert.match(e.result.content, /^original[\s\S]*overused-font:1/);
  assert.deepEqual(h.permissions.map((x) => x.action), ['read', 'shell']);
  assert.match(h.permissions[1].resources[0], /temporary\/snapshot\.css/);
  assert.equal(h.permissions[0].agent, 'build');
  await h.cleanup(); assert.equal(h.disposed(), true);
});

test('failed edits and shell tools never scan', async () => {
  const h = await harness(); await h.hook(event({ status: 'error' })); await h.hook(event({ tool: 'shell' }));
  assert.equal(h.scans.length, 0); assert.equal(h.permissions.length, 0);
});

test('missing session location does not fall back to plugin directory', async () => {
  const h = await harness(); h.ctx.session.get = async () => { throw Error('no session'); };
  const e = event(); await h.hook(e); assert.equal(h.scans.length, 0); assert.match(e.result.content, /location unavailable/);
});

test('a stalled Native session lookup cannot hold the tool indefinitely', async () => {
  const h = await harness({ contextTimeoutMs: 10 });
  h.ctx.session.get = () => new Promise(() => {});
  const e = event(); await h.hook(e);
  assert.equal(h.scans.length, 0); assert.match(e.result.content, /location unavailable/);
});

test('read and exact engine command denial propagate without scanning further', async () => {
  for (const action of ['read', 'shell']) {
    const h = await harness(); const rejection = Error('denied');
    h.ctx.permission.assert = async (p) => { if (p.action === action) throw rejection; };
    const e = event(); await assert.rejects(h.hook(e), (error) => error === rejection);
    assert.equal(e.result.content, 'original'); assert.equal(h.scans.length, action === 'read' ? 0 : 1);
    h.ctx.permission.assert = async () => {}; await h.hook(event()); // busy state is released after cancellation.
  }
});

test('detector failure is advisory and does not fail an edit', async () => {
  const h = await harness({ scanTarget: async () => { throw Error('failure'); } });
  const e = event(); await h.hook(e); assert.deepEqual(e.result.output, { success: true }); assert.match(e.result.content, /unavailable/);
});

test('concurrent hooks skip instead of building an unbounded queue', async () => {
  let release; let entered;
  const ready = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  const h = await harness({ scanTarget: async () => { entered(); await gate; return { status: 'clean' }; } });
  const first = h.hook(event()); await ready; const second = event(); await h.hook(second);
  assert.match(second.result.content, /another source scan/); release(); await first;
});

test('multi-file events have a file limit', async () => {
  const h = await harness({ selectTargets: async () => Array.from({ length: 20 }, (_, i) => ({ path: `/project/${i}.css` })) });
  const e = event(); await h.hook(e); assert.equal(h.scans.length, 8); assert.match(e.result.content, /12 files exceed/);
});

test('array content is extended rather than replaced', () => {
  const original = [{ type: 'text', text: 'native' }, { type: 'file', uri: 'file:///project/a', mime: 'text/plain' }];
  const e = event({ result: { content: original } }); annotate(e, [{ path: '/project/view.css', status: 'clean' }]);
  assert.deepEqual(e.result.content.slice(0, 2), original); assert.equal(e.result.content.length, 3);
});

test('string output without content remains visible with the report', () => {
  const e = event({ result: { output: 'original output' } });
  annotate(e, [{ status: 'clean' }]);
  assert.equal(e.result.output, 'original output');
  assert.match(e.result.content, /^original output/);
});

test('missing result is ignored rather than disrupting a completed edit', () => {
  const e = event({ result: undefined });
  assert.doesNotThrow(() => annotate(e, [{ status: 'skipped' }]));
  assert.equal(e.result, undefined);
});

test('oversized source is reported without reading or invoking a scanner', async () => {
  const root = process.env.KSI_TEST_TMP ?? '/tmp/opencode';
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'ksi-adapter-test-'));
  try {
    await fs.writeFile(path.join(directory, 'view.css'), 'x'.repeat(512 * 1024 + 1));
    const h = await harness({ selectTargets: undefined });
    h.ctx.session.get = async () => ({ location: { directory } });
    const e = event(); await h.hook(e);
    assert.match(e.result.content, /file size limit/);
    assert.equal(h.scans.length, 0); assert.equal(h.permissions.length, 0);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('non-UI source keeps the native result completely unchanged', async () => {
  const root = process.env.KSI_TEST_TMP ?? '/tmp/opencode';
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'ksi-adapter-test-'));
  try {
    await fs.writeFile(path.join(directory, 'logic.ts'), 'export const value = 1;');
    const h = await harness({ selectTargets: undefined });
    h.ctx.session.get = async () => ({ location: { directory } });
    const e = event({ input: { path: 'logic.ts' } }); const original = e.result;
    await h.hook(e); assert.equal(e.result, original);
    assert.equal(h.scans.length, 0); assert.equal(h.permissions.length, 0);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
