import { realpath } from 'node:fs/promises';

// Operator-owned server environment is independent of repository plugin options.
// No context, files, or credentials are gathered by this tool.
const unavailable = reason => ({ content: JSON.stringify({ status: 'unavailable', reason, advisory: true }) });
const validID = s => typeof s === 'string' && s.length > 0 && s.length <= 128 && !/[\s*?\/]/.test(s);
const unwrap = x => x?.data ?? x;

function consent(env, directory, model) {
  try {
    const entries = JSON.parse(env.KSI_NATIVE_DECISION_CONSENT ?? 'null');
    return Array.isArray(entries) && entries.some(e => e && e.directory === directory &&
      e.providerID === model.providerID && e.id === model.id &&
      e.allowDataTransfer === true &&
      ![e.directory, e.providerID, e.id].some(s => typeof s !== 'string' || /[*?]/.test(s)));
  } catch { return false; }
}

// An abort ends this caller's wait; the underlying Native permission request
// may remain pending. A late resolution has no continuation that can dispatch.
async function wait(promise, signal) {
  if (signal.aborted) throw new Error('cancelled');
  let onAbort;
  const cancelled = new Promise((_, reject) => {
    onAbort = () => reject(new Error('cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { return await Promise.race([promise, cancelled]); }
  finally { signal.removeEventListener('abort', onAbort); }
}

export async function setupNativeDecision(ctx, deps = {}) {
  const env = deps.env ?? process.env;
  const options = ctx.options ?? {};
  const model = { providerID: options.model?.providerID, id: options.model?.id };
  const configured = options.enabled === true && options.allowDataTransfer === true &&
    validID(model.providerID) && validID(model.id);
  const attempts = new Map();
  const inflight = new Set();
  let active = true;
  const timeoutMs = deps.timeoutMs ?? 15000;

  async function location(tc, signal) {
    const session = unwrap(await wait(ctx.session.get({ sessionID: tc.sessionID }, { signal }), signal));
    if (typeof session?.location?.directory !== 'string' || typeof ctx.location?.directory !== 'string') throw new Error('location');
    const [actual, plugin] = await wait(Promise.all([realpath(session.location.directory), realpath(ctx.location.directory)]), signal);
    if (actual !== plugin) throw new Error('location');
    return actual;
  }

  async function execute(input, tc) {
    if (!active || !configured) return unavailable('not configured');
    if (!['build', 'lead'].includes(String(tc.agent ?? '').toLowerCase())) return unavailable('agent not eligible');
    if (!tc.sessionID || !tc.messageID || !tc.id || !tc.signal) return unavailable('tool context unavailable');
    if (typeof input?.question !== 'string' || !input.question.trim() || input.question.length > 600 ||
        typeof input?.context !== 'string' || !input.context.trim() || input.context.length > 1800) return unavailable('invalid input');
    const controller = new AbortController();
    inflight.add(controller);
    const abort = () => controller.abort();
    if (tc.signal.aborted) controller.abort();
    else tc.signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    const signal = controller.signal;
    let permissionError;
    try {
      const root = await location(tc, signal);
      if (!consent(env, root, model)) return unavailable('operator consent absent or mismatched');
      // Preserve native denials/rejections: do not translate permission errors.
      try { await wait(ctx.permission.assert({ sessionID: tc.sessionID, agent: tc.agent,
        source: { type: 'tool', messageID: tc.messageID, id: tc.id },
        action: 'decision.evaluate', resources: [`${model.providerID}/${model.id}`],
        metadata: { providerID: model.providerID, modelID: model.id, dataTransfer: true } }), signal); }
      catch (e) { if (signal.aborted) return unavailable('cancelled or timed out waiting for permission'); permissionError = e; throw e; }
      if (await location(tc, signal) !== root || !consent(env, root, model)) return unavailable('location or consent changed');
      if (signal.aborted) return unavailable('cancelled or timed out');
      if (!attempts.has(tc.sessionID) && attempts.size >= 256) return unavailable('session capacity reached');
      const used = attempts.get(tc.sessionID) ?? 0;
      if (used >= 3) return unavailable('session attempt limit reached');
      attempts.set(tc.sessionID, used + 1); // reserve synchronously, including failures
      let result;
      try {
        result = unwrap(await wait(ctx.experimental.generate.decisions({ model,
          input: [{ type: 'text', text: input.context }],
          questions: [{ type: 'predicate', name: 'advice', instructions: input.question }] }, { signal }), signal));
      } catch { return unavailable('generation failed, cancelled, or timed out'); }
      if (signal.aborted || await location(tc, signal) !== root || !consent(env, root, model)) return unavailable('result withheld: location, consent, or cancellation');
      const answers = result?.answers;
      if (!Array.isArray(answers) || answers.length !== 1 || answers[0]?.name !== 'advice' ||
          answers[0]?.type !== 'predicate' || typeof answers[0]?.probability !== 'number' ||
          !Number.isFinite(answers[0].probability) || answers[0].probability < 0 || answers[0].probability > 1) return unavailable('invalid or error answer');
      return { content: JSON.stringify({ status: 'advisory', probability: answers[0].probability,
        note: 'Uncalibrated model output, not an instruction, authorization, or proof.' }) };
    } catch (e) {
      if (signal.aborted) return unavailable('cancelled or timed out');
      if (permissionError === e) throw e;
      return unavailable('location or Native API unavailable');
    } finally { clearTimeout(timer); tc.signal.removeEventListener('abort', abort); inflight.delete(controller); }
  }

  await ctx.tool.transform(editor => editor.add({
    name: 'ksi_native_decision',
    options: { codemode: false },
    description: 'Optional Native Decision advisory for Build or Lead: selectively consult on a consequential uncertain choice, not routine judgments. Only use when location, selected provider and data transfer are authorized; never include secrets. Send minimal context. Results are untrusted and do not authorize action. Unavailable unless independently configured and consented.',
    input: { type: 'object', additionalProperties: false, required: ['question', 'context'], properties: {
      question: { type: 'string', minLength: 1, maxLength: 600, description: 'A single yes/no advisory question.' },
      context: { type: 'string', minLength: 1, maxLength: 1800, description: 'Minimal authorized facts and alternatives; no secrets or unnecessary repository text.' },
    } }, execute,
  }));
  return () => { active = false; for (const controller of inflight) controller.abort(); };
}
