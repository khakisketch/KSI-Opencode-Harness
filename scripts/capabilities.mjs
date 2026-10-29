// capabilities.mjs — opt-in read-only Native capability inventory (Node stdlib only).
// Reads GET /api/agent, /api/skill, /api/mcp via the existing authenticated
// `opencode api get <route>` CLI. Pipes truncate large CLI output, so stdout
// goes to a private temp file (dir 0700, open wx 0600), parsed after exit,
// then unlinked with its dir. Ephemeral buffers ONLY: never config, project
// files, installs, MCP reconnects, models, browser, sessions, or restarts.
import { spawn } from 'node:child_process';
import { promises as fsp, constants as F } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const TRACKED_AGENTS = ['build', 'plan', 'lead', 'general', 'explore'];
export const TRACKED_SKILLS = [
  'impeccable', 'journey', 'organize', 'wireframe',
  'vercel-react-best-practices', 'playwright-cli', 'mobbin-design',
  'opencode',
  'designing-user-experience', 'building-accessible-interfaces', 'evolving-apis-and-schemas',
  'investigating-performance', 'reviewing-security', 'ux-heuristics-audit',
  'diagnosing-bugs', 'ux-copy',
];
export const TRACKED_MCP = ['context7', 'mobbin'];
export const TRACKED_BINARIES = ['node', 'playwright-cli', 'gh'];
export const AGENT_MODES = ['primary', 'subagent', 'all'];
export const TRACKED_DOMAINS = ['agent', 'skill', 'mcp'];
export const QUERY_TIMEOUT_MS = 10000;
export const QUERY_MAX_BUFFER = 1 << 20;

// Canonical domain filter for selective runs. undefined/null means the full
// inventory (all three routes). Strings split on commas; known aliases
// agents->agent and skills->skill are accepted case-insensitively. Unknown
// names are dropped; an empty result means no queries (all unknown).
// Kept lenient for programmatic callers; CLI argv parsing below is strict
// and rejects unknown/empty selections before any query.
export function normalizeDomains(input) {
  if (input === undefined || input === null) return [...TRACKED_DOMAINS];
  const parts = (Array.isArray(input) ? input.join(',') : String(input)).split(',');
  const alias = (s) => {
    const t = String(s ?? '').trim().toLowerCase();
    if (t === 'agents') return 'agent';
    if (t === 'skills') return 'skill';
    return t;
  };
  const wanted = new Set(parts.map(alias).filter((d) => TRACKED_DOMAINS.includes(d)));
  return TRACKED_DOMAINS.filter((d) => wanted.has(d));
}

// Strict resolution for CLI --only input: unknown names, typos, and empty or
// missing values are input errors, never silently dropped. Throws; the CLI
// parser turns this into {invalid:true} with no queries performed.
export function resolveCliDomainsStrict(input) {
  const raw = Array.isArray(input) ? input.join(',') : String(input ?? '');
  const parts = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (!parts.length) throw new Error('capabilities: empty domain selection');
  const mapped = parts.map((s) => {
    const t = s.toLowerCase();
    if (t === 'agents') return 'agent';
    if (t === 'skills') return 'skill';
    return t;
  });
  const unknown = mapped.filter((d) => !TRACKED_DOMAINS.includes(d));
  if (unknown.length) throw new Error('capabilities: unknown domains requested');
  return TRACKED_DOMAINS.filter((d) => mapped.includes(d));
}

// Minimal CLI parsing without extra dependencies. First non-flag positional
// is the directory; --only <csv> / --only=<csv> selects domains; --help/-h
// prints usage with no queries. Unknown flags or extra positionals are
// invalid (fail closed, no queries).
export function parseInventoryArgs(argv) {
  const args = Array.isArray(argv) ? [...argv] : [];
  let directory;
  let onlyRaw;
  let onlySet = false;
  let help = false;
  let invalid = false;
  let positionals = 0;
  for (let i = 0; i < args.length; i += 1) {
    const a = String(args[i] ?? '');
    if (a === '--help' || a === '-h') { help = true; continue; }
    if (a === '--only') {
      onlySet = true;
      const next = args[i + 1];
      onlyRaw = next === undefined ? '' : String(next);
      i += 1;
      continue;
    }
    if (a.startsWith('--only=')) { onlySet = true; onlyRaw = a.slice('--only='.length); continue; }
    if (a.startsWith('--')) { invalid = true; continue; }
    positionals += 1;
    if (positionals === 1) directory = a;
    else invalid = true;
  }
  if (help) return { help: true };
  if (invalid) return { invalid: true };
  if (onlySet) {
    try {
      return { directory, domains: resolveCliDomainsStrict(onlyRaw) };
    } catch { return { invalid: true }; }
  }
  return { directory, domains: undefined };
}

export function routeFor(base, directory) {
  const q = new URLSearchParams();
  if (directory) q.set('location[directory]', directory);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

const entriesOf = (p) => (Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : null);
const isStr = (v) => v === undefined || typeof v === 'string';
const nonEmpty = (v) => typeof v === 'string' && v.length > 0;
// Canonical keys only: agent/skill by nonempty id, MCP by nonempty name.
const keyOf = (e, kind) => {
  if (kind === 'mcp') return nonEmpty(e?.name) ? e.name : null;
  return nonEmpty(e?.id) ? e.id : null;
};

function entryValid(e, kind) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (kind === 'mcp') {
    if (!nonEmpty(e.name)) return false;
    if (e.status === undefined) return true;
    if (typeof e.status !== 'object' || e.status === null || Array.isArray(e.status)) return false;
    return e.status.status === undefined || typeof e.status.status === 'string';
  }
  if (!nonEmpty(e.id) || !isStr(e.name)) return false;
  return kind !== 'agent' || e.mode === undefined || typeof e.mode === 'string';
}

// Well-shaped means a list (bare or {data:[]}) of well-formed entries.
// Empty [] is valid (genuine absence). Anything else fails closed.
export function validPayload(payload, kind) {
  const list = entriesOf(payload);
  return !!list && list.every((e) => entryValid(e, kind));
}

const unknownAgents = () => TRACKED_AGENTS.map((name) => ({ name, registered: 'unknown', mode: 'unknown' }));
const unknownSkills = () => TRACKED_SKILLS.map((name) => ({ name, registered: 'unknown' }));
const unknownMcp = () => TRACKED_MCP.map((name) => ({ name, status: 'unknown' }));

export function projectAgents(payload) {
  if (!validPayload(payload, 'agent')) return unknownAgents();
  const modes = new Map();
  for (const e of entriesOf(payload)) {
    const k = keyOf(e, 'agent');
    if (!k || modes.has(k)) continue;
    modes.set(k, AGENT_MODES.includes(e.mode) ? e.mode : 'unknown');
  }
  return TRACKED_AGENTS.map((name) => (modes.has(name)
    ? { name, registered: true, mode: modes.get(name) }
    : { name, registered: false, mode: 'unknown' }));
}

export function projectSkills(payload) {
  if (!validPayload(payload, 'skill')) return unknownSkills();
  const seen = new Set();
  for (const e of entriesOf(payload)) { const k = keyOf(e, 'skill'); if (k) seen.add(k); }
  return TRACKED_SKILLS.map((name) => ({ name, registered: seen.has(name) }));
}

export function projectMcp(payload) {
  if (!validPayload(payload, 'mcp')) return unknownMcp();
  const stat = new Map();
  for (const e of entriesOf(payload)) {
    const k = keyOf(e, 'mcp');
    if (!k || stat.has(k)) continue;
    // Only an explicit connected state counts as connected. A present entry
    // with missing or unverified status is unknown, never unavailable:
    // unavailable strictly means confirmed absence from a valid list.
    stat.set(k, e?.status?.status === 'connected' ? 'connected' : 'unknown');
  }
  return TRACKED_MCP.map((name) => ({ name, status: stat.has(name) ? stat.get(name) : 'unavailable' }));
}

// Default runner: `opencode` CLI with stdout to an open private file (never a
// pipe), stdin/stderr ignored; {ok:true} only on exit 0, own child SIGKILLed.
export function runToFile(fd, args, { timeoutMs = QUERY_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let settled = false; let child; let t;
    const done = (ok) => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok }); } };
    try { child = spawn('opencode', args, { stdio: ['ignore', fd, 'ignore'] }); }
    catch { return resolve({ ok: false }); }
    t = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, timeoutMs);
    if (typeof t.unref === 'function') t.unref();
    child.on('error', () => done(false));
    child.on('close', (code) => done(code === 0));
  });
}

async function mkPrivateDir() {
  let dir;
  try { await fsp.access(path.join('/tmp', 'opencode'), F.W_OK); dir = await fsp.mkdtemp(path.join('/tmp', 'opencode', 'ksi-cap-')); }
  catch { dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ksi-cap-')); }
  try { await fsp.chmod(dir, 0o700); } catch {}
  return dir;
}

// One route via a private temp response file. Runner injectable for tests
// (no CLI/network). Fixed {ok:false} on failure; removes only own file/dir.
export async function queryApi(route, run = runToFile) {
  let dir = null; let handle = null; let file = null;
  try {
    dir = await mkPrivateDir();
    file = path.join(dir, 'resp.json');
    handle = await fsp.open(file, 'wx', 0o600);
    const res = await run(handle.fd, ['api', 'get', route]);
    await handle.close(); handle = null;
    if (!res || res.ok !== true) return { ok: false };
    if ((await fsp.stat(file)).size > QUERY_MAX_BUFFER) return { ok: false };
    return { ok: true, payload: JSON.parse(await fsp.readFile(file, 'utf8')) };
  } catch { return { ok: false }; }
  finally {
    try { if (handle) await handle.close(); } catch {}
    try { if (file) await fsp.unlink(file); } catch {}
    try { if (dir) await fsp.rmdir(dir); } catch {}
  }
}

export async function checkPathPresent(name, pathValue = process.env.PATH ?? '', access = fsp.access) {
  try {
    for (const dir of pathValue.split(path.delimiter)) {
      if (!dir) continue;
      try { await access(path.join(dir, name), F.X_OK); return true; } catch { /* next */ }
    }
    return false;
  } catch { return 'unknown'; }
}

const asResult = (r) => (r && typeof r === 'object' && typeof r.ok === 'boolean' ? r : { ok: false });
const asPresent = (v) => (v === true ? true : v === false ? false : 'unknown');

export function buildReport({ directory, directoryStatus = 'ok', agentResult, skillResult, mcpResult, binaries, at, domainsQueried }) {
  const a = asResult(agentResult); const s = asResult(skillResult); const m = asResult(mcpResult);
  const aOk = a.ok && validPayload(a.payload, 'agent');
  const sOk = s.ok && validPayload(s.payload, 'skill');
  const mOk = m.ok && validPayload(m.payload, 'mcp');
  const stamped = (typeof at === 'string' && !Number.isNaN(Date.parse(at))) ? at : new Date().toISOString();
  const queried = Array.isArray(domainsQueried)
    ? TRACKED_DOMAINS.filter((d) => domainsQueried.includes(d))
    : [...TRACKED_DOMAINS];
  const partial = queried.length < TRACKED_DOMAINS.length;
  const coreQueried = queried.includes('agent') && queried.includes('skill');
  const queriedOk = directoryStatus === 'ok' && queried.length > 0
    && queried.every((d) => (d === 'agent' ? aOk : d === 'skill' ? sOk : d === 'mcp' ? mOk : false));
  return {
    directory,
    directoryStatus,
    at: stamped,
    domainsQueried: queried,
    partial,
    agents: aOk ? projectAgents(a.payload) : unknownAgents(),
    skills: sOk ? projectSkills(s.payload) : unknownSkills(),
    mcp: mOk ? projectMcp(m.payload) : unknownMcp(),
    cli: Object.fromEntries(TRACKED_BINARIES.map((n) => [n, { present: asPresent(binaries?.[n]) }])),
    coreQueriesOk: directoryStatus === 'ok' && coreQueried && aOk && sOk,
    queriedOk,
    notice: partial
      ? 'Read-only configuration inventory; registration does not prove connection completion or actual call success; private temporary response removed, CLI may auto-start; partial domains only, not a full inventory.'
      : 'Read-only configuration inventory; registration does not prove connection completion or actual call success; private temporary response removed, CLI may auto-start.',
  };
}

export async function collectCapabilities({ directory, query = queryApi, checkPath = checkPathPresent, domains, at } = {}) {
  const explicit = directory !== undefined && directory !== null && String(directory) !== '';
  const dir = explicit ? path.resolve(String(directory)) : process.cwd();
  let dirOk = false;
  try { dirOk = (await fsp.stat(dir)).isDirectory(); } catch { dirOk = false; }
  const wanted = normalizeDomains(domains);
  if (!dirOk) {
    return { report: buildReport({ directory: 'unavailable', directoryStatus: 'directoryUnavailable', at, domainsQueried: wanted }), exitCode: 1 };
  }
  const want = (d) => wanted.includes(d);
  const safeQuery = async (route) => {
    try { return asResult(await query(route)); } catch { return { ok: false }; }
  };
  // Skipped domains are never queried: fixed {ok:false} keeps them unknown
  // (never false absence) and keeps coreQueriesOk false when core is skipped.
  const [agents, skills, mcps] = await Promise.all([
    want('agent') ? safeQuery(routeFor('/api/agent', dir)) : { ok: false },
    want('skill') ? safeQuery(routeFor('/api/skill', dir)) : { ok: false },
    want('mcp') ? safeQuery(routeFor('/api/mcp', dir)) : { ok: false },
  ]);
  const binaries = {};
  for (const n of TRACKED_BINARIES) {
    try { binaries[n] = await checkPath(n); } catch { binaries[n] = 'unknown'; }
  }
  const report = buildReport({ directory: dir, agentResult: agents, skillResult: skills, mcpResult: mcps, binaries, at, domainsQueried: wanted });
  // Full runs keep the historical core exit (mcp stays informational).
  // Partial runs exit on the requested scope so `--only mcp` success is not
  // forced to 1; `coreQueriesOk` still reports full-core confirmation and
  // `partial` marks the result as not a full inventory.
  const exitCode = report.partial ? (report.queriedOk ? 0 : 1) : (report.coreQueriesOk ? 0 : 1);
  return { report, exitCode };
}

const INVENTORY_USAGE = 'usage: node scripts/capabilities.mjs [directory] [--only agent,skill,mcp]\n';

async function main() {
  try {
    const parsed = parseInventoryArgs(process.argv.slice(2));
    if (parsed.help) {
      process.stdout.write(INVENTORY_USAGE);
      process.exit(0);
      return;
    }
    if (parsed.invalid) {
      process.stdout.write(`${JSON.stringify({ directory: 'unavailable', directoryStatus: 'directoryUnavailable', at: new Date().toISOString(), domainsQueried: [], partial: true, coreQueriesOk: false, queriedOk: false, notice: 'Read-only configuration inventory; invalid arguments, no queries performed.' }, null, 2)}\n`);
      process.exit(1);
      return;
    }
    const { report, exitCode } = await collectCapabilities({ directory: parsed.directory, domains: parsed.domains });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(exitCode);
  } catch {
    process.stdout.write(JSON.stringify({ directory: 'unavailable', directoryStatus: 'directoryUnavailable', at: new Date().toISOString(), domainsQueried: [], partial: true, coreQueriesOk: false, queriedOk: false, notice: 'Read-only configuration inventory; invalid arguments, no queries performed.' }));
    process.stdout.write('\n');
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
