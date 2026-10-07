// Characterize the native final-step request against an auto-only local provider.
// Never inherits credentials or contacts a shared session/real model provider.
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildIsolatedEnv, parseServeStartup } from "./verify-native-v2-isolated.mjs";

export function selectFinalAssistant(messages, requestCount) {
  if (requestCount < 2 || !Array.isArray(messages) || messages.length < 2) return undefined;
  const message = messages[1];
  return message?.time?.completed ? message : undefined;
}

async function runCase({ override, terminalTool = false }) {
  const directory = await mkdtemp(join(tmpdir(), "ksi-tool-choice-"));
  const requests = [];
  let child, connection, output = "";
  const provider = createServer(async (req, res) => {
    try {
      if (req.method === "GET") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ object: "list", data: [{ id: "fixture", object: "model" }] }));
        return;
      }
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      requests.push({ toolChoice: body.tool_choice ?? null });
      if (body.tool_choice && body.tool_choice !== "auto") {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: "only auto is supported for tool_choice", type: "invalid_request_error" } }));
        return;
      }
      const callsTool = requests.length === 1 || terminalTool;
      const delta = callsTool
        ? { role: "assistant", tool_calls: [{ index: 0, id: `call_fixture_${requests.length}`, type: "function", function: { name: "read", arguments: JSON.stringify({ path: join(directory, "fixture.txt") }) } }] }
        : { role: "assistant", content: "bounded-summary" };
      res.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = choices => ({ id: "chatcmpl_fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices });
      res.write(`data: ${JSON.stringify(chunk([{ index: 0, delta, finish_reason: null }]))}\n\n`);
      res.write(`data: ${JSON.stringify(chunk([{ index: 0, delta: {}, finish_reason: callsTool ? "tool_calls" : "stop" }]))}\n\n`);
      res.end("data: [DONE]\n\n");
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
  const env = buildIsolatedEnv(directory, process.env.PATH ?? "");
  async function api(path, body) {
    const response = await fetch(connection.url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Basic ${Buffer.from(`opencode:${connection.password}`).toString("base64")}`, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error", signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`isolated API returned HTTP ${response.status}`);
    return response.json();
  }
  try {
    const config = join(env.XDG_CONFIG_HOME, "opencode");
    await mkdir(config, { recursive: true });
    await writeFile(join(directory, "fixture.txt"), "read-only fixture\n");
    await writeFile(join(config, "opencode.json"), JSON.stringify({
      model: "fixture/fixture", default_agent: "probe",
      agents: { probe: { mode: "primary", steps: 2, system: "Read the fixture once, then summarize. No edits.", permissions: [{ action: "*", resource: "*", effect: "deny" }, { action: "read", resource: join(directory, "*"), effect: "allow" }] } },
      providers: { fixture: { package: "@opencode/ai/providers/openai-compatible", settings: { baseURL: `http://127.0.0.1:${provider.address().port}/v1`, apiKey: "non-secret-fixture" }, models: { fixture: { capabilities: { tools: true, input: ["text"], output: ["text"] }, ...(override ? { body: { tool_choice: "auto" } } : {}) } } } },
    }));
    child = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", "0"], { env, cwd: directory, stdio: ["ignore", "pipe", "pipe"] });
    connection = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("isolated startup timeout")), 15000);
      const data = chunk => {
        output = (output + chunk.toString()).slice(-4096);
        const ready = parseServeStartup(output);
        if (ready) { clearTimeout(timer); resolve(ready); }
      };
      child.stdout.on("data", data); child.stderr.on("data", data);
      child.once("error", error => { clearTimeout(timer); reject(error); });
      child.once("exit", code => { clearTimeout(timer); reject(new Error(`isolated startup exit ${code}`)); });
    });
    const model = { providerID: "fixture", id: "fixture" };
    const session = (await api("/api/session", { title: "Local step-limit compatibility probe", agent: "probe", model })).data.id;
    await api(`/api/session/${session}/prompt`, { text: "Read fixture.txt once and summarize." });
    let final;
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      const messages = (await api(`/api/session/${session}/message?type=assistant&order=asc&limit=3`)).data;
      const message = selectFinalAssistant(messages, requests.length);
      if (message) {
        const content = message.content ?? [];
        final = {
          text: content.filter(item => item.type === "text").map(item => item.text).join(""),
          toolErrors: content.filter(item => item.type === "tool").map(item => item.state?.error?.message ?? item.state?.error ?? ""),
        };
        break;
      }
    }
    if (!final) throw new Error("isolated final-step probe timed out");
    const agent = (await api("/api/agent/probe")).data;
    return { override, terminalTool, steps: agent.steps, requests, final };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
}

export async function verifyToolChoice() {
  const baseline = await runCase({ override: false });
  const compatible = await runCase({ override: true });
  const limit = await runCase({ override: true, terminalTool: true });
  const failures = [];
  if (baseline.requests.length !== 2 || baseline.requests[1].toolChoice !== "none" || baseline.final.text !== "") failures.push("native final-step rejection was not reproduced");
  if (compatible.requests.length !== 2 || compatible.requests[1].toolChoice !== "auto" || compatible.final.text !== "bounded-summary") failures.push("model-scoped overlay did not recover the final summary");
  if (limit.requests.length !== 2 || !limit.final.toolErrors.some(error => /Tools are disabled after the maximum agent steps/.test(error))) failures.push("terminal tool call bypassed the native step limit");
  if ([baseline, compatible, limit].some(result => result.steps !== 2)) failures.push("native step allowance changed");
  return { ok: failures.length === 0, failures, baseline, compatible, limit, sharedSessionsTouched: false, realProviderCalls: 0, inheritedCredentials: false, childEgress: "not monitored" };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyToolChoice().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
