// Source-contract guards for the five-profile Native migration (source only).
// These do not test model judgment or rendered UX. Sources are the active
// Lead prompt, the common AGENTS contract, Native config edges and the MERGED
// main spec — never the removed specialist prompts and
// never equality with a partial delta or the frozen old change.
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const shared = read('global/AGENTS.md');
const lead = read('global/agents/lead.md');

const strippedJsonc = () => read('global/opencode.jsonc')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');

describe('five-profile common contract (source only)', () => {
  it('centers on goal, evidence, autonomy, responsibility and boundaries', () => {
    for (const principle of ['**Goal.**', '**Evidence.**', '**Autonomy.**', '**Responsibility.**', '**Boundaries.**']) {
      assert.ok(shared.includes(principle), `missing principle ${principle}`);
    }
    assert.match(shared, /Separate binding contracts from revisable assumptions/);
    assert.match(shared, /not only the author's edit list/);
    assert.match(shared, /not an automatic fallback framework/);
    assert.match(shared, /Respect each provider's training, retention and region policy/);
  });

  it('routes by assignment with no mandatory Lead stage and no forced skill machinery', () => {
    assert.match(shared, /no mandatory Lead routing by complexity, file count or domain/);
    assert.match(shared, /Direct implementation or direct General use stays permitted/);
    assert.match(shared, /not only tiny\/single-file\/UI-free/);
    assert.match(shared, /checks Lead outputs rather than managing every General worker/);
    assert.match(shared, /coherent workstream assignment/);
    assert.match(shared, /No mandated skill-load stages, mandatory lenses or sequences/);
    assert.match(shared, /role-owned CSS authorship/);
    assert.match(shared, /single-file-only limits/);
    assert.match(shared, /model choice does not transfer ownership/);
  });

  it('keeps independent review optional with enforced non-mutation limits', () => {
    assert.match(shared, /never a default stage, pass-gate or mandatory question/);
    assert.match(shared, /`No issue found` is valid/);
    assert.match(shared, /an edit-deny alone stops no shell\/browser\/network effect/);
    assert.match(shared, /role allows are not OS sandboxes/);
  });

  it('runs Plan as a deliberate consultation exception, never a gate', () => {
    assert.match(shared, /deliberate consultation exception/);
    assert.match(shared, /user-selectable or optional Build\/Lead advisory call/);
    assert.match(shared, /never an approver\/mandater\/vetoer of independent verification/);
    assert.match(shared, /no forced stage or approval gate/);
  });

  it('protects other workers, shared state and approval boundaries', () => {
    assert.match(shared, /Protect others' work and shared state/);
    assert.match(shared, /never discard another worker's changes/);
    assert.match(shared, /production services, credentials, or unapproved hardware\/session state without authorization/);
    assert.match(shared, /never bypass permission or analysis-only limits via alternate tools or delegation/);
  });
});

describe('lead prompt role-boundary semantics (source only)', () => {
  it('states short whole-task ownership without merged method prescriptions', () => {
    assert.match(lead, /whole-task owner under Build/);
    assert.match(lead, /from research\/UX\/design through implementation,\s*tests, recovery and completion/);
    assert.match(lead, /zero\/one\/several General workers/);
    assert.match(lead, /reuse the same session for follow-ups on that\s*task/);
    assert.match(lead, /remain accountable for the actual result/);
    assert.match(lead, /Required verification always applies/);
    assert.match(lead, /Choose an independent check only for\s*a useful specific question/);
    assert.doesNotMatch(lead, /Stage A|Stage B|mandatory loop|CSS|adopt\/adapt\/reject/);
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
      assert.ok(rules.some((r) => r.action === 'subagent' && r.resource === '*' && r.effect === 'deny'), `${id} stays a leaf`);
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
