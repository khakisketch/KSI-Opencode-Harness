import { execFileSync } from "node:child_process"
import { analyzeAuditRows, percentile, sessionDurationMs, validateRoutes } from "../src/audit-metrics.mjs"
import { ROLES } from "../src/agents.mjs"
import { readFileSync } from "node:fs"

const limit = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "100", 10)
const strict = process.argv.includes("--strict")
const showTitles = process.argv.includes("--show-titles")
const showDirectories = process.argv.includes("--show-directories")
const sinceArg = process.argv.find((arg) => arg.startsWith("--since="))?.slice(8)
const routesArg = process.argv.find((arg) => arg.startsWith("--routes="))
const routesPath = routesArg?.slice(9)

if (strict && (!routesArg || !routesPath || !sinceArg)) {
  throw new Error("--strict requires explicit --routes and --since arguments before querying the OpenCode DB")
}
if (routesArg && !routesPath) throw new Error("--routes requires a JSON mapping path")

function parseSince(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

const parsedSince = sinceArg === undefined ? null : parseSince(sinceArg)
if (sinceArg !== undefined && parsedSince === null) throw new Error("--since must be a valid nonempty ISO timestamp")
const since = parsedSince ?? 0

function loadRoutes(path) {
  try {
    return validateRoutes(JSON.parse(readFileSync(path, "utf8")), ROLES)
  } catch (error) {
    if (error.message.startsWith("--routes")) throw error
    throw new Error(`--routes must contain valid JSON: ${error.message}`)
  }
}

const routes = routesArg ? loadRoutes(routesPath) : null

const sql = `
WITH assistant_messages AS (
  SELECT
    session_id,
    json_extract(data, '$.agent') AS agent,
    json_extract(data, '$.providerID') AS provider,
    json_extract(data, '$.modelID') AS model,
    json_extract(data, '$.variant') AS variant,
    time_created
  FROM message
  WHERE json_extract(data, '$.role') = 'assistant'
), ranked AS (
  SELECT
    *,
    row_number() OVER (PARTITION BY session_id ORDER BY time_created DESC) AS rn
  FROM assistant_messages
), latest AS (
  SELECT session_id, agent, provider, model, variant
  FROM ranked
  WHERE rn = 1
), parent_at_creation AS (
  SELECT
    child_session.id AS child_session_id,
    parent.provider,
    parent.model,
    parent.variant,
    row_number() OVER (PARTITION BY child_session.id ORDER BY parent.time_created DESC) AS rn
  FROM session child_session
  LEFT JOIN assistant_messages parent
    ON parent.session_id = child_session.parent_id
    AND parent.time_created <= child_session.time_created
  WHERE child_session.parent_id IS NOT NULL
), session_usage AS (
  SELECT
    session_id,
    SUM(
      COALESCE(json_extract(data, '$.tokens.input'), 0)
      + COALESCE(json_extract(data, '$.tokens.output'), 0)
      + COALESCE(json_extract(data, '$.tokens.reasoning'), 0)
      + COALESCE(json_extract(data, '$.tokens.cache.read'), 0)
      + COALESCE(json_extract(data, '$.tokens.cache.write'), 0)
    ) AS tokens,
    SUM(COALESCE(json_extract(data, '$.cost'), 0)) AS cost,
    MAX(CASE WHEN json_extract(data, '$.tokens.input') IS NOT NULL THEN 1 ELSE 0 END) AS has_tokens,
    MAX(CASE WHEN json_extract(data, '$.cost') IS NOT NULL THEN 1 ELSE 0 END) AS has_cost,
    MIN(time_created) AS first_assistant_at,
    MAX(time_created) AS last_assistant_at,
    COUNT(*) AS assistant_turns
  FROM message
  WHERE json_extract(data, '$.role') = 'assistant'
  GROUP BY session_id
)
SELECT
  s.id,
  s.title,
  s.directory,
  s.project_id,
  child.agent,
  child.provider,
  child.model,
  child.variant,
  parent.provider AS parent_provider,
  parent.model AS parent_model,
  parent.variant AS parent_variant,
  s.time_created AS session_started_at,
  usage.tokens,
  usage.cost,
  usage.has_tokens,
  usage.has_cost,
  usage.first_assistant_at,
  usage.last_assistant_at,
  usage.assistant_turns
FROM session s
JOIN latest child ON child.session_id = s.id
LEFT JOIN parent_at_creation parent ON parent.child_session_id = s.id AND parent.rn = 1
LEFT JOIN session_usage usage ON usage.session_id = s.id
WHERE s.parent_id IS NOT NULL
  AND s.time_created >= ${since}
ORDER BY s.time_created DESC
LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 100};
`

const rows = JSON.parse(
  execFileSync("opencode", ["db", "--format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
)

const { recognized, checked, violations, unrecognized, unconfigured, developerVariants } = analyzeAuditRows(rows, routes, ROLES)

const byAgent = new Map()
for (const row of recognized) byAgent.set(row.agent, (byAgent.get(row.agent) ?? 0) + 1)
const developerCount = recognized.filter((row) => row.agent === "developer").length

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M tokens`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k tokens`
  return `${n} tokens`
}

const usage = new Map()
for (const row of recognized) {
  const stat = usage.get(row.agent) ?? { sessions: 0, tokens: 0, cost: 0, hasTokens: false, hasCost: false }
  stat.sessions += 1
  stat.tokens += Number(row.tokens) || 0
  stat.cost += Number(row.cost) || 0
  if (Number(row.has_tokens)) stat.hasTokens = true
  if (Number(row.has_cost)) stat.hasCost = true
  usage.set(row.agent, stat)
}

if (routes) {
  console.log(
    `KSI routing audit: ${rows.length} recent subagents, ${checked.length} configured routes${unconfigured.length ? `, ${unconfigured.length} recognized but unconfigured skipped` : ""}${unrecognized.length ? `, ${unrecognized.length} unknown skipped` : ""}, ${violations.length} violations`,
  )
} else {
  console.log(
    `KSI routing inventory: ${rows.length} recent subagents, ${recognized.length} recognized roles${unrecognized.length ? `, ${unrecognized.length} unknown skipped` : ""}. Observational only; no expected routes configured.`,
  )
}
if (unconfigured.length) console.log(`skipped unconfigured roles: ${[...new Set(unconfigured.map((row) => row.agent))].join(", ")}`)
if (unrecognized.length) console.log(`skipped unknown roles: ${[...new Set(unrecognized.map((row) => row.agent ?? "missing"))].join(", ")}`)
if (recognized.length) {
  const summary = [...byAgent.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([agent, count]) => `${agent}=${count}`)
    .join(" ")
  console.log(`subagent usage: ${summary}`)
  const variantSummary = [...developerVariants.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([variant, count]) => `${variant}=${count}`)
    .join(" ") || "none"
  console.log(`developer tasks: ${developerCount} (variants: ${variantSummary})`)
  if ([...usage.values()].some((stat) => stat.hasTokens || stat.hasCost)) {
    console.log("usage/cost signal (informational; measured from DB token/cost fields when present; no quality or ROI implied):")
    for (const [agent, stat] of [...usage.entries()].sort((a, b) => b[1].sessions - a[1].sessions)) {
      console.log(
        `  ${agent}: ${stat.sessions} sessions, ${stat.hasTokens ? formatTokens(stat.tokens) : "tokens not recorded"}, ${stat.hasCost ? `$${stat.cost.toFixed(4)}` : "cost not recorded"}`,
      )
    }
  }
}

function formatDuration(ms) {
  if (ms == null) return "unknown"
  return `${(ms / 60_000).toFixed(ms >= 60_000 ? 1 : 2)}m`
}

const developerRows = recognized.filter((row) => row.agent === "developer")
const durationByVariant = new Map()
for (const row of developerRows) {
  const variant = row.variant ?? "missing"
  const stat = durationByVariant.get(variant) ?? { durations: [], turns: [] }
  const duration = sessionDurationMs(row)
  if (duration != null) stat.durations.push(duration)
  if (Number.isFinite(Number(row.assistant_turns))) stat.turns.push(Number(row.assistant_turns))
  durationByVariant.set(variant, stat)
}
if (durationByVariant.size) {
  console.log("developer duration/turns by variant:")
  for (const [variant, stat] of [...durationByVariant.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const medianTurns = percentile(stat.turns, 0.5)
    console.log(
      `  ${variant}: sessions=${Math.max(stat.durations.length, stat.turns.length)}, duration p50=${formatDuration(percentile(stat.durations, 0.5))}, p95=${formatDuration(percentile(stat.durations, 0.95))}, turns p50=${medianTurns ?? "unknown"}`,
    )
  }
}

const slowDeveloperRows = developerRows
  .map((row) => ({ ...row, duration: sessionDurationMs(row) }))
  .filter((row) => row.duration != null && row.duration >= 30 * 60_000)
if (slowDeveloperRows.length) {
  console.log(`slow Developer sessions (>=30m): ${slowDeveloperRows.length}`)
  console.table(slowDeveloperRows.map((row) => ({
    session: row.id,
    variant: row.variant ?? "missing",
    duration: formatDuration(row.duration),
    assistantTurns: row.assistant_turns ?? "unknown",
  })))
}
console.table(
  violations.map((row) => ({
    session: row.id,
    agent: row.agent,
    model: row.model,
    effort: row.variant ?? "missing",
    expected: `${row.expected.provider ?? "missing"}/${row.expected.model ?? "missing"}${row.expected.variant ? `@${row.expected.variant}` : row.expected.variants ? `@${row.expected.variants.join("|")}` : ""}`,
    ...(showTitles ? { title: row.title } : {}),
    ...(showDirectories ? { directory: row.directory } : {}),
  })),
)

if (routes && !checked.length) console.log("No matching configured runtime evidence; this is not a routing PASS.")
if (strict && (violations.length || !checked.length)) process.exitCode = 1
