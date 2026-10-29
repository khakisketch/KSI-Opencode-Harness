// session-evidence-context-live.test.mjs — isolated Native V2 verification of
// self-session context order and tool message schema, plus end-to-end proof
// that the managed session_evidence_summary tool accepts a correct order
// declaration and refuses a reversed one.
//
// Own HOME, server, scripted model, synthetic files and random ports; no shared
// server, real model, Ollama, cloud, or global install. Skips when the
// `opencode` binary is unavailable. Heavy by design: run it explicitly, never
// as part of a full-suite sweep.
// Run: `node --test tests/session-evidence-context-live.mjs`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}

async function api(base, auth, signal, method, route, body) {
  const response = await fetch(`${base}${route}`, { method, signal,
    headers: { authorization: auth, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`Native ${route}: ${response.status} ${text.slice(0, 500)}`);
  const raw = text ? JSON.parse(text) : undefined;
  return raw && Object.hasOwn(raw, 'data') ? raw.data : raw;
}

describe('isolated Native V2 context order and schema', () => {
  it('proves context order, tool schema, and order-declaration enforcement live', async (t) => {
    const probe = spawnSync('opencode', ['--version'], { encoding: 'utf8' });
    if (probe.status !== 0) {
      t.skip('opencode binary unavailable; isolated live verification cannot run here');
      return;
    }
    const root = await fs.mkdtemp('/tmp/opencode/ksi-evidence-live-');
    const home = path.join(root, 'home'), workspace = path.join(root, 'project');
    const cfg = path.join(home, '.config/opencode');
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(path.join(cfg, 'plugins'), { recursive: true });
    // Install the real managed plugin source (core + runtime + entry).
    await fs.cp(path.join(repo, 'global/plugins/ksi-session-evidence'), path.join(cfg, 'plugins/ksi-session-evidence'), { recursive: true });
    // Synthetic session files only.
    await fs.writeFile(path.join(workspace, 'notes.txt'), 'alpha\n');
    await fs.writeFile(path.join(workspace, 't.test.mjs'),
      `import { test } from 'node:test';\ntest('synthetic passes', (t) => { t.assert.ok(true); });\n`);
    await fs.writeFile(path.join(workspace, 'fail.test.mjs'),
      `import { test } from 'node:test';\ntest('synthetic fails', (t) => { t.assert.ok(false, 'intentional synthetic failure'); });\n`);

    // Probe plugin (generated scratch, not part of the repo): records context
    // snapshots on every prompt hook into the isolated root only.
    const OUT = path.join(root, 'probe.jsonl');
    const probeRuntime = `
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = ${JSON.stringify(OUT)};
const keysOf = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v) : (Array.isArray(v) ? 'array' : typeof v));
const markOf = (x) => (typeof x !== 'string' ? null : x.includes('DISC_TOOLSEQ') ? 'toolseq' : x.includes('DISC_BETA') ? 'beta' : 'other');
const summarize = (m, pos) => ({
  pos, type: m?.type, agent: m?.agent, id: m?.id,
  time: m?.time, keys: keysOf(m), marker: markOf(m?.text),
  parts: Array.isArray(m?.content) ? m.content.map((p) => (p?.type === 'tool'
    ? { ptype: 'tool', name: p?.name ?? p?.tool, status: p?.state?.status ?? p?.status, stateKeys: keysOf(p?.state), inputKeys: keysOf(p?.state?.input ?? p?.input),
        contentPreview: Array.isArray(p?.state?.content) ? p.state.content.map((c) => (c?.type === 'text' && typeof c?.text === 'string' ? { ptype: 'text', textLen: c.text.length, textPreview: c.text.slice(0, 160) } : { ptype: c?.type })) : null }
    : { ptype: p?.type })) : null,
});
export async function setupDiscProbe(ctx) {
  const reg = await ctx.session.hook('prompt', async (event) => {
    const payload = await ctx.session.context({ sessionID: event.sessionID });
    const messages = Array.isArray(payload) ? payload : (payload?.data ?? payload?.messages ?? []);
    await mkdir(path.dirname(OUT), { recursive: true });
    await appendFile(OUT, JSON.stringify({ count: messages.length, messages: messages.map(summarize) }) + '\\n');
  });
  return async () => { await reg.dispose(); };
}
`;
    await fs.mkdir(path.join(cfg, 'plugins/disc-probe'), { recursive: true });
    await fs.writeFile(path.join(cfg, 'plugins/disc-probe/runtime.mjs'), probeRuntime);
    await fs.writeFile(path.join(cfg, 'plugins/disc-probe/index.ts'),
      `import type { Plugin } from "@opencode/plugin";\nimport { setupDiscProbe } from "./runtime.mjs";\nexport default {\n  id: "disc.probe",\n  setup: setupDiscProbe,\n} satisfies Plugin.Plugin;\n`);

    const password = randomBytes(20).toString('hex');
    let stepOne = 0, stepBeta = 0, stepFail = 0;
    const model = http.createServer(async (req, res) => {
      if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data: [{ id: 'fixture' }] })); return; }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const flat = strings(body.messages).join('\n');
      let name, args, text = 'DISC_IDLE';
      // Auxiliary model calls (e.g. conversation titling) also carry prompt
      // text but must never consume scripted tool steps: only the main agent
      // loop drives the fixture. Discovered live: the first scripted call was
      // eaten by a title request and discarded by the server.
      const isMainLoop = flat.includes('You are an AI agent running in OpenCode');
      if (!isMainLoop) {
        text = 'disc auxiliary response';
      } else if (flat.includes('DISC_FAIL')) {
        if (stepFail === 0) { name = 'shell'; args = { command: 'node --test fail.test.mjs' }; }
        else text = 'DISC_FAIL_DONE';
        stepFail++;
      } else if (flat.includes('DISC_BETA')) {
        if (stepBeta === 0) { name = 'session_evidence_summary'; args = { order: 'newest-first' }; }
        else text = 'DISC_TURN_TWO_DONE';
        stepBeta++;
      } else if (flat.includes('DISC_TOOLSEQ')) {
        if (stepOne === 0) { name = 'edit'; args = { path: 'notes.txt', oldString: 'alpha', newString: 'alpha revised' }; }
        else if (stepOne === 1) { name = 'shell'; args = { command: 'node --test t.test.mjs' }; }
        else if (stepOne === 2) { name = 'session_evidence_summary'; args = { order: 'oldest-first' }; }
        else text = 'DISC_TURN_ONE_DONE';
        stepOne++;
      } else {
        text = 'DISC_IDLE';
      }
      const tool = name ? { id: `call_disc_${stepOne}_${stepBeta}_${stepFail}`, type: 'function', function: { name, arguments: JSON.stringify(args) } } : null;
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
      providers: { fixture: { package: '@opencode/ai/providers/openai-compatible', settings: { baseURL: `http://127.0.0.1:${modelPort}/v1`, apiKey: 'synthetic-only' },
        models: { fixture: { capabilities: { tools: true, input: ['text'], output: ['text'] }, limit: { context: 32768, output: 4096 } } } } },
    }));
    const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
    Object.assign(env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DATA_HOME: path.join(home, '.local/share'), XDG_CACHE_HOME: path.join(home, '.cache'), XDG_STATE_HOME: path.join(home, '.local/state'), OPENCODE_SERVER_PASSWORD: password });
    const fd = openSync(path.join(root, 'server.log'), 'w');
    const server = spawn('opencode', ['serve', '--port', String(port), '--hostname', '127.0.0.1'], { env, cwd: workspace, stdio: ['ignore', fd, fd] }); closeSync(fd);
    const auth = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`;
    const base = `http://127.0.0.1:${port}`;
    const controller = new AbortController(), watchdog = setTimeout(() => controller.abort(), 240_000);
    const call = (method, route, body) => api(base, auth, controller.signal, method, route, body);
    const summaryResults = (msgs) => {
      const out = [];
      for (const m of msgs) {
        for (const p of m.content ?? []) {
          if (p?.type === 'tool' && (p?.name ?? p?.tool) === 'session_evidence_summary') {
            const text = (p?.state?.content ?? []).find((c) => c?.type === 'text')?.text;
            if (typeof text === 'string' && text.includes('"status"')) out.push(JSON.parse(text));
          }
        }
      }
      return out;
    };
    try {
      let info;
      for (let i = 0; i < 100; i++) {
        try { info = await call('GET', '/api/info'); break; } catch { await sleep(250); }
      }
      assert.ok(info?.pid === server.pid, 'owns isolated server before mutations');
      const session = await call('POST', '/api/session', { location: { directory: workspace }, agent: 'build', model: { providerID: 'fixture', id: 'fixture' } });
      await call('POST', `/api/session/${session.id}/prompt`, { text: 'DISC_TOOLSEQ edit the notes and run the synthetic test' });
      let messages;
      for (let i = 0; i < 200; i++) {
        await sleep(250);
        const result = await call('GET', `/api/session/${session.id}/message`);
        messages = Array.isArray(result) ? result : result.messages;
        if (strings(messages).some((s) => s.includes('DISC_TURN_ONE_DONE'))) break;
      }
      await call('POST', `/api/session/${session.id}/prompt`, { text: 'DISC_BETA status check' });
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        const result = await call('GET', `/api/session/${session.id}/message`);
        messages = Array.isArray(result) ? result : result.messages;
        if (strings(messages).some((s) => s.includes('DISC_TURN_TWO_DONE'))) break;
      }
      await fs.writeFile(path.join(root, 'messages.json'), JSON.stringify(messages, null, 2));

      // Turn 3: a genuinely failing isolated shell. Its real failure shape
      // (completed-with-nonzero-text vs failed transport) is recorded below
      // and mirrored into a synthetic core fixture — no invented shapes.
      await call('POST', `/api/session/${session.id}/prompt`, { text: 'DISC_FAIL run the failing synthetic test' });
      for (let i = 0; i < 120; i++) {
        await sleep(250);
        const result = await call('GET', `/api/session/${session.id}/message`);
        messages = Array.isArray(result) ? result : result.messages;
        if (strings(messages).some((s) => s.includes('DISC_FAIL_DONE'))) break;
      }
      await fs.writeFile(path.join(root, 'messages-fail.json'), JSON.stringify(messages, null, 2));
      console.log(`isolated root: ${root}`);
      console.log('REST message order (index:type:text-head):');
      messages.forEach((m, i) => console.log(i, m.type, (m.text ?? '').slice(0, 60).replace(/\n/g, ' ')));

      // REST surface order: newest first (last turn at index 0, first prompt last).
      assert.ok(strings(messages.slice(0, 9)).some((s) => s.includes('DISC_TURN_TWO_DONE')), 'REST newest side holds the middle turn');
      assert.ok(strings(messages.slice(0, 4)).some((s) => s.includes('DISC_FAIL_DONE')), 'REST newest side holds the latest turn');
      assert.ok(strings(messages[messages.length - 1]).some((s) => s.includes('DISC_TOOLSEQ')), 'REST oldest message is the first prompt');

      // Probe snapshots: ctx.session.context order is oldest first with
      // per-message time.created evidence.
      const snaps = (await fs.readFile(OUT, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
      const settled = snaps.find((s) => s.messages.some((m) => m.marker === 'toolseq') && s.count >= 4);
      assert.ok(settled, 'probe recorded the settled first turn');
      assert.equal(settled.messages[0].marker, 'toolseq', 'context array starts with the first prompt (oldest-first)');
      const times = settled.messages.map((m) => m.time?.created);
      assert.ok(times.every((v) => typeof v === 'number'), 'every context message carries numeric time.created');
      assert.ok(times.every((v, i) => i === 0 || v >= times[i - 1]), 'context timestamps are non-decreasing in array order');

      // Real tool message schema matches the core parser's assumptions.
      const toolParts = messages.flatMap((m) => m.content ?? []).filter((p) => p?.type === 'tool');
      assert.ok(toolParts.length >= 4, `expected edit+shell+2 summary tool parts, saw ${toolParts.length}`);
      for (const name of ['edit', 'shell']) {
        const part = toolParts.find((p) => (p?.name ?? p?.tool) === name);
        assert.ok(part, `real ${name} tool part observed`);
        assert.equal(part?.state?.status, 'completed');
        assert.ok(part?.state?.input && typeof part.state.input === 'object', `${name} carries an input object`);
      }

      // Correct declaration (oldest-first over oldest-first context): ok with
      // an edit-then-verification candidate. The REST array is newest-first,
      // so pick results by their declared order, not by position.
      const results = summaryResults(messages);
      assert.equal(results.length, 2, 'both summary calls observed');
      const first = results.find((r) => r.order === 'oldest-first');
      assert.ok(first, 'correct-declaration result observed');
      assert.equal(first.status, 'ok');
      assert.equal(first.order, 'oldest-first');
      assert.equal(first.orderEvidence, 'timestamp-consistent');
      assert.equal(first.outcome, 'candidate-after-snapshot-last-change');
      assert.ok(first.afterSnapshotLastChange.verificationCandidates >= 1, 'verification candidate after the edit');
      assert.equal(first.lastChange.kindClass, 'completed-edit-tool-observed');
      assert.equal(first.passedProof, 'none');

      // Reverse declaration over the same store: refused as contradicted.
      const reversed = results.find((r) => r.order === 'newest-first');
      assert.ok(reversed, 'reverse-declaration result observed');
      assert.equal(reversed.status, 'unknown');
      assert.equal(reversed.reason, 'order-contradicted');

      // Real isolated shell failure: classify its observed shape through the
      // shared core using a synthetic twin built only from observed fields.
      // The twin mirrors the real turn (edit, then the failing shell).
      const { auditMessages } = await import('../global/plugins/ksi-session-evidence/core.mjs');
      const editMsg = { type: 'assistant', agent: 'engineer', content: [{ type: 'tool', name: 'edit', state: { status: 'completed', input: { path: '/proj/notes.txt' } } }] };
      const failParts = messages
        .flatMap((m) => m.content ?? [])
        .filter((p) => p?.type === 'tool' && (p?.name ?? p?.tool) === 'shell'
          && JSON.stringify(p?.state?.input ?? {}).includes('fail.test.mjs'));
      assert.ok(failParts.length >= 1, 'real failing shell tool part observed');
      const observed = failParts[failParts.length - 1];
      const observedStatus = observed?.state?.status ?? observed?.status;
      if (observedStatus === 'completed') {
        const texts = ((observed?.state?.content ?? []).filter((c) => c?.type === 'text' && typeof c?.text === 'string').map((c) => c.text).join('\n')
          || (typeof observed?.state?.output === 'string' ? observed.state.output : ''));
        assert.ok(/exit\s*1|ERR|fail/i.test(texts), `real failure text observed in completed output: ${texts.slice(0, 160)}`);
        const twin = auditMessages([editMsg, {
          type: 'assistant', agent: 'engineer',
          content: [{ type: 'tool', name: 'shell', state: { status: 'completed', input: { command: 'node --test fail.test.mjs' }, content: [{ type: 'text', text: texts.slice(0, 2000) }] } }],
        }]);
        assert.equal(twin.roles.engineer.verificationRuns, 0, 'visibly failed run is not a verification candidate');
        assert.ok(twin.roles.engineer.verificationNonzeroHints >= 1, 'real nonzero text classified as failure hint');
        assert.equal(twin.roles.engineer.completionEvidence.outcome, 'failure-signal-after-last-change');
      } else {
        const twin = auditMessages([editMsg, {
          type: 'assistant', agent: 'engineer',
          content: [{ type: 'tool', name: 'shell', state: { status: 'error', input: { command: 'node --test fail.test.mjs' }, error: { message: 'synthetic mirror of observed failed transport' } } }],
        }]);
        assert.equal(twin.roles.engineer.failedTools.shell, 1, 'failed transport counted as failed, never as verification');
        assert.equal(twin.roles.engineer.verificationRuns, 0);
        assert.equal(twin.roles.engineer.completionEvidence.outcome, 'failure-signal-after-last-change');
      }
      console.log(`live context-order evidence verified; isolated root: ${root}`);
    } finally {
      clearTimeout(watchdog); controller.abort(); server.kill('SIGTERM');
      await new Promise((resolve) => { if (server.exitCode !== null || server.signalCode !== null) return resolve(); server.once('exit', resolve); setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 2000).unref(); });
      await new Promise((resolve) => model.close(resolve));
    }
  });
});
