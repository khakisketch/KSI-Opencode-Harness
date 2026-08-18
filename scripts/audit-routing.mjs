import { execFileSync } from "node:child_process"

const limit = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "100", 10)
const strict = process.argv.includes("--strict")
const showTitles = process.argv.includes("--show-titles")
const showDirectories = process.argv.includes("--show-directories")

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
  s.time_created
FROM session s
JOIN latest child ON child.session_id = s.id
LEFT JOIN parent_at_creation parent ON parent.child_session_id = s.id AND parent.rn = 1
WHERE s.parent_id IS NOT NULL
ORDER BY s.time_created DESC
LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 100};
`

const rows = JSON.parse(
  execFileSync("opencode", ["db", "--format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
)

function expectedRoute(row) {
  if (row.agent === "developer") {
    return { provider: "local-developer", model: "qwen3.8-27b", variant: "quality" }
  }
  if (row.agent === "test-runner") {
    return { provider: "openai", model: "gpt-5.3-codex-spark", variant: "medium" }
  }
  if (row.agent === "explore") {
    return { provider: "openai", model: "gpt-5.4-mini", variant: "medium" }
  }
  if (row.agent === "reviewer") {
    return row.parent_provider === "openai"
      ? { provider: "openai", model: "gpt-5.6-terra", variant: "high" }
      : { provider: row.parent_provider, model: row.parent_model, variant: row.parent_variant ?? null }
  }
  if (row.agent === "risk-analyst") {
    return row.parent_provider === "openai"
      ? { provider: "openai", model: "gpt-5.6-sol", variant: "xhigh" }
      : { provider: row.parent_provider, model: row.parent_model, variant: row.parent_variant ?? null }
  }
}

const checked = rows.map((row) => ({ ...row, expected: expectedRoute(row) })).filter((row) => row.expected)
const tierRank = { terra: 1, sol: 2 }
const effortRank = { none: 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }

function matchesExpected(row) {
  if (!row.expected.provider || !row.expected.model) return false
  if (row.parent_provider === "openai" && row.agent === "reviewer") {
    const tier = row.model?.match(/^gpt-5\.6-(terra|sol)(?:-fast)?$/)?.[1]
    return row.provider === "openai" && (tierRank[tier] ?? -1) >= tierRank.terra && (effortRank[row.variant] ?? -1) >= effortRank.high
  }
  if (row.parent_provider === "openai" && row.agent === "risk-analyst") {
    return row.provider === "openai" && row.model === "gpt-5.6-sol" && (effortRank[row.variant] ?? -1) >= effortRank.xhigh
  }
  return (
    row.provider === row.expected.provider &&
    row.model === row.expected.model &&
    (row.expected.variant === undefined || (row.variant ?? null) === row.expected.variant)
  )
}

const violations = checked.filter((row) => !matchesExpected(row))

const byAgent = new Map()
for (const row of checked) byAgent.set(row.agent, (byAgent.get(row.agent) ?? 0) + 1)
const developerCount = checked.filter((row) => row.agent === "developer").length
const localCount = checked.filter((row) => row.provider === "local" || row.provider === "local-developer").length

console.log(
  `KSI routing audit: ${rows.length} recent subagents, ${checked.length} recognized routes, ${violations.length} violations`,
)
if (checked.length) {
  const summary = [...byAgent.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([agent, count]) => `${agent}=${count}`)
    .join(" ")
  console.log(`subagent usage: ${summary}`)
  console.log(`developer tasks: ${developerCount} (routed to local-developer/qwen3.8-27b@quality), local-total: ${localCount}`)
}
console.table(
  violations.map((row) => ({
    session: row.id,
    agent: row.agent,
    model: row.model,
    effort: row.variant ?? "missing",
    expected: `${row.expected.provider ?? "missing"}/${row.expected.model ?? "missing"}${row.expected.variant ? `@${row.expected.variant}` : ""}`,
    ...(showTitles ? { title: row.title } : {}),
    ...(showDirectories ? { directory: row.directory } : {}),
  })),
)

if (strict && violations.length) process.exitCode = 1
