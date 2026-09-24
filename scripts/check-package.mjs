import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const packageData = JSON.parse(await readFile(join(root, "package.json"), "utf8"))
const roles = ["explore", "developer", "test-runner", "reviewer", "research"]
// design-critic is a hidden local read-only critic with its own prompt file.
const hiddenRoles = ["design-critic"]
const INSTALL_CHECK_ROLES = [...roles, ...hiddenRoles]
const REQUIRED_PACKAGE_FILES = [
  "index.mjs",
  "src/agents.mjs",
  "src/contracts.mjs",
  "src/audit-metrics.mjs",
  "src/delegation.mjs",
  "src/continuity.mjs",
  "src/continuity-context.mjs",
  "bin/ksi-continuity-inject.mjs",
  "src/evidence-tools.mjs",
  "src/env-probe.mjs",
  "src/repository.mjs",
  "instructions/harness.md",
  "agents/design.md",
  "agents/design-critic.md",
  "agents/build.md",
  ...roles.map((role) => `agents/${role}.md`),
  "README.md",
  "INSTALL.md",
  "docs/architecture.md",
  "docs/verification.md",
  "docs/releasing.md",
  "docs/execution.md",
  "docs/troubleshooting.md",
  "docs/design.md",
  "docs/design-system-template.md",
  "docs/design-critique.md",
  "examples/model-routing.json",
  "examples/design.project.jsonc",
  "examples/design-handoff.md",
  "opencode.jsonc.example",
  "scripts/audit-routing.mjs",
  "LICENSE",
]
const forbiddenPath = /(?:^|\/)(?:node_modules|\.opencode|test|tests|fixtures|secrets|\.github|tmp|temp)(?:\/|$)|(?:^|\/)(?:legacy|gpu|vllm|benchmark|lease)(?:[-_.\/]|$)|(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|[^/]*auth[^/]*\.json|[^/]*credentials[^/]*\.json|[^/]+(?:\.pem|\.key))$/i
// Fail-closed: the source repo keeps project state under docs/superpowers/
// (product-state, per-workstream plan ledgers, specs). The PUBLIC npm tarball
// must never contain it, even if someone later re-adds a broad "docs/" files
// entry or loosens .npmignore. Checked separately from forbiddenPath so the
// boundary survives unrelated gate edits.
const internalStatePath = /(?:^|\/)docs\/superpowers(?:\/|$)/i

function npmInvocation(args, cwd, env, npmExecPath = process.env.npm_execpath) {
  if (!npmExecPath) throw new Error("npm_execpath is unavailable; run npm run check:package with npm.")
  return { command: process.execPath, args: [npmExecPath, ...args], options: { cwd, env, shell: false } }
}

function runNpm(args, cwd, env) {
  const invocation = npmInvocation(args, cwd, env)
  return new Promise((resolveResult, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      ...invocation.options,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code, signal) => resolveResult({ code, signal, stdout, stderr }))
  })
}

function packageManifest(packOutput) {
  let records
  try {
    records = JSON.parse(packOutput)
  } catch (error) {
    throw new Error(`npm pack --json returned invalid JSON: ${error.message}`)
  }
  const record = Array.isArray(records) ? records[0] : undefined
  assert.ok(record?.filename, "npm pack did not report a tarball filename")
  assert.ok(Array.isArray(record.files), "npm pack did not report a tarball file manifest")
  return record
}

function normalizedPath(path) {
  return path.replaceAll("\\", "/").replace(/^package\//, "")
}

function validateManifest(paths) {
  const files = paths.map(normalizedPath)
  for (const required of REQUIRED_PACKAGE_FILES) assert.ok(files.includes(required), `package is missing required file: ${required}`)
  for (const file of files) assert.doesNotMatch(file, forbiddenPath, `package contains forbidden path: ${file}`)
  for (const file of files) assert.doesNotMatch(file, internalStatePath, `package contains internal project state: ${file}`)
  assert.ok(!files.includes("scripts/check-package.mjs"), "package contains its verification script")
  assert.ok(!files.some((file) => /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json)$/i.test(file)), "package contains an install lockfile")
  return files
}

async function policyReferenceMatches(references, expectedPath) {
  const expectedRealPath = await realpath(expectedPath)
  for (const reference of references) {
    try {
      if (await realpath(reference) === expectedRealPath) return true
    } catch (error) {
      // Missing paths cannot match; surface permission, I/O and invalid-config errors.
      if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error
    }
  }
  return false
}

async function verifyPackage() {
  const workDir = await mkdtemp(join(tmpdir(), "ksi-opencode-harness-package-"))
  try {
    const packDir = join(workDir, "pack")
    const installDir = join(workDir, "install")
    const globalNpmrc = join(workDir, "global.npmrc")
    const userNpmrc = join(workDir, "user.npmrc")
    await mkdir(packDir)
    await writeFile(globalNpmrc, "")
    await writeFile(userNpmrc, "")
    const env = {
      ...process.env,
      npm_config_cache: join(workDir, "npm-cache"),
      npm_config_globalconfig: globalNpmrc,
      npm_config_userconfig: userNpmrc,
      npm_config_update_notifier: "false",
    }

    const packed = await runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", packDir], root, env)
    if (packed.code !== 0) throw new Error(`npm pack failed (${packed.code ?? packed.signal}):\n${packed.stderr}`)
    const manifest = packageManifest(packed.stdout)
    validateManifest(manifest.files.map(({ path }) => path))

    const tarball = isAbsolute(manifest.filename)
      ? manifest.filename
      : join(packDir, basename(manifest.filename))
    await access(tarball)
    const installed = await runNpm(
      ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", installDir, tarball],
      root,
      env,
    )
    if (installed.code !== 0) throw new Error(`offline local tarball install failed (${installed.code ?? installed.signal}):\n${installed.stderr}`)

    const packageDirectory = packageData.name.startsWith("@")
      ? join(installDir, "node_modules", ...packageData.name.split("/"))
      : join(installDir, "node_modules", packageData.name)
    const consumerPath = join(installDir, "consumer.mjs")
    await writeFile(consumerPath, `import plugin from ${JSON.stringify(packageData.name)}

export default async function loadConfig() {
  const hooks = await plugin()
  const config = {}
  hooks.config(config)
  return config
}
`)
    const consumerModule = await import(pathToFileURL(consumerPath).href)
    assert.equal(typeof consumerModule.default, "function", "installed package-name import did not export a consumer function")
    const config = await consumerModule.default()
    assert.equal(config.agent?.design?.mode, "primary", "installed plugin is missing Design Primary")
    assert.ok(config.agent.design.prompt, "installed plugin is missing Design prompt")
    for (const role of INSTALL_CHECK_ROLES) {
      assert.equal(config.agent?.[role]?.mode, "subagent", `installed plugin is missing role: ${role}`)
      assert.ok(config.agent[role].prompt, `installed plugin is missing prompt for role: ${role}`)
    }
    assert.equal(config.agent?.["design-critic"]?.hidden, true, "installed plugin is missing hidden design-critic registration")
    for (const command of ["complete", "review"]) {
      assert.equal(config.command?.[command]?.agent, "build", `installed plugin is missing default command: ${command}`)
    }
    const instructionPath = resolve(packageDirectory, "instructions/harness.md")
    assert.ok(await policyReferenceMatches(config.instructions ?? [], instructionPath), "installed plugin did not reference harness policy")
    await access(instructionPath)
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyPackage()
  console.log("Package verification passed: manifest, offline installation, plugin hooks, roles, commands, and policy reference.")
}

export { REQUIRED_PACKAGE_FILES, INSTALL_CHECK_ROLES, npmInvocation, policyReferenceMatches, validateManifest }
