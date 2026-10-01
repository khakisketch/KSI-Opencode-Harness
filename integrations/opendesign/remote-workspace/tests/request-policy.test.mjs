import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRemoteRequest } from '../request-policy.mjs';

const config = { origin: 'https://dgx.example.ts.net:7456' };
const valid = { peer: '127.0.0.1', host: 'dgx.example.ts.net:7456' };

test('tailnet gateway accepts same-origin browser requests and loopback peers', () => {
  assert.equal(validateRemoteRequest(valid, config).ok, true);
  assert.equal(validateRemoteRequest({ ...valid, peer: '::ffff:127.0.0.1', origin: config.origin, fetchSite: 'same-origin' }, config).ok, true);
});

for (const [name, changed] of [
  ['non-loopback peer', { peer: '100.1.2.3' }],
  ['other host', { host: 'evil.example:7456' }],
  ['host userinfo', { host: 'x@dgx.example.ts.net:7456' }],
  ['other origin', { origin: 'https://evil.example' }],
  ['null origin', { origin: 'null' }],
  ['cross-site browser', { fetchSite: 'cross-site' }],
  ['same-site but not same-origin browser', { fetchSite: 'same-site' }],
]) test(`rejects ${name}`, () => assert.equal(validateRemoteRequest({ ...valid, ...changed }, config).ok, false));

test('malformed or non-HTTPS deployment origin fails closed', () => {
  assert.equal(validateRemoteRequest(valid, { origin: 'not a URL' }).ok, false);
  assert.equal(validateRemoteRequest(valid, { origin: 'http://dgx.example.ts.net:7456' }).ok, false);
});
