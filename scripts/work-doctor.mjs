#!/usr/bin/env node
// Source-checkout helper, not an installer or runtime health probe. It reads
// known local metadata only; commands/URLs in project records are never run.
import { statSync, accessSync, constants } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { readProjectText, section } from "./work-status.mjs";

const usage = "Usage: node scripts/work-doctor.mjs [--repo PATH] [--config PATH] [--frontend] [--json]";
const fields = ["Repository", "Start command", "Verify command"];
const frontendFields = ["Design project", "Design storage", "Entry", "Product URL", "Brand source"];

function filePresent(path) {
  try { return statSync(path).isFile(); } catch { return false; }
}

function browserPresent() {
  return (process.env.PATH ?? "").split(":").filter(Boolean).some(dir =>
    ["playwright-cli", "agent-browser"].some(name => {
      try { accessSync(join(dir, name), constants.X_OK); return filePresent(join(dir, name)); } catch { return false; }
    }),
  );
}

export function readProductBinding(repo) {
  let body = section(readProjectText(repo, "docs/superpowers/product-state.md"), "Product binding");
  if (!body) {
    const checkpoint = readProjectText(repo, ".opencode/working-state.md");
    const path = checkpoint?.match(/ledger:\s*(docs\/superpowers\/plans\/[a-zA-Z0-9_-]+\.md)\s*$/m)?.[1];
    if (path) body = section(readProjectText(repo, path), "Product binding");
  }
  const binding = {};
  for (const line of body.split("\n")) {
    const match = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!match || ![...fields, ...frontendFields].includes(match[1])) continue;
    // Unknown/placeholder values cannot satisfy a prerequisite.
    if (!/^(?:unknown|not recorded|TBD|[-—])$/i.test(match[2])) binding[match[1]] = match[2];
  }
  return binding;
}

export function inspectReadiness({ repo = process.cwd(), configDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode"), frontend = false } = {}) {
  const root = resolve(repo);
  const config = resolve(configDir);
  const checks = [];
  let repositoryPresent = false;
  try { repositoryPresent = statSync(root).isDirectory(); } catch {}
  checks.push({ id: "repository", state: repositoryPresent ? "present" : "missing", detail: "Requested working directory presence; product binding still needs verification." });
  const roles = ["developer", "test-runner", "reviewer"];
  const missingRoles = roles.filter(name => !filePresent(join(config, `agents/${name}.md`)) && !filePresent(join(root, `.opencode/agents/${name}.md`)));
  checks.push({ id: "roles", state: missingRoles.length ? "missing" : "present", detail: missingRoles.length ? `Missing role files: ${missingRoles.join(", ")}` : "Role files present; effective role/model/permission catalog not inspected." });
  const policyPresent = filePresent(join(root, "AGENTS.md")) || filePresent(join(config, "AGENTS.md"));
  checks.push({ id: "policy", state: policyPresent ? "present" : "missing", detail: "File presence only; adopted policy and instruction precedence require agent inspection." });
  const binding = readProductBinding(root);
  const required = frontend ? [...fields, ...frontendFields] : fields;
  const missing = required.filter(name => !binding[name]);
  const mismatch = binding.Repository && resolve(root, binding.Repository) !== root;
  checks.push({ id: "binding", state: mismatch ? "mismatch" : missing.length ? "unknown" : "present", detail: mismatch ? "Recorded repository differs from the requested working directory; verify the actual project." : missing.length ? `Binding not fully recorded: ${missing.join(", ")}` : "Binding recorded; actual storage/read/write/URL access is not proven." });
  if (frontend) checks.push({ id: "browser", state: browserPresent() ? "present" : "unknown", detail: "Executable presence only; launch/sandbox/product interaction not tested." });
  checks.push({ id: "notifier", state: filePresent(join(config, "plugins/design-notifier/installed.json")) ? "present" : "unknown", detail: "Optional runtime manifest presence; activation/revision/delivery not verified." });
  checks.push({ id: "effective-tools", state: "unknown", detail: "Use native catalog and real project read/changed-flow checks; no credentials, service calls or commands executed here." });
  const needsSetup = !repositoryPresent || missingRoles.length > 0 || !policyPresent || mismatch || (frontend && missing.length > 0);
  return {
    status: needsSetup ? "needs-setup" : "unverified",
    scope: "local metadata only; not runtime readiness, product acceptance or deployment",
    repo: root,
    checks,
  };
}

export function renderReadiness(result) {
  return [`[Preparation: ${result.status}]`, result.scope, ...result.checks.map(check => `  ${check.id}: ${check.state} — ${check.detail}`)].join("\n");
}

function main(args) {
  const options = {};
  let json = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === "--repo" || arg === "--config") && args[i + 1] && !args[i + 1].startsWith("--")) options[arg === "--repo" ? "repo" : "configDir"] = args[++i];
    else if (arg === "--frontend") options.frontend = true;
    else if (arg === "--json") json = true;
    else throw new Error(usage);
  }
  const result = inspectReadiness(options);
  console.log(json ? JSON.stringify(result, null, 2) : renderReadiness(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
