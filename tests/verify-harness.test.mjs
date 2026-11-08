import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArgs, discoverOfflineTests, buildPlan, summarize, roleMatrix,
} from '../scripts/verify-harness.mjs';

test('defaults to offline and never runs live probes implicitly', () => {
  const opts = parseArgs([]);
  assert.equal(opts.offline, true);
  assert.equal(opts.native, false);
  assert.equal(opts.installed, false);
  assert.equal(opts.live, false);
  assert.throws(() => parseArgs(['--unknown']), /Unknown option/);
});

test('--all enables offline, native, installed and status together', () => {
  const opts = parseArgs(['--all']);
  for (const key of ['offline', 'native', 'installed', 'status']) assert.equal(opts[key], true, key);
});

test('offline discovery includes unit tests but excludes live/native scripts', async () => {
  const files = await discoverOfflineTests();
  assert.ok(files.some((file) => file.endsWith('/prompt-boundaries.test.mjs')));
  assert.ok(files.some((file) => file.endsWith('/session-audit.test.mjs')));
  assert.ok(!files.some((file) => file.endsWith('/external-evidence.test.mjs')));
  assert.ok(!files.some((file) => file.endsWith('-live.mjs')));
  assert.ok(!files.some((file) => file.endsWith('-native.mjs')));
});

test('plan keeps offline, native, installed and live steps separate', () => {
  const offline = ['/tmp/a.test.mjs', '/tmp/b.test.mjs'];
  const base = buildPlan({ offline: false, native: false, installed: false, live: false, offlineFiles: offline, root: '/tmp/project' });
  assert.deepEqual(base, []);
  const native = buildPlan({ offline: false, native: true, installed: false, live: false, offlineFiles: offline, root: '/tmp/project' });
  assert.ok(native.every((step) => !step.live));
  assert.ok(native.some((step) => step.label === 'delegation-native-integration'));
  const installed = buildPlan({ offline: false, native: false, installed: true, live: false, offlineFiles: offline, root: '/tmp/project' });
  assert.ok(installed.some((step) => step.label === 'inventory-verify' && step.args.includes('/tmp/project')));
  const all = buildPlan({ offline: true, native: true, installed: true, live: true, offlineFiles: offline, root: '/tmp/project' });
  assert.equal(all[0].label, 'offline');
  assert.ok(all.some((step) => step.live === true));
  assert.ok(!all.some((step) => step.label === 'visual-verify'));
  assert.ok(all.some((step) => step.label === 'installed-roles'));
});

test('summary fails on the first non-pass result and preserves its log', () => {
  const summary = summarize([
    { label: 'offline', status: 'pass', log: '/tmp/a' },
    { label: 'native', status: 'exit:1', log: '/tmp/b' },
    { label: 'installed', status: 'signal:SIGTERM', log: '/tmp/c' },
  ]);
  assert.equal(summary.ok, false);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed.length, 2);
  assert.equal(summary.failed[0].label, 'native');
  assert.equal(summarize([{ label: 'offline', status: 'pass', log: '/tmp/a' }]).ok, true);
});

test('role matrix marks the machine-local General override as drift from source', async () => {
  const sourceConfig = { agents: { build: {}, general: {}, plan: {}, explore: {} } };
  const installedConfig = { agents: { build: {}, general: { model: 'dgx-spark/qwen-flash-next' }, plan: { model: 'opencode-go/muse-spark-1.3-contributor#xhigh' }, explore: { model: 'opencode-go/deepseek-v4.1-flash#high' } } };
  const matrix = await roleMatrix({ sourceConfig, installedConfig });
  assert.ok(!matrix.some((row) => row.role === 'lead'));
  assert.deepEqual(matrix.map((row) => row.role), ['build', 'plan', 'general', 'explore']);
  assert.equal(matrix.find((row) => row.role === 'explore').installed, 'opencode-go/deepseek-v4.1-flash#high');
  const general = matrix.find((row) => row.role === 'general');
  assert.equal(general.source, 'inherit/session');
  assert.equal(general.installed, 'dgx-spark/qwen-flash-next');
  assert.equal(general.drift, true);
  assert.equal(matrix.find((row) => row.role === 'plan').drift, true);
  assert.equal(matrix.find((row) => row.role === 'build').installed, 'inherit/session');
  assert.equal(matrix.find((row) => row.role === 'build').drift, false);
});
