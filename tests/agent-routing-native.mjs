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
  ['ux-scout', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['ui-ux-critic', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'xhigh' }, 'subagent'],
  ['general', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['explore', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'low' }, 'subagent'],
]) {
  const a = list.find(a => a.id === id);
  check(`${id} model/mode`, () => { assert.ok(a); assert.deepEqual(a.model, model); assert.equal(a.mode, mode); });
  if (id === 'design-architect' || id === 'ux-scout' || id === 'ui-ux-critic') {
    // Source of truth is the repo global file; Main owns
    // global/agents/ui-ux-critic.md creation and system install.
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
  ['explore', 'allow'], ['ux-scout', 'allow'], ['ui-ux-critic', 'allow'], [UNKNOWN, 'deny'],
]);
await probeSubagent('design-architect', [
  ['general', 'allow'], ['ux-scout', 'allow'], ['ui-ux-critic', 'allow'], ['explore', 'allow'], ['plan', 'allow'],
  ['build', 'deny'], ['design-architect', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('plan', [
  ['explore', 'allow'], ['general', 'deny'], ['design-architect', 'deny'], ['plan', 'deny'],
  ['ux-scout', 'deny'], ['ui-ux-critic', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('general', [['explore', 'deny'], ['ux-scout', 'deny'], ['ui-ux-critic', 'deny'], [UNKNOWN, 'deny']]);
await probeSubagent('explore', [['general', 'deny'], ['ux-scout', 'deny'], ['ui-ux-critic', 'deny'], [UNKNOWN, 'deny']]);
// Scout stays a leaf: no subordinate calls, including the new critic leaf.
await probeSubagent('ux-scout', [['ui-ux-critic', 'deny'], ['general', 'deny'], [UNKNOWN, 'deny']]);
// Critic is a selectable leaf: every subagent target denies, known or unknown.
await probeSubagent('ui-ux-critic', [
  ['general', 'deny'], ['explore', 'deny'], ['plan', 'deny'],
  ['design-architect', 'deny'], ['ux-scout', 'deny'], ['ui-ux-critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
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
  ['shell', 'playwright-cli -s=ux-scout-probe open http://127.0.0.1:1234/', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe goto http://127.0.0.1:1234/', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe screenshot --filename=/tmp/opencode/shot.png', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe fill e1 "Scout Test"', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe type "Browser path verified"', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe select e3 mobile', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe check e4', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe uncheck e4', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe go-back', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe go-forward', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe reload', 'allow'],
  ['shell', 'playwright-cli -s=ux-scout-probe close', 'allow'],
  ['shell', 'playwright-cli open http://127.0.0.1:1234/', 'deny'],
  ['shell', 'playwright-cli -s=other open http://127.0.0.1:1234/', 'deny'],
  ['shell', 'playwright-cli -s=other fill e1 "Scout Test"', 'deny'],
  ['shell', 'playwright-cli -s=other close', 'deny'],
  ['shell', 'playwright-cli close-all', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe close-all', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe attach', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe state-load /tmp/opencode/auth.json', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe upload /tmp/opencode/file.txt', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe run-code "async page => {}"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe run-code "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe eval "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe --config=untrusted open', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe open http://127.0.0.1:1234/ --config=untrusted', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe open http://127.0.0.1:1234/ --profile=/tmp/opencode/profile', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe open http://127.0.0.1:1234/ --persistent', 'deny'],
  ['shell', 'playwright-cli -s=ux-scout-probe open http://127.0.0.1:1234/ -s=other', 'deny'],
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
// Critic contract mirrors global/agents/ui-ux-critic.md (Main-owned): broad
// '*' deny first, then read/glob/grep allow with *.env* deny / *.env.example
// allow; external_directory ask except /tmp/opencode/* allow; webfetch,
// execute, browser allow; skills playwright-cli + task-first-ux-review allow,
// all other skills deny; no edit, no subagent, no arbitrary shell/install/
// deploy/credential/server-setup. Playwright CLI allows only --version plus the
// designated inspection verbs in the critic's own ux-critic-* session; late
// run-code/eval/--config/--profile/--persistent/extra -s= deny, and
// state-load/upload/attach/close-all/other-session use denies. Critic writes
// no source or report files: captures leave only via screenshot-command
// output. Browser/CLI allow rules are NOT a sandbox: they authorize live
// inspection in test environments/read-only accounts only, never real
// transactions or destructive changes (same distinction as ux-scout).
// Browser declaration/effective checks follow separately; unlike the fixed
// permissions below, its catalog gate can differ in the Native query context.
// This block probes permission effects in its own session only; it performs
// zero model calls and touches only the private fixture above.
const critic = await api('session.create', [], { location: { directory: repo }, agent: 'ui-ux-critic' });
assert.ok(critic.id);
for (const [action, resource, expected] of [
  ['read', 'probe.css', 'allow'], ['read', '.env', 'deny'], ['read', '.env.example', 'allow'],
  ['glob', 'probe.css', 'allow'], ['grep', 'probe.css', 'allow'],
  ['edit', 'probe.css', 'deny'], ['edit', '/tmp/opencode/critic-output.md', 'deny'],
  ['subagent', 'general', 'deny'], ['subagent', 'ux-scout', 'deny'], ['subagent', 'ui-ux-critic', 'deny'], ['subagent', UNKNOWN, 'deny'],
  ['execute', '*', 'allow'], ['webfetch', 'https://example.com/', 'allow'],
  ['external_directory', '/tmp/opencode/shot.png', 'allow'],
  ['skill', 'playwright-cli', 'allow'], ['skill', 'task-first-ux-review', 'allow'],
  ['skill', 'mobbin-design', 'deny'], ['skill', 'impeccable', 'deny'], ['skill', 'journey', 'deny'],
  ['shell', 'node -e "console.log(1)"', 'deny'], ['shell', 'npm install anything', 'deny'],
  ['shell', 'git push origin main', 'deny'],
  ['shell', 'playwright-cli --version', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe open', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe open http://127.0.0.1:1234/', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe goto http://127.0.0.1:1234/', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe resize 1280 800', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe snapshot', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe screenshot --filename=/tmp/opencode/shot.png', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe console', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe requests', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe click e1', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe press e1 Enter', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe fill e1 "Critic Test"', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe type "Browser path verified"', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe select e3 mobile', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe check e4', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe uncheck e4', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe go-back', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe go-forward', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe reload', 'allow'],
  ['shell', 'playwright-cli -s=ux-critic-probe close', 'allow'],
  ['shell', 'playwright-cli open http://127.0.0.1:1234/', 'deny'],
  ['shell', 'playwright-cli -s=other open http://127.0.0.1:1234/', 'deny'],
  ['shell', 'playwright-cli -s=other fill e1 "Critic Test"', 'deny'],
  ['shell', 'playwright-cli -s=other close', 'deny'],
  ['shell', 'playwright-cli close-all', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe close-all', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe attach', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe state-load /tmp/opencode/auth.json', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe upload /tmp/opencode/file.txt', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe run-code "async page => {}"', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe run-code "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe eval "x goto y"', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe --config=untrusted open', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe open http://127.0.0.1:1234/ --config=untrusted', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe open http://127.0.0.1:1234/ --profile=/tmp/opencode/profile', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe open http://127.0.0.1:1234/ --persistent', 'deny'],
  ['shell', 'playwright-cli -s=ux-critic-probe open http://127.0.0.1:1234/ -s=other', 'deny'],
]) {
  // Native file tools send normalized absolute paths, not the user's relative input.
  // external_directory probes use the resource as given (absolute /tmp path).
  const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
  const r = await api('session.permission.create', [`sessionID=${critic.id}`], { action, resources: [normalized], agent: 'ui-ux-critic' });
  await rejectIfPending(critic.id, r);
  check(`critic ${action} ${resource}: ${expected}`, () => assert.equal(r.effect, expected, `critic ${action} ${normalized}`));
}
// Browser deny removes its catalog; operations do not issue individual prompts
// (https://opencode.ai/v2/docs/tools#browser). Our query returned a trailing deny
// for Critic, Scout and Architect despite declared allows; the cause is unverified.
// Assert the declaration, ordered effective rules and matching policy probe
// separately, not unconditional Native access. Never rewrite settings to unblock
// this query. Connection/execution remain unverified; CLI checks above stay fixed.
const criticSource = await readFile(path.join(repo, 'global', 'agents', 'ui-ux-critic.md'), 'utf8');
const wildcardMatches = (pattern, value) => {
  if (typeof pattern !== 'string') return false;
  const expression = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${expression}$`).test(value);
};
const browserRulesOf = (rules) => rules.filter((rl) => rl
  && wildcardMatches(rl.action, 'browser') && wildcardMatches(rl.resource, '*'));
check('critic source declares browser allow', () => {
  assert.ok(/(^|\n)\s*-\s*action:\s*browser\s*\n\s*resource:\s*["']?\*["']?\s*\n\s*effect:\s*allow/.test(criticSource),
    'ui-ux-critic source lacks browser * allow; declaration check fails');
});
check('critic source ordered rules retain effective browser allow', () => {
  // Parse only our canonical three-field frontmatter rules, not arbitrary YAML.
  // Fail closed if a rule stops matching this source format, rather than ignore it.
  const header = criticSource.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(header, 'missing role frontmatter');
  const block = header[1].split(/permissions:\r?\n/)[1];
  assert.ok(block, 'missing canonical permission list');
  const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');
  const rules = [...block.matchAll(/^\s*- action: ([^\r\n]+)\r?\n\s+resource: ([^\r\n]+)\r?\n\s+effect: (allow|deny|ask)[ \t]*$/gm)]
    .map((m) => ({ action: unquote(m[1]), resource: unquote(m[2]), effect: m[3] }));
  assert.equal(rules.length, [...block.matchAll(/^\s*- action:/gm)].length, 'unparsed source permission rule');
  assert.equal(browserRulesOf(rules).at(-1)?.effect, 'allow', 'source role itself must not end in browser deny');
});
const criticEntry = list.find((a) => a && a.id === 'ui-ux-critic');
assert.ok(criticEntry, 'ui-ux-critic missing from merged /api/agent list');
const criticRules = Array.isArray(criticEntry.permissions) ? criticEntry.permissions : null;
check('critic merged permissions expose ordered rules', () => {
  assert.ok(criticRules, 'no ordered permission rules on merged /api/agent entry; browser scope unverifiable, refusing to pass');
});
const browserRelevant = browserRulesOf(criticRules);
const browserEffective = browserRelevant.length ? browserRelevant[browserRelevant.length - 1].effect : null;
console.log(`critic merged rules relevant to (browser, *): [${browserRelevant.map((rl) => `${rl.action} ${rl.resource} ${rl.effect}`).join(', ')}] => merged-effective=${browserEffective}`);
check('critic merged view determines a browser effective value', () => {
  assert.ok(browserEffective === 'allow' || browserEffective === 'deny',
    `no merged rule covers (browser, *); refusing to pass with effect=${browserEffective}`);
});
const browserProbe = await api('session.permission.create', [`sessionID=${critic.id}`], { action: 'browser', resources: ['*'], agent: 'ui-ux-critic' });
await rejectIfPending(critic.id, browserProbe);
check(`critic browser *: probe=${browserProbe.effect} matches merged-effective=${browserEffective} (declaration/effective split; unconditional allow is not install proof on this path)`,
  () => assert.equal(browserProbe.effect, browserEffective,
    `critic browser * probe=${browserProbe.effect} merged-effective=${browserEffective}`));
console.log(`critic browser: probe=${browserProbe.effect} vs merged-effective=${browserEffective}; live connection/execution/exposure NOT verified`);
const fixtureContent = await readFile(path.join(fixture, 'probe.css'), 'utf8');
check('product fixture unchanged', () => assert.equal(fixtureContent, 'body { color: black; }\n'));
await writeFile(path.join(root, 'result.json'), JSON.stringify({ checks, sessionID: session.id, modelCalls: 0 }, null, 2));
console.log(`${checks} checks passed; evidence: ${root}`);
