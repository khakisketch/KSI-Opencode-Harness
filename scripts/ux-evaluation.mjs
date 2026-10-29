#!/usr/bin/env node
// Offline organizer of caller-supplied claims, not a quality evaluator.
const LIMIT = 65536;
const CONDITION_KEYS = ['scenario', 'state', 'viewport', 'inputs', 'environment'];
const VERDICTS = ['positive', 'negative', 'mixed', 'unknown'];
function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function keys(v, allowed) {
  if (!object(v) || Object.keys(v).some(k => !allowed.includes(k))) throw Error('invalid structure or unknown field');
}
function text(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > 500 || /[\u0000-\u001f\u007f-\u009f]/u.test(v)) throw Error('invalid text');
  return v.trim() || null;
}
function verdict(v) {
  if (v === undefined || v === null) return 'unknown';
  if (!VERDICTS.includes(v)) throw Error('invalid verdict');
  return v;
}
function cost(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1000000) throw Error('invalid cost or duration');
  return v;
}
function side(v) {
  keys(v, ['name', 'conditions', 'provenance', 'minutes', 'cost', 'costUnit', 'iterations']);
  const c = v.conditions ?? {};
  keys(c, CONDITION_KEYS);
  const iterations = cost(v.iterations);
  if (iterations !== null && !Number.isInteger(iterations)) throw Error('invalid iterations');
  return {name: text(v.name), conditions: Object.fromEntries(CONDITION_KEYS.map(k => [k, text(c[k])])), provenance: text(v.provenance), minutes: cost(v.minutes), cost: cost(v.cost), costUnit: text(v.costUnit), iterations};
}
export function evaluate(input) {
  keys(input, ['task', 'request', 'baseline', 'candidate', 'issues']);
  const baseline = side(input.baseline), candidate = side(input.candidate);
  const conditions = Object.fromEntries(CONDITION_KEYS.map(k => {
    const a = baseline.conditions[k], b = candidate.conditions[k];
    return [k, !a || !b ? 'unknown' : a === b ? 'declared-match' : 'different'];
  }));
  const values = Object.values(conditions);
  const task = text(input.task), request = text(input.request);
  const missingContext = !task || !request || !baseline.name || !candidate.name;
  const status = values.includes('different') ? 'not-comparable' : values.includes('unknown') || missingContext ? 'unknown' : 'declared-aligned-unverified';
  if (!Array.isArray(input.issues) || input.issues.length > 50) throw Error('invalid issues');
  const issues = input.issues.map(i => {
    keys(i, ['topic', 'preserve', 'counterevidence', 'userFeedback', 'referenceJudgment', 'agentJudgment']);
    const feedback = verdict(i.userFeedback), reference = verdict(i.referenceJudgment), agent = verdict(i.agentJudgment);
    return {topic: text(i.topic), preserve: text(i.preserve), counterevidence: text(i.counterevidence), userFeedback: feedback, referenceJudgment: reference, agentJudgment: agent,
      feedbackAgentDisagreement: feedback === 'unknown' || agent === 'unknown' ? 'unknown' : feedback === agent ? 'no' : 'yes',
      referenceAgentDisagreement: reference === 'unknown' || agent === 'unknown' ? 'unknown' : reference === agent ? 'no' : 'yes'};
  });
  return {format: 'ux-evaluation-v1', warning: 'All content is caller-declared and unverified; no quality verdict or user approval is inferred.', task, request, comparison: {status, missingContext, conditions}, baseline, candidate, issues};
}
async function main() {
  let size = 0, chunks = [];
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > LIMIT) throw Error('input exceeds 65536 bytes');
    chunks.push(chunk);
  }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Error('invalid JSON'); }
  console.log(JSON.stringify(evaluate(data), null, 2));
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.length !== 2) { console.error('Usage: node scripts/ux-evaluation.mjs < input.json'); process.exitCode = 2; }
  else main().catch(() => { console.error('Invalid input; see docs/ux-evaluation.md. No report produced.'); process.exitCode = 1; });
}
