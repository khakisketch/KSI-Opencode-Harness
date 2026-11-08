// KSI managed capabilities inventory; read-only in-process Native adapter.
// Explicit tool call only. No hooks, storage, permissions, models,
// HTTP, subprocess, service start, or cross-project collection.
// Reads use only ctx.agent/skill/tool/mcp/plugin list plus ctx.session.get
// for caller-session location verification, and one tool registration.
// MCP reconnect behavior is unconfirmed: mcp is opt-in only, never claimed
// as side-effect free, and missing/unknown status is never asserted.
import path from 'node:path';
import { realpath } from 'node:fs/promises';

export const PLUGIN_ID = 'ksi.capabilities-inventory';
export const NATIVE_DOMAINS = ['agent', 'skill', 'tool', 'mcp', 'plugin'];
export const DEFAULT_NATIVE_DOMAINS = ['agent', 'skill', 'tool', 'plugin'];
export const TRACKED_AGENTS = ['build', 'plan', 'general', 'explore'];
export const TRACKED_SKILLS = [
  'impeccable', 'journey', 'organize', 'wireframe',
  'vercel-react-best-practices', 'playwright-cli', 'mobbin-design',
  'opencode',
  'designing-user-experience', 'building-accessible-interfaces', 'evolving-apis-and-schemas',
  'investigating-performance', 'reviewing-security', 'ux-heuristics-audit',
  'diagnosing-bugs', 'ux-copy',
];
export const TRACKED_MCP = ['context7', 'mobbin'];
export const AGENT_MODES = ['primary', 'subagent', 'all'];
export const MAX_CATALOG_IDS = 200;
export const MAX_ID_LENGTH = 128;
export const MAX_LOCATE_SKILLS = 5;
// Optional inventory reads only. Required session/location checks never turn a
// timeout into a partial success; caller cancellation always rejects the call.
export const LIST_DEADLINE_MS = 2000;

const fail = (message) => { throw new Error(`capabilities-inventory: ${message}`); };

export function aliasNativeDomain(value) {
  const t = String(value ?? '').trim().toLowerCase();
  if (t === 'agents') return 'agent';
  if (t === 'skills') return 'skill';
  if (t === 'tools') return 'tool';
  if (t === 'plugins') return 'plugin';
  return t;
}

export function normalizeNativeDomains(input) {
  if (input === undefined || input === null) return [...NATIVE_DOMAINS];
  const parts = (Array.isArray(input) ? input.join(',') : String(input)).split(',');
  const wanted = new Set(parts.map(aliasNativeDomain).filter((d) => NATIVE_DOMAINS.includes(d)));
  return NATIVE_DOMAINS.filter((d) => wanted.has(d));
}

// Strict resolution for tool input: unknown or typo values are an input
// error, never silently dropped. normalizeNativeDomains stays lenient for
// legacy callers; execute uses this and fails closed.
export function resolveNativeDomainsStrict(input) {
  if (!Array.isArray(input)) fail('domains must be an array of domain names');
  if (input.some((d) => typeof d !== 'string')) fail('domains must be an array of domain names');
  if (input.length > NATIVE_DOMAINS.length) fail('too many domains requested');
  const unknown = input.map(aliasNativeDomain).filter((d) => !NATIVE_DOMAINS.includes(d));
  if (unknown.length) fail('unknown domains requested');
  return NATIVE_DOMAINS.filter((d) => input.map(aliasNativeDomain).includes(d));
}

const entriesOf = (p) => (Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : null);
const dataOf = (v) => (v && typeof v === 'object' && Object.hasOwn(v, 'data') ? v.data : v);
const isStr = (v) => v === undefined || typeof v === 'string';
// Observed Native id grammar in the isolated fixture (agents like
// build/compaction/title, skills like fixture-extra-skill, tools like
// patch/opencode.config.worktree, plugins like opencode.tool.input.repair,
// mcp names like context7): leading alphanumeric, then alphanumerics plus
// dot/underscore/dash, total length within MAX_ID_LENGTH. Anything else is
// omitted, never returned as an id.
// The prefix denylist is a best-effort tripwire, not secret detection: bare
// tokens that match the grammar can still be listed, and names themselves
// may be sensitive. No generic secret screening or zero-leak claim is made.
const ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/;
const SENSITIVE_PREFIX = /^(sk[-_]|akia|ghp_|gho_|ghu_|ghs_|ghr_|xox[bpas]-|bearer[ :])/i;
const hasControl = (s) => typeof s === 'string' && /[\0\x00-\x1F\x7F]/.test(s);
const allowedId = (v) => typeof v === 'string' && ID_PATTERN.test(v) && !SENSITIVE_PREFIX.test(v);
const keyOf = (e, kind) => {
  if (kind === 'mcp') return allowedId(e?.name) ? e.name : null;
  return allowedId(e?.id) ? e.id : null;
};

function entryValid(e, kind) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
  if (kind === 'mcp') {
    if (!allowedId(e.name)) return false;
    if (e.status === undefined) return true;
    if (typeof e.status !== 'object' || e.status === null || Array.isArray(e.status)) return false;
    return e.status.status === undefined || typeof e.status.status === 'string';
  }
  if (kind === 'tool' || kind === 'plugin') return allowedId(e.id);
  if (!allowedId(e.id) || !isStr(e.name) || hasControl(e.name)) return false;
  return kind !== 'agent' || e.mode === undefined || typeof e.mode === 'string';
}

export function validNativePayload(payload, kind) {
  if (!NATIVE_DOMAINS.includes(kind)) return false;
  const list = entriesOf(payload);
  return !!list && list.every((e) => entryValid(e, kind));
}

const usableEntries = (payload, kind) => (entriesOf(payload) ?? []).filter(e => entryValid(e, kind));

const unknownAgents = () => TRACKED_AGENTS.map((name) => ({ name, registered: 'unknown', mode: 'unknown' }));
const unknownSkills = () => TRACKED_SKILLS.map((name) => ({ name, registered: 'unknown' }));
const unknownMcp = () => TRACKED_MCP.map((name) => ({ name, status: 'unknown' }));
const unknownCount = () => ({ count: 'unknown', status: 'unknown' });
const unknownCatalog = () => ({ status: 'unknown', ids: [], truncated: false, count: 'unknown', omitted: 'unknown', complete: false, countKind: 'unknown' });

export function projectNativeAgents(payload) {
  if (!entriesOf(payload)) return unknownAgents();
  const complete = validNativePayload(payload, 'agent');
  const modes = new Map();
  for (const e of usableEntries(payload, 'agent')) {
    const k = keyOf(e, 'agent');
    if (!k || modes.has(k)) continue;
    modes.set(k, AGENT_MODES.includes(e.mode) ? e.mode : 'unknown');
  }
  return TRACKED_AGENTS.map((name) => (modes.has(name)
    ? { name, registered: true, mode: modes.get(name) }
    : { name, registered: complete ? false : 'unknown', mode: 'unknown' }));
}

export function projectNativeSkills(payload) {
  if (!entriesOf(payload)) return unknownSkills();
  const complete = validNativePayload(payload, 'skill');
  const seen = new Set();
  for (const e of usableEntries(payload, 'skill')) { const k = keyOf(e, 'skill'); if (k) seen.add(k); }
  return TRACKED_SKILLS.map((name) => ({ name, registered: seen.has(name) ? true : complete ? false : 'unknown' }));
}

// Present + connected stays connected. Present with missing/unknown state stays
// unknown and is never asserted as unavailable. Absent from a valid list is
// genuine absence (unavailable). An incomplete list never proves absence.
export function projectNativeMcp(payload) {
  if (!entriesOf(payload)) return unknownMcp();
  const complete = validNativePayload(payload, 'mcp');
  const stat = new Map();
  for (const e of usableEntries(payload, 'mcp')) {
    const k = keyOf(e, 'mcp');
    if (!k || stat.has(k)) continue;
    const s = e?.status?.status;
    if (s === 'connected') stat.set(k, 'connected');
    else stat.set(k, 'unknown');
  }
  return TRACKED_MCP.map((name) => {
    if (!stat.has(name)) return { name, status: complete ? 'unavailable' : 'unknown' };
    return { name, status: stat.get(name) };
  });
}

export function projectNativeToolCount(payload) {
  if (!validNativePayload(payload, 'tool')) return entriesOf(payload) ? { ...unknownCount(), observedCount: usableEntries(payload, 'tool').length } : unknownCount();
  return { count: entriesOf(payload).length, status: 'known' };
}

export function projectNativePluginCount(payload) {
  if (!validNativePayload(payload, 'plugin')) return entriesOf(payload) ? { ...unknownCount(), observedCount: usableEntries(payload, 'plugin').length } : unknownCount();
  return { count: entriesOf(payload).length, status: 'known' };
}

// Bounded actual catalog ids for the current location. Only id strings that
// match the observed Native grammar are returned; raw descriptions, configs,
// and secret fields are never returned. Overlong or off-grammar ids and
// disallowed shapes are omitted and counted; a list with zero usable ids but
// omitted shapes stays unknown rather than claiming a known empty catalog.
// Id grammar screening is not secret screening: a bare token that matches
// the grammar can still be listed, and names themselves may be sensitive.
export function catalogIds(payload, kind) {
  if (!NATIVE_DOMAINS.includes(kind)) return unknownCatalog();
  const list = entriesOf(payload);
  if (!list) return unknownCatalog();
  let omitted = 0;
  const seen = new Set();
  const ids = [];
  let truncated = false;
  for (const e of list) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) { omitted += 1; continue; }
    const raw = kind === 'mcp' ? e?.name : e?.id;
    if (!allowedId(raw)) { omitted += 1; continue; }
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (ids.length < MAX_CATALOG_IDS) ids.push(raw);
    else truncated = true;
  }
  const valid = list.length - omitted;
  const complete = validNativePayload(payload, kind);
  if (valid === 0 && omitted > 0) return { ...unknownCatalog(), omitted };
  return { status: 'known', ids, truncated, count: valid, omitted, complete, countKind: complete ? 'total' : 'observed' };
}

const asResult = (r) => (r && typeof r === 'object' && typeof r.ok === 'boolean' ? r : { ok: false });

export function buildNativeReport({ directory, directoryStatus = 'ok', at, domainsQueried, agentResult, skillResult, toolResult, mcpResult, pluginResult, locatedSkills = [] }) {
  const a = asResult(agentResult); const s = asResult(skillResult);
  const t = asResult(toolResult); const m = asResult(mcpResult); const p = asResult(pluginResult);
  const aOk = a.ok && validNativePayload(a.payload, 'agent');
  const sOk = s.ok && validNativePayload(s.payload, 'skill');
  const tOk = t.ok && validNativePayload(t.payload, 'tool');
  const mOk = m.ok && validNativePayload(m.payload, 'mcp');
  const pOk = p.ok && validNativePayload(p.payload, 'plugin');
  const stamped = (typeof at === 'string' && !Number.isNaN(Date.parse(at))) ? at : new Date().toISOString();
  const queried = Array.isArray(domainsQueried)
    ? NATIVE_DOMAINS.filter((d) => domainsQueried.includes(d))
    : [...NATIVE_DOMAINS];
  const partial = queried.length < NATIVE_DOMAINS.length;
  const coreQueried = queried.includes('agent') && queried.includes('skill');
  const okOf = (d) => (d === 'agent' ? aOk : d === 'skill' ? sOk : d === 'tool' ? tOk : d === 'mcp' ? mOk : pOk);
  const queriedOk = directoryStatus === 'ok' && queried.length > 0 && queried.every(okOf);
  const results = { agent: a, skill: s, tool: t, mcp: m, plugin: p };
  // Only bounded enums/counts are projected: neither exception messages nor
  // rejected ids are echoed. Complete means a structurally valid list, not
  // successful invocation of any listed capability.
  const queries = Object.fromEntries(NATIVE_DOMAINS.map(domain => {
    const r = results[domain];
    if (!queried.includes(domain)) return [domain, { status: 'skipped', reason: 'not-requested', omitted: 'unknown' }];
    if (!r.ok) return [domain, { status: 'unknown', reason: ['timeout', 'unavailable', 'error'].includes(r.reason) ? r.reason : 'error', omitted: 'unknown' }];
    const entries = entriesOf(r.payload);
    if (!entries) return [domain, { status: 'unknown', reason: 'invalid-payload', omitted: 'unknown' }];
    const omitted = entries.length - usableEntries(r.payload, domain).length;
    return [domain, { status: omitted ? 'incomplete' : 'complete', reason: omitted ? 'omitted-entries' : 'ok', omitted }];
  }));
  const located = Array.isArray(locatedSkills) ? locatedSkills.filter((e) => e && typeof e === 'object' && allowedId(e.id)).map((e) => ({
    id: e.id.slice(0, MAX_ID_LENGTH),
    found: e.found === true ? true : e.found === false ? false : 'unknown',
    scope: e.scope === 'project-hint' || e.scope === 'external-hint' ? e.scope : 'unknown',
  })) : [];
  return {
    directory,
    directoryStatus,
    at: stamped,
    domainsQueried: queried,
    partial,
    queries,
    listDeadlineMs: LIST_DEADLINE_MS,
    agents: a.ok ? projectNativeAgents(a.payload) : unknownAgents(),
    skills: s.ok ? projectNativeSkills(s.payload) : unknownSkills(),
    tools: t.ok ? projectNativeToolCount(t.payload) : unknownCount(),
    mcp: m.ok ? projectNativeMcp(m.payload) : unknownMcp(),
    plugins: p.ok ? projectNativePluginCount(p.payload) : unknownCount(),
    catalog: {
      agent: a.ok ? catalogIds(a.payload, 'agent') : unknownCatalog(),
      skill: s.ok ? catalogIds(s.payload, 'skill') : unknownCatalog(),
      tool: t.ok ? catalogIds(t.payload, 'tool') : unknownCatalog(),
      mcp: m.ok ? catalogIds(m.payload, 'mcp') : unknownCatalog(),
      plugin: p.ok ? catalogIds(p.payload, 'plugin') : unknownCatalog(),
    },
    skillLocations: located,
    coreQueriesOk: directoryStatus === 'ok' && coreQueried && aOk && sOk,
    queriedOk,
    notice: 'Optional lists have independent bounded deadlines; cancellation is best-effort via Native request options where supported; tool.list has no documented signal parameter; underlying work may continue after cancellation or deadline, and no retry is made. Incomplete lists preserve observed entries but never prove absence; observed counts are not full totals. ' + (partial
      ? 'Read-only in-process location inventory; explicit tool call only, no hooks or auto queries; session location is verified against the plugin location on every call; registration does not prove connection completion or actual call success; listed presence never claims usable access; no service start, model call, permission request, or stored state; mcp reconnect behavior is unconfirmed and mcp is opt-in only; catalog ids are bounded with truncation marked and raw details omitted; id strings are grammar-screened only, with no secret screening claim; skill location scope is a lexical hint only and never verifies symlinks, existence, or access — use Native skill and read tooling for actual file checks; partial domains only, not a full inventory.'
      : 'Read-only in-process location inventory; explicit tool call only, no hooks or auto queries; session location is verified against the plugin location on every call; registration does not prove connection completion or actual call success; listed presence never claims usable access; no service start, model call, permission request, or stored state; mcp reconnect behavior is unconfirmed and mcp is opt-in only; catalog ids are bounded with truncation marked and raw details omitted; id strings are grammar-screened only, with no secret screening claim; skill location scope is a lexical hint only and never verifies symlinks, existence, or access — use Native skill and read tooling for actual file checks.'),
  };
}

// Fail-closed location checks. sameRoot is kept for session-location
// verification (current-project scope): both paths must actually resolve,
// otherwise the call is rejected. Skill-path scoping below is lexical only
// and never touches the filesystem, so a read-denied external resource can
// never be probed through it.
export async function sameRoot(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  let ra, rb;
  try {
    [ra, rb] = await Promise.all([realpath(a), realpath(b)]);
  } catch { return false; }
  return ra === rb;
}

// Lexical hint only: pure string normalization, no filesystem access, so no
// existence oracle is created. The result never verifies symlinks, existence,
// or access permissions — 'project-hint'/'external-hint' only means the
// listed path string falls inside/outside the session directory textually.
// Anything unverifiable is 'unknown'.
export function lexicalScopeHint(root, file) {
  if (typeof root !== 'string' || typeof file !== 'string' || !root || !file) return 'unknown';
  const normRoot = path.normalize(root);
  const normFile = path.normalize(file);
  if (normFile === normRoot || normFile.startsWith(normRoot + path.sep)) return 'project-hint';
  return 'external-hint';
}

function toolInput(properties, required) {
  return { type: 'object', properties, required: required ?? [], additionalProperties: false };
}

const cancelled = () => new DOMException('Inventory call cancelled', 'AbortError');
const checkCancelled = signal => { if (signal?.aborted) throw cancelled(); };
// Also stop waiting when an in-process method ignores RequestOptions.signal.
// This cannot forcibly stop its work. No timeout is applied to required reads.
async function withCallerCancellation(run, signal) {
  checkCancelled(signal);
  if (!signal) return run();
  let onAbort;
  try {
    return await Promise.race([
      new Promise((_, reject) => { onAbort = () => reject(cancelled()); signal.addEventListener('abort', onAbort, { once: true }); }),
      Promise.resolve().then(() => { checkCancelled(signal); return run(); }),
    ]);
  } finally { signal.removeEventListener('abort', onAbort); }
}

async function optionalList(fn, signal, supportsSignal) {
  checkCancelled(signal);
  if (typeof fn !== 'function') return { ok: false, reason: 'unavailable' };
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let timer;
  try {
    return await withCallerCancellation(() => Promise.race([
      new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve({ ok: false, reason: 'timeout' }); }, LIST_DEADLINE_MS); }),
      Promise.resolve().then(() => { checkCancelled(controller.signal); return supportsSignal ? fn(undefined, { signal: controller.signal }) : fn(); }).then(
        payload => ({ ok: true, payload }), () => ({ ok: false, reason: 'error' }),
      ),
    ]), signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function setupCapabilitiesInventory(ctx) {
  if (!ctx || typeof ctx !== 'object') fail('plugin context is unavailable');
  if (!ctx.tool || typeof ctx.tool.transform !== 'function') fail('tool registration is unavailable');
  const execute = async (input, tc) => {
    const signal = tc?.signal;
    checkCancelled(signal);
    const raw = input == null || typeof input !== 'object' || Array.isArray(input) ? {} : input;
    for (const k of Object.keys(raw)) {
      if (k !== 'domains' && k !== 'locateSkills') fail(`unsupported input: ${k}`);
    }
    if (raw.sessionID !== undefined || raw.sessionId !== undefined || raw.parentID !== undefined || raw.parentId !== undefined) fail('session inputs are not accepted');
    if (raw.domains !== undefined && !Array.isArray(raw.domains)) fail('domains must be an array of domain names');
    const wanted = raw.domains === undefined ? [...DEFAULT_NATIVE_DOMAINS] : resolveNativeDomainsStrict(raw.domains);
    if (raw.locateSkills !== undefined && !Array.isArray(raw.locateSkills)) fail('locateSkills must be an array of skill ids');
    if (Array.isArray(raw.locateSkills) && raw.locateSkills.length > MAX_LOCATE_SKILLS) fail('too many skill locations requested');
    // Requested ids use the same bounded grammar as catalog ids (pattern plus
    // tripwire): URL/sentence/token-shaped or off-grammar values are rejected
    // before any query and are never echoed into results. This is not secret
    // screening: a bare token matching the grammar can still be requested.
    if (Array.isArray(raw.locateSkills) && raw.locateSkills.some((d) => !allowedId(d))) fail('locateSkills must be bounded skill ids');
    // Session-local verification only: never accept a parent/other session id
    // from input. The calling session id comes from the tool context.
    const sessionID = tc?.sessionID;
    if (typeof sessionID !== 'string' || !sessionID) fail('calling session is unavailable');
    const pluginDirectory = ctx?.location?.directory;
    if (typeof pluginDirectory !== 'string' || !pluginDirectory) fail('plugin location directory is unavailable');
    if (!ctx.session || typeof ctx.session.get !== 'function') fail('calling session location is unavailable');
    let sessionDirectory;
    try {
      const gotten = await withCallerCancellation(() => ctx.session.get({ sessionID }, { signal }), signal);
      sessionDirectory = dataOf(gotten)?.location?.directory;
    } catch { checkCancelled(signal); fail('calling session location is unavailable'); }
    if (typeof sessionDirectory !== 'string' || !sessionDirectory) fail('calling session location is unavailable');
    if (!(await withCallerCancellation(() => sameRoot(sessionDirectory, pluginDirectory), signal))) fail('session moved; use the plugin in its current location');
    checkCancelled(signal);
    const stamped = new Date().toISOString();
    const want = (d) => wanted.includes(d);
    // V2's agent/skill/mcp/plugin list methods take RequestOptions as the
    // second argument. ToolContext.list() is in-process and accepts no args.
    const safeList = (domain, fn) => optionalList(fn, signal, domain !== 'tool');
    const [agentResult, skillResult, toolResult, mcpResult, pluginResult] = await Promise.all([
      want('agent') ? safeList('agent', ctx.agent?.list?.bind(ctx.agent)) : { ok: false },
      want('skill') ? safeList('skill', ctx.skill?.list?.bind(ctx.skill)) : { ok: false },
      want('tool') ? safeList('tool', ctx.tool?.list?.bind(ctx.tool)) : { ok: false },
      want('mcp') ? safeList('mcp', ctx.mcp?.list?.bind(ctx.mcp)) : { ok: false },
      want('plugin') ? safeList('plugin', ctx.plugin?.list?.bind(ctx.plugin)) : { ok: false },
    ]);
    checkCancelled(signal);
    let locatedSkills = [];
    if (Array.isArray(raw.locateSkills) && raw.locateSkills.length) {
      if (skillResult.ok && entriesOf(skillResult.payload)) {
        const complete = validNativePayload(skillResult.payload, 'skill');
        const byId = new Map();
        for (const e of usableEntries(skillResult.payload, 'skill')) {
          const k = keyOf(e, 'skill');
          if (k && !byId.has(k)) byId.set(k, e);
        }
        for (const id of raw.locateSkills) {
          const entry = byId.get(id);
          // Confirmed absence in a verified list is found:false. Anything
          // else is unconfirmed, never a false absence claim. Scope is a
          // lexical hint from the listed path string only: no filesystem
          // lookup is performed, so a read-denied external resource cannot
          // be probed through this tool, and symlinks are never resolved.
          if (!entry) { locatedSkills.push({ id, found: complete ? false : 'unknown', scope: 'unknown' }); continue; }
          const p = entry.path;
          if (typeof p !== 'string' || !p) { locatedSkills.push({ id, found: true, scope: 'unknown' }); continue; }
          locatedSkills.push({ id, found: true, scope: lexicalScopeHint(sessionDirectory, p) });
        }
      } else {
        locatedSkills = raw.locateSkills.map((id) => ({ id, found: 'unknown', scope: 'unknown' }));
      }
    }
    const report = buildNativeReport({
      directory: sessionDirectory, directoryStatus: 'ok', at: stamped, domainsQueried: wanted,
      agentResult, skillResult, toolResult, mcpResult, pluginResult, locatedSkills,
    });
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  };
  const registration = await ctx.tool.transform((editor) => {
    editor.add({
      name: 'ksi_capabilities_inventory',
      description: 'Read-only selective inventory of the current location (agents, skills, tools, mcp, plugins) with bounded catalog ids. Session-verified explicit call only; mcp is opt-in until reconnect behavior is confirmed. Registration does not prove usable access. Skill location scope is a lexical hint only, never a verified file check. For full skill file paths use existing Native skill tooling; this inventory never returns absolute paths.',
      input: toolInput({
        domains: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 128 }, description: 'Subset of agent,skill,tool,mcp,plugin; omitted means the default set without mcp.' },
        locateSkills: { type: 'array', maxItems: 5, items: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$' }, description: 'Approved skill ids for a lexical location hint (project-hint/external-hint/unknown); never a verified file check and never returns paths.' },
      }, []),
      options: { codemode: false },
      execute,
    });
  });
  return async () => { await registration.dispose(); };
}
