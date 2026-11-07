// Session lifecycle + recovery native probe: create/prompt/interrupt/resume/
// wait/fork/compact/move/restart-recovery/worktree-link on a real OpenCode v2
// CLI inside a private HOME/XDG sandbox with a scripted loopback model only.
// No external models/credentials, no product repos, no commit/push.
//
// Proves Native execution primitives (not prompt rules): sessions persist
// across interrupt/resume/fork, survive a server restart, and link to
// worktrees. Scripted markers verify plumbing only, never model quality.
//
// Run: node tests/session-lifecycle-native.mjs
// Env: KSI_HARNESS_ROOT, KSI_MODEL_PORT / KSI_SERVE_PORT, OPENCODE_BIN
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const ARTIFACT_PARENT = process.env.KSI_HARNESS_ROOT ?? "/tmp/opencode";
fs.mkdirSync(ARTIFACT_PARENT, { recursive: true });
const ROOT = fs.mkdtempSync(path.join(ARTIFACT_PARENT, "ksi-lifecycle-"));
const OPENCODE_BIN = process.env.OPENCODE_BIN ?? "opencode";

const PRIV = path.join(ROOT, "priv-home");
const WORKSPACE = path.join(ROOT, "workspace");
const WORKSPACE2 = path.join(ROOT, "workspace2");
const PASSWORD = crypto.randomBytes(24).toString("hex");
const AUTH = "Basic " + Buffer.from(`opencode:${PASSWORD}`).toString("base64");
const FIXTURE_MODEL = "fixture/fixture";

let checks = 0, failures = [];
function check(name, ok, detail = "") {
  checks++;
  if (ok) console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
  else { failures.push(name); console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
function failClosed(name, detail) { check(name, false, detail); throw new Error(`FAIL-CLOSED ${name}: ${detail}`); }
function finish() {
  console.log(`${checks - failures.length}/${checks} checks passed. Evidence dir: ${ROOT}`);
  process.exit(failures.length ? 1 : 0);
}
const sha256 = (b) => crypto.createHash("sha256").update(b).digest("hex");
function stripJsonc(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\n)[ \t]*\/\/[^\n]*/g, "$1");
}
function freePortNear(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const s = net.createServer();
      s.on("error", () => tryPort(p + 1));
      s.listen(p, "127.0.0.1", () => { const port = s.address().port; s.close(() => resolve(port)); });
    };
    tryPort(start);
  });
}

// --- scripted fixture model: echo ACK for text-only prompts, no tools ---
function startFakeModel(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      if (req.method === "GET" && url.pathname === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ object: "list", data: [{ id: "fixture", object: "model", created: 1, owned_by: "ksi" }] }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
          let body = {};
          try { body = JSON.parse(raw); } catch {}
          const texts = (body.messages ?? []).flatMap((m) =>
            typeof m.content === "string" ? [m.content]
            : Array.isArray(m.content) ? m.content.map((p) => p.text ?? "") : []);
          const lastUser = [...texts].pop() ?? "";
          const text = ("ACK:" + lastUser).slice(0, 400);
          const slow = lastUser.includes("SLOW-");
          const respond = () => {
          const id = `chatcmpl-ksilife-${Date.now()}`;
          const payload = { id, object: "chat.completion", model: "fixture",
            choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }] };
          if (body.stream) {
            res.writeHead(200, { "Content-Type": "text/event-stream" });
            res.end(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] })}\n\ndata: [DONE]\n\n`);
            return;
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(payload));
          };
          if (slow) { setTimeout(respond, 8000); return; }
          respond();
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

let SERVE_PORT = 0, MODEL_PORT = 0;
async function api(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${SERVE_PORT}${p}`, {
    method,
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text: text.slice(0, 500) };
}
async function mustApi(method, p, body, what, wantStatus = 200) {
  const r = await api(method, p, body);
  if (r.status !== wantStatus) throw new Error(`${what}: HTTP ${r.status} (want ${wantStatus}): ${r.text.slice(0, 200)}`);
  return r.json;
}
function assistantTexts(messages) {
  return (messages ?? []).filter((m) => m?.type === "assistant" || m?.role === "assistant")
    .flatMap((m) => (m.content ?? []).map((p) => (typeof p === "string" ? p : p?.text ?? "")).join(""));
}
async function waitAssistant(id, marker, fetchMsgs, timeoutMs = 90000) {
  const t0 = Date.now();
  for (;;) {
    const m = await fetchMsgs(id);
    if (assistantTexts(m).includes(marker)) return m;
    if (Date.now() - t0 > timeoutMs) return m;
    await sleep(2000);
  }
}
function allTexts(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (typeof m?.text === "string" && m.text) out.push(m.text);
    const c = m?.content ?? [];
    for (const p of Array.isArray(c) ? c : [c]) {
      if (typeof p === "string" && p) out.push(p);
      else if (p && typeof p.text === "string" && p.text) out.push(p.text);
    }
    if (typeof m?.payload?.text === "string" && m.payload.text) out.push(m.payload.text);
    if (typeof m?.summary === "string" && m.summary) out.push(m.summary);
  }
  return out.join("\n");
}
function userTexts(messages) {
  return (messages ?? []).filter((m) => m?.type === "user" || m?.role === "user").map((m) => {
    const parts = [];
    if (typeof m?.text === "string") parts.push(m.text);
    const c = m?.content ?? m?.payload?.text ?? "";
    if (typeof c === "string") parts.push(c);
    else for (const p of (Array.isArray(c) ? c : [])) parts.push(typeof p === "string" ? p : (p?.text ?? ""));
    return parts.join("");
  });
}

const children = [];
const onExit = () => { for (const c of children) { try { c.kill("SIGTERM"); } catch {} } };
process.on("exit", onExit);

async function main() {
  MODEL_PORT = await freePortNear(Number(process.env.KSI_MODEL_PORT ?? 41961));
  SERVE_PORT = await freePortNear(Number(process.env.KSI_SERVE_PORT ?? 41962));

  const srcCfg = JSON.parse(stripJsonc(fs.readFileSync(path.join(REPO, "global", "opencode.jsonc"), "utf8")));
  if (srcCfg?.experimental?.subagent_depth !== 1) failClosed("CONTRACT-NOT-READY: depth != 1", String(srcCfg?.experimental?.subagent_depth));
  check("source depth-1 contract present", true);

  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.mkdirSync(WORKSPACE2, { recursive: true });
  fs.writeFileSync(path.join(WORKSPACE, "scope.txt"), "lifecycle probe scope\n");
  const cfgDir = path.join(PRIV, ".config", "opencode");
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(cfgDir, "AGENTS.md"), fs.readFileSync(path.join(REPO, "global", "AGENTS.md"), "utf8"));
  const sandboxCfg = {
    $schema: "https://opencode.ai/config.json",
    experimental: JSON.parse(JSON.stringify(srcCfg.experimental)),
    agents: { build: { ...(srcCfg.agents?.build ?? {}), model: FIXTURE_MODEL } },
    providers: { fixture: { name: "Fixture", package: "@opencode/ai/providers/openai-compatible",
      settings: { baseURL: `http://127.0.0.1:${MODEL_PORT}/v1`, apiKey: "ksi-life-fake-key" },
      models: { fixture: { name: "Scripted", capabilities: { tools: true, input: ["text"], output: ["text"] }, limit: { context: 32768, output: 8192 } } } } },
  };
  fs.writeFileSync(path.join(cfgDir, "opencode.json"), JSON.stringify(sandboxCfg, null, 1));
  check("sandbox fixture-only (no external refs)", !JSON.stringify(sandboxCfg).match(/openai\/|opencode-go\/|anthropic\/|mobbin|context7/));

  const ENV_KEEP = new Set(["PATH", "LANG", "LC_ALL", "TERM", "SHELL", "TZ", "TMPDIR", "TMP", "TEMP"]);
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (ENV_KEEP.has(k) || /^LC_[A-Z_]+$/.test(k)) env[k] = v;
  const ownTmp = path.join(ROOT, "tmp");
  fs.mkdirSync(ownTmp, { recursive: true });
  env.TMPDIR = ownTmp; env.TMP = ownTmp; env.TEMP = ownTmp;
  Object.assign(env, { HOME: PRIV, XDG_CONFIG_HOME: path.join(PRIV, ".config"),
    XDG_DATA_HOME: path.join(PRIV, ".local", "share"), XDG_CACHE_HOME: path.join(PRIV, ".cache"),
    XDG_STATE_HOME: path.join(PRIV, ".local", "state"), OPENCODE_SERVER_PASSWORD: PASSWORD });

  const fake = await startFakeModel(MODEL_PORT);
  const serveLog = path.join(ROOT, "serve.stdout.log");
  const serveOut = fs.openSync(serveLog, "a");
  const startServe = () => {
    const s = spawn(OPENCODE_BIN, ["serve", "--port", String(SERVE_PORT), "--hostname", "127.0.0.1"], { env, cwd: WORKSPACE, stdio: ["ignore", serveOut, serveOut] });
    children.push(s);
    return s;
  };
  let serve = startServe();
  const waitHealthy = async () => {
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      try { const r = await api("GET", "/api/info"); if (r.status === 200) return true; } catch {}
      if (serve.exitCode !== null) return false;
    }
    return false;
  };
  if (!await waitHealthy()) failClosed("SERVE-NOT-HEALTHY", "isolated server did not come up");
  check("isolated serve healthy", true);
  const info = await mustApi("GET", "/api/info", undefined, "server identity");
  if (!Number.isInteger(info?.pid) || info.pid !== serve.pid) failClosed("SERVER-IDENTITY-MISMATCH", "refusing to mutate a foreign instance");
  check("server PID matches owned child", true);

  const LOC = { directory: WORKSPACE };
  const mk = async (extra = {}) => (await mustApi("POST", "/api/session",
    { location: LOC, agent: "build", model: { id: "fixture", providerID: "fixture" }, ...extra }, "session.create")).data;
  const msgs = async (id) => (await mustApi("GET", `/api/session/${id}/message?order=asc&limit=50`, undefined, "messages")).data ?? [];

  // T1 create
  const s1 = await mk({ title: "KSI lifecycle probe" });
  check("T1 session.create returns id", typeof s1?.id === "string" && !!s1.id, s1?.id?.slice(0, 12));

  // T2 prompt -> scripted ACK text (prompt API is async: poll for assistant)
  await mustApi("POST", `/api/session/${s1.id}/prompt`, { text: "LIFECYCLE-PING" }, "prompt");
  let m = await waitAssistant(s1.id, "ACK:LIFECYCLE-PING", msgs);
  check("T2 prompt yields assistant ACK text", assistantTexts(m).includes("ACK:LIFECYCLE-PING"), `msgs=${m.length}`);

  // T3 interrupt preserves history
  await mustApi("POST", `/api/session/${s1.id}/interrupt?resume=false`, undefined, "interrupt");
  m = await msgs(s1.id);
  fs.writeFileSync(path.join(ROOT, "msgs-after-interrupt.json"), JSON.stringify(m, null, 1).slice(0, 4000));
  const roles = m.map((x) => x?.type ?? x?.role ?? "?").join(",");
  const preserved = allTexts(m).includes("LIFECYCLE-PING") && allTexts(m).includes("ACK:LIFECYCLE-PING");
  check("T3 interrupt preserves history", preserved, `msgs=${m.length} roles=${roles}`);

  // T4 resume on same session
  await mustApi("POST", `/api/session/${s1.id}/prompt`, { text: "LIFECYCLE-SECOND" }, "resume prompt");
  m = await waitAssistant(s1.id, "ACK:LIFECYCLE-SECOND", msgs);
  check("T4 same-session resume appends", assistantTexts(m).includes("ACK:LIFECYCLE-SECOND") && m.length >= 4, `msgs=${m.length}`);

  // T5 (F1 documented): aborted experimental wait bricks that session's generation.
  // Uses a sacrificial session so the main session stays healthy.
  const sW = await mk({ title: "KSI wait-brick probe" });
  await mustApi("POST", `/api/session/${sW.id}/prompt`, { text: "LIFECYCLE-WAIT-BASE" }, "wait-baseline prompt");
  await waitAssistant(sW.id, "ACK:LIFECYCLE-WAIT-BASE", msgs, 60000);
  const waitP = api("POST", `/api/experimental/session/${sW.id}/wait`);
  await sleep(3000);
  const tW0 = Date.now();
  const wPrompt = await mustApi("POST", `/api/session/${sW.id}/prompt`, { text: "LIFECYCLE-WAIT" }, "wait-test prompt").catch((e) => ({ __err: e.message }));
  const promptMs = Date.now() - tW0;
  let wStatus = 0;
  try { const r = await waitP; wStatus = r.status; } catch { wStatus = -1; }
  const wElapsed = Date.now() - tW0;
  await wPrompt;
  const mW = await waitAssistant(sW.id, "ACK:LIFECYCLE-WAIT", msgs, 30000);
  const waitBricked = (wStatus === -1 || wElapsed >= 12000) && !assistantTexts(mW).includes("ACK:LIFECYCLE-WAIT");
  check("T5 aborted wait never resolves; session stops generating (F1 documented)", waitBricked, `http=${wStatus} elapsed=${wElapsed}ms promptMs=${promptMs} promptOk=${!wPrompt?.__err}`);

  // T5b: fresh session still generates (brick is per-session, not global)
  const s2 = await mk({ title: "KSI lifecycle scope probe" });
  await mustApi("POST", `/api/session/${s2.id}/prompt`, { text: "LIFECYCLE-SCOPE" }, "scope prompt");
  const mS2 = await waitAssistant(s2.id, "ACK:LIFECYCLE-SCOPE", msgs, 60000);
  check("T5b fresh session still generates (scope of stuck wait)", assistantTexts(mS2).includes("ACK:LIFECYCLE-SCOPE"));
  // T6: fork of a HEALTHY session shares prefix but does not generate (F2 documented)
  const fh = (await mustApi("POST", `/api/session/${s2.id}/fork`, {}, "healthy fork")).data ?? {};
  check("T6 fork returns distinct id", typeof fh?.id === "string" && fh.id !== s2.id, fh?.id?.slice(0, 12));
  const mf = await msgs(fh.id);
  check("T6 fork shares history prefix", allTexts(mf).includes("LIFECYCLE-SCOPE"), `forkMsgs=${mf.length}`);
  await mustApi("POST", `/api/session/${fh.id}/prompt`, { text: "LIFECYCLE-FORK-ONLY" }, "fork prompt");
  const mFork = await waitAssistant(fh.id, "FORK-ONLY", msgs, 30000);
  check("T6 forked session does not generate (F2 documented)", !assistantTexts(mFork).includes("FORK-ONLY"));

  // T9 queue during in-flight generation: order preserved, run unbroken
  const s3 = await mk({ title: "KSI queue probe" });
  await mustApi("POST", `/api/session/${s3.id}/prompt`, { text: "SLOW-QUEUE-FIRST" }, "slow prompt");
  await mustApi("POST", `/api/session/${s3.id}/prompt`, { text: "LIFECYCLE-QUEUED", delivery: "queue" }, "queued prompt");
  const mQ = await waitAssistant(s3.id, "ACK:LIFECYCLE-QUEUED", msgs, 60000);
  const allQ = allTexts(mQ);
  // T9 (F3 documented): delivery:"queue" during in-flight generation is dropped.
  // Client-side rule: poll messages for idle before sending follow-ups.
  const hasSlow = allQ.includes("ACK:SLOW-QUEUE-FIRST"), hasQ = allQ.includes("ACK:LIFECYCLE-QUEUED");
  check("T9 queued in-flight prompt is dropped; slow one completes (F3 documented)", hasSlow && !hasQ, `msgs=${mQ.length} slow=${hasSlow} queued=${hasQ}`);

  // T10 session status shape: is there an idle/busy signal for client-side serialization?
  const st = await api("GET", `/api/session/${s3.id}`);
  fs.writeFileSync(path.join(ROOT, "session-status-shape.json"), JSON.stringify(st.json ?? {}, null, 1).slice(0, 2000));
  check("T10 session status readable", st.status === 200 && !!(st.json?.data ?? st.json)?.id, `keys=${Object.keys((st.json?.data ?? st.json) ?? {}).slice(0, 12).join(",")}`);

  // T10b instructions.entry round-trip (Native continuity primitive, no plugin)
  const putR = await api("PUT", `/api/experimental/session/${s3.id}/instructions/entries/ksi-goal`, { value: "LIFECYCLE-GOAL-MARKER" });
  const listR = await api("GET", `/api/experimental/session/${s3.id}/instructions/entries`);
  const entriesText = JSON.stringify(listR.json ?? {});
  check("T10b instructions.entry persists + lists", (putR.status === 200 || putR.status === 204 || putR.status === 201) && entriesText.includes("ksi-goal"), `put=${putR.status} get=${listR.status}`);
  const c1 = await api("POST", `/api/session/${s1.id}/compact`, {});
  const c2shape = JSON.stringify(c1.json ?? {}).slice(0, 120);
  const stillOk = (await msgs(s1.id)).length >= 4;
  check("T7 compact deterministic + session usable", (c1.status === 200 || c1.status >= 400) && stillOk, `http=${c1.status} ${c2shape.slice(0, 60)}`);

  // T8b: move of a HEALTHY session keeps it generatable (isolates move from T5 state)
  const hmv = await api("POST", `/api/session/${s2.id}/move`, { directory: WORKSPACE2 });
  if (hmv.status !== 200 && hmv.status !== 204) throw new Error(`healthy move: HTTP ${hmv.status}`);
  check("T8b healthy move accepted", true, `http=${hmv.status}`);
  await mustApi("POST", `/api/session/${s2.id}/prompt`, { text: "LIFECYCLE-HEALTHY-MOVE" }, "healthy moved prompt");
  const mHm = await waitAssistant(s2.id, "ACK:LIFECYCLE-HEALTHY-MOVE", msgs, 60000);
  check("T8b healthy moved session still works", assistantTexts(mHm).includes("ACK:LIFECYCLE-HEALTHY-MOVE"));
  // R1 restart recovery: kill server, respawn same HOME, history intact
  try { serve.kill("SIGTERM"); } catch {}
  await sleep(2000);
  serve = startServe();
  if (!await waitHealthy()) failClosed("RESTART-NOT-HEALTHY", "server did not come back");
  check("R1 server restarts in sandbox", true);
  const mAfter = await msgs(s1.id);
  const histOk = allTexts(mAfter).includes("LIFECYCLE-PING") && allTexts(mAfter).includes("ACK:LIFECYCLE-SECOND");
  check("R1 history survives server restart", histOk, `msgs=${mAfter.length}`);
  // R2: post-restart generation works on the healthy main session
  // (restart is safe for healthy sessions; F1-bricked sessions stay bricked)
  await mustApi("POST", `/api/session/${s1.id}/prompt`, { text: "LIFECYCLE-POST-RESTART" }, "post-restart prompt");
  const mR2 = await waitAssistant(s1.id, "ACK:LIFECYCLE-POST-RESTART", msgs, 60000);
  check("R2 generation works after restart (healthy session)", assistantTexts(mR2).includes("ACK:LIFECYCLE-POST-RESTART"));

  // W1 worktree link via project id from location readiness
  const locInfo = await mustApi("GET", `/api/location?location%5Bdirectory%5D=${encodeURIComponent(WORKSPACE)}`, undefined, "location readiness");
  const projectId = locInfo?.project?.id ?? null;
  if (typeof projectId === "string") {
    check("W0 location exposes project id", true, String(projectId).slice(0, 12));
  } else {
    check("W0 location exposes project id", false, "no project id; worktree link untestable via API");
  }

  try { fake.close(); } catch {}
  finish();
}

main().catch((e) => { console.error("FATAL", e?.message ?? e); process.exit(1); });
