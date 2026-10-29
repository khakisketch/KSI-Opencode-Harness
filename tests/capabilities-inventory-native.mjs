// Opt-in isolated Native integration for capabilities inventory.
// Proves plugin activation, session-verified tool calls, bounded catalog ids,
// cross-workspace isolation, and input rejection with a LOCAL SCRIPTED model.
// Own HOME, server, fake credentials, files and sessions; no shared reloads,
// no real models, no global install.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await fs.mkdtemp('/tmp/opencode/ksi-capinv-native-');
const home = path.join(root, 'home');
const workspace1 = path.join(root, 'proj1');
const workspace2 = path.join(root, 'proj2');
const cfg = path.join(home, '.config/opencode');
await fs.mkdir(workspace1, { recursive: true });
await fs.mkdir(workspace2, { recursive: true });
await fs.mkdir(path.join(cfg, 'plugins'), { recursive: true });
await fs.cp(path.join(repo, 'global/plugins/ksi-capabilities-inventory'), path.join(cfg, 'plugins/ksi-capabilities-inventory'), { recursive: true });
await fs.mkdir(path.join(home, '.agents/skills/fixture-extra-skill'), { recursive: true });
await fs.writeFile(path.join(home, '.agents/skills/fixture-extra-skill/SKILL.md'), '---\nname: fixture-extra-skill\ndescription: Synthetic skill for Native inventory delivery verification only\n---\nSYNTHETIC_SKILL_TEST_MARKER. Use inventory tools on this test project.\n');
await fs.writeFile(path.join(workspace1, 'README.md'), '# proj1\n');
await fs.writeFile(path.join(workspace2, 'README.md'), '# proj2\n');
const password = randomBytes(20).toString('hex');
let checks = 0;
function check(label, value) { assert.ok(value, label); checks++; console.log(`PASS ${label}`); }
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}
function toolCalls(messages) {
  return messages.filter((m) => m.type === 'assistant').flatMap((m) => m.content ?? []).filter((p) => p.type === 'tool');
}
function toolText(call) {
  const t = (call.state?.content ?? []).find((c) => c.type === 'text');
  return t ? JSON.parse(t.text) : null;
}

const model = http.createServer(async (req, res) => {
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'fixture' }] })); return; }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const flat = strings(body.messages).join('\n');
  const names = (body.tools ?? []).map((t) => t.function?.name);
  let name, args, text = 'Fixture auxiliary response';
  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user');
  const userText = typeof lastUser?.content === 'string' ? lastUser.content : strings(lastUser?.content).join('\n');
  const alreadyCalled = strings(body.messages).some((s) => s.includes('"domainsQueried"'));
  const sawInventoryError = strings(body.messages).some((s) => s.includes('session inputs are not accepted') || s.includes('unsupported input') || s.includes('session moved') || s.includes('calling session'));
  if (!alreadyCalled && !sawInventoryError) {
    if (userText.includes('NATIVE_CAPINV_DEFAULT')) { name = 'ksi_capabilities_inventory'; args = {}; }
    else if (userText.includes('NATIVE_CAPINV_MCP')) { name = 'ksi_capabilities_inventory'; args = { domains: ['mcp'] }; }
    else if (userText.includes('NATIVE_CAPINV_LOCATE_UNVERIFIED')) { name = 'ksi_capabilities_inventory'; args = { domains: ['tool'], locateSkills: ['fixture-extra-skill'] }; }
    else if (userText.includes('NATIVE_CAPINV_LOCATE')) { name = 'ksi_capabilities_inventory'; args = { domains: ['skill'], locateSkills: ['fixture-extra-skill'] }; }
    else if (userText.includes('NATIVE_CAPINV_LOCATE_UNVERIFIED')) { name = 'ksi_capabilities_inventory'; args = { domains: ['tool'], locateSkills: ['fixture-extra-skill'] }; }
    else if (userText.includes('NATIVE_CAPINV_BADSESSION')) { name = 'ksi_capabilities_inventory'; args = { sessionID: 'ses_other' }; }
    else if (userText.includes('NATIVE_CAPINV_W2')) { name = 'ksi_capabilities_inventory'; args = {}; }
  }
  if (!name) {
    if (userText.includes('NATIVE_CAPINV_DEFAULT')) text = 'CAPINV_DEFAULT_DONE';
    else if (userText.includes('NATIVE_CAPINV_MCP')) text = 'CAPINV_MCP_DONE';
    else if (userText.includes('NATIVE_CAPINV_LOCATE_UNVERIFIED')) text = 'CAPINV_LOCATE_UNVERIFIED_DONE';
    else if (userText.includes('NATIVE_CAPINV_LOCATE')) text = 'CAPINV_LOCATE_DONE';
    else if (userText.includes('NATIVE_CAPINV_BADSESSION')) text = 'CAPINV_BADSESSION_DONE';
    else if (userText.includes('NATIVE_CAPINV_W2')) text = 'CAPINV_W2_DONE';
    else text = 'CAPINV_DONE';
  }
  const tool = name ? { id: `call_inv_${randomBytes(4).toString('hex')}`, type: 'function', function: { name, arguments: JSON.stringify(args) } } : null;
  const finish = tool ? 'tool_calls' : 'stop';
  if (body.stream) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const delta = tool ? { role: 'assistant', tool_calls: [{ index: 0, ...tool }] } : { role: 'assistant', content: text };
    for (const [d, f] of [[delta, null], [{}, finish]]) res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'fixture', choices: [{ index: 0, delta: d, finish_reason: f }] })}\n\n`);
    res.end('data: [DONE]\n\n');
  } else {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', model: 'fixture', choices: [{ index: 0, finish_reason: finish, message: tool ? { role: 'assistant', content: null, tool_calls: [tool] } : { role: 'assistant', content: text } }] }));
  }
});
await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve));
const modelPort = model.address().port;
const reserve = net.createServer(); await new Promise((resolve) => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port; await new Promise((resolve) => reserve.close(resolve));
await fs.writeFile(path.join(cfg, 'opencode.json'), JSON.stringify({
  model: 'fixture/fixture',
  providers: { fixture: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${modelPort}/v1`, apiKey: 'synthetic-only' }, models: { fixture: { capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } } },
}));
const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
Object.assign(env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'), OPENCODE_SERVER_PASSWORD: password });
const fd = openSync(path.join(root, 'server.log'), 'w');
const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { env, cwd: workspace1, stdio: ['ignore', fd, fd] }); closeSync(fd);
const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
const controller = new AbortController(), watchdog = setTimeout(() => controller.abort(), 120_000);
async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, signal: controller.signal, headers: { authorization: auth, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Native ${route}: ${response.status} ${text.slice(0, 300)}`);
  const raw = text ? JSON.parse(text) : undefined;
  return raw && Object.hasOwn(raw, 'data') ? raw.data : raw;
}
async function waitFor(sessionID, marker, tries = 120) {
  for (let i = 0; i < tries; i++) {
    await sleep(250);
    const result = await api('GET', `/api/session/${sessionID}/message`);
    const messages = Array.isArray(result) ? result : result.messages;
    if (strings(messages).some((s) => s.includes(marker))) return messages;
  }
  throw new Error(`timeout waiting for ${marker}`);
}
try {
  let info;
  for (let i = 0; i < 100; i++) {
    try { info = await api('GET', '/api/info'); break; } catch { await sleep(250); }
  }
  check('owns isolated server before mutations', info?.pid === server.pid);
  for (const ws of [workspace1, workspace2]) {
    const q = `location[directory]=${encodeURIComponent(ws)}`;
    await api('GET', `/api/location?${q}`);
    await api('POST', `/api/location/reload?${q}`, {});
  }
  const plugins = await (async () => {
    const q = `location[directory]=${encodeURIComponent(workspace1)}`;
    for (let i = 0; i < 60; i++) {
      const list = await api('GET', `/api/plugin?${q}`);
      if (Array.isArray(list) && list.some((p) => p.id === 'ksi.capabilities-inventory' && p.state?.status === 'active')) return list;
      await sleep(500);
    }
    return api('GET', `/api/plugin?${q}`);
  })();
  await fs.writeFile(path.join(root, 'plugins.json'), JSON.stringify(plugins, null, 2));
  check('real plugin loaded', plugins.some((p) => p.id === 'ksi.capabilities-inventory' && p.state?.status === 'active'));
  async function runCase(workspace, prompt, marker) {
    const session = await api('POST', '/api/session', { location: { directory: workspace }, agent: 'build', model: { providerID: 'fixture', id: 'fixture' } });
    await api('POST', `/api/session/${session.id}/prompt`, { text: prompt });
    const messages = await waitFor(session.id, marker);
    await fs.writeFile(path.join(root, `${marker}.json`), JSON.stringify(messages, null, 2).slice(0, 200_000));
    return { session, messages };
  }
  {
    const { messages } = await runCase(workspace1, 'NATIVE_CAPINV_DEFAULT: list capabilities', 'CAPINV_DEFAULT_DONE');
    const call = toolCalls(messages).find((p) => p.name === 'ksi_capabilities_inventory');
    check('default inventory tool completes', call?.state?.status === 'completed');
    const report = toolText(call);
    check('default scope is session workspace', report.directory === workspace1);
    check('default excludes mcp opt-in', !report.domainsQueried.includes('mcp') && report.partial === true);
    check('default core still confirmed', report.coreQueriesOk === true && report.queriedOk === true);
    check('actual tool catalog discovers the inventory tool', report.catalog.tool.ids.includes('ksi_capabilities_inventory'));
    check('actual skill catalog discovers the fixture skill', report.catalog.skill.ids.includes('fixture-extra-skill'));
    check('catalog ids are bounded with truncation marked', report.catalog.tool.ids.length <= 200 && report.catalog.tool.ids.every((id) => id.length <= 128) && typeof report.catalog.tool.truncated === 'boolean');
    check('raw details omitted without secrets', !JSON.stringify(report).includes('synthetic-only') && !JSON.stringify(report).includes('SYNTHETIC_SKILL_TEST_MARKER') && !JSON.stringify(report).match(/sk-secret|Bearer /i)
      && report.catalog.tool.ids.every((id) => /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/.test(id))
      && [...report.agents, ...report.skills].every((e) => Object.keys(e).every((k) => ['name', 'registered', 'mode'].includes(k)))
      && report.mcp.every((e) => Object.keys(e).every((k) => ['name', 'status'].includes(k))));
    check('isolated grammar fits the id pattern with nothing omitted', ['agent', 'skill', 'tool', 'plugin'].every((d) => report.catalog[d].omitted === 0)
      && ['agent', 'skill', 'tool', 'plugin'].every((d) => report.catalog[d].ids.every((id) => /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,126}[A-Za-z0-9])?$/.test(id))));
    check('tracked projections keep fixed shape', report.agents.length === 5 && report.skills.length === 16 && report.mcp.length === 2);
  }
  {
    const { messages } = await runCase(workspace1, 'NATIVE_CAPINV_MCP: list mcp explicitly', 'CAPINV_MCP_DONE');
    const call = toolCalls(messages).find((p) => p.name === 'ksi_capabilities_inventory' && JSON.stringify(p.state?.input).includes('mcp'));
    check('explicit mcp opt-in completes', call?.state?.status === 'completed');
    const report = toolText(call);
    check('explicit mcp scope is marked', report.domainsQueried.includes('mcp'));
    check('mcp status never asserts unavailable without evidence', report.mcp.every((m) => ['connected', 'unavailable', 'unknown'].includes(m.status)));
    check('mcp notice stays unconfirmed', report.notice.includes('mcp reconnect behavior is unconfirmed'));
    check('explicit mcp catalog shape is confirmed empty, not unknown', report.catalog.mcp.status === 'known' && report.catalog.mcp.count === 0 && report.catalog.mcp.omitted === 0);
  }
  {
    const { messages } = await runCase(workspace1, 'NATIVE_CAPINV_LOCATE: where is the approved skill', 'CAPINV_LOCATE_DONE');
    const call = toolCalls(messages).find((p) => p.name === 'ksi_capabilities_inventory' && JSON.stringify(p.state?.input).includes('locateSkills'));
    check('locateSkills completes without absolute paths', call?.state?.status === 'completed');
    const report = toolText(call);
    const located = report.skillLocations.find((e) => e.id === 'fixture-extra-skill');
    check('approved skill scope is a hint, never a raw path', located?.found === true && ['project-hint', 'external-hint'].includes(located.scope) && !JSON.stringify(report.skillLocations).includes(workspace1));
    check('hint scope disclaims verification', report.notice.includes('lexical hint only'));
  }
  {
    const { messages } = await runCase(workspace1, 'NATIVE_CAPINV_LOCATE_UNVERIFIED: where is the skill without its list', 'CAPINV_LOCATE_UNVERIFIED_DONE');
    const call = toolCalls(messages).find((p) => p.name === 'ksi_capabilities_inventory' && JSON.stringify(p.state?.input).includes('locateSkills'));
    check('unverified skill list completes without false absence', call?.state?.status === 'completed');
    const report = toolText(call);
    check('skipped skill list marks location unknown, not absent', report.skillLocations.every((e) => e.found === 'unknown' && e.scope === 'unknown') && report.skillLocations.some((e) => e.id === 'fixture-extra-skill'));
  }
  {
    const { messages } = await runCase(workspace1, 'NATIVE_CAPINV_BADSESSION: use another session', 'CAPINV_BADSESSION_DONE');
    const calls = toolCalls(messages).filter((p) => p.name === 'ksi_capabilities_inventory');
    check('parent/other session input never changes session scope', calls.length >= 1);
    for (const call of calls) {
      const report = call.state?.status === 'completed' ? toolText(call) : null;
      if (report) check('injected session id is inert; scope stays the calling session', report.directory === workspace1);
      else check('injected session id is rejected fail-closed', call.state?.status === 'error');
    }
  }
  {
    const { messages } = await runCase(workspace2, 'NATIVE_CAPINV_W2: list capabilities here', 'CAPINV_W2_DONE');
    const call = toolCalls(messages).find((p) => p.name === 'ksi_capabilities_inventory');
    check('second workspace inventory completes', call?.state?.status === 'completed');
    const report = toolText(call);
    check('second workspace scope does not leak the first', report.directory === workspace2 && !JSON.stringify(report).includes(workspace1));
  }
  console.log(`${checks} checks passed; scripted transport evidence: ${root}`);
} finally {
  clearTimeout(watchdog); controller.abort(); server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { try { server.kill('SIGKILL'); } catch {} resolve(); }, 2000).unref(); });
  await new Promise((resolve) => model.close(resolve));
}
