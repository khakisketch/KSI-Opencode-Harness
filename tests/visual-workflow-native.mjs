// Opt-in real Native transport/permission test with a LOCAL SCRIPTED model.
// Proves skill activation and tool/image wiring, NOT model/design quality.
// Own HOME, server, fake credentials, files and sessions; no shared reloads.
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
import { fixturePng } from './helpers/visual-fixture.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await fs.mkdtemp('/tmp/opencode/ksi-visual-native-');
const home = path.join(root, 'home'), workspace = path.join(root, 'project');
const cfg = path.join(home, '.config/opencode');
await fs.mkdir(workspace, { recursive: true });
await fs.mkdir(path.join(cfg, 'plugins'), { recursive: true });
await fs.mkdir(path.join(home, '.agents/skills/impeccable'), { recursive: true });
await fs.cp(path.join(repo, 'global/plugins/ksi-visual-workflow'), path.join(cfg, 'plugins/ksi-visual-workflow'), { recursive: true });
await fs.writeFile(path.join(home, '.agents/skills/impeccable/SKILL.md'), '---\nname: impeccable\ndescription: Synthetic skill for Native delivery verification only\n---\nSYNTHETIC_SKILL_TEST_MARKER. Use the visual tools on this test project.\n');
await fs.writeFile(path.join(workspace, 'Screen.kt'), 'fun screen() = "original"\n');
await fs.writeFile(path.join(workspace, 'tokens.xml'), '<color name="primary">#123456</color>');
await fs.writeFile(path.join(workspace, 'before.png'), fixturePng());
await fs.writeFile(path.join(workspace, 'after.png'), fixturePng(32, 24, 90));
const password = randomBytes(20).toString('hex');
const observations = [];
let step = 0, deniedStep = 0, checks = 0;
function check(label, value) { assert.ok(value, label); checks++; console.log(`PASS ${label}`); }
function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}
const model = http.createServer(async (req, res) => {
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'fixture' }] })); return; }
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const flat = strings(body.messages).join('\n');
  const names = (body.tools ?? []).map(t => t.function?.name);
  await fs.writeFile(path.join(root, 'model-shape.json'), JSON.stringify({ keys: Object.keys(body), tools: body.tools?.map(t => ({ type: t.type, name: t.name, function: t.function?.name, namespace: t.namespace })) }, null, 2));
  const primary = names.includes('visual_prepare');
  let name, args, text = 'Fixture auxiliary response';
  if (primary && flat.includes('NATIVE_VISUAL_DENIED')) {
    if (deniedStep++ === 0) { name = 'visual_prepare'; args = { target: 'Screen.kt', resources: ['tokens.xml'] }; }
    else text = 'VISUAL_DENIAL_COMPLETE';
  } else if (primary) {
    observations.push({ step, hasSkill: flat.includes('SYNTHETIC_SKILL_TEST_MARKER'), hasRuntime: flat.includes('KSI visual tools'), hasTokens: flat.includes('#123456'), imageCount: (flat.match(/data:image\/png;base64,/g) ?? []).length });
    if (step === 0) { name = 'visual_prepare'; args = { target: 'Screen.kt', resources: ['tokens.xml'] }; }
    if (step === 1) { name = 'visual_capture'; args = { adapter: 'existing', path: 'before.png', state: 'mission', simulated: true, provenance: 'Synthetic fixture, not native UI' }; }
    if (step === 2) { name = 'read'; args = { path: path.join(workspace, 'Screen.kt') }; }
    if (step === 3) { name = 'edit'; args = { path: path.join(workspace, 'Screen.kt'), oldString: 'original', newString: 'revised' }; }
    if (step === 4) { name = 'visual_capture'; args = { adapter: 'existing', path: 'after.png', state: 'mission', simulated: true, provenance: 'Synthetic fixture, not native UI' }; }
    if (step === 5) {
      const ids = [...new Set([...flat.matchAll(/"id"\s*:\s*"([0-9a-f-]{36})"/g)].map(m => m[1]))];
      name = 'visual_review'; args = { before: ids[0] ?? 'missing', after: ids[1] ?? 'missing', problem: 'Original plan hierarchy problem' };
    }
    if (step >= 6) text = 'VISUAL_TRANSPORT_COMPLETE. No design acceptance is claimed.';
    step++;
  }
  const tool = name ? { id: `call_visual_${step}`, type: 'function', function: { name, arguments: JSON.stringify(args) } } : null;
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
await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
const modelPort = model.address().port;
const reserve = net.createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
await fs.writeFile(path.join(cfg, 'opencode.json'), JSON.stringify({
  model: 'fixture/fixture',
  providers: { fixture: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${modelPort}/v1`, apiKey: 'synthetic-only' },
    models: { fixture: { capabilities: { tools: true, input: ['text', 'image'], output: ['text'] }, limit: { context: 65536, output: 4096 } } } } },
}));
const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM'].filter(k => process.env[k]).map(k => [k, process.env[k]]));
Object.assign(env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'), OPENCODE_SERVER_PASSWORD: password });
const fd = openSync(path.join(root, 'server.log'), 'w');
const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { env, cwd: workspace, stdio: ['ignore', fd, fd] }); closeSync(fd);
const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
const controller = new AbortController(), watchdog = setTimeout(() => controller.abort(), 100_000);
async function api(method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, signal: controller.signal,
    headers: { authorization: auth, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Native ${route}: ${response.status} ${text.slice(0, 250)}`);
  const raw = text ? JSON.parse(text) : undefined;
  return raw && Object.hasOwn(raw, 'data') ? raw.data : raw;
}
try {
  let info;
  for (let i = 0; i < 100; i++) {
    try { info = await api('GET', '/api/info'); break; } catch { await sleep(250); }
  }
  check('owns isolated server before mutations', info?.pid === server.pid);
  const locationQuery = `location[directory]=${encodeURIComponent(workspace)}`;
  const locationInfo = await api('GET', `/api/location?${locationQuery}`);
  await fs.writeFile(path.join(root, 'location.json'), JSON.stringify(locationInfo, null, 2));
  await api('POST', `/api/location/reload?${locationQuery}`, {});
  const session = await api('POST', '/api/session', { location: { directory: workspace }, agent: 'build', model: { providerID: 'fixture', id: 'fixture' } });
  const prompt = 'NATIVE_VISUAL_CASE: 이 임무 화면 디자인을 개선해줘. Screen.kt와 tokens.xml이 실제 대상이다.';
  await api('POST', `/api/session/${session.id}/prompt`, { text: prompt });
  let messages;
  for (let i = 0; i < 160; i++) {
    await sleep(250);
    const result = await api('GET', `/api/session/${session.id}/message`);
    messages = Array.isArray(result) ? result : result.messages;
    if (strings(messages).some(s => s.includes('VISUAL_TRANSPORT_COMPLETE'))) break;
  }
  await fs.writeFile(path.join(root, 'messages.json'), JSON.stringify(messages, null, 2));
  await fs.writeFile(path.join(root, 'model-observations.json'), JSON.stringify(observations, null, 2));
  const plugins = await api('GET', `/api/plugin?${locationQuery}`);
  await fs.writeFile(path.join(root, 'plugins.json'), JSON.stringify(plugins, null, 2));
  check('real plugin loaded', plugins.some(p => p.id === 'ksi.visual-workflow' && p.state.status === 'active'));
  const user = messages.find(m => m.type === 'user');
  check('user text preserved byte-for-byte', user.text === prompt);
  check('Native skill attachment admitted', user.skills?.some(s => s.id === 'impeccable'));
  check('synthetic skill body reaches model through Native attachment resolution', observations[0]?.hasSkill);
  check('runtime context reaches the model', observations[0]?.hasRuntime);
  check('actual design resource reaches the following model call', observations.some(o => o.hasTokens));
  const calls = messages.filter(m => m.type === 'assistant').flatMap(m => m.content ?? []).filter(p => p.type === 'tool');
  for (const name of ['visual_prepare', 'visual_capture', 'visual_review']) check(`actual Native ${name} completes`, calls.some(p => p.name === name && p.state?.status === 'completed'));
  check('implementation source actually changed', (await fs.readFile(path.join(workspace, 'Screen.kt'), 'utf8')).includes('revised'));
  check('actual PNG images reach model input', observations.some(o => o.imageCount >= 2));
  check('bounded Native tool loop reaches final response', strings(messages).some(s => s.includes('VISUAL_TRANSPORT_COMPLETE')));
  const denied = await api('POST', '/api/session', { location: { directory: workspace }, agent: 'build', model: { providerID: 'fixture', id: 'fixture' },
    permissions: [{ action: 'read', resource: '*', effect: 'deny' }, { action: 'edit', resource: '*', effect: 'deny' }] });
  await api('POST', `/api/session/${denied.id}/prompt`, { text: 'NATIVE_VISUAL_DENIED: Improve this UI screen.' });
  let deniedMessages;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    const result = await api('GET', `/api/session/${denied.id}/message`);
    deniedMessages = Array.isArray(result) ? result : result.messages;
    if (strings(deniedMessages).some(s => s.includes('VISUAL_DENIAL_COMPLETE'))) break;
  }
  await fs.writeFile(path.join(root, 'denied-messages.json'), JSON.stringify(deniedMessages, null, 2));
  const deniedCall = deniedMessages.filter(m => m.type === 'assistant').flatMap(m => m.content ?? []).find(p => p.type === 'tool' && p.name === 'visual_prepare');
  check('Native deny-read is enforced inside the custom tool', deniedCall?.state?.status === 'error');
  check('denied custom tool returns no source token data', !strings(deniedMessages).some(s => s.includes('#123456')));
  check('denied session leaves implementation unchanged', (await fs.readFile(path.join(workspace, 'Screen.kt'), 'utf8')).includes('revised'));
  console.log(`${checks} checks passed; scripted transport evidence: ${root}`);
} finally {
  clearTimeout(watchdog); controller.abort(); server.kill('SIGTERM');
  await new Promise(resolve => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000).unref(); });
  await new Promise(resolve => model.close(resolve));
}
