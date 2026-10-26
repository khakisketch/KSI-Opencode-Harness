// Structural guards for runtime instructions, role configuration and the merged
// specification. Natural-language wording is deliberately not a test contract;
// Native execution tests cover permissions and delegation, not model judgment.
import { readFileSync, existsSync } from 'node:fs';
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
    assert.equal(cfg.agents.plan.model, 'opencode-go/muse-spark-1.3-contributor#xhigh');
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

describe('merged main spec coherence (source only)', () => {
  const main = read('openspec/specs/engineer-workflow/spec.md');
  const newDelta = read('openspec/changes/task-completion-native-lead/specs/engineer-workflow/spec.md');
  const oldDelta = read('openspec/changes/engineer-unit-openspec-skills/specs/engineer-workflow/spec.md');

  it('carries the merged contract under one Requirements section', () => {
    assert.ok(!main.includes('## ADDED Requirements'));
    assert.ok(!main.includes('## MODIFIED Requirements'));
    assert.ok(main.includes('## Requirements'));
    // Three added requirements landed.
    for (const name of [
      '### Requirement: Five operating profiles and Native autonomy',
      '### Requirement: Result verification with OPTIONAL independent checks and enforced boundaries',
      '### Requirement: Retired operating profile removal and backup',
    ]) {
      assert.ok(main.includes(name), `missing ${name}`);
    }
    // Seven modified requirements took the delta content, not the old text.
    for (const marker of [
      'no mandatory Lead routing by complexity/file-count/domain',
      'zero/one/several General workers',
      'mode `all` as a deliberate consultation exception',
      'OPTIONAL fresh-General check',
      'short whole-workflow responsibility',
    ]) {
      assert.ok(main.includes(marker), `missing modified marker: ${marker}`);
    }
    assert.ok(!main.includes('the Engineer unit owns it end-to-end within its assignment'));
    assert.ok(!main.includes('the Design unit owns it, not Engineer'));
  });

  it('preserves the six untouched requirement blocks', () => {
    // Canonical workflow, staged-skills, architect-retention, model-caveat,
    // Native context and Native MCP requirements stay preserved via merge.
    for (const [header, marker] of [
      ['### Requirement: Canonical OpenSpec workflow usage', 'baseline 1.15.0'],
      ['### Requirement: Staged-skills compatibility', 'the osmontero'],
      ['### Requirement: Architect file retention', 'docs/archive/agents/architect.md'],
      ['### Requirement: No unverified model requirements', 'remains advisory prose until quality-verified'],
      ['### Requirement: Native context policy', 'no top-level `compaction`'],
      ['### Requirement: Native MCP server configuration', 'mcp.servers'],
    ]) {
      assert.ok(main.includes(header), `missing ${header}`);
      assert.ok(main.includes(marker), `missing frozen marker: ${marker}`);
    }
    const headers = [...main.matchAll(/^### Requirement: (.+)$/gm)].map((m) => m[1]);
    assert.equal(headers.length, 16);
    assert.equal(new Set(headers).size, 16);
  });

  it('never equates the merged spec with a partial delta or the old change', () => {
    assert.notEqual(main, newDelta.replace('# Spec Delta', '# Engineer-Workflow Specification'));
    assert.notEqual(main, oldDelta.replace('## ADDED Requirements', '## Requirements'));
    // The old change stays frozen on its own baseline: its 8-role routing
    // text lives only there, never in the merged main spec.
    assert.ok(oldDelta.includes('the Engineer unit owns it end-to-end within its assignment'));
    assert.ok(oldDelta.includes('the Design unit owns it, not Engineer'));
  });

  it('does not close the four empirical verification tasks', () => {
    const tasks = read('openspec/changes/engineer-unit-openspec-skills/tasks.md');
    for (const id of ['5.1', '5.2', '5.4', '5.5']) {
      assert.ok(tasks.includes(`- [ ] ${id} `), `${id} still needs real-task evidence`);
    }
  });
});
