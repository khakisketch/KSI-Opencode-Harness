import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { resolveWorkspacePath } from '../path-policy.mjs';
import { createWorkspaceService } from '../workspace-service.mjs';
import { createGateway } from '../gateway.mjs';
import http from 'node:http';

function request(url, method, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers: { host: 'dgx.example.ts.net:7456', 'content-type': 'application/json' } }, res => {
      let text = ''; res.on('data', c => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function fixture(t) {
  const base = await mkdtemp('/tmp/opencode/remote-path-');
  const home = path.join(base, 'home');
  t.after(() => rm(base, { recursive: true, force: true }));
  for (const dir of ['Desktop/Project A', 'Other', '.hidden-project', '.ssh']) await mkdir(path.join(home, dir), { recursive: true });
  await symlink(path.join(home, 'Other'), path.join(home, 'alias'));
  await symlink(base, path.join(home, 'escape'));
  await writeFile(path.join(home, 'not-a-directory'), 'do not show contents');
  const service = createWorkspaceService({ config: { home }, connector: {} });
  return { home, base, service };
}

test('lists directories, hidden toggle and symlink reasons without file contents', async t => {
  const { service, home } = await fixture(t);
  const listing = await service.listDirectories({ path: '' });
  assert.equal(listing.path, home);
  assert.deepEqual(listing.entries.map(x => x.name), ['alias', 'Desktop', 'escape', 'Other']);
  assert.equal(listing.entries.find(x => x.name === 'alias').selectable, true);
  assert.equal(listing.entries.find(x => x.name === 'escape').selectable, false);
  assert.equal((await service.listDirectories({ path: '', showHidden: true })).entries.find(x => x.name === '.ssh').selectable, false);
  assert.equal((await service.listDirectories({ path: '', showHidden: true })).entries.find(x => x.name === '.hidden-project').selectable, true);
});

test('canonicalizes home-relative, absolute and internal symlink paths', async t => {
  const { home } = await fixture(t);
  assert.equal(await resolveWorkspacePath('Desktop/Project A', { home, forSelection: true }), path.join(home, 'Desktop/Project A'));
  assert.equal(await resolveWorkspacePath(path.join(home, 'Other'), { home, forSelection: true }), path.join(home, 'Other'));
  assert.equal(await resolveWorkspacePath('alias', { home, forSelection: true }), path.join(home, 'Other'));
});

test('refuses home workspace, credential roots, outside paths, links and missing/file targets', async t => {
  const { home, base } = await fixture(t);
  for (const input of ['', '.ssh', base, '../', 'escape', 'missing', 'not-a-directory']) {
    await assert.rejects(resolveWorkspacePath(input, { home, forSelection: true }));
  }
  assert.equal(await resolveWorkspacePath('', { home, forSelection: false }), home);
});

test('gateway directory API exposes only metadata and refuses unknown connection fields', async t => {
  const { home } = await fixture(t);
  const { createConnector } = await import('../connector.mjs');
  const connector = await createConnector({ config: { home, stateDir: path.join(home, 'state'), service: 'open-design' }, inspectRuns: async () => ({ runs: [] }), recreate: async () => {}, waitHealthy: async () => {} });
  const gateway = createGateway({ config: { origin: 'https://dgx.example.ts.net:7456' }, workspaceService: createWorkspaceService({ config: { home }, connector }), upstream: 'http://127.0.0.1:1' });
  await new Promise(r => gateway.listen(0, '127.0.0.1', r));
  t.after(() => { gateway.closeAllConnections(); gateway.close(); });
  const base = `http://127.0.0.1:${gateway.address().port}/api/remote-workspace`;
  const directories = await request(base + '/directories', 'GET');
  assert.equal(directories.status, 200);
  assert.equal(JSON.stringify(directories.body).includes('do not show contents'), false);
  const rejected = await request(base + '/connections', 'POST', { path: 'Other', requestId: '00000000-0000-4000-8000-000000000001', command: 'evil' });
  assert.equal(rejected.status, 400);
  const accepted = await request(base + '/connections', 'POST', { path: 'Other', requestId: '00000000-0000-4000-8000-000000000002' });
  assert.equal(accepted.status, 202);
  assert.equal(typeof accepted.body.operationId, 'string');
  // Let the operation finish before its fixture directory is removed.
  for (let i = 0; i < 100; i++) {
    const op = await request(base + '/operations/' + accepted.body.operationId, 'GET');
    if (op.body.status === 'ready') return;
    await new Promise(r => setTimeout(r, 2));
  }
  assert.fail('connection did not become ready');
});
