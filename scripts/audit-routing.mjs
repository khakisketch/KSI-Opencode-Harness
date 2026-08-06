import { execFileSync } from "node:child_process"

const limit = Number.parseInt(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? "100", 10)
const strict = process.argv.includes("--strict")
const showTitles = process.argv.includes("--show-titles")

const sql = `
WITH latest AS (
  SELECT
    session_id,
    json_extract(data, '$.agent') AS agent,
    json_extract(data, '$.providerID') AS provider,
    json_extract(data, '$.modelID') AS model,
    json_extract(data, '$.variant') AS variant,
    row_number() OVER (PARTITION BY session_id ORDER BY time_created DESC) AS rn
  FROM message
  WHERE json_extract(data, '$.role') = 'assistant'
)
SELECT s.id, s.title, latest.agent, latest.provider, latest.model, latest.variant, s.time_created
FROM session s
JOIN latest ON latest.session_id = s.id AND latest.rn = 1
WHERE s.parent_id IS NOT NULL
ORDER BY s.time_created DESC
LIMIT ${Number.isFinite(limit) && limit > 0 ? limit : 100};
`

const rows = JSON.parse(
  execFileSync("opencode", ["db", "--format", "json", sql], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }),
)

const tierRank = { luna: 0, terra: 1, sol: 2 }
const effortRank = { none: 0, low: 1, medium: 2, high: 3, xhigh: 4, max: 5 }
const minimum = {
  explore: { tier: "luna", effort: "high" },
  "ksi-analyst": { tier: "terra", effort: "xhigh" },
  general: { tier: "terra", effort: "high" },
  reviewer: { tier: "terra", effort: "xhigh" },
  "project-skill-advisor": { tier: "terra", effort: "high" },
  "ksi-risk-analyst": { tier: "sol", effort: "xhigh" },
}

function tier(model) {
  return model?.match(/^gpt-5\.6-(luna|terra|sol)(?:-fast)?$/)?.[1]
}

const checked = rows.filter((row) => row.provider === "openai" && tier(row.model) && minimum[row.agent])
const violations = checked.filter((row) => {
  const expected = minimum[row.agent]
  return tierRank[tier(row.model)] < tierRank[expected.tier] || effortRank[row.variant] < effortRank[expected.effort]
})

console.log(`KSI routing audit: ${rows.length} recent subagents, ${checked.length} OpenAI GPT routes, ${violations.length} violations`)
console.table(
  violations.map((row) => ({
    session: row.id,
    agent: row.agent,
    model: row.model,
    effort: row.variant ?? "missing",
    ...(showTitles ? { title: row.title } : {}),
  })),
)

if (strict && violations.length) process.exitCode = 1
