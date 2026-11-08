import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = path.join(REPO, 'global', 'opencode.jsonc');
const INSTALLED = path.join(homedir(), '.config', 'opencode', 'opencode.jsonc');

// Line-start // comments only; URLs inside strings stay intact.
function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
}

function readJsonc(file) {
  return JSON.parse(stripJsonc(readFileSync(file, 'utf8')));
}

function subagentPolicy(agent) {
  return (agent?.permissions ?? [])
    .filter((rule) => rule.action === 'subagent')
    .map((rule) => `${rule.effect}:${rule.resource}`)
    .sort();
}

const skip = existsSync(INSTALLED) ? false : 'installed config absent; CI checks the portable source only';

test('installed Plan description and depth mirror the portable source', { skip }, () => {
  const source = readJsonc(SOURCE);
  const installed = readJsonc(INSTALLED);

  assert.equal(installed.agents?.plan?.description, source.agents?.plan?.description);
  assert.equal(installed.agents?.plan?.mode, source.agents?.plan?.mode);
  assert.equal(installed.experimental?.subagent_depth, source.experimental?.subagent_depth);
});

test('installed subagent policy matches the portable single-edge contract', { skip }, () => {
  const source = readJsonc(SOURCE);
  const installed = readJsonc(INSTALLED);

  for (const id of ['build', 'plan', 'general', 'explore']) {
    assert.deepEqual(
      subagentPolicy(installed.agents?.[id]),
      subagentPolicy(source.agents?.[id]),
      `${id} subagent policy drifted; machine-local model pins and non-subagent tool denies are allowed`,
    );
  }

  assert.deepEqual(subagentPolicy(installed.agents.plan), ['allow:explore', 'deny:*']);
  for (const id of ['general', 'explore']) {
    assert.deepEqual(subagentPolicy(installed.agents[id]), ['deny:*'], `${id} must be a leaf`);
  }
});
