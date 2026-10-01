import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGateway } from './gateway.mjs';
import { createConnector } from './connector.mjs';
import { createWorkspaceService } from './workspace-service.mjs';
import { validateRemoteRequest } from './request-policy.mjs';

export async function createService(config) {
  const origin = new URL(config.origin);
  if (!validateRemoteRequest({ peer: '127.0.0.1', host: origin.host }, config).ok) throw new Error('Invalid remote origin');
  const upstream = new URL(config.upstream);
  if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535 || config.port === Number(upstream.port || 80)) throw new Error('Gateway port must differ from upstream');
  let workspaceService;
  if (config.workspaceEnabled !== false) {
    if (typeof config.daemonToken !== 'string' || config.daemonToken.length < 32) throw new Error('Private daemon token required');
    if (!path.isAbsolute(config.home ?? '') || !path.isAbsolute(config.stateDir ?? '') || !Array.isArray(config.composeFiles) || config.composeFiles.some(p => !path.isAbsolute(p)) || config.service !== 'open-design') throw new Error('Invalid workspace service configuration');
    const headers = config.upstreamToken ? { authorization: `Bearer ${config.upstreamToken}` } : {};
    async function inspectRuns() {
      const response = await fetch(new URL('/api/runs', upstream), { headers, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Cannot verify daemon run state');
      return response.json();
    }
    async function waitHealthy() {
      const until = Date.now() + 120000;
      while (Date.now() < until) {
        try {
          const response = await fetch(new URL('/api/health', upstream), { headers, signal: AbortSignal.timeout(2000) });
          if (response.ok && (await response.json()).ok === true) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Daemon health recovery timed out');
    }
    const connector = await createConnector({ config, inspectRuns, waitHealthy });
    workspaceService = createWorkspaceService({ config, connector });
  }
  return createGateway({ config, workspaceService, upstream: config.upstream });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] !== '--config' || !process.argv[3]) throw new Error('Usage: service.mjs --config <private config path>');
    const config = JSON.parse(await readFile(process.argv[3], 'utf8'));
    config.daemonToken = process.env.OD_REMOTE_DAEMON_TOKEN;
    config.upstreamToken = process.env.OD_REMOTE_UPSTREAM_TOKEN;
    const server = await createService(config);
    server.on('error', () => { console.error('Remote workspace listener failed'); process.exitCode = 1; });
    server.listen(config.port, '127.0.0.1', () => console.log('Remote workspace gateway ready'));
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
  } catch { console.error('Remote workspace startup failed; verify private configuration'); process.exitCode = 1; }
}
