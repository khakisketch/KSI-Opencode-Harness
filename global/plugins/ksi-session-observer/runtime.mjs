// Explicit, read-only child observation. Events only wake a fresh snapshot;
// this adapter never sends prompts, interrupts sessions, or changes files.
import { realpath } from 'node:fs/promises';

const unwrap = (value) => value && typeof value === 'object' && 'data' in value ? value.data : value;
const fail = (message) => { throw new Error(`session-observer: ${message}`); };

export function classifySnapshot({ session, previous, permissions }) {
  if (!session || !previous || !Array.isArray(permissions)) return 'unknown';
  if (permissions.length) return 'permission_wait';
  if (JSON.stringify(previous.time) !== JSON.stringify(session.time) || previous.outcome !== session.outcome) return 'unknown';
  const busy = session.time?.busy, idle = session.time?.idle;
  if (typeof busy !== 'number') return 'inactive_unknown';
  if (typeof idle !== 'number' || busy > idle) return 'running_or_stalled';
  if (busy === idle) return 'unknown';
  if (session.outcome === 'succeeded') return 'completed';
  if (session.outcome === 'failed') return 'failed';
  if (session.outcome === 'interrupted') return 'interrupted';
  return 'inactive_unknown';
}

export async function readChildSnapshot(ctx, callerID, childID, signal) {
  if (!/^ses_[A-Za-z0-9]+$/.test(childID) || typeof callerID !== 'string') fail('invalid session');
  const options = { signal };
  const caller = unwrap(await ctx.session.get({ sessionID: callerID }, options));
  const child = unwrap(await ctx.session.get({ sessionID: childID }, options));
  if (!caller || !child || child.parentID !== callerID || child.projectID !== caller.projectID) fail('session is not an owned direct child');
  if (!caller.location?.directory || !ctx.location?.directory ||
      await realpath(caller.location.directory) !== await realpath(ctx.location.directory)) fail('caller location mismatch');
  const permissions = unwrap(await ctx.permission.list({ sessionID: childID }, options));
  const previous = unwrap(await ctx.session.get({ sessionID: childID }, options));
  const current = unwrap(await ctx.session.get({ sessionID: childID }, options));
  if (current?.parentID !== callerID || current?.projectID !== caller.projectID) fail('child identity changed');
  const state = classifySnapshot({ session: current, previous, permissions });
  return { sessionID: childID, state, outcome: current?.outcome ?? null,
    directory: current?.location?.directory ?? null, agent: current?.agent ?? null,
    model: current?.model ?? null, permissionCount: Array.isArray(permissions) ? permissions.length : null,
    advice: 'Projected session timestamps can be stale after a crash; verify active execution, ownership and worktree changes before follow-up. No automatic resume or replacement.' };
}

export async function observeChild(ctx, callerID, childID, waitMs, signal) {
  if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 30000) fail('waitMs must be 0..30000');
  // Start consuming before the first snapshot so a transition cannot disappear
  // between the initial read and subscription. A timeout always re-reads state.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) fail('cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  let timer;
  let lastHint = null;
  let streamError = false;
  const events = ctx.event.subscribe({ signal: controller.signal });
  const iterator = events[Symbol.asyncIterator]();
  const next = () => iterator.next().then((value) => value, (error) => ({ error }));
  let pending = next();
  try {
    let snapshot = await readChildSnapshot(ctx, callerID, childID, signal);
    if (waitMs && snapshot.state === 'running_or_stalled') {
      const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve({ timeout: true }), waitMs); });
      while (snapshot.state === 'running_or_stalled') {
        let result;
        try { result = await Promise.race([pending, timeout]); }
        catch { streamError = true; break; }
        if (result.timeout || result.done || result.error) { if (result.done || result.error) streamError = true; break; }
        const event = result.value;
        pending = next();
        if (event?.data?.sessionID !== childID || !['session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted', 'session.retry.scheduled', 'permission.asked', 'permission.replied'].includes(event.type)) continue;
        lastHint = event.type;
        snapshot = await readChildSnapshot(ctx, callerID, childID, signal);
      }
    }
    if (signal?.aborted) fail('cancelled');
    // Reconcile even on missed events, duplicate events, timeout or disconnect.
    snapshot = await readChildSnapshot(ctx, callerID, childID, signal);
    return { ...snapshot, eventHint: lastHint, streamError };
  } finally {
    clearTimeout(timer);
    controller.abort();
    signal?.removeEventListener('abort', abort);
    // Native's iterator honors abort. Do not await a potentially stuck source.
    pending.catch(() => {});
  }
}

export async function setupSessionObserver(ctx) {
  const registration = await ctx.tool.transform((editor) => editor.add({
    name: 'ksi_session_observe',
    description: 'Observe an owned direct child via Native events and session/permission snapshots. Running-or-stalled is not proof of a live worker. Read-only; never resumes, interrupts or replaces a worker.',
    input: { type: 'object', properties: {
      sessionID: { type: 'string', pattern: '^ses_[A-Za-z0-9]+$', maxLength: 128 },
      waitMs: { type: 'integer', minimum: 0, maximum: 30000 },
    }, required: ['sessionID'], additionalProperties: false },
    options: { codemode: false },
    execute: async (input, toolContext) => ({ content: [{ type: 'text', text: JSON.stringify(
      await observeChild(ctx, toolContext.sessionID, input.sessionID, input.waitMs ?? 0, toolContext.signal)) }] }),
  }));
  return async () => { await registration.dispose(); };
}
