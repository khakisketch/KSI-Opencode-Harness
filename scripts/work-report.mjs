#!/usr/bin/env node
// Read-only consolidated work report for the KSI OpenCode workflow:
// goals, design-run deliveries, recent usage, worktrees and backlog next
// slices. Opens the session database in read-only mode and never writes to
// any inspected state.
//
// Usage:
//   node scripts/work-report.mjs                     # last 7 days, cwd repo
//   node scripts/work-report.mjs --days 30
//   node scripts/work-report.mjs --repo /path/to/repo
//   node scripts/work-report.mjs --json

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function envPath(name, fallback) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function defaultPaths(env = process.env) {
  const home = env.HOME?.trim() || homedir();
  const dataHome = env.XDG_DATA_HOME?.trim() || join(home, ".local", "share");
  const stateHome = env.XDG_STATE_HOME?.trim() || join(home, ".local", "state");
  return {
    goals: envPath("KSI_WORK_REPORT_GOALS", join(dataHome, "opencode-goal-plugin", "goals.json")),
    bindings: envPath("KSI_WORK_REPORT_BINDINGS", join(stateHome, "opencode-design-notifier", "bindings.json")),
    paused: envPath("KSI_WORK_REPORT_PAUSED", join(stateHome, "opencode-design-notifier", "paused.json")),
    db: envPath("KSI_WORK_REPORT_DB", join(dataHome, "opencode", "opencode.db")),
  };
}

function oneLine(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Goal state stores seconds; session state stores milliseconds.
function toMillis(value) {
  const n = numberOrNull(value);
  if (n === null) return null;
  return n > 1e12 ? n : n * 1000;
}

export function formatTokens(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "?";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}k`;
  return String(value);
}

function formatTime(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "?";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseNextSlices(markdown) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Next slices/i.test(line));
  if (start === -1) return [];
  const items = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const match = line.match(/^\s*-\s+(.+)$/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

export function summarizeGoals(raw) {
  const container = raw && typeof raw === "object" ? raw : {};
  const goalsRaw = container.goals ?? container;
  const list = Array.isArray(goalsRaw) ? goalsRaw : Object.values(goalsRaw ?? {});
  return list
    .filter((goal) => goal && typeof goal === "object")
    .map((goal) => ({
      sessionID: typeof goal.sessionID === "string" ? goal.sessionID : null,
      objective: oneLine(goal.objective).slice(0, 110),
      status: typeof goal.status === "string" ? goal.status : "unknown",
      tokensUsed: numberOrNull(goal.tokensUsed),
      tokenBudget: numberOrNull(goal.tokenBudget),
      autoTurns: numberOrNull(goal.autoTurns),
      maxAutoTurns: numberOrNull(goal.maxAutoTurns),
      updatedAt: toMillis(goal.updatedAt),
    }))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function summarizeBindings(raw) {
  const list = Object.values(raw && typeof raw === "object" ? raw : {}).filter(
    (record) => record && typeof record === "object",
  );
  const isPending = (state) => state === "requested" || state === "tracking" || state === "held";
  return list
    .map((record) => ({
      key: typeof record.key === "string" ? record.key : "",
      state: typeof record.state === "string" ? record.state : "unknown",
      runId: typeof record.runId === "string" ? record.runId : null,
      sessionID: typeof record.sessionID === "string" ? record.sessionID : null,
      classification:
        record.delivery?.classification ??
        (record.lastStatus?.deliverableValid === true ? "valid" : record.lastStatus ? "invalid" : null),
      updatedAt: numberOrNull(record.updatedAt),
    }))
    .sort((a, b) => {
      const pa = isPending(a.state) ? 0 : 1;
      const pb = isPending(b.state) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
}

function parseJson(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed);
  } catch {
    return [];
  }
}

export function queryUsage(dbPath, sinceMs, { topSessions = 6 } = {}) {
  const open = `file:${resolve(dbPath)}?mode=ro`;
  const byProject = parseJson(
    execFileSync(
      "sqlite3",
      [
        "-json",
        open,
        `SELECT directory AS project, COUNT(*) AS sessions,
                COALESCE(SUM(tokens_input),0) AS tokens_in,
                COALESCE(SUM(tokens_output),0) AS tokens_out,
                ROUND(COALESCE(SUM(cost),0),4) AS cost
         FROM session_v2 WHERE time_created >= ${Number(sinceMs)}
         GROUP BY directory ORDER BY tokens_in DESC LIMIT 12;`,
      ],
      { encoding: "utf8" },
    ),
  );
  const top = parseJson(
    execFileSync(
      "sqlite3",
      [
        "-json",
        open,
        `SELECT substr(id,1,14) AS id, agent,
                substr(COALESCE(title,''),1,64) AS title,
                tokens_input AS tokens_in, tokens_output AS tokens_out,
                ROUND(cost,4) AS cost
         FROM session_v2 WHERE time_created >= ${Number(sinceMs)}
         ORDER BY tokens_input DESC LIMIT ${Number(topSessions)};`,
      ],
      { encoding: "utf8" },
    ),
  );
  return { byProject, top };
}

export function queryWorktrees(repoPath) {
  try {
    const out = execFileSync("git", ["-C", resolve(repoPath), "worktree", "list"], {
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function readJsonFile(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

export function buildReport({ repo = null, days = 7, now = Date.now() } = {}) {
  const paths = defaultPaths();
  const since = now - days * 24 * 60 * 60 * 1000;
  const report = {
    generatedAt: now,
    days,
    repo: repo ? resolve(repo) : null,
    goals: summarizeGoals(readJsonFile(paths.goals, {})),
    designRuns: summarizeBindings(readJsonFile(paths.bindings, {})),
    designPaused: readJsonFile(paths.paused, {}),
    usage: existsSync(paths.db) ? queryUsage(paths.db, since) : { byProject: [], top: [] },
    worktrees: repo ? queryWorktrees(repo) : [],
    nextSlices: [],
  };
  if (repo) {
    const productState = join(resolve(repo), "docs/superpowers/product-state.md");
    if (existsSync(productState)) {
      report.nextSlices = parseNextSlices(readFileSync(productState, "utf8"));
    }
  }
  return report;
}

export function renderReport(report) {
  const lines = [];
  lines.push(
    `=== KSI work report — ${formatTime(report.generatedAt)} (last ${report.days} days) ===`,
  );

  lines.push("");
  lines.push(`[Goals] (${report.goals.length})`);
  if (report.goals.length === 0) lines.push("  (none)");
  for (const goal of report.goals) {
    const tokens = `${formatTokens(goal.tokensUsed ?? 0)}${goal.tokenBudget ? `/${formatTokens(goal.tokenBudget)}` : ""}`;
    const turns = goal.autoTurns === null ? "?" : `${goal.autoTurns}${goal.maxAutoTurns ? `/${goal.maxAutoTurns}` : ""}`;
    lines.push(
      `  - [${goal.status}] ${goal.sessionID ? goal.sessionID.slice(0, 16) : "?"}  tokens ${tokens}  turns ${turns}  ${formatTime(goal.updatedAt)}`,
    );
    lines.push(`      ${goal.objective}`);
  }

  const pending = report.designRuns.filter((run) =>
    ["requested", "tracking", "held"].includes(run.state),
  );
  lines.push("");
  lines.push(`[Design runs] (${report.designRuns.length}, pending ${pending.length})  paused=${JSON.stringify(report.designPaused ?? {})}`);
  if (report.designRuns.length === 0) lines.push("  (none)");
  for (const run of report.designRuns.slice(0, 12)) {
    lines.push(
      `  - [${run.state}] ${run.runId ? run.runId.slice(0, 8) : "?"} -> ${run.sessionID ? run.sessionID.slice(0, 16) : "?"}  ${run.classification ?? ""}  ${formatTime(run.updatedAt)}`,
    );
  }

  lines.push("");
  lines.push("[Usage by project]");
  if (report.usage.byProject.length === 0) lines.push("  (no sessions in range)");
  for (const row of report.usage.byProject) {
    lines.push(
      `  in ${formatTokens(row.tokens_in).padEnd(8)} out ${formatTokens(row.tokens_out).padEnd(7)} cost $${row.cost}  sessions ${String(row.sessions).padEnd(4)} ${row.project}`,
    );
  }

  lines.push("");
  lines.push("[Top sessions]");
  for (const row of report.usage.top) {
    lines.push(
      `  ${formatTokens(row.tokens_in).padEnd(8)} ${String(row.agent ?? "?").padEnd(12)} ${row.id}  ${row.title}`,
    );
  }

  if (report.repo) {
    lines.push("");
    lines.push(`[Worktrees] (${report.repo})`);
    if (report.worktrees.length === 0) lines.push("  (none)");
    for (const line of report.worktrees) lines.push(`  ${line}`);

    lines.push("");
    lines.push("[Next slices]");
    if (report.nextSlices.length === 0) lines.push("  (none found)");
    for (const item of report.nextSlices) lines.push(`  - ${item.slice(0, 160)}`);
  }

  return lines.join("\n");
}

async function main(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const json = args.includes("--json");
  const repoIndex = args.indexOf("--repo");
  const daysIndex = args.indexOf("--days");
  if (repoIndex !== -1 && !args[repoIndex + 1]) throw new Error("--repo requires a path");
  if (daysIndex !== -1 && !args[daysIndex + 1]) throw new Error("--days requires a number");
  const repo = repoIndex === -1 ? process.cwd() : args[repoIndex + 1];
  const days = daysIndex === -1 ? 7 : Number(args[daysIndex + 1]);
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

  const report = buildReport({ repo, days });
  process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${renderReport(report)}\n`);
}

const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`work-report: ${error?.message ?? error}`);
    process.exitCode = 1;
  });
}
