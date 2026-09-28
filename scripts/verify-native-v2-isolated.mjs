import { spawn, spawnSync } from "node:child_process"
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const roles = {
  build: "primary", plan: "primary", design: "primary",
  explore: "subagent", developer: "subagent", "test-runner": "subagent",
  reviewer: "subagent",
}

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

export function checkAgents(agents, configRoot) {
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
  const design = agents.find((item) => item.id === "design")
  if (design && !design.permissions?.some((rule) => rule.action === "edit" && rule.resource === "*" && rule.effect === "allow")) {
    failures.push("design lacks normal workspace edit permission")
  }
  if (design && !design.permissions?.some((rule) => rule.action === "subagent" && rule.resource === "explore" && rule.effect === "allow")) {
    failures.push("design lacks explore delegation")
  }
  if (design && !design.permissions?.some((rule) => rule.action === "subagent" && rule.resource === "reviewer" && rule.effect === "allow")) {
    failures.push("design lacks reviewer delegation")
  }
  if (agents.some((item) => item.id === "research")) failures.push("retired research role still installed")
  if (agents.some((item) => item.id === "design-critic")) failures.push("retired design-critic role still installed")
  if (design && configRoot) {
    const reference = join(configRoot, "skills", "web-design-guidelines", "references", "guidelines.md")
    const rules = design.permissions?.filter((rule) => rule.action === "external_directory"
      && (rule.resource === "*" || (rule.resource.endsWith("*") && reference.startsWith(rule.resource.slice(0, -1))))) ?? []
    if (rules.at(-1)?.effect !== "allow") failures.push("design installed skill reference requires external-directory approval")
  }
  for (const id of ["design", "developer", "test-runner", "reviewer"]) {
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

export function checkSkills(skills, isolatedSkillRoot) {
  const failures = []
  for (const id of ["frontend-design", "impeccable-design-polish", "web-design-guidelines"]) {
    const skill = skills.find((item) => item.id === id)
    if (!skill) failures.push(`${id} absent from effective skill catalog`)
    else if (skill.path !== join(isolatedSkillRoot, id, "SKILL.md")) failures.push(`${id} not loaded from isolated install`)
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

async function verify() {
  const directory = await mkdtemp(join(tmpdir(), "ksi-native-v2-"))
  const env = buildIsolatedEnv(directory, process.env.PATH ?? "")
  let server
  try {
    const config = join(env.XDG_CONFIG_HOME, "opencode")
    await mkdir(config, { recursive: true })
    const cli = join(root, "bin", "ksi-opencode.mjs")
    parseJson(run(process.execPath, [cli, "install", "--target", config, "--with-design-kit", "--apply"], env, directory), "native installer")
    await writeFile(join(config, "opencode.jsonc"), `${JSON.stringify({ agents: { developer: { model: "opencode-go/deepseek-v4.1-flash", steps: 47 } } }, null, 2)}\n`)
    const source = await readFile(join(config, "agents", "developer.md"), "utf8")
    const installedAgents = (await readdir(join(config, "agents"))).sort()
    const installedSkills = (await readdir(join(config, "skills"))).sort()
    const configEntries = (await readdir(config)).sort()
    const files = {
      installed: installedAgents.join(",") === ["design.md", "developer.md", "reviewer.md", "test-runner.md"].join(","),
      modelAndStepsOmitted: !/\n(?:model|steps):/.test(source),
      builtinsUntouched: !installedAgents.some((name) => ["build.md", "plan.md", "explore.md"].includes(name)),
      skillsInstalled: installedSkills.join(",") === "frontend-design,impeccable-design-polish,web-design-guidelines",
      commandsNotInstalled: configEntries.join(",") === "agents,opencode.jsonc,skills",
    }
    server = startIsolatedServer(env, directory)
    const connection = await server.ready
    let agents = { ok: false, failures: ["agent catalog not queried"] }
    let agentAttempts = 0
    for (let attempt = 1; attempt <= 8; attempt++) {
      agentAttempts = attempt
      const catalog = await getCatalog(connection, "/api/agent")
      agents = checkAgents(catalog.data ?? [], config)
      if (agents.ok) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    let skills = { ok: false, failures: ["skill catalog not queried"] }
    let skillAttempts = 0
    for (let attempt = 1; attempt <= 8; attempt++) {
      skillAttempts = attempt
      const catalog = await getCatalog(connection, "/api/skill")
      skills = checkSkills(catalog.data ?? [], join(config, "skills"))
      if (skills.ok) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const result = { version: run("opencode", ["--version"], env, directory).stdout.trim(), files, agents: { ...agents, attempts: agentAttempts }, skills: { ...skills, attempts: skillAttempts }, providerRequestsIssuedByVerifier: 0, childEgress: "not monitored", isolated: true }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!files.installed || !files.modelAndStepsOmitted || !files.builtinsUntouched || !files.skillsInstalled || !files.commandsNotInstalled || !agents.ok || !skills.ok) process.exitCode = 1
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
