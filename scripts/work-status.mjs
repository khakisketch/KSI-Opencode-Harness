// Local, read-only record/Git reconciliation. Never infer user acceptance or
// deployment from idle state, a complete ledger, or an upstream comparison.
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join, relative, isAbsolute } from "node:path";

export function readProjectText(repo, path) {
  try {
    const root = realpathSync(repo);
    const target = realpathSync(join(root, path));
    const rel = relative(root, target);
    if (rel === ".." || rel.startsWith("../") || isAbsolute(rel)) return null;
    return readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

export function section(text, name) {
  const lines = String(text ?? "").split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `## ${name}`);
  if (start === -1) return "";
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    body.push(line);
  }
  return body.join("\n").trim();
}

function field(text, name) {
  return String(text ?? "").match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1].trim() ?? null;
}

function gitRead(repo, args) {
  try {
    return execFileSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", repo, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

export function inspectWorkStatus(repo) {
  const root = resolve(repo);
  const checkpoint = readProjectText(root, ".opencode/working-state.md");
  const product = readProjectText(root, "docs/superpowers/product-state.md");
  const head = gitRead(root, ["rev-parse", "HEAD"]);
  const branch = gitRead(root, ["branch", "--show-current"]);
  const changes = gitRead(root, ["status", "--porcelain"]);
  const aheadText = gitRead(root, ["rev-list", "--count", "@{upstream}..HEAD"]);
  const ahead = aheadText !== null && /^\d+$/.test(aheadText) ? Number(aheadText) : null;
  const recordedHead = field(checkpoint, "HEAD")?.match(/^[a-f0-9]{7,40}\b/i)?.[0] ?? null;
  const slice = field(checkpoint, "Slice");
  // Only the established plans namespace, no traversal/absolute paths.
  const ledgerPath = slice?.match(/ledger:\s*(docs\/superpowers\/plans\/[a-zA-Z0-9_-]+\.md)\s*$/)?.[1] ?? null;
  const ledgerText = ledgerPath ? readProjectText(root, ledgerPath) : null;
  const recordedStatus = field(checkpoint, "Status") ?? "unknown";
  const ledgerStatus = field(ledgerText, "Status") ?? "unknown";
  const warnings = [];
  if (!checkpoint) warnings.push("Checkpoint missing or unreadable; recorded work is unknown.");
  if (!head) warnings.push("Git revision unavailable; not a verified Git checkout.");
  if (head && checkpoint && (!recordedHead || !head.startsWith(recordedHead))) warnings.push("Checkpoint revision differs from current Git HEAD or is unrecorded.");
  const recordedBranch = field(checkpoint, "Branch");
  if (branch && recordedBranch && branch !== recordedBranch) warnings.push("Checkpoint branch differs from current Git branch.");
  if (slice?.includes("ledger:") && !ledgerPath) warnings.push("Ledger pointer malformed or outside the supported plans namespace.");
  if (ledgerPath && !ledgerText) warnings.push("Ledger missing, unreadable or outside the project.");
  if (recordedStatus === "idle" && ledgerText && (/in[ _-]?progress|active/i.test(ledgerStatus) || /^\s*- \[ \]/m.test(ledgerText))) {
    warnings.push("Idle checkpoint has an unfinished ledger; reconcile before claiming completion.");
  }
  return {
    repo: root,
    recordedStatus,
    slice,
    git: { head, branch: branch || null, changedPaths: changes === null ? null : changes ? changes.split("\n").length : 0, ahead },
    ledger: { path: ledgerPath, status: ledgerStatus },
    acceptance: section(product, "Human acceptance") || "not recorded",
    delivery: ahead === null ? "unknown" : ahead > 0 ? "local commits ahead of upstream; publication/deployment not inferred" : "no commits ahead of upstream; deployment not inferred",
    next: section(checkpoint, "Next").split("\n").filter(line => /^- /.test(line)).map(line => line.slice(2)).slice(0, 3),
    warnings,
  };
}

export function renderWorkStatus(status) {
  return [
    "[Work status — recorded, not user acceptance]",
    `  Work: ${status.recordedStatus} | ${status.slice ?? "not recorded"}`,
    `  Git: ${status.git.branch ?? "unknown"} @ ${status.git.head?.slice(0, 7) ?? "unknown"}; changed paths: ${status.git.changedPaths ?? "unknown"}`,
    `  User acceptance: ${status.acceptance}`,
    `  External delivery: ${status.delivery}`,
    ...status.next.map(item => `  Next: ${item}`),
    ...status.warnings.map(item => `  Warning: ${item}`),
  ].join("\n");
}
