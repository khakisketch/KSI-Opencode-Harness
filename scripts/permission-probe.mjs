// permission-probe.mjs — test-only idempotent cleanup for source-free ask probes.
// This is NOT a product permission-bypass utility. It is regression-tested
// cleanup code for the agent-routing-native permission-effect test, where a
// synthetic (source-free) probe such as mobbin___permission_probe can resolve
// to `ask` with no durable pending tool request. Observed Native behavior:
// listing the OWN session shows the probe once, then replying reject fails
// with HTTP 404 PermissionNotFoundError for that same request id, and a
// follow-up list shows it gone. Cause remains unverified; no role/config or
// server changes are made, and permission expectations are not retried away.
//
// Contract:
// - probe.effect !== 'ask'              -> noop, zero api calls.
// - ask + own-session list lacks id     -> already-gone, no reply call.
// - ask + listed + reject ok            -> rejected (decision is always reject).
// - ask + listed + reply fails with EXACTLY
//   operation === 'session.permission.reply' AND
//   nativeTag === 'PermissionNotFoundError' AND
//   nativeRequestID === probe.id         -> re-list the SAME own session; if the
//   id is now absent, report idempotent-cleanup.
// - Anything else (other error, other request id, untyped 404, malformed
//   shape, re-list failure, target still present, foreign session) -> throw.
// - allow/deny/ask expectations and check order/count of the caller are
//   unchanged; this helper only settles the ask-probe cleanup path.

export function isOwnSessionNotFoundReply(err, requestID) {
  return typeof requestID === 'string' && requestID.length > 0 && !!err
    && typeof err === 'object'
    && err.operation === 'session.permission.reply'
    && err.nativeTag === 'PermissionNotFoundError'
    && err.nativeRequestID === requestID;
}

function assertListShape(list, what, sessionID) {
  if (!Array.isArray(list)) {
    throw new Error(`permission-probe cleanup failed: ${what} did not return a pending list`);
  }
  for (const request of list) {
    if (!request || typeof request !== 'object' || Array.isArray(request)
      || typeof request.id !== 'string' || !request.id
      || (request.sessionID !== undefined && request.sessionID !== sessionID)) {
      throw new Error(`permission-probe cleanup failed: ${what} has an invalid or foreign request`);
    }
  }
  return list;
}

export async function settleSourceFreeAskProbe({ sessionID, probe, api, notice } = {}) {
  if (typeof sessionID !== 'string' || sessionID.length === 0) {
    throw new Error('permission-probe cleanup failed: sessionID must be a nonempty string');
  }
  if (typeof api !== 'function') {
    throw new Error('permission-probe cleanup failed: api must be a function');
  }
  if (!probe || typeof probe !== 'object') {
    throw new Error('permission-probe cleanup failed: probe must be an object');
  }
  if (probe.effect === 'allow' || probe.effect === 'deny') return { settled: 'noop' };
  if (probe.effect !== 'ask') throw new Error('permission-probe cleanup failed: unknown effect');
  if (typeof probe.id !== 'string' || probe.id.length === 0) {
    throw new Error('permission-probe cleanup failed: ask probe has no request id');
  }
  if (probe.sessionID !== undefined && probe.sessionID !== sessionID) {
    throw new Error('permission-probe cleanup failed: probe belongs to another session');
  }
  const label = typeof notice === 'string' && notice.length > 0 ? notice : `session=${sessionID} probe=${probe.id}`;
  const pending = assertListShape(
    await api('session.permission.list', [`sessionID=${sessionID}`]),
    'session.permission.list',
    sessionID,
  );
  if (!pending.some((p) => p && p.id === probe.id)) {
    return { settled: 'already-gone', notice: label };
  }
  try {
    await api(
      'session.permission.reply',
      [`sessionID=${sessionID}`, `requestID=${probe.id}`],
      { decision: 'reject' },
    );
    return { settled: 'rejected', notice: label };
  } catch (err) {
    if (!isOwnSessionNotFoundReply(err, probe.id)) throw err;
    const again = assertListShape(
      await api('session.permission.list', [`sessionID=${sessionID}`]),
      'session.permission.list recheck',
      sessionID,
    );
    if (again.some((p) => p && p.id === probe.id)) throw err;
    return { settled: 'idempotent-cleanup', notice: label };
  }
}
