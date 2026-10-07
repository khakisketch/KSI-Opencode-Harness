import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, rename, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createConnector } from '../connector.mjs';

async function fixture(t, overrides = {}) {
  // Canonicalize: production resolves every path with realpath, so the
  // fixture base must be canonical too (/var vs /private/var on macOS,
  // 8.3 short names in TMPDIR on Windows) before deriving home/state.
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'remote-connect-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const home = path.join(base, 'home');
  for (const p of ['project', 'second']) await mkdir(path.join(home, p), { recursive: true });
  const config = { home, stateDir: path.join(base, 'state'), composeFiles: ['/fixed/base.yml', '/fixed/linux.yml'], composeProject: 'open-design', service: 'open-design', container: 'open-design' };
  const effects = [];
  const deps = {
    inspectRuns: async () => ({ runs: [], awaitingInputProjectIds: [] }),
    recreate: async ({ overrideFile }) => effects.push(JSON.parse(await readFile(overrideFile, 'utf8'))),
    waitHealthy: async () => {},
    ...overrides,
  };
  const connector = await createConnector({ config, ...deps });
  // Escape target for symlink-swap tests: an existing directory outside the
  // fixture home but inside the owned fixture root. A host-specific path such
  // as /tmp may be missing or drive-relative on other platforms.
  const outside = config.stateDir;
  await mkdir(outside, { recursive: true });
  assert.ok(path.relative(home, outside).startsWith('..'));
  return { config, connector, home, outside, effects, deps };
}

async function settled(connector, id) {
  for (let i = 0; i < 100; i++) {
    const op = connector.getOperation(id);
    if (!['pending', 'connecting'].includes(op.status)) return op;
    await new Promise(r => setTimeout(r, 2));
  }
  throw new Error('operation did not finish');
}

test('connects only selected canonical project with same-path mount and survives reload', async t => {
  const { connector, config, home, effects, deps } = await fixture(t);
  const requestId = randomUUID();
  const opened = await connector.connectProject({ path: 'project', requestId });
  assert.equal((await settled(connector, opened.operationId)).status, 'ready');
  assert.deepEqual(effects[0].services['open-design'].volumes, [{ type: 'bind', source: path.join(home, 'project'), target: path.join(home, 'project'), bind: { create_host_path: false } }]);
  const resumed = await createConnector({ config, ...deps });
  assert.equal(resumed.getOperation(opened.operationId).status, 'ready');
  assert.equal((await resumed.connectProject({ path: 'project', requestId })).operationId, opened.operationId);
  assert.equal(effects.length, 1);
});

test('joins duplicate requests while connecting and refuses a second concurrent project', async t => {
  let release;
  const held = new Promise(r => { release = r; });
  const { connector } = await fixture(t, { waitHealthy: () => held });
  const requestId = randomUUID();
  const first = await connector.connectProject({ path: 'project', requestId });
  const duplicate = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  assert.equal(first.operationId, duplicate.operationId);
  const second = await connector.connectProject({ path: 'second', requestId: randomUUID() });
  assert.equal(second.status, 'busy');
  release();
  assert.equal((await settled(connector, first.operationId)).status, 'ready');
});

test('active and unknown run state never restarts container', async t => {
  for (const runs of [{ runs: [{ status: 'running' }] }, {}, { runs: [{ status: 'unexpected' }] }]) {
    const { connector, effects } = await fixture(t, { inspectRuns: async () => runs });
    const opened = await connector.connectProject({ path: 'project', requestId: randomUUID() });
    assert.equal((await settled(connector, opened.operationId)).status, 'busy');
    assert.equal(effects.length, 0);
  }
});

test('health failure restores previous mount set and records recovered rollback', async t => {
  let checks = 0;
  const { connector, effects, home } = await fixture(t, { waitHealthy: async () => { if (++checks === 2) throw new Error('fixture health timeout'); } });
  const first = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  await settled(connector, first.operationId);
  const second = await connector.connectProject({ path: 'second', requestId: randomUUID() });
  const result = await settled(connector, second.operationId);
  assert.equal(result.status, 'failed');
  assert.equal(result.rollbackRecovered, true);
  assert.deepEqual(effects[2].services['open-design'].volumes.map(x => x.source), [path.join(home, 'project')]);
  assert.equal(connector.isConnected(path.join(home, 'second')), false);
});

test('rejects command/container/image injection and request identity reuse for another path', async t => {
  const { connector } = await fixture(t);
  for (const extra of [{ container: 'other' }, { image: 'evil' }, { command: 'rm' }]) {
    await assert.rejects(connector.connectProject({ path: 'project', requestId: randomUUID(), ...extra }), /Unexpected/);
  }
  const requestId = randomUUID();
  const first = await connector.connectProject({ path: 'project', requestId });
  await settled(connector, first.operationId);
  await assert.rejects(connector.connectProject({ path: 'second', requestId }), /different path/);
});

test('rechecks selected symlink after run inspection and before mount side effect', async t => {
  let fixtureHome, fixtureOutside;
  const { connector, home, effects, outside } = await fixture(t, { inspectRuns: async () => {
    await unlink(path.join(fixtureHome, 'project'));
    await symlink(fixtureOutside, path.join(fixtureHome, 'project'));
    return { runs: [] };
  } });
  fixtureHome = home; fixtureOutside = outside;
  await rm(path.join(home, 'project'), { recursive: true });
  await symlink(path.join(home, 'second'), path.join(home, 'project'));
  const first = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  assert.equal((await settled(connector, first.operationId)).status, 'failed');
  assert.equal(effects.length, 0);
});

test('fresh request to a connected root does not restart or erase another operation', async t => {
  const { connector, effects } = await fixture(t);
  const first = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  await settled(connector, first.operationId);
  const reopened = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  assert.equal(reopened.status, 'ready');
  assert.equal(connector.getOperation(first.operationId).status, 'ready');
  assert.equal(effects.length, 1);
});

test('late canonical-root swap during recreation never becomes ready and rolls back', async t => {
  let fixtureHome, fixtureOutside;
  let calls = 0;
  const { connector, home, outside } = await fixture(t, { recreate: async () => {
    if (++calls === 1) {
      await rename(path.join(fixtureHome, 'project'), path.join(fixtureHome, 'moved'));
      await symlink(fixtureOutside, path.join(fixtureHome, 'project'));
    }
  } });
  fixtureHome = home; fixtureOutside = outside;
  const operation = await connector.connectProject({ path: 'project', requestId: randomUUID() });
  const result = await settled(connector, operation.operationId);
  assert.equal(result.status, 'failed');
  assert.equal(result.rollbackRecovered, true);
  assert.equal(connector.isConnected(path.join(home, 'project')), false);
  assert.equal(calls, 2);
});
