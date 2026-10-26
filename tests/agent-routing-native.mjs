// Opt-in, no model calls: verify installed Native role routing and permission effects
// for the 5-profile harness (build, plan, lead, general, explore) with dynamic
// max subagent_depth 3. The four superseded specialists (engineer, design,
// research, critic) were removed with user approval (last-approved contents
// survive only in private backups): the repo and installed files must be
// absent while the merged catalog offers only the five operating profiles and
// every live caller denies (or fails closed on) the retired ids. The retired
// architect.md is physically archived byte-identical at
// docs/archive/agents/architect.md (out of discovery): the architect id must
// be strictly unregistered and is never probed as a live caller.
// Creates only its own sessions/temporary fixture and rejects its own ask probes.
// Not a browser sandbox test, a design-quality benchmark, or a product mutation.
// Read-only global test: expected to FAIL until Main installs the new global
// config/roles; a fixture must never fake it into passing.
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
async function checkAsync(label, fn) {
  await fn();
  checks++;
  console.log(`PASS ${label}`);
}
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
  ['plan', { providerID: 'openai', id: 'gpt-6.1-sol', variant: 'high' }, 'all'],
  ['lead', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'xhigh' }, 'subagent'],
  ['general', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'high' }, 'subagent'],
  ['explore', { providerID: 'opencode-go', id: 'muse-spark-1.3-contributor', variant: 'medium' }, 'subagent'],
]) {
  const a = list.find(a => a.id === id);
  check(`${id} model/mode`, () => {
    assert.ok(a);
    assert.deepEqual(a.model, model);
    assert.equal(a.mode, mode);
  });
  if (id === 'lead') {
    // Source of truth is the repo global file; Main owns
    // global/agents/lead.md creation and system install.
    const source = await readFile(path.join(repo, 'global', 'agents', 'lead.md'), 'utf8');
    const installed = await readFile(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', 'agents', 'lead.md'), 'utf8');
    check('lead installed/system match', () => {
      assert.equal(source, installed);
      assert.equal(a.system.trim(), source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim());
    });
  }
}
{
  const source = await readFile(path.join(repo, 'global', 'AGENTS.md'), 'utf8');
  const installed = await readFile(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', 'AGENTS.md'), 'utf8');
  check('common instructions installed match source', () => assert.equal(installed, source));
}
// Superseded specialists are REMOVED with user approval (last-approved
// contents survive only in private backups): the repo source files must be
// absent, the installed files must be absent after the Main deploy, and the
// merged catalog must carry no such ids. Removal is proven by absence plus the
// permission/call checks below — never by hiding.
for (const id of ['engineer', 'design', 'research', 'critic']) {
  const rel = `agents/${id}.md`;
  await checkAsync(`removed ${id}.md absent from source`, async () => {
    try {
      await readFile(path.join(repo, 'global', rel), 'utf8');
      assert.fail(`repo source still carries ${rel}`);
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
    }
  });
  await checkAsync(`removed ${id}.md absent from installed global`, async () => {
    try {
      await readFile(path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', rel), 'utf8');
      assert.fail(`installed global still carries ${rel}`);
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
    }
  });
  check(`retired role not registered: ${id}`, () => assert.ok(!list.some(a => a.id === id)));
}
// Retired/archived native ids must not be registered after the Main install.
// Physical archive decision: architect.md lives at docs/archive/agents/
// architect.md (out of discovery), so the id is strictly unregistered.
for (const retired of ['architect', 'design-specialist', 'design-architect', 'ux-scout', 'ui-ux-critic', 'product-reviewer']) {
  check(`retired role not registered: ${retired}`, () => assert.ok(!list.some(a => a.id === retired)));
}
// Archive retained, never installed: the repo archive file exists byte-full,
// and the installed global agents dir carries no architect.md (the new install
// never copies the archive; legacy globals have none either). Stale installed
// globals are never inspected as install proof — the model/mode checks above
// already fail until Main reinstalls.
{
  const archSrc = await readFile(path.join(repo, 'docs', 'archive', 'agents', 'architect.md'), 'utf8');
  check('archived source retained byte-full (model frontmatter + body)', () => {
    assert.ok(/^---\r?\n[\s\S]*?\r?\n---/.test(archSrc), 'archive missing frontmatter');
    assert.ok(/^model:\s*\S+/m.test(archSrc), 'archive missing model line');
    assert.ok(archSrc.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim().length > 0, 'archive missing body');
  });
  const installedArch = path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), 'opencode', 'agents', 'architect.md');
  await checkAsync('installed global carries no architect.md (archive not installed)', async () => {
    try {
      await readFile(installedArch, 'utf8');
      assert.fail(`installed architect.md present at ${installedArch}`);
    } catch (e) {
      if (e?.code !== 'ENOENT') throw e;
    }
  });
}
// Plan keeps its Native system and permission rules. Removed specialist roles
// have no operating definitions; source hiding/tombstones are not removal.
{
  const raw = await readFile(path.join(repo, 'global', 'opencode.jsonc'), 'utf8');
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
  const cfg = JSON.parse(stripped);
  check('plan source has no agents.plan.system override', () => {
    assert.ok(cfg && typeof cfg === 'object');
    assert.ok(!cfg.agents?.plan || cfg.agents.plan.system === undefined,
      'agents.plan.system must stay undefined so the Native prompt applies');
  });
  check('source carries no retired operating definitions (removal, no tombstones)', () => {
    for (const id of ['engineer', 'design', 'research', 'critic']) {
      assert.ok(!(id in (cfg.agents ?? {})), `${id} must have no agents entry`);
    }
    assert.ok(!('architect' in (cfg.agents ?? {})));
  });
  check('source Build/Lead child edges are the five-profile contract; Plan keeps Native permissions', () => {
    const allows = (id) => (cfg.agents?.[id]?.permissions ?? [])
      .filter((r) => r?.action === 'subagent' && r?.effect === 'allow')
      .map((r) => r?.resource)
      .sort();
    assert.deepEqual(allows('build'), ['explore', 'general', 'lead', 'plan']);
    // No custom Plan permission allowlist: Native prompt/permissions retained
    // (mode `all` is the only exception plus the model preference). Native
    // General/Explore analysis delegation and the Native edit deny are proven
    // live, never by static allows.
    assert.ok(cfg.agents?.plan?.permissions === undefined);
    for (const id of ['general', 'explore']) {
      assert.ok(!(cfg.agents?.[id]?.permissions ?? []).some((r) => r?.action === 'skill'), `${id} declares no skill rules`);
    }
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
// Scoped owner delegation for five profiles. Build owns product goal/
// integration/final acceptance and calls lead/general/explore plus optional
// Plan consultation; Lead owns the assigned whole task and calls
// plan/general/explore; Plan (mode all, deliberate consultation exception)
// advises and delegates analysis-only to general/explore; General and Explore
// are leaves that call nothing. Effects below are allowed targets, not a fixed
// chain; the Native guard limits remaining depth. Plan keeps Native permission
// defaults, so exclusion there rests on absent targets, not a policy denial.
const UNKNOWN = 'no-such-agent-ksi-probe';
const RETIRED = ['engineer', 'design', 'research', 'critic'];
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
  ['plan', 'allow'], ['lead', 'allow'], ['general', 'allow'], ['explore', 'allow'],
  ...RETIRED.map((id) => [id, 'deny']),
  ['architect', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('plan', [
  // Native-observed (source declares no Plan rules): analysis delegation to
  // general/explore allows, and every other target also probes allow under
  // Native defaults. Retired exclusion rests on catalog absence plus real-call
  // failure (chain X in the isolated fixture) — never on a faked deny.
  // Self/ancestor discipline (plan/lead/build) is contractual (AGENTS.md),
  // not permission-enforced for the Native-permissioned Plan.
  ['general', 'allow'], ['explore', 'allow'],
  ['plan', 'allow'], ['lead', 'allow'], ['build', 'allow'],
  ...RETIRED.map((id) => [id, 'allow']),
  ['architect', 'allow'], [UNKNOWN, 'allow'],
]);
// Lead executes whole tasks (unlike a management-only router): worker fan-out
// to plan/general/explore except self/parent/retired/unknown.
await probeSubagent('lead', [
  ['plan', 'allow'], ['general', 'allow'], ['explore', 'allow'],
  ...RETIRED.map((id) => [id, 'deny']),
  ['architect', 'deny'],
  ['lead', 'deny'], ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('general', [
  ['plan', 'deny'], ['lead', 'deny'], ['general', 'deny'], ['explore', 'deny'],
  ...RETIRED.map((id) => [id, 'deny']),
  ['architect', 'deny'], ['critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
await probeSubagent('explore', [
  ['plan', 'deny'], ['lead', 'deny'], ['general', 'deny'], ['explore', 'deny'],
  ...RETIRED.map((id) => [id, 'deny']),
  ['architect', 'deny'], ['critic', 'deny'],
  ['build', 'deny'], [UNKNOWN, 'deny'],
]);
// The archived architect id is never an operational caller: no session is
// created for it; the catalog must exclude it regardless of policy effects.
// Plan stays analysis-only: normal edits deny in its own session even though it
// may delegate analysis to General under explicit boundaries. Children own
// their own permissions; nothing is inherited from the parent (behavioral
// limit verified by the runtime worker).
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
// Lead executes whole tasks: normal edits allow in its own session (execution
// capability proof). Exact skill breadth stays Native (no KSI whitelist);
// only read/edit/subagent effects assert here.
{
  const leadSession = await api('session.create', [], { location: { directory: repo }, agent: 'lead' });
  assert.ok(leadSession.id);
  for (const [action, resource, expected] of [
    ['read', 'probe.css', 'allow'],
    ['edit', 'probe.css', 'allow'],
    ['edit', '/tmp/opencode/lead-output.md', 'allow'],
    ['subagent', 'general', 'allow'],
    ['subagent', 'plan', 'allow'],
    ['subagent', 'explore', 'allow'],
    ['subagent', 'lead', 'deny'],
    ['subagent', 'build', 'deny'],
    ['subagent', 'engineer', 'deny'],
    ['subagent', 'architect', 'deny'],
    ['subagent', UNKNOWN, 'deny'],
  ]) {
    const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
    const er = await api('session.permission.create', [`sessionID=${leadSession.id}`], { action, resources: [normalized], agent: 'lead' });
    await rejectIfPending(leadSession.id, er);
    check(`lead ${action} ${resource}: ${expected}`, () => assert.equal(er.effect, expected, `lead ${action} ${normalized}`));
  }
}
// General is a broad Native executor: reads/writes allow in its own session
// and it calls no subagent. Explore is read-centric: reads allow, edits deny,
// no subagent.
{
  const generalSession = await api('session.create', [], { location: { directory: repo }, agent: 'general' });
  assert.ok(generalSession.id);
  for (const [action, resource, expected] of [
    ['read', 'probe.css', 'allow'],
    ['edit', 'probe.css', 'allow'],
    ['subagent', 'general', 'deny'],
    ['subagent', 'plan', 'deny'],
    ['subagent', 'lead', 'deny'],
    ['subagent', 'build', 'deny'],
    ['subagent', UNKNOWN, 'deny'],
    ['question', '*', 'deny'],
  ]) {
    const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
    const gr = await api('session.permission.create', [`sessionID=${generalSession.id}`], { action, resources: [normalized], agent: 'general' });
    await rejectIfPending(generalSession.id, gr);
    check(`general ${action} ${resource}: ${expected}`, () => assert.equal(gr.effect, expected, `general ${action} ${normalized}`));
  }
  const exploreSession = await api('session.create', [], { location: { directory: repo }, agent: 'explore' });
  assert.ok(exploreSession.id);
  for (const [action, resource, expected] of [
    ['read', 'probe.css', 'allow'],
    ['edit', 'probe.css', 'deny'],
    ['subagent', 'general', 'deny'],
    ['subagent', 'explore', 'deny'],
    ['subagent', UNKNOWN, 'deny'],
    ['question', '*', 'deny'],
  ]) {
    const normalized = ['read', 'edit'].includes(action) ? path.resolve(fixture, resource) : resource;
    const xr = await api('session.permission.create', [`sessionID=${exploreSession.id}`], { action, resources: [normalized], agent: 'explore' });
    await rejectIfPending(exploreSession.id, xr);
    check(`explore ${action} ${resource}: ${expected}`, () => assert.equal(xr.effect, expected, `explore ${action} ${normalized}`));
  }
}
// General Native breadth: the KSI skill whitelist is removed, so skills once
// denied by configuration (design/strategy/review lenses) are available inside
// the assigned task scope — including review, craft and optional-service
// lenses. This probes permission effects in its own session only (permissions
// are not actual skill usage or UI quality); it performs zero model calls.
{
  const session = await api('session.create', [], { location: { directory: repo }, agent: 'general' });
  assert.ok(session.id);
  for (const sk of ['diagnosing-bugs', 'ux-copy', 'designing-user-experience', 'journey', 'organize', 'reviewing-security', 'investigating-performance', 'ux-heuristics-audit', 'vercel-react-best-practices', 'building-accessible-interfaces', 'evolving-apis-and-schemas', 'playwright-cli', 'opencode', 'impeccable', 'mobbin-design']) {
    const r = await api('session.permission.create', [`sessionID=${session.id}`], { action: 'skill', resources: [sk], agent: 'general' });
    await rejectIfPending(session.id, r);
    check(`general skill ${sk}: allow (no KSI whitelist)`, () => assert.equal(r.effect, 'allow', `general skill ${sk}`));
  }
}
// Lead carries equally broad existing tool access: its Markdown declares zero
// skill rules (subagent edges only), so the same lenses are available inside
// its assigned whole task. Same probe scope: permission effects only.
{
  const session = await api('session.create', [], { location: { directory: repo }, agent: 'lead' });
  assert.ok(session.id);
  for (const sk of ['diagnosing-bugs', 'ux-copy', 'designing-user-experience', 'journey', 'organize', 'reviewing-security', 'investigating-performance', 'ux-heuristics-audit', 'vercel-react-best-practices', 'building-accessible-interfaces', 'evolving-apis-and-schemas', 'playwright-cli', 'opencode', 'impeccable', 'mobbin-design']) {
    const r = await api('session.permission.create', [`sessionID=${session.id}`], { action: 'skill', resources: [sk], agent: 'lead' });
    await rejectIfPending(session.id, r);
    check(`lead skill ${sk}: allow (short prompt, no whitelist)`, () => assert.equal(r.effect, 'allow', `lead skill ${sk}`));
  }
}
const fixtureContent = await readFile(path.join(fixture, 'probe.css'), 'utf8');
check('product fixture unchanged', () => assert.equal(fixtureContent, 'body { color: black; }\n'));
await writeFile(path.join(root, 'result.json'), JSON.stringify({ checks, modelCalls: 0 }, null, 2));
console.log(`${checks} checks passed; evidence: ${root}`);
