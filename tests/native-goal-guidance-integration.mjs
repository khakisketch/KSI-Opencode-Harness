// Opt-in isolated transport check of the repository's common and Lead guidance.
// This proves delivery to scripted Build/Lead inputs, not model understanding,
// Goal activation, status propagation, test success or product acceptance.
// Private HOME/server and fake loopback model only; no shared server or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const source = fileURLToPath(new URL('../global/', import.meta.url));
const root = await fs.mkdtemp(path.join(process.env.KSI_HARNESS_ROOT || process.env.TMPDIR || os.tmpdir(), 'ksi-native-goal-guidance-fixture-'));
const home = path.join(root, 'home'), project = path.join(root, 'project');
const cfg = path.join(home, '.config/opencode');
await fs.mkdir(path.join(cfg, 'agents'), { recursive: true });
await fs.mkdir(project, { recursive: true });
const shared = await fs.readFile(path.join(source, 'AGENTS.md'), 'utf8');
const lead = await fs.readFile(path.join(source, 'agents/lead.md'), 'utf8');
assert.ok(shared.includes('- **Native goal.**'));
assert.ok(lead.includes("An active Native /goal in Build's session is not inherited by this child."));
const isolatedLead = lead.replace(/^model:\s*[^\r\n]+$/m, 'model: fixture/fixture');
assert.notEqual(lead, isolatedLead);
await fs.writeFile(path.join(cfg, 'AGENTS.md'), shared);
await fs.writeFile(path.join(cfg, 'agents/lead.md'), isolatedLead);
const strings = v => typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : [];
const norm = v => v.replace(/\r\n/g, '\n').trim();
const leadBody = lead.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
const observed = [];
let parentStep = 0;
const model = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ data: [{ id: 'fixture' }] })); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const flat = strings(body.messages).join('\n');
    const users = (body.messages ?? []).filter(m => m.role === 'user').flatMap(m => strings(m.content)).join('\n');
    const isAgentLoop = Array.isArray(body.tools) && body.tools.length > 0;
    const isMain = flat.includes('You are an AI agent running in OpenCode');
    const child = users.includes('SOURCE_FIXTURE_CHILD');
    let tool, text = 'fixture auxiliary';
    if (isAgentLoop && child) {
      observed.push({ role: 'lead', isMain, hasCommon: norm(flat).includes(norm(shared)), hasLead: norm(flat).includes(norm(leadBody)) });
      text = 'SOURCE_FIXTURE_CHILD_DONE';
    } else if (isAgentLoop && isMain && flat.includes('SOURCE_FIXTURE_PARENT')) {
      observed.push({ role: 'build', hasCommon: norm(flat).includes(norm(shared)) });
      if (parentStep++ === 0) tool = { id: 'fixture_lead_call', type: 'function', function: { name: 'subagent', arguments: JSON.stringify({ agent: 'lead', description: 'Test source guidance', prompt: 'SOURCE_FIXTURE_CHILD: return the fixture completion marker.' }) } };
      else text = 'SOURCE_FIXTURE_PARENT_DONE';
    }
    const finish = tool ? 'tool_calls' : 'stop';
    if (body.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const delta = tool ? { role: 'assistant', tool_calls: [{ index: 0, ...tool }] } : { role: 'assistant', content: text };
      for (const [d, f] of [[delta, null], [{}, finish]]) res.write(`data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'fixture', choices: [{ index: 0, delta: d, finish_reason: f }] })}\n\n`);
      return res.end('data: [DONE]\n\n');
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ id: 'fixture', object: 'chat.completion', model: 'fixture', choices: [{ index: 0, finish_reason: finish, message: tool ? { role: 'assistant', content: null, tool_calls: [tool] } : { role: 'assistant', content: text } }] }));
  } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
});
await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
const mp = model.address().port;
const reserve = net.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
await fs.writeFile(path.join(cfg, 'opencode.json'), JSON.stringify({
  model: 'fixture/fixture',
  experimental: { subagent_depth: 2 },
  providers: { fixture: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${mp}/v1`, apiKey: 'synthetic-only' },
    models: { fixture: { capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } } },
  agents: { build: { permissions: [{ action: 'subagent', resource: '*', effect: 'deny' }, { action: 'subagent', resource: 'lead', effect: 'allow' }] } },
}));
const password = randomBytes(20).toString('hex');
const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TERM'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { HOME: home, TMPDIR: root, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'), OPENCODE_SERVER_PASSWORD: password });
const fd = openSync(path.join(root, 'server.log'), 'w');
const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { env, cwd: project, stdio: ['ignore', fd, fd] });
closeSync(fd);
const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
const ctrl = new AbortController(), watchdog = setTimeout(() => ctrl.abort(), 90_000);
async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, signal: ctrl.signal, headers: { authorization: auth, 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${text.slice(0, 200)}`);
  const raw = text ? JSON.parse(text) : undefined;
  return raw && Object.hasOwn(raw, 'data') ? raw.data : raw;
}
try {
  let info;
  for (let i = 0; i < 100; i++) { try { info = await api('GET', '/api/info'); break; } catch { await sleep(100); } }
  assert.equal(info?.pid, server.pid, 'refuse to mutate a server other than the owned child');
  assert.equal(server.exitCode, null);
  const session = await api('POST', '/api/session', { location: { directory: project }, agent: 'build', model: { providerID: 'fixture', id: 'fixture' } });
  await api('POST', `/api/session/${session.id}/prompt`, { text: 'SOURCE_FIXTURE_PARENT: ask the Lead fixture to return its marker.' });
  let messages;
  for (let i = 0; i < 200; i++) {
    await sleep(100);
    const raw = await api('GET', `/api/session/${session.id}/message`);
    messages = Array.isArray(raw) ? raw : raw.messages;
    if (strings(messages).includes('SOURCE_FIXTURE_PARENT_DONE')) break;
  }
  assert.ok(strings(messages).includes('SOURCE_FIXTURE_PARENT_DONE'));
  assert.ok(observed.some(x => x.role === 'build' && x.hasCommon), 'full common source reached scripted Build input');
  assert.ok(observed.some(x => x.role === 'lead' && x.hasCommon && x.hasLead), 'full common and Lead source reached scripted Lead input');
  const calls = messages.flatMap(m => m.content ?? []).filter(p => p?.type === 'tool' && p?.name === 'subagent');
  assert.ok(calls.some(p => p?.state?.status === 'completed' && strings(p.state?.content).some(x => x.includes('SOURCE_FIXTURE_CHILD_DONE'))));
  for (const [f, expected] of [[path.join(source, 'AGENTS.md'), shared], [path.join(source, 'agents/lead.md'), lead]]) {
    assert.equal(createHash('sha256').update(await fs.readFile(f)).digest('hex'), createHash('sha256').update(expected).digest('hex'), 'source file stable during fixture');
  }
  console.log(`PASS isolated OpenCode delivered copied common source to scripted Build, and full common plus Lead source to scripted Lead; model override only in sandbox. ${root}`);
} catch (err) {
  console.error(`FAIL isolated source-guidance fixture ${root}: ${err.stack}; observations=${JSON.stringify(observed)}`);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog); ctrl.abort(); server.kill('SIGTERM');
  await new Promise(resolve => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000).unref(); });
  await new Promise(resolve => model.close(resolve));
}
