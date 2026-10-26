// capabilities.test.mjs — injected/mock API tests only (no CLI/network/spawn).
// Run: `node --test tests/capabilities.test.mjs` from the repository root.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { writeSync, readFileSync, promises as tfsp } from 'node:fs';
import {
  TRACKED_AGENTS,
  TRACKED_SKILLS,
  TRACKED_MCP,
  TRACKED_BINARIES,
  QUERY_MAX_BUFFER,
  routeFor,
  validPayload,
  projectAgents,
  projectSkills,
  projectMcp,
  queryApi,
  buildReport,
  collectCapabilities,
} from '../scripts/capabilities.mjs';

const SECRET = 'sk-secret-xyz';
// Canonical Native shapes: agent/skill keyed by `id`; `name` is a display label.
const realAgents = [
  { id: 'build', name: 'Build Agent', mode: 'primary', apiKey: SECRET },
  { id: 'plan', name: 'Plan', mode: 'all' },
];
const realSkills = [
  { id: 'impeccable', name: 'Impeccable', config: { token: SECRET } },
  { id: 'wireframe', name: 'Wireframe' },
];
const realMcp = [{ name: 'context7', status: { status: 'connected' }, headers: { auth: SECRET } }];

describe('tracked role inventory', () => {
  it('tracks 5 operating roles in exact order build,plan,lead,general,explore', () => {
    assert.deepEqual(TRACKED_AGENTS, ['build', 'plan', 'lead', 'general', 'explore']);
  });
  it('tracks all 17 harness-wired skills (core, external gap 6, trial 2, opencode)', () => {
    assert.deepEqual(TRACKED_SKILLS, [
      'impeccable', 'journey', 'organize', 'wireframe',
      'vercel-react-best-practices', 'playwright-cli', 'emilkowalski-motion', 'mobbin-design',
      'opencode',
      'designing-user-experience', 'building-accessible-interfaces', 'evolving-apis-and-schemas',
      'investigating-performance', 'reviewing-security', 'ux-heuristics-audit',
      'diagnosing-bugs', 'ux-copy',
    ]);
  });
  it('exposes lead registration; unregistered lead is false absence, not unknown', () => {
    const withLead = projectAgents([
      { id: 'build', name: 'Build', mode: 'primary' },
      { id: 'lead', name: 'Lead', mode: 'subagent', extra: SECRET },
    ]);
    assert.equal(withLead.find((a) => a.name === 'lead').registered, true);
    assert.equal(withLead.find((a) => a.name === 'lead').mode, 'subagent');
    assert.equal(withLead.find((a) => a.name === 'general').registered, false);
    assert.ok(!JSON.stringify(withLead).includes(SECRET));
    const withoutLead = projectAgents([]);
    assert.equal(withoutLead.find((a) => a.name === 'lead').registered, false);
    assert.equal(withoutLead.find((a) => a.name === 'lead').mode, 'unknown');
    assert.ok(!JSON.stringify(withoutLead).match(/apiKey|headers|config|stdout|stderr|url|prompt/i));
  });
  it('exposes plan/general/explore registration; unregistered roles are false absence, not unknown', () => {
    const withNew = projectAgents([
      { id: 'build', name: 'Build', mode: 'primary' },
      { id: 'plan', name: 'Plan', mode: 'all', apiKey: SECRET },
      { id: 'general', name: 'General', mode: 'subagent' },
      { id: 'explore', name: 'Explore', mode: 'subagent', headers: { auth: SECRET } },
    ]);
    assert.equal(withNew.find((a) => a.name === 'plan').registered, true);
    assert.equal(withNew.find((a) => a.name === 'plan').mode, 'all');
    assert.equal(withNew.find((a) => a.name === 'general').registered, true);
    assert.equal(withNew.find((a) => a.name === 'general').mode, 'subagent');
    assert.equal(withNew.find((a) => a.name === 'explore').registered, true);
    assert.equal(withNew.find((a) => a.name === 'explore').mode, 'subagent');
    assert.equal(withNew.find((a) => a.name === 'lead').registered, false);
    assert.ok(!JSON.stringify(withNew).includes(SECRET));
    const withoutNew = projectAgents([]);
    for (const n of ['plan', 'general', 'explore']) {
      assert.equal(withoutNew.find((a) => a.name === n).registered, false);
      assert.equal(withoutNew.find((a) => a.name === n).mode, 'unknown');
    }
    assert.ok(!JSON.stringify(withoutNew).match(/apiKey|headers|config|stdout|stderr|url|prompt/i));
  });
  it('retired/superseded native ids are not tracked and never project as registered', () => {
    // engineer/design/research/critic sources are retained byte-identical but
    // Native-disabled out of default operations (Main owns suppression proof);
    // architect.md stays an archived non-operational file. None of these ids
    // may be tracked or projected as registered operating roles.
    for (const retired of ['engineer', 'design', 'research', 'critic', 'architect', 'design-specialist', 'design-architect', 'ux-scout', 'ui-ux-critic', 'product-reviewer']) {
      assert.ok(!TRACKED_AGENTS.includes(retired), `${retired} must not be tracked`);
    }
    const mocked = projectAgents([
      { id: 'engineer', name: 'Engineer', mode: 'subagent' },
      { id: 'design', name: 'Design', mode: 'all' },
      { id: 'research', name: 'Research', mode: 'subagent' },
      { id: 'critic', name: 'Critic', mode: 'subagent' },
      { id: 'architect', name: 'Architect', mode: 'subagent' },
      { id: 'ux-scout', name: 'UX Scout', mode: 'subagent' },
      { id: 'ui-ux-critic', name: 'UI UX Critic', mode: 'subagent' },
      { id: 'design-architect', name: 'Design Architect', mode: 'all' },
      { id: 'product-reviewer', name: 'Product Reviewer', mode: 'subagent' },
      { id: 'design-specialist', name: 'Design Specialist', mode: 'all' },
    ]);
    assert.ok(mocked.every((a) => a.registered === false));
    assert.ok(!mocked.some((a) => ['engineer', 'design', 'research', 'critic', 'architect', 'ux-scout', 'ui-ux-critic', 'design-architect', 'product-reviewer', 'design-specialist'].includes(a.name)));
  });
  it('tracks 5 roles in projections and mocks without secret exposure', () => {
    assert.equal(projectAgents([]).length, 5);
    assert.equal(projectAgents([]).find((a) => a.name === 'lead').registered, false);
    const mocked = projectAgents([
      { id: 'lead', name: 'Lead', mode: 'subagent', headers: { auth: SECRET } },
    ]);
    assert.equal(mocked.find((a) => a.name === 'lead').registered, true);
    assert.ok(!JSON.stringify(mocked).includes(SECRET));
  });
});

describe('canonical id shapes', () => {
  it('matches agent/skill by id when display name differs', () => {
    const agents = projectAgents(realAgents);
    assert.equal(agents.find((a) => a.name === 'build').registered, true);
    assert.equal(agents.find((a) => a.name === 'build').mode, 'primary');
    const skills = projectSkills({ data: realSkills });
    assert.equal(skills.find((s) => s.name === 'impeccable').registered, true);
    assert.ok(!JSON.stringify({ agents, skills }).includes(SECRET));
  });
  it('matches by id only; name-only entries are unknown shape', () => {
    const agents = projectAgents([{ id: 'general', name: 'build', mode: 'subagent' }]);
    assert.equal(agents.find((a) => a.name === 'general').registered, true);
    assert.equal(agents.find((a) => a.name === 'general').mode, 'subagent');
    assert.equal(agents.find((a) => a.name === 'build').registered, false);
    assert.ok(projectAgents([{ name: 'explore', mode: 'primary' }]).every((a) => a.registered === 'unknown'));
    assert.ok(projectSkills([{ name: 'impeccable' }]).every((s) => s.registered === 'unknown'));
  });
  it('mcp matches by name with connected status', () => {
    const mcp = projectMcp(realMcp);
    assert.equal(mcp.find((m) => m.name === 'context7').status, 'connected');
    assert.equal(mcp.find((m) => m.name === 'mobbin').status, 'unavailable');
    assert.ok(!JSON.stringify(mcp).includes(SECRET));
  });
  it('allows only primary/subagent/all modes; arbitrary strings become unknown', () => {
    const agents = projectAgents([{ id: 'build', name: 'Build', mode: SECRET }]);
    assert.equal(agents.find((a) => a.name === 'build').mode, 'unknown');
    assert.ok(!JSON.stringify(agents).includes(SECRET));
    assert.ok(!JSON.stringify(agents).match(/apiKey|headers|config|stdout|stderr|url|prompt/i));
  });
});

describe('fail-closed projections', () => {
  it('unexpected top-level shapes yield unknown labels', () => {
    for (const bad of [{ nope: 1 }, { data: 'x' }, 'string', 42, null, undefined]) {
      assert.ok(projectAgents(bad).every((a) => a.registered === 'unknown' && a.mode === 'unknown'));
      assert.ok(projectSkills(bad).every((s) => s.registered === 'unknown'));
      assert.ok(projectMcp(bad).every((m) => m.status === 'unknown'));
      assert.equal(validPayload(bad, 'agent'), false);
    }
  });
  it('malformed entries yield unknown, never false absence', () => {
    for (const bad of [[{ id: 'impeccable' }, 42], ['x'], [null], [{ id: 123 }], [{ name: 'context7', status: 'connected' }]]) {
      const kind = Array.isArray(bad) && typeof bad[0] === 'object' && bad[0] !== null && 'status' in bad[0] ? 'mcp' : 'skill';
      assert.equal(validPayload(bad, kind), false, JSON.stringify(Object.keys(bad[0] ?? {})));
    }
    assert.ok(projectSkills([{ id: 'impeccable' }, 42]).every((s) => s.registered === 'unknown'));
    assert.ok(projectMcp([{ name: 'context7', status: 'connected' }]).every((m) => m.status === 'unknown'));
  });
  it('empty objects fail closed, never false absence', () => {
    assert.equal(validPayload([{}], 'agent'), false);
    assert.equal(validPayload([{}], 'skill'), false);
    assert.equal(validPayload([{}], 'mcp'), false);
    assert.ok(projectAgents([{}]).every((a) => a.registered === 'unknown'));
  });
  it('empty well-shaped [] is valid absence, not unknown', () => {
    assert.equal(validPayload([], 'agent'), true);
    assert.ok(projectAgents([]).every((a) => a.registered === false));
    assert.ok(projectSkills([]).every((s) => s.registered === false));
    assert.ok(projectMcp([]).every((m) => m.status === 'unavailable'));
  });
  it('builds routes with location[directory] via URLSearchParams', () => {
    const r = routeFor('/api/agent', '/tmp/x');
    const u = new URL(r, 'http://localhost');
    assert.equal(u.pathname, '/api/agent');
    assert.equal(u.searchParams.get('location[directory]'), '/tmp/x');
  });
});

describe('collectCapabilities with injected query', () => {
  const okQuery = (routes = []) => async (route) => {
    routes.push(route);
    if (route.startsWith('/api/agent')) return { ok: true, payload: realAgents };
    if (route.startsWith('/api/skill')) return { ok: true, payload: realSkills };
    return { ok: true, payload: realMcp };
  };
  it('runs 3 parallel independent queries, no retries/loops', async () => {
    const routes = [];
    const { report, exitCode } = await collectCapabilities({
      query: okQuery(routes), checkPath: async () => true,
    });
    assert.equal(exitCode, 0);
    assert.equal(routes.length, 3);
    assert.equal(new Set(routes).size, 3);
    assert.ok(report.coreQueriesOk);
    for (const n of TRACKED_BINARIES) assert.equal(report.cli[n].present, true);
    assert.ok(!JSON.stringify(report).includes(SECRET));
  });
  it('schema drift (ok but malformed) is core-nonzero', async () => {
    const { report, exitCode } = await collectCapabilities({
      query: async (route) => (route.startsWith('/api/agent')
        ? { ok: true, payload: { version: 2, agents: realAgents } }
        : { ok: true, payload: [] }),
      checkPath: async () => false,
    });
    assert.equal(exitCode, 1);
    assert.equal(report.coreQueriesOk, false);
    assert.ok(report.agents.every((a) => a.registered === 'unknown'));
  });
  it('rejected query/checkPath cannot leak raw errors', async () => {
    const boom = async () => { throw new Error(`raw-boom-${SECRET}`); };
    const failed = await collectCapabilities({ query: boom, checkPath: boom });
    assert.equal(failed.exitCode, 1);
    assert.ok(failed.report.agents.every((a) => a.registered === 'unknown'));
    assert.ok(Object.values(failed.report.cli).every((c) => c.present === 'unknown'));
    assert.ok(!JSON.stringify(failed).match(/raw-boom|ENOENT|Error|stderr|stdout/i));
    assert.ok(!JSON.stringify(failed).includes(SECRET));
  });
  it('explicit invalid directory makes no queries and stays nonzero', async () => {
    let calls = 0;
    const missing = path.join(os.tmpdir(), `ksi-cap-missing-${process.pid}`);
    const { report, exitCode } = await collectCapabilities({
      directory: missing,
      query: async () => { calls += 1; return { ok: true, payload: [] }; },
      checkPath: async () => { calls += 1; return true; },
    });
    assert.equal(calls, 0);
    assert.equal(exitCode, 1);
    assert.equal(report.directory, 'unavailable');
    assert.equal(report.directoryStatus, 'directoryUnavailable');
    assert.equal(report.coreQueriesOk, false);
    assert.ok(!JSON.stringify(report).includes('ksi-cap-missing'));
  });
  it('mcp-only failure stays informational with exit 0', async () => {
    const { report, exitCode } = await collectCapabilities({
      query: async (route) => (route.startsWith('/api/mcp')
        ? { ok: false } : { ok: true, payload: route.startsWith('/api/agent') ? realAgents : realSkills }),
      checkPath: async () => 'unknown',
    });
    assert.equal(exitCode, 0);
    assert.equal(report.mcp.find((m) => m.name === 'context7').status, 'unknown');
  });
  it('fixed tracked roles/skills always present; presence never claims the tool works', () => {
    const r = buildReport({
      directory: '/tmp', agentResult: { ok: true, payload: [] },
      skillResult: { ok: true, payload: [] }, mcpResult: { ok: true, payload: [] },
      binaries: { node: true, 'playwright-cli': false, gh: 'weird' },
    });
    assert.deepEqual(r.agents.map((a) => a.name), TRACKED_AGENTS);
    assert.deepEqual(r.skills.map((s) => s.name), TRACKED_SKILLS);
    assert.deepEqual(r.mcp.map((m) => m.name), TRACKED_MCP);
    assert.equal(r.cli.gh.present, 'unknown');
    assert.ok(!JSON.stringify(r).match(/works|healthy|version/i));
    assert.ok(r.notice.includes('Read-only'));
  });
});

describe('file transport (injected runner, no CLI/network)', () => {
  async function capDirs() {
    const out = [];
    for (const base of [path.join('/tmp', 'opencode'), os.tmpdir()]) {
      try {
        for (const e of await tfsp.readdir(base)) if (e.startsWith('ksi-cap-')) out.push(path.join(base, e));
      } catch { /* base may not exist */ }
    }
    return out.sort();
  }
  it('parses complete JSON from the temp file', async () => {
    const r = await queryApi('/api/skill', async (fd) => { writeSync(fd, JSON.stringify(realSkills)); return { ok: true }; });
    assert.equal(r.ok, true);
    assert.deepEqual(r.payload, realSkills);
  });
  it('truncated, empty, and invalid JSON fail fixed with no leak', async () => {
    for (const body of ['[{"id":"impeccable","name":"Impe', '', 'not json']) {
      const r = await queryApi('/api/skill', async (fd) => { writeSync(fd, `${body}${SECRET}`); return { ok: true }; });
      assert.deepEqual(r, { ok: false });
      assert.ok(!JSON.stringify(r).includes(SECRET));
    }
  });
  it('oversize responses, command failure, and runner throws fail closed', async () => {
    const big = await queryApi('/api/skill', async (fd) => { writeSync(fd, Buffer.alloc(QUERY_MAX_BUFFER + 1, 91)); return { ok: true }; });
    assert.deepEqual(big, { ok: false });
    const failed = await queryApi('/api/skill', async (fd) => { writeSync(fd, '[]'); return { ok: false }; });
    assert.deepEqual(failed, { ok: false });
    const threw = await queryApi('/api/skill', async () => { throw new Error(`raw-boom-${SECRET}`); });
    assert.deepEqual(threw, { ok: false });
    assert.ok(!JSON.stringify(threw).includes(SECRET));
  });
  it('removes only its own temp file and dir', async () => {
    const before = await capDirs();
    await queryApi('/api/skill', async (fd) => { writeSync(fd, '[]'); return { ok: true }; });
    await queryApi('/api/skill', async () => ({ ok: false }));
    await queryApi('/api/skill', async () => { throw new Error('x'); });
    assert.deepEqual(await capDirs(), before);
  });
  it('collects end-to-end through file transport', async () => {
    const bodyFor = (route) => (route.startsWith('/api/agent') ? realAgents : route.startsWith('/api/skill') ? realSkills : realMcp);
    const { report, exitCode } = await collectCapabilities({
      query: (route) => queryApi(route, async (fd) => { writeSync(fd, JSON.stringify(bodyFor(route))); return { ok: true }; }),
      checkPath: async () => true,
    });
    assert.equal(exitCode, 0);
    assert.equal(report.coreQueriesOk, true);
    assert.equal(report.skills.find((s) => s.name === 'impeccable').registered, true);
    assert.ok(!JSON.stringify(report).includes(SECRET));
  });
});

describe('mcp servers canonical V2 source', () => {
  // Same JSONC comment-stripping idiom as tests/compaction-continuity.test.mjs:
  // only actual server fields are inspected as parsed objects, never prose
  // word-bans, and no secret values are read or asserted.
  const mcpBlock = () => {
    const stripped = readFileSync(new URL('../global/opencode.jsonc', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
    return JSON.parse(stripped).mcp;
  };
  it('nests the two approved remote servers under mcp.servers', () => {
    const mcp = mcpBlock();
    assert.ok(mcp && typeof mcp === 'object');
    assert.ok(!('mobbin' in mcp));
    assert.ok(!('context7' in mcp));
    const servers = mcp.servers;
    assert.deepEqual(Object.keys(servers).sort(), ['context7', 'mobbin']);
    assert.equal(servers.mobbin.type, 'remote');
    assert.equal(servers.mobbin.url, 'https://api.mobbin.com/mcp');
    assert.equal(servers.context7.type, 'remote');
    assert.equal(servers.context7.url, 'https://mcp.context7.com/mcp');
  });
  it('keeps auth separation with defaults omitted and no secrets', () => {
    const servers = mcpBlock().servers;
    assert.deepEqual(servers.context7.headers, { CONTEXT7_API_KEY: '{env:CONTEXT7_API_KEY}' });
    assert.equal(servers.context7.oauth, false);
    assert.ok(!('oauth' in servers.mobbin));
    assert.ok(!('headers' in servers.mobbin));
    for (const server of Object.values(servers)) {
      assert.ok(!('enabled' in server));
      assert.ok(!('timeout' in server));
      assert.ok(!('disabled' in server));
    }
    assert.ok(!JSON.stringify(servers).match(/sk-[A-Za-z0-9]|Bearer [A-Za-z0-9]/));
  });
});
