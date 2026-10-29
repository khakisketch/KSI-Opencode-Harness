// capabilities-inventory.test.mjs — injected fake ctx only (no CLI/network/spawn,
// no real Native server, no models, no env reads beyond this process).
// Location checks use real temp dirs (mkdtemp); unverifiable paths must fail
// closed, never string-match into verified scope.
// Run: `node --test tests/capabilities-inventory.test.mjs` from the repository root.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, chmod } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  PLUGIN_ID,
  NATIVE_DOMAINS,
  DEFAULT_NATIVE_DOMAINS,
  MAX_CATALOG_IDS,
  MAX_ID_LENGTH,
  MAX_LOCATE_SKILLS,
  TRACKED_AGENTS as NATIVE_AGENTS,
  TRACKED_SKILLS as NATIVE_SKILLS,
  TRACKED_MCP as NATIVE_MCP,
  aliasNativeDomain,
  normalizeNativeDomains,
  resolveNativeDomainsStrict,
  validNativePayload,
  projectNativeAgents,
  projectNativeSkills,
  projectNativeMcp,
  projectNativeToolCount,
  projectNativePluginCount,
  catalogIds,
  buildNativeReport,
  sameRoot,
  lexicalScopeHint,
  setupCapabilitiesInventory,
} from '../global/plugins/ksi-capabilities-inventory/runtime.mjs';
import {
  TRACKED_AGENTS,
  TRACKED_SKILLS,
  TRACKED_MCP,
} from '../scripts/capabilities.mjs';

const SECRET = 'sk-secret-xyz';
const realAgents = [
  { id: 'build', name: 'Build Agent', mode: 'primary', apiKey: SECRET, description: 'keep private' },
  { id: 'plan', name: 'Plan', mode: 'all' },
  { id: 'fixture-extra-agent', name: 'Extra', mode: 'subagent', config: { token: SECRET } },
];
const realSkills = [
  { id: 'impeccable', name: 'Impeccable', config: { token: SECRET }, description: 'keep private' },
  { id: 'wireframe', name: 'Wireframe' },
  { id: 'fixture-extra-skill', name: 'Extra', path: '/tmp/ksi-capinv-projection-fixture/SKILL.md' },
];
const realTools = [{ id: 'read', description: SECRET }, { id: 'edit' }, { id: 'ksi_capabilities_inventory' }];
const realMcp = [{ name: 'context7', status: { status: 'connected' }, headers: { auth: SECRET }, description: 'keep private' }];
const realPlugins = [{ id: 'ksi.capabilities-inventory', extra: SECRET }, { id: 'other' }];
// Ids observed in the isolated Native fixture (agents like
// build/compaction/title, skills like fixture-extra-skill, tools like
// patch/opencode.config.worktree, plugins like opencode.tool.input.repair).
const observedIds = [
  'build', 'general', 'explore', 'compaction', 'title', 'summary', 'plan',
  'opencode', 'report', 'browser', 'fixture-extra-skill',
  'patch', 'edit', 'glob', 'grep', 'opencode_session_rename',
  'opencode.config.worktree', 'opencode.provider.prompt-cache-key',
  'opencode.tool.input.repair', 'ksi.capabilities-inventory', 'context7',
];

function fakeCtx({ lists = {}, pluginDir, sessionDir, sessionID = 'ses_test', calls = [] } = {}) {
  const wrap = (domain, fn) => async (...a) => {
    calls.push(domain);
    return fn(...a);
  };
  let added;
  const ctx = {
    calls,
    pluginDir,
    sessionDir,
    location: { directory: pluginDir },
    session: {
      get: async (input) => {
        calls.push('session.get');
        assert.deepEqual(input, { sessionID });
        return { data: { location: { directory: sessionDir } } };
      },
    },
    agent: { list: wrap('agent', lists.agent ?? (async () => [])) },
    skill: { list: wrap('skill', lists.skill ?? (async () => [])) },
    tool: {
      list: wrap('tool', lists.tool ?? (async () => [])),
      transform: async (cb) => {
        const editor = { add: (def) => { added = def; } };
        await cb(editor);
        return { dispose: async () => {} };
      },
    },
    mcp: { list: wrap('mcp', lists.mcp ?? (async () => [])) },
    plugin: { list: wrap('plugin', lists.plugin ?? (async () => [])) },
    getAdded: () => added,
  };
  if (lists.__omit) {
    for (const d of lists.__omit) delete ctx[d];
  }
  return ctx;
}
const tc = (sessionID = 'ses_test') => ({ sessionID, agent: 'build', messageID: 'msg_tool', id: 'call_test', signal: new AbortController().signal });

describe('native inventory identity and parity', () => {
  it('uses the managed plugin id and five selectable domains with mcp opt-in default', () => {
    assert.equal(PLUGIN_ID, 'ksi.capabilities-inventory');
    assert.deepEqual(NATIVE_DOMAINS, ['agent', 'skill', 'tool', 'mcp', 'plugin']);
    assert.deepEqual(DEFAULT_NATIVE_DOMAINS, ['agent', 'skill', 'tool', 'plugin']);
  });
  it('tracks the same agents/skills/mcp as the shared CLI inventory', () => {
    assert.deepEqual(NATIVE_AGENTS, TRACKED_AGENTS);
    assert.deepEqual(NATIVE_SKILLS, TRACKED_SKILLS);
    assert.deepEqual(NATIVE_MCP, TRACKED_MCP);
  });
  it('normalizes native domain filters in canonical order', () => {
    assert.deepEqual(normalizeNativeDomains(undefined), ['agent', 'skill', 'tool', 'mcp', 'plugin']);
    assert.deepEqual(normalizeNativeDomains(null), ['agent', 'skill', 'tool', 'mcp', 'plugin']);
    assert.deepEqual(normalizeNativeDomains(['plugins', 'TOOL', ' mcp ']), ['tool', 'mcp', 'plugin']);
    assert.deepEqual(normalizeNativeDomains('skill,agent'), ['agent', 'skill']);
    assert.deepEqual(normalizeNativeDomains('garbage'), []);
    assert.deepEqual(normalizeNativeDomains([]), []);
  });
});

describe('strict domain input with legacy compat', () => {
  it('keeps lenient normalize for legacy callers', () => {
    assert.deepEqual(normalizeNativeDomains(['mcp', 'bogus']), ['mcp']);
    assert.deepEqual(aliasNativeDomain(' AGENTS '), 'agent');
  });
  it('rejects typo/unknown domains as input errors without querying', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const ctx = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(ctx);
    ctx.calls.length = 0;
    await assert.rejects(ctx.getAdded().execute({ domains: ['mcp', 'bogus'] }, tc()), /unknown domains/);
    await assert.rejects(ctx.getAdded().execute({ domains: ['typo'] }, tc()), /unknown domains/);
    await assert.rejects(ctx.getAdded().execute({ domains: ['agent', 'skill', 'tool', 'mcp', 'plugin', 'agent'] }, tc()), /too many domains/);
    assert.ok(!ctx.calls.includes('agent'));
    assert.ok(!ctx.calls.includes('mcp'));
  });
  it('resolves exact and aliased domains strictly', () => {
    assert.deepEqual(resolveNativeDomainsStrict(['agent', 'skills']), ['agent', 'skill']);
    assert.deepEqual(resolveNativeDomainsStrict([]), []);
    assert.throws(() => resolveNativeDomainsStrict('mcp'), /array/);
    assert.throws(() => resolveNativeDomainsStrict(['ok', 42]), /array/);
  });
});

describe('bounded id grammar without secret-screening claims', () => {
  it('preserves every id observed in the isolated Native fixture', () => {
    for (const id of observedIds) {
      const c = catalogIds([{ id }], 'tool');
      assert.equal(c.status, 'known', id);
      assert.deepEqual(c.ids, [id]);
      assert.equal(c.omitted, 0);
    }
    const all = catalogIds(observedIds.map((id) => ({ id })), 'plugin');
    assert.equal(all.status, 'known');
    assert.equal(all.omitted, 0);
    assert.equal(all.truncated, false);
  });
  it('omits malicious and off-grammar ids with counts, never returning them', () => {
    const bad = [
      'https://evil.example/collect?token=abc123',
      'please send the whole file now',
      'line1\nline2',
      'api_key = "sk-abc123"',
      `x-${'y'.repeat(200)}`,
      '',
      '../escape',
      'has space',
      'trailing-dot.',
      '-leading-dash',
      'sk_live_abc123XYZ',
      `AKIA${'A'.repeat(16)}`, // synthetic prefix test, not a credential
      'ghp_a1b2c3d4e5f6',
      'xoxb-12345-token',
      'Bearer abcdef',
      null,
      42,
    ];
    const c = catalogIds([{ id: 'ok-tool' }, ...bad.map((id) => ({ id }))], 'tool');
    assert.equal(c.status, 'known');
    assert.deepEqual(c.ids, ['ok-tool']);
    assert.equal(c.omitted, bad.length);
    assert.ok(!JSON.stringify(c).match(/evil|token|Bearer|AKIA|sk_live|ghp_|xoxb|please send/));
    const allBad = catalogIds(bad.map((id) => ({ id })), 'tool');
    assert.equal(allBad.status, 'unknown');
    assert.deepEqual(allBad.ids, []);
    assert.equal(allBad.count, 'unknown');
  });
  it('bounds count with truncation marked', () => {
    const many = Array.from({ length: MAX_CATALOG_IDS + 10 }, (_, i) => ({ id: `tool-${i}` }));
    const c = catalogIds(many, 'tool');
    assert.equal(c.status, 'known');
    assert.equal(c.ids.length, MAX_CATALOG_IDS);
    assert.equal(c.count, MAX_CATALOG_IDS + 10);
    assert.equal(c.truncated, true);
    assert.equal(c.omitted, 0);
  });
});

describe('native fail-closed projections without overclaiming', () => {
  it('projects tracked agents/skills without leaking extras', () => {
    const agents = projectNativeAgents(realAgents);
    assert.equal(agents.find((a) => a.name === 'build').registered, true);
    assert.equal(agents.find((a) => a.name === 'build').mode, 'primary');
    const skills = projectNativeSkills({ data: realSkills });
    assert.equal(skills.find((s) => s.name === 'impeccable').registered, true);
    assert.ok(!JSON.stringify({ agents, skills }).includes(SECRET));
    assert.ok(!JSON.stringify({ agents, skills }).match(/apiKey|headers|config|stdout|stderr|url|prompt/i));
  });
  it('leaves missing or unconfirmed mcp state as unknown, absence as unavailable', () => {
    const connected = projectNativeMcp(realMcp);
    assert.equal(connected.find((m) => m.name === 'context7').status, 'connected');
    assert.equal(connected.find((m) => m.name === 'mobbin').status, 'unavailable');
    const missing = projectNativeMcp([{ name: 'context7' }, { name: 'mobbin', status: {} }]);
    assert.equal(missing.find((m) => m.name === 'context7').status, 'unknown');
    assert.equal(missing.find((m) => m.name === 'mobbin').status, 'unknown');
    const odd = projectNativeMcp([{ name: 'context7', status: { status: 'connecting' } }]);
    assert.equal(odd.find((m) => m.name === 'context7').status, 'unknown');
    assert.ok(projectNativeMcp([{ name: 'x', status: 'connected' }]).every((m) => m.status === 'unknown' || m.status === 'unavailable'));
  });
  it('counts tools/plugins without listing raw entries', () => {
    assert.deepEqual(projectNativeToolCount(realTools), { count: 3, status: 'known' });
    assert.deepEqual(projectNativePluginCount(realPlugins), { count: 2, status: 'known' });
    assert.ok(!JSON.stringify(projectNativeToolCount(realTools)).includes(SECRET));
  });
  it('builds scoped reports with catalogs, time, and no success claim', () => {
    const r = buildNativeReport({
      directory: '/tmp/ksi-capinv-report-fixture', agentResult: { ok: true, payload: realAgents },
      skillResult: { ok: true, payload: realSkills }, toolResult: { ok: true, payload: realTools },
      mcpResult: { ok: true, payload: realMcp }, pluginResult: { ok: true, payload: realPlugins },
      at: '2026-10-28T00:00:00.000Z',
    });
    assert.equal(r.at, '2026-10-28T00:00:00.000Z');
    assert.deepEqual(r.domainsQueried, ['agent', 'skill', 'tool', 'mcp', 'plugin']);
    assert.equal(r.partial, false);
    assert.equal(r.coreQueriesOk, true);
    assert.equal(r.queriedOk, true);
    assert.ok(r.catalog.agent.ids.includes('fixture-extra-agent'));
    assert.ok(r.notice.includes('registration does not prove connection completion'));
    assert.ok(r.notice.includes('no secret screening claim'));
    assert.ok(!JSON.stringify(r).match(/works|healthy|version/i));
    assert.ok(!JSON.stringify(r).match(/apiKey|headers|config|stdout|stderr|url|prompt/i));
    assert.ok(!JSON.stringify(r).includes(SECRET));
  });
  it('keeps located found tri-state through report sanitizing', () => {
    const r = buildNativeReport({
      directory: '/tmp/x', agentResult: { ok: true, payload: [] },
      skillResult: { ok: true, payload: [] }, toolResult: { ok: true, payload: [] },
      mcpResult: { ok: true, payload: [] }, pluginResult: { ok: true, payload: [] },
      locatedSkills: [
        { id: 'a', found: true, scope: 'project-hint' },
        { id: 'b', found: false, scope: 'unknown' },
        { id: 'c', found: 'unknown', scope: 'unknown' },
        { id: 'd', found: 'yes', scope: 'project' },
      ],
    });
    assert.deepEqual(r.skillLocations, [
      { id: 'a', found: true, scope: 'project-hint' },
      { id: 'b', found: false, scope: 'unknown' },
      { id: 'c', found: 'unknown', scope: 'unknown' },
      { id: 'd', found: 'unknown', scope: 'unknown' },
    ]);
  });
});

describe('fail-closed location checks with real directories', () => {
  it('sameRoot accepts identical real dirs and rejects different or missing ones', async () => {
    const a = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const b = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    assert.equal(await sameRoot(a, a), true);
    assert.equal(await sameRoot(a, b), false);
    assert.equal(await sameRoot(a, path.join(a, 'does-not-exist')), false);
    assert.equal(await sameRoot(a, `${a}/sub/../..`), false);
    assert.equal(await sameRoot(a, null), false);
  });
  it('lexicalScopeHint is a string-only hint that never touches the filesystem', () => {
    const root = '/tmp/ksi-capinv-lexical-fixture';
    const outside = '/tmp/ksi-capinv-lexical-outside';
    assert.equal(lexicalScopeHint(root, `${root}/SKILL.md`), 'project-hint');
    assert.equal(lexicalScopeHint(root, root), 'project-hint');
    assert.equal(lexicalScopeHint(root, `${root}/sub/../SKILL.md`), 'project-hint');
    assert.equal(lexicalScopeHint(root, `${outside}/SKILL.md`), 'external-hint');
    // A `..` traversal that escapes lexically stays external-hint, never project.
    assert.equal(lexicalScopeHint(root, `${root}/sub/../../etc/passwd`), 'external-hint');
    // A symlink path is judged by its listed string only: never resolved,
    // so it can never be promoted to a verified claim.
    assert.equal(lexicalScopeHint(root, `${root}/link-out`), 'project-hint');
    assert.equal(lexicalScopeHint(root, null), 'unknown');
    assert.equal(lexicalScopeHint(root, ''), 'unknown');
    assert.equal(lexicalScopeHint(null, `${root}/x`), 'unknown');
  });
  it('skill-path scoping performs no filesystem oracle on existence or access', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const outside = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    await writeFile(`${root}/SKILL.md`, 'x');
    const runLocate = async (skillPayload) => {
      const ctx = fakeCtx({ lists: { agent: async () => [], skill: async () => skillPayload, tool: async () => [], plugin: async () => [] }, pluginDir: root, sessionDir: root });
      await setupCapabilitiesInventory(ctx);
      const report = JSON.parse((await ctx.getAdded().execute({ domains: ['skill'], locateSkills: skillPayload.map((e) => e.id) }, tc())).content[0].text);
      return report.skillLocations;
    };
    // The same listed strings give the same hint whether or not the files
    // exist: calling cannot distinguish external presence from absence.
    const payloadMissing = [
      { id: 'absent-file-skill', path: `${outside}/no-such-file-SKILL.md` },
      { id: 'traversal-skill', path: `${root}/sub/../../etc/passwd` },
    ];
    const missingResult = await runLocate(payloadMissing);
    assert.deepEqual(missingResult, [
      { id: 'absent-file-skill', found: true, scope: 'external-hint' },
      { id: 'traversal-skill', found: true, scope: 'external-hint' },
    ]);
    await writeFile(`${outside}/no-such-file-SKILL.md`, 'x');
    const presentResult = await runLocate(payloadMissing);
    assert.deepEqual(presentResult, missingResult);
    // A read-denied directory changes nothing: no access is attempted, so no
    // error is raised and the string hint is returned as-is.
    const locked = path.join(root, 'locked');
    await mkdir(locked);
    await writeFile(path.join(locked, 'SKILL.md'), 'x');
    await chmod(locked, 0o000);
    try {
      const deniedResult = await runLocate([{ id: 'denied-skill', path: `${locked}/SKILL.md` }]);
      assert.deepEqual(deniedResult, [{ id: 'denied-skill', found: true, scope: 'project-hint' }]);
    } finally { await chmod(locked, 0o700); }
    // A symlink path is never resolved: lexically inside stays a hint.
    const link = path.join(root, 'link-out');
    await symlink(outside, link);
    const linkResult = await runLocate([{ id: 'link-skill', path: link }]);
    assert.deepEqual(linkResult, [{ id: 'link-skill', found: true, scope: 'project-hint' }]);
  });
  it('execute rejects unverifiable or moved sessions without querying lists', async () => {
    const a = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const b = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const moved = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: a, sessionDir: b });
    await setupCapabilitiesInventory(moved);
    await assert.rejects(moved.getAdded().execute({}, tc()), /session moved/);
    assert.ok(!moved.calls.includes('agent'));
    const missing = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: a, sessionDir: path.join(a, 'does-not-exist') });
    await setupCapabilitiesInventory(missing);
    await assert.rejects(missing.getAdded().execute({}, tc()), /session moved/);
    assert.ok(!missing.calls.includes('agent'));
    const dotdot = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: path.join(a, 'sub'), sessionDir: path.join(a, 'sub', '..') });
    await mkdir(path.join(a, 'sub'));
    await setupCapabilitiesInventory(dotdot);
    await assert.rejects(dotdot.getAdded().execute({}, tc()), /session moved/);
    const locked = path.join(a, 'locked');
    await mkdir(locked);
    await chmod(locked, 0o000);
    try {
      const denied = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: a, sessionDir: locked });
      await setupCapabilitiesInventory(denied);
      await assert.rejects(denied.getAdded().execute({}, tc()), /session moved/);
      assert.ok(!denied.calls.includes('agent'));
    } finally { await chmod(locked, 0o700); }
    const link = path.join(a, 'link-b');
    await symlink(b, link);
    const symlinkMoved = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: a, sessionDir: link });
    await setupCapabilitiesInventory(symlinkMoved);
    await assert.rejects(symlinkMoved.getAdded().execute({}, tc()), /session moved/);
    const linkSame = path.join(a, 'link-a');
    await symlink(a, linkSame);
    const symlinkSame = fakeCtx({ lists: { agent: async () => realAgents }, pluginDir: a, sessionDir: linkSame });
    await setupCapabilitiesInventory(symlinkSame);
    const out = await symlinkSame.getAdded().execute({ domains: ['agent'] }, tc());
    assert.equal(JSON.parse(out.content[0].text).agents.find((x) => x.name === 'build').registered, true);
  });
});

describe('session-verified explicit-call tool', () => {
  it('registers one read-only tool and defaults without mcp', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const ctx = fakeCtx({ lists: { agent: async () => realAgents, skill: async () => realSkills, tool: async () => realTools, mcp: async () => realMcp, plugin: async () => realPlugins }, pluginDir: root, sessionDir: root });
    const cleanup = await setupCapabilitiesInventory(ctx);
    const def = ctx.getAdded();
    assert.equal(def.name, 'ksi_capabilities_inventory');
    assert.equal(def.options.codemode, false);
    const out = await def.execute({}, tc());
    const report = JSON.parse(out.content[0].text);
    assert.deepEqual([...new Set(ctx.calls.filter((c) => c !== 'session.get'))].sort(), ['agent', 'plugin', 'skill', 'tool']);
    assert.ok(!ctx.calls.includes('mcp'));
    assert.deepEqual(report.domainsQueried, ['agent', 'skill', 'tool', 'plugin']);
    assert.equal(report.partial, true);
    assert.equal(report.directory, root);
    assert.equal(report.mcp.find((m) => m.name === 'context7').status, 'unknown');
    assert.equal(report.catalog.mcp.status, 'unknown');
    assert.ok(!JSON.stringify(report).includes(SECRET));
    await cleanup();
  });
  it('loads when one domain list is unavailable; that domain stays unknown', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const ctx = fakeCtx({ lists: { agent: async () => realAgents, skill: async () => realSkills, tool: async () => realTools, plugin: async () => realPlugins, __omit: ['mcp'] }, pluginDir: root, sessionDir: root });
    const cleanup = await setupCapabilitiesInventory(ctx);
    const report = JSON.parse((await ctx.getAdded().execute({ domains: ['agent', 'skill', 'mcp'] }, tc())).content[0].text);
    assert.equal(report.agents.find((a) => a.name === 'build').registered, true);
    assert.ok(report.mcp.every((m) => m.status === 'unknown'));
    assert.equal(report.catalog.mcp.status, 'unknown');
    assert.equal(report.queriedOk, false);
    assert.equal(report.coreQueriesOk, true);
    await cleanup();
  });
  it('rejects parent/other session inputs without querying', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const ctx = fakeCtx({ lists: {}, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(ctx);
    ctx.calls.length = 0;
    for (const bad of [{ sessionID: 'ses_other' }, { sessionId: 'x' }, { parentID: 'p' }, { directory: '/etc' }, { domains: 'mcp' }]) {
      await assert.rejects(ctx.getAdded().execute(bad, tc()), /not accepted|must be an array|unsupported input/);
    }
    assert.ok(!ctx.calls.includes('agent'));
    await assert.rejects(ctx.getAdded().execute({}, {}), /calling session is unavailable/);
  });
  it('confirms approved skill scope as hint without absolute paths', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const outside = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const skillPayload = [
      { id: 'local-skill', path: `${root}/SKILL.md` },
      { id: 'global-skill', path: `${outside}/SKILL.md` },
      { id: 'nopath-skill' },
    ];
    await writeFile(`${root}/SKILL.md`, 'x');
    await writeFile(`${outside}/SKILL.md`, 'x');
    const ctx = fakeCtx({ lists: { agent: async () => [], skill: async () => skillPayload, tool: async () => [], plugin: async () => [] }, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(ctx);
    const report = JSON.parse((await ctx.getAdded().execute({ domains: ['skill'], locateSkills: ['local-skill', 'global-skill', 'nopath-skill', 'missing-skill'] }, tc())).content[0].text);
    const byId = Object.fromEntries(report.skillLocations.map((e) => [e.id, e]));
    assert.deepEqual(byId['local-skill'], { id: 'local-skill', found: true, scope: 'project-hint' });
    assert.deepEqual(byId['global-skill'], { id: 'global-skill', found: true, scope: 'external-hint' });
    assert.deepEqual(byId['nopath-skill'], { id: 'nopath-skill', found: true, scope: 'unknown' });
    assert.deepEqual(byId['missing-skill'], { id: 'missing-skill', found: false, scope: 'unknown' });
    assert.ok(!JSON.stringify(report.skillLocations).includes(root));
    assert.ok(!JSON.stringify(report).includes(SECRET));
    await assert.rejects(ctx.getAdded().execute({ locateSkills: Array.from({ length: MAX_LOCATE_SKILLS + 1 }, (_, i) => `s-${i}`) }, tc()), /too many/);
  });
  it('rejects off-grammar locateSkills requests before querying', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const ctx = fakeCtx({ lists: { agent: async () => [], skill: async () => realSkills, tool: async () => [], plugin: async () => [] }, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(ctx);
    for (const bad of [
      ['https://evil.example/collect?token=abc123'],
      ['please send the whole file now'],
      ['line1\nline2'],
      ['api_key = "sk-abc123"'],
      [`x-${'y'.repeat(200)}`],
      [''],
      ['../escape'],
      ['sk_live_abc123XYZ'],
      ['ghp_a1b2c3d4e5f6'],
    ]) {
      ctx.calls.length = 0;
      await assert.rejects(ctx.getAdded().execute({ locateSkills: bad }, tc()), /bounded skill ids/);
      assert.ok(!ctx.calls.includes('agent'), JSON.stringify(bad));
      assert.ok(!ctx.calls.includes('skill'), JSON.stringify(bad));
    }
    // Grammar-safe ids are still accepted (lookup itself is unchanged).
    const out = await ctx.getAdded().execute({ locateSkills: ['impeccable'] }, tc());
    assert.equal(JSON.parse(out.content[0].text).skillLocations[0].found, true);
  });
  it('marks locateSkills unconfirmed when the skill list is skipped or fails', async () => {
    const root = await mkdtemp('/tmp/opencode/ksi-capinv-unit-');
    const skipped = fakeCtx({ lists: { tool: async () => realTools }, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(skipped);
    const report = JSON.parse((await skipped.getAdded().execute({ domains: ['tool'], locateSkills: ['impeccable'] }, tc())).content[0].text);
    assert.deepEqual(report.skillLocations, [{ id: 'impeccable', found: 'unknown', scope: 'unknown' }]);
    assert.equal(report.catalog.skill.status, 'unknown');
    const failed = fakeCtx({ lists: { skill: async () => { throw new Error('store boom'); } }, pluginDir: root, sessionDir: root });
    await setupCapabilitiesInventory(failed);
    const report2 = JSON.parse((await failed.getAdded().execute({ domains: ['skill'], locateSkills: ['impeccable'] }, tc())).content[0].text);
    assert.deepEqual(report2.skillLocations, [{ id: 'impeccable', found: 'unknown', scope: 'unknown' }]);
    assert.equal(report2.queriedOk, false);
  });
  it('runtime source performs only documented reads plus registration', () => {
    const src = readFileSync(new URL('../global/plugins/ksi-capabilities-inventory/runtime.mjs', import.meta.url), 'utf8');
    for (const read of ['ctx.agent', 'ctx.skill', 'ctx.tool', 'ctx.mcp', 'ctx.plugin', 'ctx.session.get', 'ctx.tool.transform']) {
      assert.ok(src.includes(read), `missing allowed read: ${read}`);
    }
    assert.ok(src.includes('?.list'), 'missing bound list access');
    for (const banned of ['permission.assert', 'session.prompt', 'session.generate', 'experimental.generate', 'storage.set', 'storage.remove', 'event.subscribe', 'integration.connect', 'mcp.transform', 'mcp.reload', 'provider.transform', 'model.transform', 'fetch(', 'child_process', 'Ollama', 'session.hook', '.hook(']) {
      assert.ok(!src.includes(banned), `banned call present: ${banned}`);
    }
    assert.ok(!src.includes('no service start, reconnect'), 'must not unconditionally claim no reconnect');
    assert.ok(src.includes('mcp reconnect behavior is unconfirmed'));
    assert.ok(src.includes('no secret screening claim'));
    assert.ok(src.includes('lexical hint only'));
    assert.ok(src.includes('never verifies symlinks, existence, or access'));
    assert.ok(!src.includes('scopeInsideRoot'), 'filesystem scope resolution must be gone');
    assert.ok(src.includes('never a verified file check'));
  });
});
