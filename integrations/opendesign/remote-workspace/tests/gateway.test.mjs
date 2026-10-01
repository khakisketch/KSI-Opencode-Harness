import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { Readable } from 'node:stream';
import { createGateway } from '../gateway.mjs';

const origin = 'https://dgx.example.ts.net:7456';
const remoteHost = 'dgx.example.ts.net:7456';
const labs = '/api/strategies/od-next/rollout';

// Node fetch overrides Host; use real HTTP requests like the tailnet proxy.
function fetch(url, { method = 'GET', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, res => {
      resolve(new Response(Readable.toWeb(res), { status: res.statusCode, headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function listen(server, t) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

async function fixture(t) {
  let calls = 0;
  const upstream = await listen(http.createServer((req, res) => {
    calls++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ host: req.headers.host, origin: req.headers.origin ?? null, authorization: req.headers.authorization ?? null, url: req.url, method: req.method }));
  }), t);
  const gateway = await listen(createGateway({ config: { origin }, upstream }), t);
  return { gateway, upstream, calls: () => calls };
}

test('only exact read-only Labs request gets loopback Host and validated Origin removal', async t => {
  const { gateway, upstream } = await fixture(t);
  const response = await fetch(gateway + labs, { headers: { host: remoteHost, origin, authorization: 'Bearer fixture-only' } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { host: new URL(upstream).host, origin: null, authorization: 'Bearer fixture-only', url: labs, method: 'GET' });
});

for (const [method, path] of [['POST', labs], ['GET', labs + '?x=1'], ['GET', labs + '/'], ['PUT', '/api/app-config'], ['GET', '/api/health']]) {
  test(`does not grant local authority to ${method} ${path}`, async t => {
    const { gateway } = await fixture(t);
    const result = await fetch(gateway + path, { method, headers: { host: remoteHost, origin } });
    assert.equal(result.status, 200);
    const body = await result.json();
    assert.equal(body.host, remoteHost);
    assert.equal(body.origin, origin);
  });
}

test('rejects unapproved host/origin before upstream and ignores forged forwarding authority', async t => {
  const { gateway, calls } = await fixture(t);
  for (const headers of [
    { host: 'evil.example', 'x-forwarded-host': remoteHost },
    { host: remoteHost, origin: 'https://evil.example' },
    { host: remoteHost, 'sec-fetch-site': 'cross-site' },
  ]) assert.equal((await fetch(gateway + labs, { headers })).status, 403);
  assert.equal(calls(), 0);
});

test('unavailable daemon returns a JSON 502 rather than hanging', async t => {
  const gateway = await listen(createGateway({ config: { origin }, upstream: 'http://127.0.0.1:1' }), t);
  const result = await fetch(gateway + '/api/health', { headers: { host: remoteHost } });
  assert.equal(result.status, 502);
  assert.equal((await result.json()).error.code, 'UPSTREAM_UNAVAILABLE');
});

test('internal daemon connection check requires separate token, never public request authority', async t => {
  const token = 'fixture-daemon-token-not-a-real-secret';
  const workspaceService = {
    async handleInternal(_req, res) { res.end('internal fixture'); },
    async handle() { return false; },
  };
  const gateway = await listen(createGateway({ config: { origin, daemonToken: token }, workspaceService, upstream: 'http://127.0.0.1:1' }), t);
  const internal = '/api/remote-workspace/internal/connected?path=/home/fixture/project';
  assert.equal((await fetch(gateway + internal, { headers: { host: remoteHost } })).status, 403);
  const allowed = await fetch(gateway + internal, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(allowed.status, 200);
  assert.equal(await allowed.text(), 'internal fixture');
  assert.equal((await fetch(gateway + internal, { method: 'POST', headers: { authorization: `Bearer ${token}` } })).status, 403);
  assert.equal((await fetch(gateway + internal, { headers: { host: remoteHost, authorization: `Bearer ${token}` } })).status, 403);
  assert.equal((await fetch(gateway + internal, { headers: { origin, authorization: `Bearer ${token}` } })).status, 403);
});

test('streams SSE data before upstream finishes', async t => {
  let finish;
  const upstream = await listen(http.createServer((_req, res) => {
    res.setHeader('content-type', 'text/event-stream');
    res.write('data: first\n\n');
    finish = () => res.end('data: last\n\n');
  }), t);
  const gateway = await listen(createGateway({ config: { origin }, upstream }), t);
  const result = await fetch(gateway + '/api/events', { headers: { host: remoteHost } });
  const reader = result.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: first\n\n');
  finish();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: last\n\n');
  await reader.cancel();
});

test('forwards websocket upgrade and bytes without changing remote authority', async t => {
  const server = http.createServer();
  const sockets = new Set();
  t.after(() => { for (const socket of sockets) socket.destroy(); });
  server.on('upgrade', (req, socket, head) => {
    assert.equal(req.headers.host, remoteHost);
    sockets.add(socket);
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
    if (head.length) socket.write(head);
    socket.on('data', chunk => socket.write(chunk));
  });
  const upstream = await listen(server, t);
  const gateway = await listen(createGateway({ config: { origin }, upstream }), t);
  await new Promise((resolve, reject) => {
    const socket = net.connect(new URL(gateway).port, '127.0.0.1');
    t.after(() => socket.destroy());
    socket.setTimeout(3000, () => reject(new Error('upgrade timeout')));
    socket.on('error', reject);
    let text = '';
    socket.on('data', chunk => {
      text += chunk;
      if (text.includes('fixture-ping')) { socket.destroy(); resolve(); }
      else if (text.includes('\r\n\r\n')) socket.write('fixture-ping');
    });
    socket.on('connect', () => socket.write(`GET /socket HTTP/1.1\r\nHost: ${remoteHost}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
  });
});
