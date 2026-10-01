import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createService } from '../service.mjs';

test('service can start Labs-only gateway with workspace capabilities disabled', async t => {
  const upstream = http.createServer((_req, res) => res.end('{"status":{"effectiveMode":"active"}}'));
  await new Promise(r => upstream.listen(0, '127.0.0.1', r));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const server = await createService({ origin: 'https://dgx.example.ts.net:7456', upstream: `http://127.0.0.1:${upstream.address().port}`, port: 17456, workspaceEnabled: false });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const result = await new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${server.address().port}/api/strategies/od-next/rollout`, { headers: { host: 'dgx.example.ts.net:7456' } }, res => {
      let body = ''; res.on('data', c => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    }); req.on('error', reject);
  });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).status.effectiveMode, 'active');
});

test('invalid origin/upstream/port or missing daemon token refuses service startup', async () => {
  const base = { origin: 'https://dgx.example.ts.net:7456', upstream: 'http://127.0.0.1:7456', port: 17456, workspaceEnabled: false };
  for (const change of [{ origin: 'http://evil' }, { upstream: 'http://evil:7456' }, { port: 7456 }, { workspaceEnabled: true }]) {
    await assert.rejects(createService({ ...base, ...change }));
  }
});
