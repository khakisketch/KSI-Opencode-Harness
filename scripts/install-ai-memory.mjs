#!/usr/bin/env node
/**
 * Install and wire ai-memory as the optional global long-term memory layer.
 *
 * This is intentionally narrower than `ai-memory setup`: it installs the
 * baseline binary when absent, runs a local-only server, wires MCP + lifecycle hooks for
 * OpenCode, Claude Code and Codex, and leaves skills/profile/cloud features
 * alone. Capture uses allowlist mode: only repositories with an
 * `.ai-memory.toml` marker emit lifecycle events.
 *
 * Usage:
 *   node scripts/install-ai-memory.mjs
 *   node scripts/install-ai-memory.mjs --verify
 *   node scripts/install-ai-memory.mjs --marker /path/to/project \
 *     --workspace my-workspace --project my-project
 *
 * The script is idempotent and backs up every config file it changes.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, chmodSync, symlinkSync, unlinkSync } from "node:fs";
import { homedir, platform, arch } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERSION = "3.2.8";
const HOME = homedir();
const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const value = (name, fallback = null) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const expandHome = (input) => input.replace(/^~(?=$|\/)/, HOME);
const PORT = Number(value("--port", "49375"));
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error("[ai-memory] ERROR: --port must be an integer between 1 and 65535");
  process.exit(1);
}
const DATA_DIR = resolve(expandHome(value("--data-dir", join(HOME, ".local/share/ai-memory"))));
const BIN_LINK = join(HOME, ".local/bin/ai-memory");
const RELEASE = `https://github.com/akitaonrails/ai-memory/releases/download/v${VERSION}`;

if (has("--help") || has("-h")) {
  console.log(`Usage: node scripts/install-ai-memory.mjs [options]

Options:
  --verify                 Check the existing install without changing files.
  --marker <dir>           Create <dir>/.ai-memory.toml (allowlist opt-in).
  --workspace <name>       Marker workspace (default: default).
  --project <name>         Marker project (default: directory basename).
  --data-dir <dir>         Default: ~/.local/share/ai-memory
  --port <n>               Default: 49375 (OpenCode already uses 49374).
  --no-service             Start a detached process instead of systemd.
  --skip-opencode          Do not wire OpenCode MCP/hooks.
  --skip-claude            Do not wire Claude Code MCP/hooks.
  --skip-codex             Do not wire Codex MCP/hooks.
  --no-hooks               Wire MCP only; no automatic lifecycle capture.
  --help                   Show this help.

This bootstraps a baseline binary and preserves newer stable installs.
Existing older installs must be updated with the official ai-memory upgrade command.
It uses local-only mode: no cloud LLM,
no embedding model download, no cross-project profile, no auto-compaction.
`);
  process.exit(0);
}

const verifyOnly = has("--verify");
const noService = has("--no-service");
const skipOpenCode = has("--skip-opencode");
const skipClaude = has("--skip-claude");
const skipCodex = has("--skip-codex");
const noHooks = has("--no-hooks");
const markerDir = value("--marker");
const workspace = value("--workspace", "default");
const project = value("--project", markerDir ? resolve(markerDir).split("/").filter(Boolean).pop() : null);

function log(message) {
  console.log(`[ai-memory] ${message}`);
}

function fail(message) {
  console.error(`[ai-memory] ERROR: ${message}`);
  process.exit(1);
}

function run(command, commandArgs = [], options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.inherit ? "inherit" : "pipe",
    ...options,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${command} ${commandArgs.join(" ")} failed (${result.status})\n${result.stderr || result.stdout || ""}`);
  }
  return result;
}

function backup(file) {
  if (!existsSync(file)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = `${file}.before-ai-memory-${stamp}`;
  copyFileSync(file, target);
  log(`backup: ${target}`);
}

function releaseAsset() {
  const os = platform();
  const cpu = arch();
  if (os === "linux" && cpu === "x64") return "ai-memory-linux-x86_64.tar.gz";
  if (os === "linux" && cpu === "arm64") return "ai-memory-linux-aarch64.tar.gz";
  if (os === "darwin" && cpu === "arm64") return "ai-memory-macos-aarch64.tar.gz";
  if (os === "darwin" && cpu === "x64") return "ai-memory-macos-x86_64.tar.gz";
  fail(`Unsupported platform for the Node installer: ${os}/${cpu}. Use the official ai-memory installer.`);
}

async function download(url, destination) {
  log(`download: ${url}`);
  const response = await fetch(url);
  if (!response.ok) fail(`download failed: ${response.status} ${url}`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

// Compare the executable's version, not its directory name: the official
// upgrader replaces the binary in place, including under an older version path.
export function keepInstalledBinary(output, minimum = VERSION) {
  const installed = /^ai-memory (\d+\.\d+\.\d+)\s*$/.exec(output.trim());
  if (!installed || !/^\d+\.\d+\.\d+$/.test(minimum)) {
    throw new Error("Cannot establish a stable ai-memory version; leaving the existing binary untouched.");
  }
  const actual = installed[1].split(".").map(Number);
  const required = minimum.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (actual[i] !== required[i]) return actual[i] > required[i];
  }
  return true;
}

async function ensureBinary() {
  if (existsSync(BIN_LINK)) {
    const result = run(BIN_LINK, ["--version"], { allowFailure: true });
    if (result.status !== 0) fail("Existing ai-memory could not report its version; leaving it untouched.");
    if (keepInstalledBinary(result.stdout)) {
      log(`binary already installed: ${result.stdout.trim()}`);
      return;
    }
    fail(`Existing binary is older than ${VERSION}; back up memory, run ai-memory upgrade, then restart only the ai-memory service before reapplying this integration.`);
  }
  const asset = releaseAsset();
  const installRoot = join(HOME, ".local/share/ai-memory", VERSION);
  mkdirSync(installRoot, { recursive: true });
  mkdirSync(dirname(BIN_LINK), { recursive: true });
  const tmp = join(HOME, ".cache/ai-memory-install");
  mkdirSync(tmp, { recursive: true });
  const tarball = join(tmp, asset);
  const checksum = `${tarball}.sha256`;
  await download(`${RELEASE}/${asset}`, tarball);
  await download(`${RELEASE}/${asset}.sha256`, checksum);
  const expected = readFileSync(checksum, "utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(readFileSync(tarball)).digest("hex");
  if (expected !== actual) fail(`checksum mismatch for ${asset}`);
  run("tar", ["-xzf", tarball, "-C", installRoot]);
  const binary = join(installRoot, "ai-memory");
  if (!existsSync(binary)) fail(`binary missing after extraction: ${binary}`);
  chmodSync(binary, 0o755);
  if (existsSync(BIN_LINK)) unlinkSync(BIN_LINK);
  symlinkSync(binary, BIN_LINK);
  log(`installed: ${BIN_LINK} -> ${binary}`);
}

function ensureConfig() {
  if (!existsSync(join(DATA_DIR, "config.toml"))) {
    log(`init: ${DATA_DIR}`);
    run(BIN_LINK, ["init", "--data-dir", DATA_DIR], { inherit: true });
  }
  const file = join(DATA_DIR, "config.toml");
  const original = readFileSync(file, "utf8");
  let text = original;
  text = text.replace(/^bind\s*=\s*"[^"]+"/m, `bind = "127.0.0.1:${PORT}"`);
  if (!/^server_url\s*=/m.test(text)) {
    text = text.replace(/^bind\s*=\s*"[^"]+"/m, (line) => `${line}\nserver_url = "http://127.0.0.1:${PORT}"`);
  } else {
    text = text.replace(/^server_url\s*=\s*"[^"]+"/m, `server_url = "http://127.0.0.1:${PORT}"`);
  }
  if (!/^embedding_provider\s*=/m.test(text)) {
    text = text.replace(/\n\[decay\]\n/, `\n# Local-only: do not download or call an embedding model.\nembedding_provider = "none"\n\n[decay]\n`);
  }
  if (!/^compact_cold_episodic\s*=/m.test(text)) {
    text = text.replace(/^ledger_retention_months\s*=.*$/m, (line) => `${line}\ncompact_cold_episodic = false`);
  }
  text = text.replace(/(\[auto_improve\.scheduler\][\s\S]*?)^enabled\s*=\s*true$/m, "$1enabled = false");
  if (!/^\[profile\]$/m.test(text)) {
    const profile = `\n[profile]\n# Global install: do not learn or inject cross-project preferences.\nenabled = false\nshare = "off"\ninject_on_session_start = false\nllm = false\n\n`;
    text = text.replace(/\n\[auth\]\n/, `${profile}[auth]\n`);
  }
  if (text !== original) {
    backup(file);
    writeFileSync(file, text);
    log(`config updated: ${file}`);
  } else {
    log(`config already current: ${file}`);
  }
}

function ensureService() {
  if (noService) {
    const health = run("curl", ["-fsS", `http://127.0.0.1:${PORT}/healthz`], { allowFailure: true });
    if (health.status === 0) {
      log("service: already running; --no-service left it alone");
      return;
    }
    const child = spawn(BIN_LINK, ["serve", "--transport", "http", "--data-dir", DATA_DIR], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    log(`service: detached process started (pid ${child.pid})`);
    return;
  }
  if (platform() !== "linux") {
    log("service: non-Linux host; start manually: ai-memory serve --transport http --data-dir " + DATA_DIR);
    return;
  }
  const unitDir = join(HOME, ".config/systemd/user");
  const unit = join(unitDir, "ai-memory.service");
  mkdirSync(unitDir, { recursive: true });
  const desired = `[Unit]
Description=ai-memory local memory server
After=network.target

[Service]
Type=simple
ExecStart=${BIN_LINK} serve --transport http --data-dir ${DATA_DIR}
Restart=on-failure
RestartSec=3
Environment=RUST_LOG=info

[Install]
WantedBy=default.target
`;
  if (!existsSync(unit) || readFileSync(unit, "utf8") !== desired) {
    backup(unit);
    writeFileSync(unit, desired);
    log(`service unit written: ${unit}`);
  }
  run("systemctl", ["--user", "daemon-reload"]);
  run("systemctl", ["--user", "enable", "--now", "ai-memory.service"]);
  log("service: ai-memory.service enabled");
}

function patchOpenCode() {
  const jsonc = join(HOME, ".config/opencode/opencode.jsonc");
  const json = join(HOME, ".config/opencode/opencode.json");
  const file = existsSync(jsonc) ? jsonc : json;
  if (!existsSync(file)) {
    log("OpenCode: config not found; skipping");
    return;
  }
  let text = readFileSync(file, "utf8");
  if (/"ai-memory"\s*:/.test(text)) {
    log("OpenCode: ai-memory MCP already present");
    return;
  }
  const comment = file.endsWith(".jsonc")
    ? "        // Local bridge; reads the bearer token from the ai-memory data dir.\n"
    : "";
  const block = `      "ai-memory": {
${comment}        "type": "local",
        "command": [
          "${BIN_LINK}",
          "mcp-bridge",
          "--no-session-id",
          "--server-url",
          "http://127.0.0.1:${PORT}/mcp",
          "--data-dir",
          "${DATA_DIR}"
        ]
      },
`;
  if (!text.includes('"servers": {')) fail("OpenCode config has no mcp.servers block");
  backup(file);
  text = text.replace('"servers": {', `"servers": {\n${block}`, 1);
  writeFileSync(file, text);
  log(`OpenCode: MCP entry added to ${file}`);
}

function patchCodex() {
  const file = join(HOME, ".codex/config.toml");
  if (!existsSync(file)) {
    log("Codex: config not found; skipping");
    return;
  }
  let text = readFileSync(file, "utf8");
  if (/^\[mcp_servers\.ai-memory\]/m.test(text)) {
    log("Codex: ai-memory MCP already present");
    return;
  }
  const block = `
[mcp_servers.ai-memory]
# Local stdio bridge; reads the bearer token from the ai-memory data dir.
command = "${BIN_LINK}"
args = ["mcp-bridge", "--no-session-id", "--server-url", "http://127.0.0.1:${PORT}/mcp", "--data-dir", "${DATA_DIR}"]
`;
  backup(file);
  writeFileSync(file, `${text.trimEnd()}\n${block}`);
  log(`Codex: MCP entry added to ${file}`);
}

function installAgentHooks() {
  if (noHooks) {
    log("hooks: skipped by --no-hooks");
    return;
  }
  if (!skipOpenCode) {
    run(BIN_LINK, ["install-hooks", "--agent", "opencode2", "--apply", "--capture-mode", "allowlist", "--data-dir", DATA_DIR, "--server-url", `http://127.0.0.1:${PORT}`], { inherit: true });
  }
  if (!skipClaude) {
    run(BIN_LINK, ["install-hooks", "--agent", "claude-code", "--apply", "--capture-mode", "allowlist", "--scope", "global", "--data-dir", DATA_DIR, "--server-url", `http://127.0.0.1:${PORT}`], { inherit: true });
  }
  if (!skipCodex) {
    run(BIN_LINK, ["install-hooks", "--agent", "codex", "--apply", "--capture-mode", "allowlist", "--data-dir", DATA_DIR, "--server-url", `http://127.0.0.1:${PORT}`], { inherit: true });
  }
}

function installAgentMcp() {
  if (!skipClaude) {
    run(BIN_LINK, ["install-mcp", "--client", "claude-code", "--apply", "--session-aware", "--data-dir", DATA_DIR, "--server-url", `http://127.0.0.1:${PORT}`], { inherit: true });
  }
  if (!skipCodex) patchCodex();
  if (!skipOpenCode) patchOpenCode();
}

function createMarker() {
  if (!markerDir) return;
  const dir = resolve(markerDir);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, ".ai-memory.toml");
  if (existsSync(file)) {
    log(`marker already exists: ${file}`);
    return;
  }
  const marker = `workspace = "${workspace}"
project = "${project}"
drop_subagent_captures = "true"

[profile]
contribute = false
consume = false
`;
  writeFileSync(file, marker);
  log(`marker written: ${file}`);
}

async function verify() {
  const tokenFile = join(DATA_DIR, "auth-tokens/default");
  if (!existsSync(tokenFile)) fail("auth token missing; run install first");
  const token = readFileSync(tokenFile, "utf8").trim();
  let health;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    health = await fetch(`http://127.0.0.1:${PORT}/healthz`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (health?.ok) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!health?.ok) fail(`server health check failed: ${health?.status ?? "unreachable"}`);
  log(`server: healthy at http://127.0.0.1:${PORT}`);
  for (const [label, command, commandArgs] of [
    ["OpenCode", "opencode", ["mcp", "list"]],
    ["Claude Code", "claude", ["mcp", "list"]],
    ["Codex", "codex", ["mcp", "list"]],
  ]) {
    const result = run(command, commandArgs, { allowFailure: true });
    const text = `${result.stdout || ""}\n${result.stderr || ""}`;
    if (text.includes("ai-memory")) log(`${label}: ai-memory MCP present`);
    else log(`${label}: ai-memory MCP not visible (agent may need a restart or login)`);
  }
  const status = run(BIN_LINK, ["status", "--data-dir", DATA_DIR], { allowFailure: true });
  if (status.status === 0) log("memory status: OK");
  else log("memory status: not available");
}

async function main() {
  log(`baseline: ai-memory ${VERSION} (newer stable installs preserved), data=${DATA_DIR}, port=${PORT}`);
  if (verifyOnly) {
    await verify();
    return;
  }
  await ensureBinary();
  ensureConfig();
  ensureService();
  installAgentMcp();
  installAgentHooks();
  createMarker();
  await verify();
  log("done. OpenCode V2 watches config/plugins; no shared-service restart is required. Start a new Claude Code/Codex session to load changed hooks.");
  log("Codex will ask you to trust the new hooks once; review them before accepting.");
  log("Only repositories with .ai-memory.toml are captured (allowlist).");
  log("No cloud LLM, embedding model, cross-project profile, or auto-compaction is enabled.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => fail(error.stack || error.message));
}
