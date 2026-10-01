import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { resolveWorkspacePath, workspaceError } from './path-policy.mjs';
import { sendJson } from './gateway.mjs';

async function jsonBody(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > 8192) throw workspaceError('Request body too large', 413);
  }
  try { return JSON.parse(text); } catch { throw workspaceError('Invalid JSON'); }
}

export function createWorkspaceService({ config, connector }) {
  async function listDirectories({ path: input = '', showHidden = false }) {
    const canonical = await resolveWorkspacePath(input, { home: config.home });
    const children = await readdir(canonical, { withFileTypes: true });
    const entries = [];
    for (const child of children) {
      if ((!child.isDirectory() && !child.isSymbolicLink()) || (!showHidden && child.name.startsWith('.'))) continue;
      const selected = path.join(canonical, child.name);
      let browsable = true, selectable = true, reason = null;
      try { await resolveWorkspacePath(selected, { home: config.home }); }
      catch (error) { browsable = false; selectable = false; reason = error.message; }
      if (browsable) {
        try { await resolveWorkspacePath(selected, { home: config.home, forSelection: true }); }
        catch (error) { selectable = false; reason = error.message; }
      }
      entries.push({ name: child.name, path: selected, browsable, selectable, reason });
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
    let selectable = false;
    try { await resolveWorkspacePath(canonical, { home: config.home, forSelection: true }); selectable = true; } catch {}
    return { home: config.home, path: canonical, selectable, entries };
  }
  return {
    listDirectories,
    async handleInternal(req, res) {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/remote-workspace/internal/connected') {
        const canonical = await resolveWorkspacePath(url.searchParams.get('path') ?? '', { home: config.home, forSelection: true });
        sendJson(res, 200, { path: canonical, connected: connector.isConnected(canonical), connecting: connector.isConnecting() });
      } else if (url.pathname === '/api/remote-workspace/internal/status') {
        sendJson(res, 200, { connecting: connector.isConnecting() });
      } else sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown internal status request' } });
    },
    async handle(req, res) {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/remote-workspace/')) return false;
      if (req.method === 'GET' && url.pathname === '/api/remote-workspace/capabilities') {
        sendJson(res, 200, { enabled: true, home: config.home, desktop: path.join(config.home, 'Desktop') });
      } else if (req.method === 'GET' && url.pathname === '/api/remote-workspace/directories') {
        sendJson(res, 200, await listDirectories({ path: url.searchParams.get('path') ?? '', showHidden: url.searchParams.get('showHidden') === 'true' }));
      } else if (req.method === 'POST' && url.pathname === '/api/remote-workspace/connections') {
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw workspaceError('JSON content type required', 415);
        sendJson(res, 202, await connector.connectProject(await jsonBody(req)));
      } else if (req.method === 'GET' && /^\/api\/remote-workspace\/operations\/[0-9a-f-]+$/.test(url.pathname)) {
        sendJson(res, 200, connector.getOperation(url.pathname.split('/').at(-1)));
      } else sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown remote workspace request' } });
      return true;
    },
  };
}
