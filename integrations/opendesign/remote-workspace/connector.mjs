import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolveWorkspacePath, workspaceError } from './path-policy.mjs';

export async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = file + '.' + randomUUID();
  await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}

async function readState(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { paths: [], operations: [] }; throw error; }
}

export function composeRecreate(config) {
  return async ({ overrideFile }) => {
    const args = ['compose', '--project-name', config.composeProject];
    for (const file of [...config.composeFiles, overrideFile]) args.push('--file', file);
    args.push('up', '-d', '--no-deps', config.service);
    await new Promise((resolve, reject) => {
      const child = spawn('docker', args, { cwd: config.composeCwd, stdio: ['ignore', 'ignore', 'pipe'] });
      // Do not persist Docker output: it can contain deployment environment values.
      child.stderr.resume();
      const deadline = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Container recreation timed out')); }, 120000);
      child.on('error', error => { clearTimeout(deadline); reject(error); });
      child.on('exit', code => { clearTimeout(deadline); code === 0 ? resolve() : reject(new Error('Container recreation failed')); });
    });
  };
}

export async function createConnector({ config, inspectRuns, recreate = composeRecreate(config), waitHealthy }) {
  const stateFile = path.join(config.stateDir, 'connections.json');
  const overrideFile = path.join(config.stateDir, 'projects.compose.json');
  const saved = await readState(stateFile);
  const paths = new Set(saved.paths);
  const operations = new Map(saved.operations.map(op => [op.operationId, op]));
  for (const op of operations.values()) if (['pending', 'connecting'].includes(op.status)) {
    op.status = 'failed'; op.message = 'Connection process interrupted; retry with a new request';
  }
  let active = null;
  const visibleOperation = op => ({ ...op, ...(active === op && !['pending', 'connecting'].includes(op.status) ? { status: 'connecting' } : {}) });
  let writes = Promise.resolve();
  const persist = () => {
    writes = writes.then(() => atomicJson(stateFile, { paths: [...paths], operations: [...operations.values()] }));
    return writes;
  };
  const override = selected => ({ services: { [config.service]: { volumes: selected.map(p => ({ type: 'bind', source: p, target: p, bind: { create_host_path: false } })) } } });
  const verifyRoots = async selected => {
    for (const p of selected) if (await resolveWorkspacePath(p, { home: config.home, forSelection: true }) !== p) throw workspaceError('Connected directory changed during connection');
  };

  async function perform(op, originalInput) {
    const previous = [...paths];
    let attempted = false;
    try {
      const runs = await inspectRuns();
      const terminals = ['succeeded', 'failed', 'canceled'];
      if (!Array.isArray(runs?.runs) || runs.runs.some(run => !terminals.includes(run.status))) {
        op.status = 'busy'; op.message = 'Generation is active or its state cannot be verified; retry when idle';
        return;
      }
      const checked = await resolveWorkspacePath(originalInput, { home: config.home, forSelection: true });
      if (checked !== op.path) throw workspaceError('Selected directory changed before connection');
      // Recheck all retained roots; a moved root must not silently expose a replacement symlink.
      for (const p of previous) if (await resolveWorkspacePath(p, { home: config.home, forSelection: true }) !== p) throw workspaceError('Previously connected directory changed');
      op.status = 'connecting';
      await persist();
      await atomicJson(overrideFile, override([...previous, op.path]));
      attempted = true;
      await verifyRoots([...previous, op.path]);
      await recreate({ overrideFile });
      await waitHealthy();
      await verifyRoots([...previous, op.path]);
      paths.add(op.path);
      op.status = 'ready';
    } catch (error) {
      op.status = 'failed';
      op.message = error.status ? error.message : 'Connection failed; see rollback status and retry';
      if (attempted) {
        try {
          await atomicJson(overrideFile, override(previous));
          await verifyRoots(previous);
          await recreate({ overrideFile });
          await waitHealthy();
          await verifyRoots(previous);
          op.rollbackRecovered = true;
        } catch { op.rollbackRecovered = false; op.message = 'Connection and rollback recovery failed; operator recovery required'; }
      }
    } finally {
      await persist();
      active = null;
    }
  }

  return {
    isConnecting: () => active !== null,
    isConnected: p => paths.has(p),
    getOperation: id => {
      const op = operations.get(id);
      if (!op) throw workspaceError('Connection operation not found', 404);
      return visibleOperation(op);
    },
    async connectProject(input) {
      if (!input || Object.keys(input).some(key => !['path', 'requestId'].includes(key))) throw workspaceError('Unexpected connection fields');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId ?? '')) throw workspaceError('requestId must be a UUID');
      const canonical = await resolveWorkspacePath(input.path, { home: config.home, forSelection: true });
      const existing = [...operations.values()].find(op => op.requestIds.includes(input.requestId));
      if (existing) {
        if (existing.path !== canonical) throw workspaceError('requestId was used for a different path');
        return visibleOperation(existing);
      }
      if (active?.path === canonical) {
        active.requestIds.push(input.requestId);
        await persist();
        return visibleOperation(active);
      }
      const op = { operationId: randomUUID(), requestIds: [input.requestId], path: canonical, status: paths.has(canonical) ? 'ready' : active ? 'busy' : 'pending' };
      operations.set(op.operationId, op);
      if (op.status === 'pending') active = op;
      await persist();
      if (op.status === 'pending') void perform(op, input.path).catch(() => { active = null; op.status = 'failed'; op.message = 'Could not persist connection state'; });
      return visibleOperation(op);
    },
  };
}
