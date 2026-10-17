// Opt-in, no model calls: verify installed Native role routing and permission effects.
// Creates only its own sessions/temporary fixture and rejects its own ask probes.
// Not a browser sandbox test or a design-quality benchmark.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await mkdtemp('/tmp/opencode/ksi-agent-routing-');
const fixture = path.join(root, 'case');
await mkdir(fixture);
await writeFile(path.join(fixture, 'probe.css'), 'body { color: black; }\n');
let call = 0;
async function api(op, params = [], data = null) {
  const file = path.join(root, `api-${++call}.json`);
  const { openSync, closeSync } = await import('node:fs');
  const out = openSync(file, 'wx'), err = openSync(file + '.stderr', 'wx');
  let result;
  try {
    result = spawnSync('opencode', ['api', op, ...params.flatMap(p => ['--param', p]),
      ...(data === null ? [] : ['-d', JSON.stringify(data)])], {
      stdio: ['ignore', out, err], timeout: 15000,
    });
  } finally { closeSync(out); closeSync(err); }
  assert.equal(result.status, 0, `${op} failed; inspect ${file}`);
  const text = await readFile(file, 'utf8');
  return text.trim() ? JSON.parse(text).data : null;
}
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
async function rejectIfPending(sessionID, r) {
  // Source-free policy probes can return ask without a pending tool request.
  if (r.effect === 'ask') {
    const pending = await api('session.permission.list', [`sessionID=${sessionID}`]);
    if (pending.some(p => p.id === r.id)) await api('session.permission.reply', [`sessionID=${sessionID}`, `requestID=${r.id}`], { decision: 'reject' });
  }
}
// CLI operation-id route below uses a directory query to inspect this project.
// Do not change the shared location/configuration to make checks pass.
const { queryApi, routeFor } = await import('../scripts/capabilities.mjs');
const response = await queryApi(routeFor('/api/agent', repo));
assert.ok(response.ok);
const list = Array.isArray(response.payload) ? response.payload : response.payload.data;
for (const [id, model, mode] of [
  ['plan', { providerID: 'openai', id: 'gpt-6.1-sol', variant: 'xhigh' }, 'all'],
  ['design-architect', { providerID: 'openai', id: 'gpt-6.1-sol', variant: 'high' }, 'all'],
  ['ux-scout', { providerID: 'openai', id: 'gpt-6-luna-fast', variant: 'high' }, 'subagent'],
  ['general', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['explore', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'low' }, 'subagent'],
]) {
  const a = list.find(a => a.id === id);
  check(`${id} model/mode`, () => { assert.ok(a); assert.deepEqual(a.model, model); assert.equal(a.mode, mode); });
  if (id === 'design-architect' || id === 'ux-scout') {
    const rel = `agents/${id}.md`;
    const source = await readFile(path.join(repo, 'global', rel), 'utf8');
    const installed = await readFile(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', rel), 'utf8');
    check(`${id} installed/system match`, () => {
      assert.equal(source, installed);
      assert.equal(a.system.trim(), source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim());
    });
  }
}
check('retired role not registered', () => assert.ok(!list.some(a => a.id === 'design-specialist')));
// Nested-delegation allowance. V2 official OpenAPI Config.InfoEncoded.experimental
// .subagent_depth is integer >= 0; the tools default nesting is 1. This evaluates
// only the currently loaded install location inspected above. Cold-location
// discovery/readiness is distinct and is not evidence of a permission decision.
// Source-declared config only: collect every document declaration, require at
// least one and mutual consistency (fail explicit ambiguity), and keep expected
// 2. Actual depth enforcement is proven by live nesting, not by this read.
const cfgResponse = await queryApi(routeFor('/api/config', repo));
assert.ok(cfgResponse.ok);
const cfgList = Array.isArray(cfgResponse.payload) ? cfgResponse.payload : cfgResponse.payload.data;
const depthDecls = cfgList
  .filter(e => e && e.type === 'document' && e.info?.experimental?.subagent_depth !== undefined)
  .map(e => ({ path: e.path, depth: e.info.experimental.subagent_depth }));
check('experimental.subagent_depth declared == 2, consistent', () => {
  assert.ok(depthDecls.length >= 1, 'no source declares experimental.subagent_depth');
  assert.ok(depthDecls.every(d => d.depth === depthDecls[0].depth),
    `ambiguous depth declarations: ${JSON.stringify(depthDecls.map(d => d.path))}`);
  assert.equal(depthDecls[0].depth, 2);
});
// Scoped depth-2 owner delegation: Build owns product goal/integration/final
// acceptance; Architect owns an assigned UI unit and calls worker sessions
// directly; Plan is a technical advisor over Explore only; leaves delegate no
// further. Depth is a max allowance, not a mandatory tree. Unknown targets deny.
const UNKNOWN = 'no-such-agent-ksi-probe';
async function probeSubagent(caller, targets) {
  const s = await api('session.create', [], { location: { directory: repo }, agent: caller });
  assert.ok(s.id);
  for (const [target, expected] of targets) {
    const r = await api('session.permission.create', [`sessionID=${s.id}`], { action: 'subagent', resources: [target], agent: caller });
    await rejectIfPending(s.id, r);
    check(`subagent ${caller} -> ${target}: ${expected}`, () => assert.equal(r.effect, expected, `subagent ${caller} -> ${target}`));
  }
  return s;
}
await probeSubagent('build', [
  ['plan', 'allow'], ['design-architect', 'allow'], ['general', 'allow'],
  ['explore', 'allow'], ['ux-scout', 'allow'], [UNKNOWN, 'deny'],
]);
await probeSubagent('design-architect', [
  ['general', 'allow'], ['ux-scout', 'allow'], ['explore', 'allow'], ['plan', 'allow'],
  ['build', 'deny'], ['design-architect', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('plan', [
  ['explore', 'allow'], ['general', 'deny'], ['design-architect', 'deny'], ['plan', 'deny'],
]);
await probeSubagent('general', [['explore', 'deny'], [UNKNOWN, 'deny']]);
await probeSubagent('explore', [['general', 'deny'], [UNKNOWN, 'deny']]);
// Evaluate in the already-loaded install location inspected above. Cold-location
// discovery/readiness is distinct and is not evidence of a permission decision.
const session = await api('session.create', [], { location: { directory: repo }, agent: 'ux-scout' });
assert.ok(session.id);
for (const [action, resource, expected] of [
  ['read', 'probe.css', 'allow'], ['read', '.env', 'deny'], ['read', '.env.example', 'allow'],
  ['edit', 'probe.css', 'deny'], ['edit', '/tmp/opencode/scout-output.md', 'deny'],
  ['subagent', 'general', 'deny'], ['subagent', UNKNOWN, 'deny'], ['execute', '*', 'allow'],
  ['shell', 'node -e "console.log(1)"', 'deny'], ['shell', 'npm install anything', 'deny'],
  ['shell', 'git push origin main', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe open', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe goto http://127.0.0.1:1234/', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe screenshot --filename=/tmp/opencode/shot.png', 'allow'],
  ['shell', 'playwright-cli -s=other close', 'deny'],
  ['shell', 'playwright-cli close-all', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe run-code "async page => {}"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe run-code "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe eval "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe --config=untrusted open', 'deny'],
  // Synthetic action tests a wildcard policy only; it is NOT a real Mobbin tool call.
  ['mobbin___permission_probe', '*', 'ask'],
  ['mobbin_search_screens', '*', 'allow'],
  ['mobbin_search_flows', '*', 'allow'],
  ['mobbin_search_sections', '*', 'allow'],
]) {
  // Native file tools send normalized absolute paths, not the user's relative input.
  const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
  const r = await api('session.permission.create', [`sessionID=${session.id}`], { action, resources: [normalized], agent: 'ux-scout' });
  await rejectIfPending(session.id, r);
  check(`${action} ${resource}: ${expected}`, () => assert.equal(r.effect, expected, `${action} ${normalized}`));
}
const fixtureContent = await readFile(path.join(fixture, 'probe.css'), 'utf8');
check('product fixture unchanged', () => assert.equal(fixtureContent, 'body { color: black; }\n'));
await writeFile(path.join(root, 'result.json'), JSON.stringify({ checks, sessionID: session.id, modelCalls: 0 }, null, 2));
console.log(`${checks} checks passed; evidence: ${root}`);
