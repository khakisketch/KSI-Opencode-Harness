#!/usr/bin/env node
// One explicit verification entrypoint for the harness. It runs only the
// selected checks; live real-model probes are never implicit.
import { spawn } from 'node:child_process';
import { open, mkdir, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(repo, 'tests');
const nativeScripts = [
  'tests/delegation-native-integration.mjs',
  'tests/native-guidance-integration.mjs',
  'tests/capabilities-inventory-native.mjs',
  'tests/session-lifecycle-native.mjs',
];
const liveScripts = [
  'tests/delegation-ownership-live.mjs',
  'tests/compaction-continuity-live.mjs',
  'tests/completion-guidance-live.mjs',
];

export function parseArgs(argv) {
  const opts = { offline: false, native: false, installed: false, status: false, all: false, json: false, live: false, help: false };
  for (const arg of argv) {
    if (arg === '--offline') opts.offline = true;
    else if (arg === '--native') opts.native = true;
    else if (arg === '--installed') opts.installed = true;
    else if (arg === '--status') opts.status = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--live') opts.live = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (opts.all) { opts.offline = true; opts.native = true; opts.installed = true; opts.status = true; }
  if (!opts.offline && !opts.native && !opts.installed && !opts.status && !opts.live && !opts.help) opts.offline = true;
  return opts;
}

export async function discoverOfflineTests(dir = testsDir) {
  const names = await readdir(dir);
  const files = names.filter((name) => name.endsWith('.test.mjs')).sort().map((name) => path.join(dir, name));
  return files;
}

export function buildPlan({ offline, native, installed, live, offlineFiles, root = repo }) {
  const plan = [];
  if (offline) plan.push({ label: 'offline', args: ['--test', ...offlineFiles] });
  if (native) for (const script of nativeScripts) plan.push({ label: path.basename(script, '.mjs'), args: [script] });
  if (installed) {
    plan.push({ label: 'installed-roles', args: ['tests/agent-routing-native.mjs'] });
    plan.push({ label: 'inventory-verify', args: ['scripts/install-capabilities-inventory.mjs', '--project', root, '--verify'] });
  }
  if (live) for (const script of liveScripts) plan.push({ label: `live-${path.basename(script, '.mjs')}`, args: [script], live: true });
  return plan;
}

export function summarize(results) {
  const failed = results.filter((result) => result.status !== 'pass');
  return {
    ok: failed.length === 0,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.map((result) => ({ label: result.label, status: result.status, log: result.log })),
  };
}

function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)[ \t]*\/\/[^\n]*/g, '$1');
}

async function readJsonc(file) {
  if (!existsSync(file)) return null;
  try { return JSON.parse(stripJsonc(await readFile(file, 'utf8'))); }
  catch (error) { throw new Error(`Invalid JSONC at ${file}: ${error.message}`); }
}

function modelText(value) {
  if (!value) return 'inherit/session';
  if (typeof value === 'string') return value;
  return `${value.providerID}/${value.id}${value.variant ? `#${value.variant}` : ''}`;
}

export async function roleMatrix({ sourceConfig, installedConfig }) {
  const roles = ['build', 'plan', 'general', 'explore'];
  return roles.map((role) => {
    const source = sourceConfig?.agents?.[role] ?? {};
    const installed = installedConfig?.agents?.[role] ?? {};
    return {
      role,
      mode: installed.mode ?? source.mode ?? (role === 'build' ? 'primary' : 'subagent'),
      source: modelText(source.model),
      installed: modelText(installed.model),
      drift: modelText(source.model) !== modelText(installed.model),
    };
  });
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); }
  catch (error) { console.error(error.message); console.error('Usage: node scripts/verify-harness.mjs [--offline|--native|--installed|--all] [--status] [--json] [--live]'); process.exitCode = 2; return; }
  if (opts.help) {
    console.log('Verify the harness without implicit live model calls.\n' +
      '  (default) --offline   offline unit/installer suite\n' +
      '  --native              isolated Native transport/delegation/visual checks\n' +
      '  --installed           installed role catalog + managed file hashes\n' +
      '  --all                 offline + native + installed\n' +
      '  --status              print the source/installed agent model matrix\n' +
      '  --live                explicit real-model probes (spends usage)\n' +
      '  --json                machine-readable summary');
    return;
  }
  if (opts.live) console.error('WARNING: --live runs real-model probes and may spend usage.');

  const offlineFiles = opts.offline ? await discoverOfflineTests() : [];
  const plan = buildPlan({ ...opts, offlineFiles, root: repo });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(os.homedir(), '.local/share/ksi-harness-verification', stamp);
  await mkdir(logDir, { recursive: true, mode: 0o700 });
  const results = [];
  const started = Date.now();

  for (const [index, step] of plan.entries()) {
    const log = path.join(logDir, `${String(index + 1).padStart(2, '0')}-${step.label}.log`);
    const fd = await open(log, 'w', 0o600);
    const env = { ...process.env };
    const begin = Date.now();
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, step.args, {
        cwd: repo, env, stdio: ['ignore', fd.fd, fd.fd], timeout: 360_000, killSignal: 'SIGTERM',
      });
      child.on('error', (error) => resolve({ label: step.label, status: 'error', detail: error.message, log, ms: Date.now() - begin }));
      child.on('close', (code, signal) => resolve({
        label: step.label,
        status: code === 0 ? 'pass' : signal ? `signal:${signal}` : `exit:${code}`,
        detail: code === 0 ? '' : signal ? `terminated by ${signal}` : `exit ${code}`,
        log,
        ms: Date.now() - begin,
      }));
    });
    await fd.close();
    results.push(result);
    if (!opts.json) console.log(`${result.status === 'pass' ? 'PASS' : 'FAIL'} ${result.label} (${(result.ms / 1000).toFixed(1)}s)`);
    if (result.status !== 'pass') {
      const text = await readFile(log, 'utf8').catch(() => '');
      const tail = text.trimEnd().split('\n').slice(-20).join('\n');
      if (tail) console.error(tail);
    }
  }

  let matrix = null;
  if (opts.status) {
    const home = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    const sourceConfig = await readJsonc(path.join(repo, 'global/opencode.jsonc'));
    const installedPath = path.join(home, 'opencode/opencode.jsonc');
    const installedConfig = await readJsonc(installedPath);
    matrix = await roleMatrix({ sourceConfig, installedConfig });
    if (!installedConfig) matrix.push({ role: 'installed-config', mode: 'missing', source: '', installed: 'missing', drift: true });
  }

  const summary = summarize(results);
  const explicit = [opts.offline, opts.native, opts.installed].filter(Boolean).length;
  const mode = opts.all ? 'all'
    : opts.live && explicit === 0 ? 'live'
      : explicit > 1 ? 'mixed'
        : opts.native ? 'native' : opts.installed ? 'installed' : opts.offline ? 'offline' : 'status';
  const report = {
    ok: summary.ok,
    mode,
    durationSeconds: Number(((Date.now() - started) / 1000).toFixed(2)),
    results,
    summary,
    matrix,
    logs: logDir,
    limits: 'Offline and scripted Native checks prove mechanisms, not real-model quality, product acceptance, or a controlled Codex comparison.',
  };
  if (opts.json) console.log(JSON.stringify(report, null, 2));
  else {
    if (matrix) {
      console.log('\nRole       Mode       Source                                    Installed');
      for (const row of matrix) {
        console.log(`${row.role.padEnd(10)} ${String(row.mode).padEnd(10)} ${row.source.padEnd(41)} ${row.installed}${row.drift ? '  (drift)' : ''}`);
      }
      console.log('\nSource is portable; installed may contain machine-local DGX overrides.');
    }
    if (summary.total === 0) console.log('\nStatus only; no checks run. Logs: ' + logDir);
    else console.log(`\n${summary.passed}/${summary.total} checks passed${summary.ok ? '' : ' — FAILED'}. Logs: ${logDir}`);
    if (opts.live) console.log('Live probes are explicit opt-in and are not product acceptance.');
    console.log(report.limits);
  }
  if (!summary.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.stack ?? error.message); process.exitCode = 1; });
}
