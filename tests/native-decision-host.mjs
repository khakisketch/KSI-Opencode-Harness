// Isolated OpenCode Native-host integration. All models are loopback fakes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await fs.mkdtemp(path.join(process.env.KSI_HARNESS_ROOT || process.env.TMPDIR || os.tmpdir(), 'native-decision-host-'));
const home = path.join(root, 'home'), project = path.join(root, 'project'), foreign = path.join(root, 'foreign');
const cfg = path.join(home, '.config/opencode'), plugin = path.join(root, 'plugin');
await Promise.all([fs.mkdir(cfg, { recursive: true }), fs.mkdir(project), fs.mkdir(foreign)]);
// Outside every automatic discovery directory: only the configured instance loads.
await fs.cp(path.join(repo, 'global/plugins/ksi-native-decision'), plugin, { recursive: true });
const strings = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
const decisionCalls = [], chatInputs = [];
const fake = http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    if (req.url === '/decision/v1/systemone') {
      decisionCalls.push(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ model: 'fixture', answers: { advice: { type: 'noul', noul: 0.81 } }, usage: { input_tokens: 4, output_tokens: 1 } }));
    }
    if (req.url !== '/chat/v1/chat/completions') { res.writeHead(404); return res.end(); }
    const flat = strings(body.messages).join('\n');
    chatInputs.push(flat);
    const done = body.messages?.some(m => m.role === 'tool') || flat.includes('"status":"advisory"') || flat.includes('"status":"unavailable"') || flat.includes('permission.rejected') || flat.includes('Permission denied: decision.evaluate') || flat.includes('No tool named');
    const delegate = flat.includes('SYNTHETIC_DELEGATION_ROOT') && !flat.includes('SYNTHETIC_DELEGATION_CHILD');
    const call = done ? undefined : delegate
      ? { id: 'call_fixture', type: 'function', function: { name: 'subagent', arguments: JSON.stringify({ agent: 'lead', description: 'Fixture decision advice', prompt: 'SYNTHETIC_DELEGATION_CHILD: call the fixture decision tool once and return the result.' }) } }
      : { id: 'call_fixture', type: 'function', function: { name: 'ksi_native_decision', arguments: JSON.stringify({ question: 'Should this synthetic task be delegated?', context: 'SYNTHETIC_CONTEXT_ONLY' }) } };
    const finish = call ? 'tool_calls' : 'stop';
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = call ? { role: 'assistant', tool_calls: [{ index: 0, ...call }] } : { role: 'assistant', content: 'FIXTURE_DONE' };
      for (const [d, f] of [[delta, null], [{}, finish]]) res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'fixture', choices: [{ index: 0, delta: d, finish_reason: f }] })}\n\n`);
      return res.end('data: [DONE]\n\n');
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', model: 'fixture', choices: [{ index: 0, finish_reason: finish, message: call ? { role: 'assistant', content: null, tool_calls: [call] } : { role: 'assistant', content: 'FIXTURE_DONE' } }] }));
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
const fakePort = fake.address().port;
const reserve = net.createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
await fs.writeFile(path.join(cfg, 'opencode.json'), JSON.stringify({
  model: 'fixturechat/fixture',
  agents: { lead: { mode: 'subagent', description: 'Synthetic Lead for delegation testing.' } },
  providers: {
    fixturechat: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${fakePort}/chat/v1`, apiKey: 'synthetic-only' }, models: { fixture: { capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } },
    fixturedecision: { package: '@opencode/ai/providers/opencode/decisions', settings: { baseURL: `http://127.0.0.1:${fakePort}/decision/v1`, apiKey: 'synthetic-only' }, models: { fixture: { type: 'decision' } } },
  },
  plugins: [{ package: plugin, options: { enabled: true, allowDataTransfer: true, model: { providerID: 'fixturedecision', id: 'fixture' } } }],
}));
const password = randomBytes(20).toString('hex');
const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TERM'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { HOME: home, TMPDIR: root, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'), OPENCODE_SERVER_PASSWORD: password,
  KSI_NATIVE_DECISION_CONSENT: JSON.stringify([{ directory: project, providerID: 'fixturedecision', id: 'fixture', allowDataTransfer: true }]) });
const fd = openSync(path.join(root, 'server.log'), 'w');
const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { env, cwd: project, stdio: ['ignore', fd, fd] }); closeSync(fd);
const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
const controller = new AbortController(), watchdog = setTimeout(() => controller.abort(), 100000);
async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, signal: controller.signal, headers: { authorization: auth, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text(); if (!response.ok) throw Error(`${method} ${route}: ${response.status} ${text.slice(0, 500)}`);
  const parsed = text ? JSON.parse(text) : undefined; return parsed && Object.hasOwn(parsed, 'data') ? parsed.data : parsed;
}
async function run(directory, permissions, text = 'SYNTHETIC_HOST_CASE: call the fixture decision tool once.') {
  const session = await api('POST', '/api/session', { location: { directory }, agent: 'build', model: { providerID: 'fixturechat', id: 'fixture' }, ...(permissions ? { permissions } : {}) });
  await api('POST', `/api/session/${session.id}/prompt`, { text });
  let messages;
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const page = await api('GET', `/api/session/${session.id}/message`); messages = Array.isArray(page) ? page : page.messages;
    if (messages.some(m => m.type === 'assistant' && m.finish === 'stop' && strings(m.content).some(s => s.includes('FIXTURE_DONE')))) return { messages, session };
  }
  await fs.writeFile(path.join(root, 'timeout.json'), JSON.stringify({ messages, chatInputs }, null, 2));
  throw Error(`scripted Build did not finish; evidence at ${root}`);
}
const parts = messages => messages.filter(m => m.type === 'assistant').flatMap(m => m.content ?? []).filter(p => p.type === 'tool' && p.name === 'ksi_native_decision');
try {
  let info;
  for (let i = 0; i < 100; i++) { try { info = await api('GET', '/api/info'); break; } catch { await sleep(100); } }
  assert.equal(info?.pid, server.pid, 'owns isolated server');
  const { messages: allowed } = await run(project);
  await fs.writeFile(path.join(root, 'allowed.json'), JSON.stringify(allowed, null, 2));
  const loaded = await api('GET', `/api/plugin?location[directory]=${encodeURIComponent(project)}`);
  assert.equal(loaded.filter(p => p.id === 'ksi.native-decision' && p.state.status === 'active').length, 1, 'exactly one active configured plugin');
  assert.equal(parts(allowed).length, 1);
  assert.equal(parts(allowed)[0].state.status, 'completed');
  assert.ok(strings(parts(allowed)[0]).some(s => s.includes('"status":"advisory"') && s.includes('0.81')), 'decoded advisory returned in tool result');
  assert.ok(chatInputs.some(s => s.includes('"status":"advisory"') && s.includes('0.81')), 'scripted Build received advisory');
  assert.equal(decisionCalls.length, 1); assert.equal(decisionCalls[0].state, 'SYNTHETIC_CONTEXT_ONLY');
  const { messages: denied } = await run(project, [{ action: 'decision.evaluate', resource: '*', effect: 'deny' }]);
  assert.equal(parts(denied).length, 1); assert.equal(parts(denied)[0].state.status, 'error');
  assert.equal(decisionCalls.length, 1, 'denied request made no provider call');
  const { messages: unconsented } = await run(foreign);
  assert.equal(parts(unconsented).length, 1);
  assert.ok(strings(parts(unconsented)[0]).some(s => s.includes('"status":"unavailable"')));
  assert.equal(decisionCalls.length, 1, 'unconsented request made no provider call');
  const delegation = await run(project, [{ action: 'decision.evaluate', resource: 'fixturedecision/fixture', effect: 'allow' }], 'SYNTHETIC_DELEGATION_ROOT: delegate this synthetic task to Lead.');
  const subagent = delegation.messages.filter(m => m.type === 'assistant').flatMap(m => m.content ?? []).filter(p => p.type === 'tool' && p.name === 'subagent');
  assert.equal(subagent.length, 1); assert.equal(subagent[0].state.status, 'completed');
  const page = await api('GET', `/api/session?parentID=${encodeURIComponent(delegation.session.id)}`);
  const children = Array.isArray(page) ? page : page.sessions;
  assert.equal(children.length, 1, 'one actual delegated child session');
  const childPage = await api('GET', `/api/session/${children[0].id}/message`);
  const child = Array.isArray(childPage) ? childPage : childPage.messages;
  await fs.writeFile(path.join(root, 'lead-messages.json'), JSON.stringify(child, null, 2));
  assert.ok(child.some(m => m.type === 'assistant' && m.agent === 'lead'), 'child runs Lead');
  assert.equal(parts(child).length, 1); assert.equal(parts(child)[0].state.status, 'completed');
  assert.ok(strings(parts(child)[0]).some(s => s.includes('"status":"advisory"') && s.includes('0.81')), 'Lead receives advisory');
  assert.ok(chatInputs.some(s => s.includes('SYNTHETIC_DELEGATION_CHILD') && s.includes('"status":"advisory"') && s.includes('0.81')), 'advisory reached scripted Lead model');
  assert.equal(decisionCalls.length, 2, 'one additional Lead fake-provider call');
  console.log(`PASS isolated Native host: Build and delegated Lead advisory, deny, no consent; evidence ${root}`);
} catch (e) { console.error(`Evidence: ${root}`); throw e; }
finally {
  clearTimeout(watchdog); controller.abort(); server.kill('SIGTERM');
  await new Promise(resolve => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000).unref(); });
  await new Promise(resolve => fake.close(resolve));
}
