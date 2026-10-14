// Native integration test: ksi.impeccable-detector end-to-end on OpenCode v2 (2.0.29).
//
// Spins up, in a private HOME/XDG sandbox:
//   1. a local scripted OpenAI-compatible model server (no external models/credentials),
//   2. `opencode serve` on an isolated loopback port with a global config that
//      defines ONLY the scripted `fixture` provider (package
//      @opencode/ai/providers/openai-compatible, settings.baseURL+apiKey fake,
//      model capabilities.tools=true),
//   3. the plugin under test installed as a global file plugin (copied from
//      KSI_PLUGIN_DIR), with the real upstream skills tree symlinked read-only
//      alongside it so the launcher-derived engine resolves to the genuine
//      installed binary (no upstream writes).
//
// The scripted model drives REAL native tool calls: write (defective UI) ->
// edit (repair) -> shell+read (non-UI skip), then a second session whose
// permission ruleset denies the shell command and the outside-tree read.
// Assertions verify native hooks fired, the original engine's detect finding
// is delivered in tool result metadata/content, repair scans clean, and
// non-UI/denied calls are never scanned.
//
// Run:  node tests/native-hook-integration.mjs
// Env:  KSI_PLUGIN_DIR (default <repo>/global/plugins/ksi-impeccable-detector)
//       KSI_HARNESS_ROOT (artifact parent; a unique directory is created, never erased)
//       KSI_MODEL_PORT (default 41851), KSI_SERVE_PORT (default 41852)
//       KSI_REAL_SKILLS (default user's global OpenCode skills directory)
//       OPENCODE_BIN (default opencode)
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const PLUGIN_SRC = process.env.KSI_PLUGIN_DIR ?? path.join(REPO, "global", "plugins", "ksi-impeccable-detector");
const REAL_SKILLS = process.env.KSI_REAL_SKILLS ?? path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "opencode", "skills");
const ARTIFACT_PARENT = process.env.KSI_HARNESS_ROOT ?? "/tmp/opencode";
fs.mkdirSync(ARTIFACT_PARENT, { recursive: true });
const ROOT = fs.mkdtempSync(path.join(ARTIFACT_PARENT, "ksi-native-"));
const MODEL_PORT = Number(process.env.KSI_MODEL_PORT ?? 41851);
const SERVE_PORT = Number(process.env.KSI_SERVE_PORT ?? 41852);
const OPENCODE_BIN = process.env.OPENCODE_BIN ?? "opencode";

const PRIV = path.join(ROOT, "priv-home");
const WORKSPACE = path.join(ROOT, "workspace");
const OUTSIDE = path.join(ROOT, "outside");
const PLUGIN_DST = path.join(PRIV, ".config", "opencode", "plugins", "ksi-impeccable-detector");
const PASSWORD = "ksi-native-test-pw";
const AUTH = "Basic " + Buffer.from(`opencode:${PASSWORD}`).toString("base64");

// Defect pair verified against the real engine in regex snapshot mode
// (core scans every target as an isolated .tsx snapshot, CSS stays .css):
//   defective -> exit 2, antipattern overused-font; repaired -> exit 0, [].
const BAD_CSS = "body { font-family: Inter, system-ui, sans-serif; }\n";
const BAD_OLD = "font-family: Inter, system-ui, sans-serif;";
const GOOD_NEW = "font-family: Georgia, serif;";
const GOOD_CSS = "body { font-family: Georgia, serif; }\n";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
}

// ---------------------------------------------------------------- fake model
function userTextOf(body) {
  const msgs = body.messages ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content.map((p) => (typeof p.text === "string" ? p.text : "")).join("\n");
    }
  }
  return "";
}
const emitted = { A: { write: 0, edit: 0, tail: 0 }, B: { tail: 0 }, C: { write: 0 }, D: { write: 0 } };
function scriptFor(marker, advertised) {
  const has = (n) => Array.isArray(advertised) && advertised.includes(n);
  // Requests without tools (title/summary/auxiliary agents) get plain text
  // and never consume a script step.
  if (!has("write") && !has("edit") && !has("shell") && !has("read")) return { kind: "text", text: "ok" };
  if (marker === "A") {
    if (emitted.A.write === 0 && has("write")) {
      emitted.A.write++;
      return { kind: "tools", calls: [{ name: "write", args: { path: "banner.css", content: BAD_CSS } }] };
    }
    if (emitted.A.edit === 0 && has("edit")) {
      emitted.A.edit++;
      return {
        kind: "tools",
        calls: [{ name: "edit", args: { path: "banner.css", oldString: BAD_OLD, newString: GOOD_NEW } }],
      };
    }
    if (emitted.A.tail === 0 && has("shell") && has("read")) {
      emitted.A.tail++;
      return {
        kind: "tools",
        calls: [
          { name: "shell", args: { command: "echo native-probe-ok" } },
          { name: "read", args: { path: "banner.css" } },
        ],
      };
    }
    return { kind: "text", text: "probe-a done" };
  }
  if (marker === "B") {
    if (emitted.B.tail === 0 && has("shell")) {
      emitted.B.tail++;
      return {
        kind: "tools",
        calls: [
          { name: "shell", args: { command: "echo native-probe-denied" } },
          { name: "read", args: { path: path.join(OUTSIDE, "secret.txt") } },
        ],
      };
    }
    return { kind: "text", text: "probe-b done" };
  }
  if (marker === "C" || marker === "D") {
    if (!emitted[marker].write && has("write")) {
      emitted[marker].write++;
      return { kind: "tools", calls: [{ name: "write", args: { path: `blocked-${marker.toLowerCase()}.css`, content: BAD_CSS } }] };
    }
    return { kind: "text", text: `probe-${marker.toLowerCase()} done` };
  }
  return { kind: "text", text: "ok" };
}
function chunk(id, model, delta, finish) {
  return { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finish }] };
}
function startFakeModel() {
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
          const text = userTextOf(body);
          const marker = ["A", "B", "C", "D"].find((candidate) => text.includes(`PROBE-${candidate}`)) ?? null;
          const advertised = Array.isArray(body.tools) ? body.tools.map((t) => t?.function?.name ?? t?.type) : null;
          const script = scriptFor(marker, advertised);
          try {
            fs.appendFileSync(
              path.join(ROOT, "fake-model-requests.jsonl"),
              JSON.stringify({
                marker,
                hasTools: !!advertised,
                userTail: text.slice(-200),
                toolMsgs: (body.messages ?? [])
                  .filter((m) => m.role === "tool")
                  .map((m) => JSON.stringify(m.content ?? m).slice(0, 2000)),
                scriptKind: script.kind,
                scriptCalls: script.kind === "tools" ? script.calls.map((c) => c.name) : [],
                scriptArgs: script.kind === "tools" ? script.calls.map((c) => JSON.stringify(c.args).slice(0, 2000)) : [],
              }) + "\n",
            );
          } catch {}
          const id = `chatcmpl-ksinative-${Date.now()}`;
          const finishWith = (payloads, jsonBody) => {
            if (body.stream) {
              res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
              for (const p of payloads) res.write(`data: ${JSON.stringify(p)}\n\n`);
              res.write("data: [DONE]\n\n");
              res.end();
            } else {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify(jsonBody));
            }
          };
          if (script.kind === "text") {
            const msg = { role: "assistant", content: script.text };
            finishWith(
              [chunk(id, "fixture", { role: "assistant", content: script.text }, null), chunk(id, "fixture", {}, "stop")],
              { id, object: "chat.completion", created: 1, model: "fixture", choices: [{ index: 0, message: msg, finish_reason: "stop" }] },
            );
            return;
          }
          const calls = script.calls.map((c, i) => ({
            id: `call_ksinative_${marker}_${i}_${Date.now()}`,
            type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.args) },
          }));
          const deltas = calls.map((c, i) => chunk(id, "fixture", { role: "assistant", tool_calls: [{ index: i, id: c.id, type: c.type, function: c.function }] }, null));
          deltas.push(chunk(id, "fixture", {}, "tool_calls"));
          finishWith(deltas, {
            id, object: "chat.completion", created: 1, model: "fixture",
            choices: [{ index: 0, message: { role: "assistant", content: null, tool_calls: calls }, finish_reason: "tool_calls" }],
          });
        });
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
    });
    server.on("error", reject);
    server.listen(MODEL_PORT, "127.0.0.1", () => resolve(server));
  });
}

// ---------------------------------------------------------------- driver
async function api(method, p, body) {
  const r = await fetch(`http://127.0.0.1:${SERVE_PORT}${p}`, {
    method,
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}
function toolEntries(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (m.type !== "assistant") continue;
    for (const part of m.content ?? []) {
      if (part?.type === "tool") out.push(part);
    }
  }
  return out;
}
async function main() {
  check("plugin source present", fs.existsSync(path.join(PLUGIN_SRC, "index.js")) && fs.existsSync(path.join(PLUGIN_SRC, "adapter.mjs")), PLUGIN_SRC);

  // --- sandbox layout (only /tmp writes; upstream repo/home untouched)
  fs.mkdirSync(WORKSPACE, { recursive: true });
  fs.mkdirSync(OUTSIDE, { recursive: true });
  fs.writeFileSync(path.join(OUTSIDE, "secret.txt"), "topsecret\n");
  const cfgDir = path.join(PRIV, ".config", "opencode");
  fs.mkdirSync(path.join(cfgDir, "plugins"), { recursive: true });
  fs.cpSync(PLUGIN_SRC, PLUGIN_DST, { recursive: true });
  fs.symlinkSync(REAL_SKILLS, path.join(cfgDir, "skills"));
  const launcher = path.join(cfgDir, "skills", "impeccable", "scripts", "impeccable");
  const engineBin = path.join(cfgDir, "skills", "impeccable", "scripts", "bin", `${process.platform === "win32" ? "windows" : process.platform}-${process.arch === "x64" ? "x64" : process.arch}`, process.platform === "win32" ? "impeccable.exe" : "impeccable");
  check("launcher resolves via isolated skills symlink", fs.existsSync(launcher), launcher);
  let engineOk = false;
  try { fs.accessSync(engineBin, fs.constants.X_OK); engineOk = true; } catch {}
  check("real installed engine binary executable", engineOk, engineBin);
  fs.writeFileSync(
    path.join(cfgDir, "opencode.jsonc"),
    JSON.stringify({
      $schema: "https://opencode.ai/config.json",
      model: "fixture/fixture",
      permissions: [{ action: "*", resource: "*", effect: "allow" }],
      providers: {
        fixture: {
          name: "Fixture (local scripted)",
          package: "@opencode/ai/providers/openai-compatible",
          settings: { baseURL: `http://127.0.0.1:${MODEL_PORT}/v1`, apiKey: "ksi-native-fake-key" },
          models: {
            fixture: {
              name: "Fixture scripted model",
              capabilities: { tools: true, input: ["text"], output: ["text"] },
              limit: { context: 32768, output: 8192 },
            },
          },
        },
      },
    }),
  );

  const env = {
    ...process.env,
    HOME: PRIV,
    XDG_CONFIG_HOME: path.join(PRIV, ".config"),
    XDG_DATA_HOME: path.join(PRIV, ".local", "share"),
    XDG_CACHE_HOME: path.join(PRIV, ".cache"),
    XDG_STATE_HOME: path.join(PRIV, ".local", "state"),
    OPENCODE_SERVER_PASSWORD: PASSWORD,
  };
  const children = [];
  const onExit = () => { for (const c of children) { try { c.kill("SIGTERM"); } catch {} } };
  process.on("exit", onExit);

  const fake = await startFakeModel();
  const serveLog = path.join(ROOT, "serve.stdout.log");
  const serveOut = fs.openSync(serveLog, "a");
  const serve = spawn(OPENCODE_BIN, ["serve", "--port", String(SERVE_PORT), "--hostname", "127.0.0.1"], { env, cwd: WORKSPACE, stdio: ["ignore", serveOut, serveOut] });
  children.push(serve);
  try {

  let healthy = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    try {
      const r = await api("GET", "/api/info");
      if (r.status === 200) { healthy = true; break; }
    } catch {}
  }
  check("isolated serve healthy (private HOME, no external creds)", healthy, `127.0.0.1:${SERVE_PORT}`);
  if (!healthy) throw new Error("Private server did not become healthy");

  const serverLogPath = path.join(PRIV, ".local", "share", "opencode", "log", "opencode.log");
  const readServerLog = () => {
    try { return fs.readFileSync(serverLogPath, "utf8"); } catch { return ""; }
  };
  for (let i = 0; i < 15; i++) {
    if (readServerLog().includes("ksi-impeccable-detector")) break;
    await sleep(1000);
  }

  async function runSession(tag, permissions) {
    const s = await api("POST", "/api/session", {
      location: { directory: WORKSPACE },
      model: { id: "fixture", providerID: "fixture" },
      ...(permissions ? { permissions } : {}),
    });
    const id = s.json?.data?.id;
    if (!id) throw new Error(`session create failed: ${s.status} ${JSON.stringify(s.json).slice(0, 300)}`);
    const p = await api("POST", `/api/session/${id}/prompt`, { text: `${tag} scaffold a tiny banner stylesheet in banner.css` });
    if (p.status !== 200) throw new Error(`prompt failed: ${p.status}`);
    // Bounded wait for the agent loop to settle: the scripted final text
    // ("probe-a/b done") appears as an assistant message. (Persisted tool
    // part states can lag behind the live loop, so they are not the signal.)
    const doneText = `${tag.toLowerCase()} done`;
    let messages = [];
    for (let i = 0; i < 90; i++) {
      const m = await api("GET", `/api/session/${id}/message?limit=100&order=asc`);
      messages = m.json?.data ?? [];
      const settled = messages.some(
        (x) => x.type === "assistant" && JSON.stringify(x.content ?? "") .includes(doneText),
      );
      if (settled) break;
      await sleep(1000);
    }
    fs.writeFileSync(path.join(ROOT, `messages-${tag.toLowerCase()}.json`), JSON.stringify(messages, null, 1));
    return messages;
  }

  // --- session A: write(defect) -> edit(repair) -> shell+read(skip)
  // Primary evidence channel: the tool results the native loop delivers back
  // to the model (fake-model request log). The adapter appends its
  // [Impeccable source-only ...] note to scanned results only.
  const aMsgs = await runSession("PROBE-A", null);
  const reqLog = fs.readFileSync(path.join(ROOT, "fake-model-requests.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const aReqs = reqLog.filter((r) => r.marker === "A");
  const toolResultBlobs = aReqs.flatMap((r) => r.toolMsgs ?? []);
  const joinedResults = toolResultBlobs.join("\n");
  const writeArgs = (aReqs.flatMap((r) => r.scriptArgs ?? []).map((s) => { try { return JSON.parse(s); } catch { return null; } }).find((a) => a && typeof a.content === "string") ?? {});
  const writtenContent = writeArgs.content ?? "";

  check("native write executed", toolResultBlobs.length >= 1 && writtenContent.includes("Inter"), `tool-result msgs=${toolResultBlobs.length}`);
  check(
    "original engine detect finding delivered in write tool output",
    joinedResults.includes("[Impeccable source-only") && joinedResults.includes("overused-font"),
    joinedResults.slice(joinedResults.indexOf("[Impeccable"), joinedResults.indexOf("[Impeccable") + 250),
  );
  const noteStart = joinedResults.indexOf("[Impeccable source-only");
  const noteWindow = noteStart >= 0 ? joinedResults.slice(noteStart, noteStart + 1200) : "";
  check(
    "finding summary carries rule detail without temp snapshot paths",
    noteWindow.includes("overused-font") && !noteWindow.includes("ksi-det-") && !noteWindow.includes("snapshot-"),
    noteWindow.slice(0, 300),
  );
  check(
    "repaired file scans clean (subsequent result notes clean)",
    joinedResults.includes(": clean"),
    (joinedResults.match(/banner\.css: [a-z]+/g) ?? []).join(" | "),
  );
  check(
    "workspace file holds repaired content (real native write+edit)",
    fs.readFileSync(path.join(WORKSPACE, "banner.css"), "utf8") === GOOD_CSS,
  );
  // Independent cross-check: run the real engine binary directly on the exact
  // bytes the native write produced; its finding must match the delivered note.
  let engineFinding = null;
  try {
    const snapDir = fs.mkdtempSync(path.join(ROOT, "xcheck-"));
    const snap = path.join(snapDir, "snapshot-xcheck.css");
    fs.writeFileSync(snap, writtenContent);
     const proc = spawn(engineBin, ["detect", "--json", "--no-config", "--no-design-system", "--", snap], { cwd: snapDir, timeout: 1500, killSignal: "SIGKILL" });
    let stdout = "";
    proc.stdout.on("data", (c) => (stdout += c));
    const exitCode = await new Promise((resolve) => proc.on("close", resolve));
    const parsed = JSON.parse(stdout || "[]");
    engineFinding = { exitCode, first: parsed[0]?.antipattern ?? parsed[0]?.rule ?? null, line: parsed[0]?.line ?? null };
    fs.rmSync(snapDir, { recursive: true, force: true });
  } catch (e) { engineFinding = { error: String(e).slice(0, 120) }; }
  check(
    "independent engine run reproduces the delivered finding",
    engineFinding?.exitCode === 2 && engineFinding?.first === "overused-font" && noteWindow.includes("overused-font"),
    JSON.stringify(engineFinding),
  );
  const shellResult = toolResultBlobs.find((b) => b.includes("native-probe-ok"));
  const readResult = toolResultBlobs.find((b) => b.includes("Read file banner.css"));
  check("shell tool skipped (non-UI, result has no scan note)", !!shellResult && !shellResult.includes("Impeccable"), (shellResult ?? "").slice(0, 120));
  check("read tool skipped (result has no scan note)", !!readResult && !readResult.includes("Impeccable"), (readResult ?? "").slice(0, 120));
  const editedTools = toolEntries(aMsgs).filter((tool) => ["write", "edit"].includes(tool.name));
  check("write and edit persist completed results with JSON-safe detector metadata", editedTools.length === 2 && editedTools.every((tool) => tool.state?.status === "completed" && Array.isArray(tool.state.metadata?.ksiImpeccable)));

  // --- session B: denied shell + denied outside-tree read -> error, never scanned
  const bMsgs = await runSession("PROBE-B", [
    { action: "external_directory", resource: "*", effect: "deny" },
    { action: "shell", resource: "echo *", effect: "deny" },
  ]);
  const bTools = toolEntries(bMsgs);
  const bShell = bTools.filter((t) => t.name === "shell")[0];
  const bRead = bTools.filter((t) => t.name === "read")[0];
  const bShellErr = bShell?.state?.error?.message ?? "", bReadErr = bRead?.state?.error?.message ?? "";
  check("denied shell errors without scan", bShell?.state?.status === "error" && !bShellErr.includes("Invalid arguments") && !(bShell?.state?.metadata?.ksiImpeccable), bShellErr.slice(0, 160));
  check("denied read errors without scan", bRead?.state?.status === "error" && !bReadErr.includes("Invalid arguments") && !(bRead?.state?.metadata?.ksiImpeccable), bReadErr.slice(0, 160));

  for (const [tag, action, resource] of [["PROBE-C", "read", "*blocked-c.css"], ["PROBE-D", "shell", "*impeccable*"]]) {
    const messages = await runSession(tag, [{ action, resource, effect: "deny" }]);
    const write = toolEntries(messages).find((tool) => tool.name === "write");
    const error = write?.state?.error?.message ?? "";
    check(`detector respects Native ${action} denial after a successful write`, write?.state?.status === "error" && error.includes(`Permission denied: ${action}`) && !write?.state?.metadata?.ksiImpeccable, error.slice(0, 160));
    check(`Native ${action} denial does not undo the authorized edit`, fs.readFileSync(path.join(WORKSPACE, `blocked-${tag.slice(-1).toLowerCase()}.css`), "utf8") === BAD_CSS);
  }

  // Server log sinks flush asynchronously; assert plugin load at the end.
  check(
    "plugin loads natively (server log shows ksi-impeccable-detector entrypoint)",
    readServerLog().includes("ksi-impeccable-detector"),
    serverLogPath,
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed. Evidence dir: ${ROOT}`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name).join("; "));
    process.exitCode = 1;
  }
  } finally {
    fake.closeAllConnections();
    await new Promise((resolve) => fake.close(resolve));
    if (serve.exitCode === null && serve.signalCode === null) {
      serve.kill("SIGTERM");
      await Promise.race([new Promise((resolve) => serve.once("exit", resolve)), sleep(2000)]);
      if (serve.exitCode === null && serve.signalCode === null) serve.kill("SIGKILL");
    }
    fs.closeSync(serveOut);
    process.removeListener("exit", onExit);
  }
}

main().catch((e) => {
  console.error("INTEGRATION-ERROR", e?.stack ?? String(e));
  process.exitCode = 1;
});
