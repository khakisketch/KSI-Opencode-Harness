// Opt-in, no model calls: verify installed Native role routing and permission effects
// for the 8-role harness (build, plan, general, explore, research, design,
// architect, critic) with dynamic max subagent_depth 3.
// Creates only its own sessions/temporary fixture and rejects its own ask probes.
// Not a browser sandbox test, a design-quality benchmark, or a product mutation.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { settleSourceFreeAskProbe } from '../scripts/permission-probe.mjs';
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
  if (result.status !== 0) {
    // Nonzero CLI exit: throw an explicit error preserving ONLY the structured
    // routing fields (operation + native tag/request id). Raw payloads,
    // messages, credentials, and stdout/stderr stay in the private files.
    let nativeTag; let nativeRequestID;
    try {
      const text = await readFile(file, 'utf8');
      const trimmed = text.trim();
      if (trimmed) {
        let parsed = null;
        try { parsed = JSON.parse(trimmed); } catch { parsed = null; }
        const holder = parsed && typeof parsed === 'object' ? parsed : null;
        const tag = holder?._tag;
        const rid = holder?.requestID;
        if (typeof tag === 'string') nativeTag = tag;
        if (typeof rid === 'string') nativeRequestID = rid;
      }
    } catch { /* keep fail-closed below */ }
    const err = new Error(`${op} failed; inspect ${file}`);
    err.operation = op;
    if (nativeTag !== undefined) err.nativeTag = nativeTag;
    if (nativeRequestID !== undefined) err.nativeRequestID = nativeRequestID;
    throw err;
  }
  const text = await readFile(file, 'utf8');
  if (!text.trim()) return null;
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`${op} failed; inspect ${file}`); }
  assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    && Object.hasOwn(parsed, 'data'), `${op} returned an unknown response shape; inspect ${file}`);
  return parsed.data;
}
let checks = 0;
function check(label, fn) { fn(); checks++; console.log(`PASS ${label}`); }
async function rejectIfPending(sessionID, r) {
  // Source-free policy probes can return ask without a pending tool request.
  // Same call sites as before; idempotent cleanup lives in the helper.
  const res = await settleSourceFreeAskProbe({
    sessionID, probe: r, api, notice: `own-session cleanup session=${sessionID} probe=${r?.id}`,
  });
  if (res.settled !== 'noop') console.log(`NOTICE source-free probe ${res.settled}: ${res.notice}`);
}
// CLI operation-id route below uses a directory query to inspect this project.
// Do not change the shared location/configuration to make checks pass.
const { queryApi, routeFor } = await import('../scripts/capabilities.mjs');
const response = await queryApi(routeFor('/api/agent', repo));
assert.ok(response.ok);
const list = Array.isArray(response.payload) ? response.payload : response.payload.data;
// Build is primary by default selection and carries no global model; its model
// comes from the caller/session selection, so only registration/mode are fixed.
const buildEntry = list.find(a => a.id === 'build');
check('build registered primary, no global model', () => {
  assert.ok(buildEntry);
  assert.equal(buildEntry.mode, 'primary');
  assert.ok(buildEntry.model === undefined || buildEntry.model === null);
});
for (const [id, model, mode] of [
  ['plan', { providerID: 'openai', id: 'gpt-6.1-sol', variant: 'xhigh' }, 'all'],
  ['design', { providerID: 'openai', id: 'gpt-6.1-sol', variant: 'high' }, 'all'],
  ['architect', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'xhigh' }, 'subagent'],
  ['research', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['critic', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'xhigh' }, 'subagent'],
  ['general', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['explore', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'low' }, 'subagent'],
]) {
  const a = list.find(a => a.id === id);
  check(`${id} model/mode`, () => { assert.ok(a); assert.deepEqual(a.model, model); assert.equal(a.mode, mode); });
  if (id === 'design' || id === 'research' || id === 'architect' || id === 'critic') {
    // Source of truth is the repo global file; Main owns
    // global/agents/<id>.md creation and system install.
    const rel = `agents/${id}.md`;
    const source = await readFile(path.join(repo, 'global', rel), 'utf8');
    const installed = await readFile(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', rel), 'utf8');
    check(`${id} installed/system match`, () => {
      assert.equal(source, installed);
      assert.equal(a.system.trim(), source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim());
    });
  }
}
// Retired native ids must not be registered after the Main install.
for (const retired of ['design-specialist', 'design-architect', 'ux-scout', 'ui-ux-critic', 'product-reviewer']) {
  check(`retired role not registered: ${retired}`, () => assert.ok(!list.some(a => a.id === retired)));
}
// Plan is analysis-only: the repo JSONC must not override the Native prompt
// with an agents.plan.system entry. Main owns the install; this asserts source.
{
  const raw = await readFile(path.join(repo, 'global', 'opencode.jsonc'), 'utf8');
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
  const cfg = JSON.parse(stripped);
  check('plan source has no agents.plan.system override', () => {
    assert.ok(cfg && typeof cfg === 'object');
    assert.ok(!cfg.agents?.plan || cfg.agents.plan.system === undefined,
      'agents.plan.system must stay undefined so the Native prompt applies');
  });
}
// Nested-delegation allowance. V2 official OpenAPI Config.InfoEncoded.experimental
// .subagent_depth is integer >= 0; the tools default nesting is 1. This evaluates
// only the currently loaded install location inspected above. Cold-location
// discovery/readiness is distinct and is not evidence of a permission decision.
// Source-declared config only: collect every document declaration, require at
// least one and mutual consistency (fail explicit ambiguity), and keep expected
// 3. Actual depth enforcement is proven by live nesting, not by this read.
// Depth is a dynamic max allowance (root 0, usual 1~2, optional third), never a
// fixed pipeline: checks below assert allowed targets, not a mandatory chain.
const cfgResponse = await queryApi(routeFor('/api/config', repo));
assert.ok(cfgResponse.ok);
const cfgList = Array.isArray(cfgResponse.payload) ? cfgResponse.payload : cfgResponse.payload.data;
const depthDecls = cfgList
  .filter(e => e && e.type === 'document' && e.info?.experimental?.subagent_depth !== undefined)
  .map(e => ({ path: e.path, depth: e.info.experimental.subagent_depth }));
check('experimental.subagent_depth declared == 3, consistent', () => {
  assert.ok(depthDecls.length >= 1, 'no source declares experimental.subagent_depth');
  assert.ok(depthDecls.every(d => d.depth === depthDecls[0].depth),
    `ambiguous depth declarations: ${JSON.stringify(depthDecls.map(d => d.path))}`);
  assert.equal(depthDecls[0].depth, 3);
});
// Scoped owner delegation. Build owns product goal/integration/final acceptance;
// Plan and Design (mode all) advise/coordinate and call permitted workers
// directly; Architect calls research/explore/critic; Research calls explore
// only; General/Explore/Critic are leaves that call nothing. Effects below are
// allowed targets, not a fixed chain; the Native guard limits remaining depth.
// Unknown targets deny everywhere (fail closed).
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
  ['plan', 'allow'], ['design', 'allow'], ['general', 'allow'],
  ['explore', 'allow'], ['research', 'allow'], ['architect', 'allow'], ['critic', 'allow'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('plan', [
  ['design', 'allow'], ['architect', 'allow'], ['research', 'allow'],
  ['critic', 'allow'], ['general', 'allow'], ['explore', 'allow'],
  ['plan', 'deny'], ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('design', [
  ['plan', 'allow'], ['architect', 'allow'], ['research', 'allow'],
  ['critic', 'allow'], ['general', 'allow'], ['explore', 'allow'],
  ['design', 'deny'], ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('architect', [
  ['research', 'allow'], ['explore', 'allow'], ['critic', 'allow'],
  ['plan', 'deny'], ['design', 'deny'], ['architect', 'deny'],
  ['general', 'deny'], ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('research', [
  ['explore', 'allow'],
  ['plan', 'deny'], ['design', 'deny'], ['architect', 'deny'], ['research', 'deny'],
  ['critic', 'deny'], ['general', 'deny'], ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('general', [
  ['plan', 'deny'], ['design', 'deny'], ['general', 'deny'], ['explore', 'deny'],
  ['research', 'deny'], ['architect', 'deny'], ['critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('explore', [
  ['plan', 'deny'], ['design', 'deny'], ['general', 'deny'], ['explore', 'deny'],
  ['research', 'deny'], ['architect', 'deny'], ['critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
// Critic is a selectable leaf: every subagent target denies, known or unknown.
await probeSubagent('critic', [
  ['plan', 'deny'], ['design', 'deny'], ['general', 'deny'], ['explore', 'deny'],
  ['research', 'deny'], ['architect', 'deny'], ['critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
// Plan stays analysis-only: normal edits deny in its own session even though it
// may call General. Children own their own permissions; nothing is inherited
// from the parent (behavioral limit verified by the runtime worker).
{
  const planSession = await api('session.create', [], { location: { directory: repo }, agent: 'plan' });
  assert.ok(planSession.id);
  for (const [action, resource, expected] of [
    ['edit', 'probe.css', 'deny'],
    ['edit', '/tmp/opencode/plan-output.md', 'deny'],
  ]) {
    const normalized = path.resolve(fixture, resource);
    const r = await api('session.permission.create', [`sessionID=${planSession.id}`], { action, resources: [normalized], agent: 'plan' });
    await rejectIfPending(planSession.id, r);
    check(`plan ${action} ${resource}: ${expected}`, () => assert.equal(r.effect, expected, `plan ${action} ${normalized}`));
  }
}
// Shared canonical frontmatter parser for source checks. Fails closed on any
// rule that stops matching the canonical three-field format.
const parseSourceRules = (source) => {
  const header = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(header, 'missing role frontmatter');
  const block = header[1].split(/permissions:\r?\n/)[1];
  assert.ok(block, 'missing canonical permission list');
  const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2');
  const rules = [...block.matchAll(/^\s*- action: ([^\r\n]+)\r?\n\s+resource: ([^\r\n]+)\r?\n\s+effect: (allow|deny|ask)[ \t]*$/gm)]
    .map((m) => ({ action: unquote(m[1]), resource: unquote(m[2]), effect: m[3] }));
  assert.equal(rules.length, [...block.matchAll(/^\s*- action:/gm)].length, 'unparsed source permission rule');
  return rules;
};
const wildcardMatches = (pattern, value) => {
  if (typeof pattern !== 'string') return false;
  const expression = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${expression}$`).test(value);
};
const browserRulesOf = (rules) => rules.filter((rl) => rl
  && wildcardMatches(rl.action, 'browser') && wildcardMatches(rl.resource, '*'));
// Readonly role contract (mirrors Main-owned global/agents/<id>.md): default
// '*' deny first, then read/glob/grep allow with *.env* deny / *.env.example
// allow; external_directory ask except /tmp/opencode/* allow; webfetch,
// websearch, execute allow; Context7 exact 2 actions allow, no other MCP
// except Research Mobbin (mobbin_* ask with search_screens/search_flows/
// search_sections allow); per-role skills below, all other skills deny; no
// edit, no subagent, no arbitrary shell/install/deploy/credential/server-setup.
// Playwright CLI allows only --version plus the designated inspection verbs in
// the role's own <prefix>-* session; late run-code/eval/--config/--profile/
// --persistent/extra -s= deny, and state-load/upload/attach/close-all/
// other-session use denies. Captures leave only via screenshot-command output.
// Browser/CLI allow rules are NOT a sandbox: they authorize live inspection in
// test environments/read-only accounts only, never real transactions or
// destructive changes. Browser declaration/effective checks follow separately;
// unlike the fixed permissions below, its catalog gate can differ in the Native
// query context. This block probes permission effects in its own session only;
// it performs zero model calls and touches only the private fixture above.
function cliCases(prefix) {
  const s = (rest) => `playwright-cli -s=${prefix} ${rest}`;
  return [
    ['shell', 'playwright-cli --version', 'allow'],
    ['shell', s('open'), 'allow'],
    ['shell', s('open http://127.0.0.1:1234/'), 'allow'],
    ['shell', s('goto http://127.0.0.1:1234/'), 'allow'],
    ['shell', s('resize 1280 800'), 'allow'],
    ['shell', s('snapshot'), 'allow'],
    ['shell', s('screenshot --filename=/tmp/opencode/shot.png'), 'allow'],
    ['shell', s('console'), 'allow'],
    ['shell', s('requests'), 'allow'],
    ['shell', s('click e1'), 'allow'],
    ['shell', s('press e1 Enter'), 'allow'],
    ['shell', s('fill e1 "Probe Test"'), 'allow'],
    ['shell', s('type "Browser path verified"'), 'allow'],
    ['shell', s('select e3 mobile'), 'allow'],
    ['shell', s('check e4'), 'allow'],
    ['shell', s('uncheck e4'), 'allow'],
    ['shell', s('go-back'), 'allow'],
    ['shell', s('go-forward'), 'allow'],
    ['shell', s('reload'), 'allow'],
    ['shell', s('close'), 'allow'],
    ['shell', 'playwright-cli open http://127.0.0.1:1234/', 'deny'],
    ['shell', 'playwright-cli -s=other open http://127.0.0.1:1234/', 'deny'],
    ['shell', 'playwright-cli -s=other fill e1 "Probe Test"', 'deny'],
    ['shell', 'playwright-cli -s=other close', 'deny'],
    ['shell', 'playwright-cli close-all', 'deny'],
    ['shell', s('close-all'), 'deny'],
    ['shell', s('attach'), 'deny'],
    ['shell', s('state-load /tmp/opencode/auth.json'), 'deny'],
    ['shell', s('upload /tmp/opencode/file.txt'), 'deny'],
    ['shell', s('run-code "async page => {}"'), 'deny'],
    ['shell', s('run-code "x goto y"'), 'deny'],
    ['shell', s('eval "x goto y"'), 'deny'],
    ['shell', s('--config=untrusted open'), 'deny'],
    ['shell', s('open http://127.0.0.1:1234/ --config=untrusted'), 'deny'],
    ['shell', s('open http://127.0.0.1:1234/ --profile=/tmp/opencode/profile'), 'deny'],
    ['shell', s('open http://127.0.0.1:1234/ --persistent'), 'deny'],
    ['shell', s('open http://127.0.0.1:1234/ -s=other'), 'deny'],
    ['shell', s('-s=other close'), 'deny'],
    ['shell', s('-s other close'), 'deny'],
    ['shell', s('close -s other'), 'deny'],
    ['shell', s('--session=other close'), 'deny'],
    ['shell', s('close --session other'), 'deny'],
    ['shell', 'node -e "console.log(1)"', 'deny'],
    ['shell', 'npm install anything', 'deny'],
    ['shell', 'git push origin main', 'deny'],
  ];
}
async function probeReadonlyRole({ agent, cliPrefix, outputFile, skillsAllow, skillsDeny, mobbinSearchEffect }) {
  const session = await api('session.create', [], { location: { directory: repo }, agent });
  assert.ok(session.id);
  const cases = [
    ['read', 'probe.css', 'allow'], ['read', '.env', 'deny'], ['read', '.env.example', 'allow'],
    ['glob', 'probe.css', 'allow'], ['grep', 'probe.css', 'allow'],
    ['edit', 'probe.css', 'deny'], ['edit', outputFile, 'deny'],
    ['subagent', 'general', 'deny'], ['subagent', agent, 'deny'], ['subagent', UNKNOWN, 'deny'],
    ['execute', '*', 'allow'],
    ['webfetch', 'https://example.com/', 'allow'],
    ['websearch', 'probe query', 'allow'],
    ['external_directory', '/tmp/opencode/shot.png', 'allow'],
    ['context7_resolve_library_id', '*', 'allow'],
    ['context7_query_docs', '*', 'allow'],
    ['context7___permission_probe', '*', 'deny'],
    // Synthetic action tests a wildcard policy only; it is NOT a real Mobbin tool call.
    ['mobbin___permission_probe', '*', agent === 'research' ? 'ask' : 'deny'],
    ['mobbin_search_screens', '*', mobbinSearchEffect],
    ['mobbin_search_flows', '*', mobbinSearchEffect],
    ['mobbin_search_sections', '*', mobbinSearchEffect],
    ...skillsAllow.map((sk) => ['skill', sk, 'allow']),
    ...skillsDeny.map((sk) => ['skill', sk, 'deny']),
    ...cliCases(cliPrefix),
  ];
  for (const [action, resource, expected] of cases) {
    // Native file tools send normalized absolute paths, not the user's relative input.
    // external_directory probes use the resource as given (absolute /tmp path).
    const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
    const r = await api('session.permission.create', [`sessionID=${session.id}`], { action, resources: [normalized], agent });
    await rejectIfPending(session.id, r);
    check(`${agent} ${action} ${resource}: ${expected}`, () => assert.equal(r.effect, expected, `${agent} ${action} ${normalized}`));
  }
  return session;
}
// Research: readonly + Mobbin search allow; skills playwright-cli,
// mobbin-design, opencode, journey, organize; every other skill denies.
const research = await probeReadonlyRole({
  agent: 'research', cliPrefix: 'research-probe', outputFile: '/tmp/opencode/research-output.md',
  skillsAllow: ['playwright-cli', 'mobbin-design', 'opencode', 'journey', 'organize'],
  skillsDeny: ['task-first-ux-review', 'impeccable', 'vercel-react-best-practices', 'wireframe', 'emilkowalski-motion'],
  mobbinSearchEffect: 'allow',
});
// Architect: readonly, no Mobbin; skills playwright-cli, opencode,
// vercel-react-best-practices; every other skill denies.
const architect = await probeReadonlyRole({
  agent: 'architect', cliPrefix: 'architect-probe', outputFile: '/tmp/opencode/architect-output.md',
  skillsAllow: ['playwright-cli', 'opencode', 'vercel-react-best-practices'],
  skillsDeny: ['mobbin-design', 'journey', 'organize', 'task-first-ux-review', 'impeccable', 'wireframe', 'emilkowalski-motion'],
  mobbinSearchEffect: 'deny',
});
// Critic: readonly, no Mobbin; skills playwright-cli, task-first-ux-review,
// impeccable, journey, organize, vercel-react-best-practices, opencode;
// every other skill denies.
const critic = await probeReadonlyRole({
  agent: 'critic', cliPrefix: 'critic-probe', outputFile: '/tmp/opencode/critic-output.md',
  skillsAllow: ['playwright-cli', 'task-first-ux-review', 'impeccable', 'journey', 'organize', 'vercel-react-best-practices', 'opencode'],
  skillsDeny: ['mobbin-design', 'wireframe', 'emilkowalski-motion'],
  mobbinSearchEffect: 'deny',
});
// Browser deny removes its catalog; operations do not issue individual prompts
// (https://opencode.ai/v2/docs/tools#browser). A query can return a trailing
// deny despite declared allows; the cause is unverified. Assert the source
// declaration, ordered effective rules and matching policy probe separately,
// not unconditional Native access. Never rewrite settings to unblock this
// query. Connection/execution remain unverified; CLI checks above stay fixed.
async function checkBrowserSplit(agent, sessionID) {
  const source = await readFile(path.join(repo, 'global', 'agents', `${agent}.md`), 'utf8');
  check(`${agent} source declares browser allow`, () => {
    assert.ok(/(^|\n)\s*-\s*action:\s*browser\s*\n\s*resource:\s*["']?\*["']?\s*\n\s*effect:\s*allow/.test(source),
      `${agent} source lacks browser * allow; declaration check fails`);
  });
  check(`${agent} source ordered rules retain effective browser allow`, () => {
    const rules = parseSourceRules(source);
    assert.equal(browserRulesOf(rules).at(-1)?.effect, 'allow', 'source role itself must not end in browser deny');
  });
  const entry = list.find((a) => a && a.id === agent);
  assert.ok(entry, `${agent} missing from merged /api/agent list`);
  const rules = Array.isArray(entry.permissions) ? entry.permissions : null;
  check(`${agent} merged permissions expose ordered rules`, () => {
    assert.ok(rules, 'no ordered permission rules on merged /api/agent entry; browser scope unverifiable, refusing to pass');
  });
  const relevant = browserRulesOf(rules);
  const effective = relevant.length ? relevant[relevant.length - 1].effect : null;
  console.log(`${agent} merged rules relevant to (browser, *): [${relevant.map((rl) => `${rl.action} ${rl.resource} ${rl.effect}`).join(', ')}] => merged-effective=${effective}`);
  check(`${agent} merged view determines a browser effective value`, () => {
    assert.ok(effective === 'allow' || effective === 'deny',
      `no merged rule covers (browser, *); refusing to pass with effect=${effective}`);
  });
  const probe = await api('session.permission.create', [`sessionID=${sessionID}`], { action: 'browser', resources: ['*'], agent });
  await rejectIfPending(sessionID, probe);
  check(`${agent} browser *: probe=${probe.effect} matches merged-effective=${effective} (declaration/effective split; unconditional allow is not install proof on this path)`,
    () => assert.equal(probe.effect, effective,
      `${agent} browser * probe=${probe.effect} merged-effective=${effective}`));
  console.log(`${agent} browser: probe=${probe.effect} vs merged-effective=${effective}; live connection/execution/exposure NOT verified`);
}
await checkBrowserSplit('research', research.id);
await checkBrowserSplit('architect', architect.id);
await checkBrowserSplit('critic', critic.id);
const fixtureContent = await readFile(path.join(fixture, 'probe.css'), 'utf8');
check('product fixture unchanged', () => assert.equal(fixtureContent, 'body { color: black; }\n'));
await writeFile(path.join(root, 'result.json'), JSON.stringify({ checks, sessionID: research.id, modelCalls: 0 }, null, 2));
console.log(`${checks} checks passed; evidence: ${root}`);
