// Structural guards for runtime instructions and active role/tool configuration.
// Natural-language wording is deliberately not a test contract;
// Native execution tests cover permissions and delegation, not model judgment.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const shared = read('global/AGENTS.md');
const lead = read('global/agents/lead.md');

const strippedJsonc = () => read('global/opencode.jsonc')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');

describe('runtime instruction structure (not prose or quality assertions)', () => {
  it('keeps a non-empty common instruction source', () => {
    assert.ok(shared.trim().length > 0);
  });

  it('preserves Native system prompts for all four builtins', () => {
    const cfg = JSON.parse(strippedJsonc());
    for (const id of ['build', 'plan', 'general', 'explore']) {
      assert.equal(cfg.agents[id].system, undefined, `${id} uses its Native system`);
    }
  });

  it('does not eagerly inject project documents through global instructions', () => {
    const cfg = JSON.parse(strippedJsonc());
    assert.deepEqual(cfg.instructions ?? [], []);
  });
});

describe('lead instruction structure (source only)', () => {
  it('keeps frontmatter, a dispatch description and a non-empty system body', () => {
    const parts = lead.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    assert.ok(parts, 'Lead must remain a Native Markdown agent');
    assert.match(parts[1], /^description:\s*\S/m);
    assert.ok(parts[2].trim().length > 0);
  });

  it('keeps the Lead model and child edges Native-shaped', () => {
    assert.match(lead, /^model: opencode-go\/muse-spark-1\.3-contributor#xhigh$/m);
    assert.match(lead, /^mode: subagent$/m);
    for (const target of ['plan', 'general', 'explore']) {
      assert.match(lead, new RegExp(`- action: subagent\\s*\\n\\s*resource: ${target}\\s*\\n\\s*effect: allow`));
    }
    assert.doesNotMatch(lead, /resource: (engineer|design|research|critic)\s*\n\s*effect: allow/);
  });
});

describe('native config edges for five profiles (source only)', () => {
  it('gives Build only Lead/General/Explore/Plan child edges', () => {
    const cfg = JSON.parse(strippedJsonc());
    const allows = (cfg.agents.build.permissions ?? [])
      .filter((r) => r.action === 'subagent' && r.effect === 'allow')
      .map((r) => r.resource)
      .sort();
    assert.deepEqual(allows, ['explore', 'general', 'lead', 'plan']);
    assert.equal(cfg.agents.build.mode ?? 'primary', 'primary');
    assert.ok(cfg.agents.build.model === undefined);
  });

  it('keeps Plan analysis-only with Native permissions (no custom allowlist)', () => {
    const cfg = JSON.parse(strippedJsonc());
    assert.equal(cfg.agents.plan.mode, 'all');
    assert.equal(cfg.agents.plan.model, 'openai/gpt-6.1-sol#high');
    assert.ok(cfg.agents.plan.system === undefined);
    // No custom system or permission allowlist: the Native prompt and Native
    // permissions apply; only mode `all` (deliberate consultation exception)
    // and the model preference are configured. Native analysis delegation to
    // General/Explore and the Native edit deny are proven live in the isolated
    // fixture, never by static allows here.
    assert.ok(cfg.agents.plan.permissions === undefined);
  });

  it('restores General/Explore Native breadth with no KSI skill whitelist', () => {
    const cfg = JSON.parse(strippedJsonc());
    for (const id of ['general', 'explore']) {
      const rules = cfg.agents[id].permissions ?? [];
      // The builtin leaf deny need not be duplicated in source. Its effective
      // policy and removed tool surface are tested by Native execution.
      assert.ok(!rules.some((r) => r.action === 'subagent' && r.effect === 'allow'), `${id} adds no child allows`);
      assert.ok(!rules.some((r) => r.action === 'skill'), `${id} declares no skill rules`);
    }
    assert.equal(cfg.agents.general.model, 'opencode-go/muse-spark-1.3-contributor#high');
    assert.equal(cfg.agents.explore.model, 'opencode-go/muse-spark-1.3-contributor#medium');
    assert.ok(cfg.agents.explore.steps === undefined);
    assert.equal(cfg.experimental.subagent_depth, 3);
  });

  it('removes (never hides or tombstones) the four superseded specialists', () => {
    const cfg = JSON.parse(strippedJsonc());
    for (const id of ['engineer', 'design', 'research', 'critic']) {
      assert.ok(!(id in (cfg.agents ?? {})), `${id} has no operating definition`);
      assert.equal(existsSync(new URL(`../global/agents/${id}.md`, import.meta.url)), false, `${id}.md removed from source`);
    }
    assert.ok(!('architect' in (cfg.agents ?? {})));
  });
});

describe('installed-check asynchronous reporting', () => {
  const source = read('tests/agent-routing-native.mjs');
  const helper = source.match(/async function checkAsync\([^]*?\n}/)?.[0];

  it('reports success only after the asynchronous assertion settles', () => {
    assert.ok(helper);
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      let checks = 0;
      ${helper}
      let settled = false;
      await checkAsync('awaited', async () => { await Promise.resolve(); settled = true; });
      if (!settled || checks !== 1) process.exit(2);
    `], { encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), 'PASS awaited');
  });

  it('an asynchronous failure exits nonzero without printing PASS', () => {
    assert.ok(helper);
    const run = spawnSync(process.execPath, ['--input-type=module', '--eval', `
      let checks = 0;
      ${helper}
      await checkAsync('must fail', async () => { await Promise.resolve(); throw new Error('expected failure'); });
    `], { encoding: 'utf8' });
    assert.notEqual(run.status, 0);
    assert.doesNotMatch(run.stdout, /PASS/);
    assert.match(run.stderr, /expected failure/);
  });
});

describe('framework-free active discovery (not archived prose)', () => {
  it('has no active OpenSpec project root', () => {
    assert.equal(existsSync(new URL('../openspec', import.meta.url)), false);
  });

  it('has no generated opsx command files or configured commands', () => {
    const dir = new URL('../.opencode/commands', import.meta.url);
    const names = existsSync(dir) ? readdirSync(dir) : [];
    assert.deepEqual(names.filter((name) => name.startsWith('opsx-')), []);
    const cfg = JSON.parse(strippedJsonc());
    assert.deepEqual(Object.keys(cfg.commands ?? {}).filter((name) => name.startsWith('opsx-')), []);
  });

  it('has no generated OpenSpec skills in project discovery', () => {
    const dir = new URL('../.opencode/skills', import.meta.url);
    const names = existsSync(dir) ? readdirSync(dir) : [];
    assert.deepEqual(names.filter((name) => name.startsWith('openspec-')), []);
  });
});
