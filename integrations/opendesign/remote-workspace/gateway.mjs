import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { isLoopback, validateRemoteRequest } from './request-policy.mjs';

const LABS_STATUS = '/api/strategies/od-next/rollout';

export function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createGateway({ config, workspaceService, upstream }) {
  const target = new URL(upstream);
  if (target.protocol !== 'http:' || !isLoopback(target.hostname) || target.pathname !== '/') {
    throw new Error('Upstream must be a loopback HTTP origin');
  }
  const validate = req => validateRemoteRequest({
    peer: req.socket.remoteAddress,
    host: req.headers.host,
    origin: req.headers.origin,
    fetchSite: req.headers['sec-fetch-site'],
  }, config);

  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/remote-workspace/internal/')) {
      const supplied = Buffer.from(req.headers.authorization ?? '');
      const expected = Buffer.from(`Bearer ${config.daemonToken ?? ''}`);
      const localAuthority = /^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(req.headers.host ?? '');
      if (req.method !== 'GET' || !localAuthority || req.headers.origin !== undefined || !isLoopback(req.socket.remoteAddress) || !config.daemonToken || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'Internal daemon authentication required' } });
      }
      try { await workspaceService.handleInternal(req, res); }
      catch (error) { sendJson(res, error.status ?? 500, { error: { code: 'WORKSPACE_ERROR', message: error.status ? error.message : 'Internal status unavailable' } }); }
      return;
    }
    const validation = validate(req);
    if (!validation.ok) return sendJson(res, 403, { error: { code: 'FORBIDDEN', message: validation.reason } });
    try {
      if (workspaceService && await workspaceService.handle(req, res)) return;
    } catch (error) {
      if (!res.headersSent) sendJson(res, error.status ?? 500, { error: { code: error.code ?? 'WORKSPACE_ERROR', message: error.status ? error.message : 'Workspace request failed' } });
      else res.destroy();
      return;
    }
    const headers = { ...req.headers };
    if (req.method === 'GET' && req.url === LABS_STATUS) {
      headers.host = target.host;
      delete headers.origin;
    }
    const outbound = http.request(target, { method: req.method, path: req.url, headers });
    const deadline = setTimeout(() => outbound.destroy(new Error('Upstream response timeout')), 15000);
    outbound.on('response', response => {
      clearTimeout(deadline);
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
      response.on('error', () => res.destroy());
    });
    outbound.on('error', () => {
      clearTimeout(deadline);
      if (!res.headersSent && !res.destroyed) sendJson(res, 502, { error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Local daemon is unavailable; retry after reconnect' } });
      else res.destroy();
    });
    req.on('aborted', () => outbound.destroy());
    res.on('close', () => { if (!res.writableEnded) outbound.destroy(); });
    req.pipe(outbound);
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/api/remote-workspace/') || !validate(req).ok) return socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    const outbound = http.request(target, { method: req.method, path: req.url, headers: req.headers });
    const deadline = setTimeout(() => outbound.destroy(new Error('Upgrade timeout')), 15000);
    outbound.on('upgrade', (response, peer, upstreamHead) => {
      clearTimeout(deadline);
      let responseHeaders = `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`;
      for (let i = 0; i < response.rawHeaders.length; i += 2) {
        responseHeaders += `${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`;
      }
      socket.write(responseHeaders + '\r\n');
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) peer.write(head);
      peer.pipe(socket).pipe(peer);
      socket.on('close', () => peer.destroy());
      peer.on('close', () => socket.destroy());
      peer.on('error', () => socket.destroy());
    });
    outbound.on('response', response => {
      clearTimeout(deadline);
      response.resume();
      socket.end(`HTTP/1.1 ${response.statusCode} Upstream rejected upgrade\r\nConnection: close\r\n\r\n`);
    });
    outbound.on('error', () => {
      clearTimeout(deadline);
      if (!socket.destroyed) socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');
    });
    socket.on('error', () => outbound.destroy());
    socket.on('close', () => outbound.destroy());
    outbound.end();
  });
  return server;
}
