import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createConnector } from '../connector.mjs';

const exec = promisify(execFile);
test('real isolated Compose preserves base mounts and recovers failed project connection', { skip: process.env.OD_REMOTE_DOCKER_SMOKE !== '1', timeout: 120000 }, async t => {
  const root = await mkdtemp('/tmp/opencode/remote-docker-smoke-');
  const project = 'ksi-remote-smoke-' + randomUUID().slice(0, 8);
  const container = project;
  const home = path.join(root, 'home');
  for (const p of ['one', 'two']) await mkdir(path.join(home, p), { recursive: true });
  const data = path.join(root, 'data'); await mkdir(data); await writeFile(path.join(data, 'sentinel'), 'preserved');
  const base = path.join(root, 'base.compose.json');
  await writeFile(base, JSON.stringify({ services: { 'open-design': {
    image: 'ksi-open-design:remote-workspace-20260930-ready', container_name: container,
    entrypoint: ['node'], command: ['--input-type=module', '-e', "import http from 'node:http';http.createServer((q,r)=>r.end('healthy')).listen(7456,'127.0.0.1');"],
    volumes: [{ type: 'bind', source: data, target: '/fixture-data' }],
  } } }));
  const compose = ['compose', '--project-name', project, '-f', base];
  t.after(async () => {
    await exec('docker', [...compose, 'down'], { timeout: 30000 });
    await rm(root, { recursive: true, force: true });
  });
  const config = { home, stateDir: path.join(root, 'state'), composeFiles: [base], composeProject: project, composeCwd: root, service: 'open-design', container };
  let healthChecks = 0;
  const connector = await createConnector({ config, inspectRuns: async () => ({ runs: [] }), waitHealthy: async () => {
    for (let i = 0; i < 50; i++) {
      try {
        await exec('docker', ['exec', container, 'node', '-e', "fetch('http://127.0.0.1:7456').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], { timeout: 5000 });
        break;
      } catch (e) { if (i === 49) throw e; await new Promise(r => setTimeout(r, 200)); }
    }
    const metadata = JSON.parse((await exec('docker', ['inspect', container], { timeout: 10000 })).stdout)[0];
    assert(metadata.Mounts.some(m => m.Source === data && m.Destination === '/fixture-data'));
    assert(metadata.Mounts.some(m => m.Source === path.join(home, 'one')));
    if (++healthChecks === 2) {
      assert(metadata.Mounts.some(m => m.Source === path.join(home, 'two')));
      throw new Error('controlled post-recreate health failure');
    }
  } });
  async function settled(id) {
    for (let i = 0; i < 500; i++) { const op = connector.getOperation(id); if (!['pending', 'connecting'].includes(op.status)) return op; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('operation timeout');
  }
  const first = await connector.connectProject({ path: 'one', requestId: randomUUID() });
  assert.equal((await settled(first.operationId)).status, 'ready');
  const second = await connector.connectProject({ path: 'two', requestId: randomUUID() });
  const failed = await settled(second.operationId);
  assert.equal(failed.status, 'failed'); assert.equal(failed.rollbackRecovered, true);
  const mounts = JSON.parse((await exec('docker', ['inspect', container])).stdout)[0].Mounts;
  assert(!mounts.some(m => m.Source === path.join(home, 'two')));
  assert.equal((await exec('docker', ['exec', container, 'cat', '/fixture-data/sentinel'])).stdout, 'preserved');
});
