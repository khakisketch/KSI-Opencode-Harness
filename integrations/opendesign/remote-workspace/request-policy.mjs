import net from 'node:net';

export function isLoopback(peer) {
  const value = String(peer ?? '').replace(/^::ffff:/, '');
  return value === '::1' || (net.isIP(value) === 4 && value.startsWith('127.'));
}

export function validateRemoteRequest({ peer, host, origin, fetchSite }, config) {
  const fail = reason => ({ ok: false, reason });
  let expected;
  try {
    expected = new URL(config.origin);
    if (expected.protocol !== 'https:' || expected.origin !== config.origin) return fail('Invalid configured origin');
  } catch { return fail('Invalid configured origin'); }
  if (!isLoopback(peer)) return fail('Loopback proxy required');
  if (host !== expected.host) return fail('Unapproved request host');
  if (origin !== undefined && origin !== expected.origin) return fail('Unapproved request origin');
  if (fetchSite !== undefined && !['same-origin', 'none'].includes(fetchSite)) return fail('Cross-site request forbidden');
  return { ok: true };
}
