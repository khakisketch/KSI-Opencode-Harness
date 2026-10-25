// Source-contract guards only: these do not test model judgment or rendered UX.
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const shared = read('global/AGENTS.md');
const design = read('global/agents/design.md');
const critic = read('global/agents/critic.md');

describe('minimal prompt boundary correction (source only)', () => {
  it('keeps binding contracts distinct from inherited layout assumptions', () => {
    assert.match(shared, /confirmed constraints versus revisable assumptions \(including inherited layouts\)/);
    assert.match(shared, /not only the author's edit list/);
    assert.match(design, /earlier agent brief as a contract/);
    assert.match(critic, /original goal and protected\s+contracts/);
  });

  it('preserves help, required disclosure and decision-critical status', () => {
    assert.match(shared, /preserve useful help and required provenance/);
    assert.match(design, /simulation\/prototype disclosure/);
    assert.match(critic, /useful help or required prototype\/provenance\/simulation/);
    assert.doesNotMatch(design + critic, /prose explaining where UI controls are|zero meta-pollution/);
  });

  it('preserves legitimate managed focus instead of banning heading outlines', () => {
    assert.match(design, /visible keyboard focus, including headings/);
    assert.match(critic, /lost\/invisible keyboard focus/);
    assert.doesNotMatch(design + critic, /raw (?:browser )?focus outlines/);
    assert.match(design, /Touch-target size does not dictate read-only row height/);
  });

  it('prevents silent asset/time/source substitution during recovery', () => {
    assert.match(shared, /preserving selected asset\/time\/source identity/);
    assert.match(design, /silent switch\s+to another asset, time or source/);
    assert.match(design, /explicit choices\s+under the product contract/);
  });

  it('keeps main and delta specifications coherent', () => {
    const main = read('openspec/specs/engineer-workflow/spec.md');
    const delta = read('openspec/changes/engineer-unit-openspec-skills/specs/engineer-workflow/spec.md');
    assert.equal(main, delta.replace('## ADDED Requirements', '## Requirements'));
  });

  it('does not close the four empirical verification tasks', () => {
    const tasks = read('openspec/changes/engineer-unit-openspec-skills/tasks.md');
    for (const id of ['5.1', '5.2', '5.4', '5.5']) {
      assert.ok(tasks.includes(`- [ ] ${id} `), `${id} still needs real-task evidence`);
    }
  });
});
