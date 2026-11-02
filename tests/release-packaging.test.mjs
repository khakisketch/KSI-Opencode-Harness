// Verify the versioned ignore policy without reading or staging local records.
// This creates only synthetic paths in a new, isolated Git repository.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('fresh clone ignores local records and common weights, not portable sources', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ksi-release-ignore-'));
  try {
    execFileSync('git', ['init', '--quiet', root], { stdio: 'pipe' });
    copyFileSync(fileURLToPath(new URL('../.gitignore', import.meta.url)), path.join(root, '.gitignore'));
    const ignored = [
      'AGENTS.md', '.harness-journal/README.md', '.opencode/opencode.json',
      '.opencode/opencode.jsonc', '.ai-memory.toml', '.env', 'nested/.env.local',
      'models/fake.gguf', 'models/fake.safetensors', 'models/fake.bin',
      'models/fake.pt', 'models/fake.pth', 'models/fake.ckpt',
      'scripts/__pycache__/fake.pyc',
    ];
    const portable = [
      'global/AGENTS.md', 'global/opencode.jsonc', 'examples/project-AGENTS.md',
      'tests/fixtures/synthetic.json', '.env.example', '.env.sample',
    ];
    for (const name of [...ignored, ...portable]) {
      const file = path.join(root, name);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, 'synthetic test data\n');
      const result = spawnSync('git', ['check-ignore', '--quiet', name], { cwd: root });
      assert.equal(result.status, ignored.includes(name) ? 0 : 1, name);
    }
  } finally {
    // Only the directory created by this test, never a user's workspace.
    rmSync(root, { recursive: true, force: true });
  }
});

test('default operating sources exclude retired and experimental entry points', () => {
  const guides = [
    '../README.md', '../docs/README.md', '../docs/installation.md',
    '../docs/validation.md', '../docs/visual-workflow.md', '../docs/workflow-evidence.md',
  ];
  // Checks current guide text only; it does not inspect a staged release,
  // decide which untracked files to include, or replace manual content review.
  const localEntry = /global\/plugins\/(?:ksi-native-lead-goal|ksi-native-decision|ksi-session-evidence)|scripts\/install-session-evidence|scripts\/ux-evaluation\.mjs|docs\/native-decision\.md|docs\/ux-evaluation\.md/;
  for (const guide of guides) {
    assert.doesNotMatch(readFileSync(new URL(guide, import.meta.url), 'utf8'), localEntry, guide);
  }
  for (const entry of ['ksi-native-lead-goal', 'ksi-native-decision', 'ksi-session-evidence']) {
    assert.equal(existsSync(new URL(`../global/plugins/${entry}/index.ts`, import.meta.url)), false);
  }
  assert.equal(existsSync(new URL('../scripts/install-session-evidence.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../experiments/native-decision/runtime.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../experiments/ux-evaluation/evaluate.mjs', import.meta.url)), true);
  assert.doesNotMatch(readFileSync(new URL('../global/AGENTS.md', import.meta.url), 'utf8'), /ksi_native_decision|session_evidence_summary/);
  assert.doesNotMatch(readFileSync(new URL('../global/opencode.jsonc', import.meta.url), 'utf8'), /experiments\//);
});

test('offline audit retains its local portable core without a runtime plugin', () => {
  const audit = readFileSync(new URL('../scripts/session-audit.mjs', import.meta.url), 'utf8');
  assert.match(audit, /\.\/lib\/session-audit-core\.mjs/);
  assert.ok(existsSync(new URL('../scripts/lib/session-audit-core.mjs', import.meta.url)));
  // Existence in the checkout is not proof of staging or release inclusion.
});
