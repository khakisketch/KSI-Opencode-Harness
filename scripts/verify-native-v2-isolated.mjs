import { spawn, spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const roles = {
  build: "primary", plan: "primary",
  explore: "subagent", developer: "subagent", "test-runner": "subagent",
  reviewer: "subagent",
}

export const RETIRED_DESIGN_SKILLS = ["frontend-design", "impeccable-design-polish", "web-design-guidelines"]

const designPermissionCases = [
  ...["get_active_context", "get_project", "list_projects", "list_files", "get_file", "get_artifact", "search_files", "list_skills", "list_plugins", "list_agents", "get_run"]
    .map((name) => ({ agent: "plan", action: `opendesign_${name}`, expected: "allow" })),
  ...["start_run", "cancel_run", "write_file", "delete_file", "create_project", "delete_project", "create_artifact", "collect_brief", "confirm_brief", "future_mutation"]
    .map((name) => ({ agent: "plan", action: `opendesign_${name}`, expected: "deny" })),
  { agent: "build", action: "opendesign_start_run", expected: "allow" },
  { agent: "plan", action: "edit", expected: "deny" },
]

export function buildIsolatedEnv(directory, path) {
  return {
    PATH: path,
    HOME: join(directory, "home"),
    XDG_CONFIG_HOME: join(directory, "home", ".config"),
    XDG_DATA_HOME: join(directory, "data"),
    XDG_CACHE_HOME: join(directory, "cache"),
    XDG_STATE_HOME: join(directory, "state"),
    TMPDIR: directory,
  }
}

export function checkAgents(agents) {
  const failures = []
  for (const [id, mode] of Object.entries(roles)) {
    const agent = agents.find((item) => item.id === id)
    if (!agent) failures.push(`${id} absent from effective agent catalog`)
    else if (agent.mode !== mode) failures.push(`${id} expected ${mode}, got ${agent.mode}`)
  }
  const developer = agents.find((item) => item.id === "developer")
  const model = developer?.model
  const modelText = typeof model === "string" ? model
    : model?.providerID && (model?.id || model?.model) ? `${model.providerID}/${model.id ?? model.model}${model.variant ? `#${model.variant}` : ""}` : null
  if (developer && modelText !== "opencode-go/deepseek-v4.1-flash") failures.push(`developer model not retained: ${String(modelText)}`)
  if (developer && developer.steps !== 47) failures.push(`developer steps not retained: ${String(developer.steps)}`)
  if (agents.some((item) => item.id === "design")) failures.push("retired design role still installed")
  if (agents.some((item) => item.id === "research")) failures.push("retired research role still installed")
  if (agents.some((item) => item.id === "design-critic")) failures.push("retired design-critic role still installed")
  for (const id of ["developer", "test-runner", "reviewer"]) {
    const agent = agents.find((item) => item.id === id)
    if (agent?.permissions?.some((rule) => rule.action === "skill" && rule.resource === "*" && rule.effect === "deny")) {
      failures.push(`${id} blocks native skill discovery`)
    }
  }
  if (developer && (!developer.permissions?.some((rule) => rule.action === "subagent" && rule.resource === "*" && rule.effect === "deny")
    || developer.permissions?.some((rule) => rule.action === "subagent" && rule.resource === "test-runner" && rule.effect === "allow"))) {
    failures.push("developerTestRunner is not default-off")
  }
  return { ok: failures.length === 0, failures }
}

export function checkRetiredSkills(skills) {
  const failures = []
  for (const id of RETIRED_DESIGN_SKILLS) {
    if (skills.some((item) => item.id === id)) failures.push(`retired design skill still installed: ${id}`)
  }
  return { ok: failures.length === 0, failures }
}

export function checkDesignPermissions(decisions) {
  const failures = []
  if (!decisions.length) return { ok: false, failures: ["design permissions were not evaluated"] }
  if (decisions.length !== designPermissionCases.length) failures.push(`expected ${designPermissionCases.length} design permission decisions, got ${decisions.length}`)
  for (const { agent, action, expected } of designPermissionCases) {
    const matches = decisions.filter((item) => item.agent === agent && item.action === action)
    if (matches.length !== 1) {
      failures.push(`${agent} ${action}: expected one decision, got ${matches.length}`)
      continue
    }
    const decision = matches[0]
    if (decision.expected !== expected) failures.push(`${agent} ${action}: declared expectation must be ${expected}`)
    if (decision.effect !== expected) failures.push(`${agent} ${action}: expected ${expected}, got ${String(decision.effect)}`)
  }
  return { ok: failures.length === 0, failures }
}

function run(command, args, env, cwd) {
  const child = spawnSync(command, args, { env, cwd, encoding: "utf8", timeout: 15000, maxBuffer: 8 * 1024 * 1024 })
  return { status: child.status, stdout: child.stdout ?? "", stderr: child.stderr ?? "", error: child.error?.message }
}

function parseJson(result, label) {
  if (result.status !== 0) throw new Error(`${label} exited ${String(result.status)}: ${result.error ?? result.stderr.slice(0, 300)}`)
  try { return JSON.parse(result.stdout) } catch { throw new Error(`${label} did not return JSON`) }
}

export function parseServeStartup(output) {
  const url = output.match(/(?:^|\n)server listening on (http:\/\/127\.0\.0\.1:[1-9]\d*)(?:\r?\n|$)/)?.[1]
  const password = output.match(/(?:^|\n)server password ([^\s\r\n]+)(?:\r?\n|$)/)?.[1]
  return url && password ? { url, password } : null
}

function startIsolatedServer(env, cwd) {
  const child = spawn("opencode", ["serve", "--hostname", "127.0.0.1", "--port", "0"], {
    env, cwd, stdio: ["ignore", "pipe", "pipe"],
  })
  const ready = new Promise((resolve, reject) => {
    let output = ""
    const timer = setTimeout(() => reject(new Error("isolated OpenCode server startup timed out")), 15000)
    const onData = (chunk) => {
      output = (output + chunk.toString()).slice(-4096)
      const started = parseServeStartup(output)
      if (started) {
        clearTimeout(timer)
        resolve(started)
      }
    }
    child.stdout.on("data", onData)
    child.stderr.on("data", onData)
    child.once("error", (error) => {
      clearTimeout(timer)
      reject(new Error(`isolated OpenCode server failed to start: ${error.message}`))
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      reject(new Error(`isolated OpenCode server exited before ready: ${String(code)}`))
    })
  })
  return { child, ready }
}

async function stopIsolatedServer(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  child.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
}

async function getCatalog({ url, password }, path) {
  const response = await fetch(`${url}${path}`, {
    headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

async function postApi({ url, password }, path, body) {
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`)
  return response.json()
}

async function evaluateDesignPermissions(connection) {
  // Native policy evaluation only: no MCP server, tool execution or provider call.
  const session = await postApi(connection, "/api/session", { title: "Isolated design-permission verification" })
  const id = session.data?.id
  if (!id) throw new Error("isolated permission session has no id")
  const decisions = []
  for (const item of designPermissionCases) {
    const result = await postApi(connection, `/api/session/${id}/permission`, {
      agent: item.agent, action: item.action, resources: ["*"],
    })
    decisions.push({ ...item, effect: result.data?.effect })
  }
  return { ...checkDesignPermissions(decisions), decisions, toolsInvoked: 0 }
}

async function verify() {
  const directory = await mkdtemp(join(tmpdir(), "ksi-native-v2-"))
  const env = buildIsolatedEnv(directory, process.env.PATH ?? "")
  let server
  try {
    const config = join(env.XDG_CONFIG_HOME, "opencode")
    await mkdir(config, { recursive: true })
    const cli = join(root, "bin", "ksi-opencode.mjs")
    parseJson(run(process.execPath, [cli, "install", "--target", config, "--apply"], env, directory), "native installer")
    // The maintained example uses comment-only lines, not arbitrary JSONC parsing.
    const sampleText = await readFile(join(root, "opencode.jsonc.example"), "utf8")
    const sample = JSON.parse(sampleText.split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n"))
    await writeFile(join(config, "opencode.jsonc"), `${JSON.stringify({ agents: {
      developer: { model: "opencode-go/deepseek-v4.1-flash", steps: 47 },
      ...(sample.agents?.plan ? { plan: sample.agents.plan } : {}),
    } }, null, 2)}\n`)
    const source = await readFile(join(config, "agents", "developer.md"), "utf8")
    const installedAgents = (await readdir(join(config, "agents"))).sort()
    const configEntries = (await readdir(config)).sort()
    const files = {
      installed: installedAgents.join(",") === ["developer.md", "reviewer.md", "test-runner.md"].join(","),
      modelAndStepsOmitted: !/\n(?:model|steps):/.test(source),
      builtinsUntouched: !installedAgents.some((name) => ["build.md", "plan.md", "explore.md"].includes(name)),
      noSkillsInstalled: !configEntries.includes("skills"),
      commandsNotInstalled: configEntries.join(",") === "agents,opencode.jsonc",
    }
    server = startIsolatedServer(env, directory)
    const connection = await server.ready
    let agents = { ok: false, failures: ["agent catalog not queried"] }
    let agentAttempts = 0
    for (let attempt = 1; attempt <= 8; attempt++) {
      agentAttempts = attempt
      const catalog = await getCatalog(connection, "/api/agent")
      agents = checkAgents(catalog.data ?? [])
      if (agents.ok) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    let skills = { ok: false, failures: ["skill catalog not queried"] }
    let skillAttempts = 0
    for (let attempt = 1; attempt <= 8; attempt++) {
      skillAttempts = attempt
      const catalog = await getCatalog(connection, "/api/skill")
      skills = checkRetiredSkills(catalog.data ?? [])
      if (skills.ok) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const designPermissions = await evaluateDesignPermissions(connection)
    const result = { version: run("opencode", ["--version"], env, directory).stdout.trim(), files, agents: { ...agents, attempts: agentAttempts }, retiredSkills: { ...skills, attempts: skillAttempts }, designPermissions, providerRequestsIssuedByVerifier: 0, childEgress: "not monitored", isolated: true }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!files.installed || !files.modelAndStepsOmitted || !files.builtinsUntouched || !files.noSkillsInstalled || !files.commandsNotInstalled || !agents.ok || !skills.ok || !designPermissions.ok) process.exitCode = 1
  } finally {
    await stopIsolatedServer(server?.child)
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verify().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
