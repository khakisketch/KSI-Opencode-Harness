import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { constants } from "node:fs"
import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const required = [
  "bin/ksi-opencode.mjs", "src/native-bundle.mjs", "src/native-roles.mjs",
  "templates/agents/developer.md", "templates/agents/reviewer.md",
  "examples/project-AGENTS.md", "examples/autonomous-development.md", "README.md", "INSTALL.md",
  "docs/architecture.md", "docs/integrations/opendesign.md",
]
const forbidden = /(?:^|\/)(?:index\.mjs|plugin-v2\.mjs|node_modules|test|tests|docs\/superpowers|\.opencode|design-previews)(?:\/|$)|^(?:src\/agents\.mjs|agents\/|commands\/)|(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]*credentials[^/]*|[^/]*auth[^/]*\.json)$/i

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => resolve({ code, stdout, stderr }))
  })
}

// Portable npm invocation. `npm run` supplies the trusted npm CLI script path
// as npm_execpath; driving it with the current Node binary needs no shell and
// no PATH lookup, so Windows (npm.cmd) behaves like POSIX. Without
// npm_execpath there is no safe resolution: fail descriptively instead of
// guessing a shell string.
export function npmTarget(env = process.env, execPath = process.execPath) {
  const npmCli = env.npm_execpath
  if (typeof npmCli !== "string" || npmCli === "" || !isAbsolute(npmCli)) {
    throw new Error("npm CLI unavailable: run this verifier via `npm run check:package` so npm_execpath is set to an absolute path")
  }
  return { command: execPath, baseArgs: [npmCli] }
}

// Portable installed-CLI target. On Windows the .bin entry is an sh script
// plus .cmd/.ps1 shims (not directly executable without a shell), so the
// registered .cmd shim presence is asserted while behavior runs through Node
// + the installed bin JS. POSIX keeps the actual standalone executable check.
export function installedCliTarget({ installRoot, packageDir, platform = process.platform, execPath = process.execPath }) {
  const dotBin = join(installRoot, "node_modules", ".bin", "ksi-opencode")
  if (platform === "win32") {
    const binJs = join(packageDir, "bin", "ksi-opencode.mjs")
    return { command: execPath, baseArgs: [binJs], present: [`${dotBin}.cmd`, binJs], executable: null }
  }
  return { command: dotBin, baseArgs: [], present: [], executable: dotBin }
}

async function main() {
  const npm = npmTarget()
  const work = await mkdtemp(join(tmpdir(), "ksi-native-package-"))
  try {
    const env = {
      PATH: process.env.PATH,
      HOME: work,
      npm_config_cache: join(work, "npm-cache"),
      npm_config_offline: "true",
      npm_config_update_notifier: "false",
    }
    const runNpm = (args) => run(npm.command, [...npm.baseArgs, ...args], root, env)
    const packed = await runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", work])
    assert.equal(packed.code, 0, packed.stderr)
    const [record] = JSON.parse(packed.stdout)
    const paths = record.files.map(({ path }) => path.replaceAll("\\", "/"))
    for (const path of required) assert.ok(paths.includes(path), `missing packaged file: ${path}`)
    assert.ok(!paths.includes("templates/agents/design.md"), "retired Design role must not be packaged")
    assert.ok(!paths.includes("templates/agents/research.md"), "retired Research role must not be packaged")
    assert.ok(!paths.includes("templates/agents/design-critic.md"), "retired Design Critic role must not be packaged")
    assert.ok(!paths.includes("templates/agents/test-runner.md"), "retired Test Runner role must not be packaged")
    assert.ok(!paths.some((path) => path.startsWith("vendor/")), "vendored design kit must not be packaged")
    assert.ok(!paths.some((path) => path.startsWith("integrations/")), "manual deployment assets must not be packaged")
    assert.ok(!paths.some((path) => path.startsWith("docs/design")), "retired design docs must not be packaged")
    assert.ok(!paths.some((path) => path.startsWith("examples/design")), "retired design examples must not be packaged")
    assert.ok(!paths.includes("docs/releasing.md"), "maintainer-only release guide must not be packaged")
    for (const path of paths) assert.doesNotMatch(path, forbidden, `forbidden packaged file: ${path}`)
    const tarball = isAbsolute(record.filename) ? record.filename : join(work, basename(record.filename))
    await access(tarball)
    const installRoot = join(work, "consumer")
    const installed = await runNpm(["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--prefix", installRoot, tarball])
    assert.equal(installed.code, 0, installed.stderr)
    const packageDir = join(installRoot, "node_modules", "ksi-opencode-harness")
    const manifest = JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"))
    assert.equal(manifest.version, "0.5.0-beta.8")
    assert.notEqual(manifest.private, true)
    assert.equal(manifest.main, undefined)
    assert.equal(manifest.exports, undefined)
    assert.equal(manifest.bin["ksi-opencode"], "./bin/ksi-opencode.mjs")
    const config = join(work, "opencode-config")
    const cli = installedCliTarget({ installRoot, packageDir })
    for (const entry of cli.present) await access(entry)
    if (cli.executable) await access(cli.executable, constants.X_OK)
    await assert.rejects(access(join(work, ".config", "opencode")), { code: "ENOENT" }, "package install must not change config")
    const runCli = (args) => run(cli.command, [...cli.baseArgs, ...args], work, env)
    const relative = await runCli(["install", "--target", "relative-config", "--apply"])
    assert.notEqual(relative.code, 0)
    await assert.rejects(access(join(work, "relative-config")), { code: "ENOENT" })
    const retired = await runCli(["install", "--target", config, "--with-design-kit", "--apply"])
    assert.notEqual(retired.code, 0, "the removed design-kit flag must fail loudly")
    assert.match(retired.stderr, /with-design-kit.*removed/i)
    await assert.rejects(access(config), { code: "ENOENT" }, "a rejected flag must not create the target")
    const preview = await runCli(["install", "--target", config])
    assert.equal(preview.code, 0, preview.stderr)
    assert.equal(JSON.parse(preview.stdout).applied, false)
    await assert.rejects(access(config), { code: "ENOENT" }, "preview must not create target")
    const ran = await runCli(["install", "--target", config, "--apply"])
    assert.equal(ran.code, 0, ran.stderr)
    assert.deepEqual((await readdir(join(config, "agents"))).sort(), ["developer.md", "reviewer.md"])
    assert.deepEqual(await readdir(config), ["agents"])
    const repeat = await runCli(["install", "--target", config, "--apply"])
    assert.equal(repeat.code, 0, repeat.stderr)
    assert.deepEqual(JSON.parse(repeat.stdout).changes, [], "repeated apply must be idempotent")
    const ownedRole = join(config, "agents", "reviewer.md")
    const userRouting = "---\nmodel: user-owned/model\n---\nDo not replace this role.\n"
    await writeFile(ownedRole, userRouting)
    const conflict = await runCli(["install", "--target", config, "--apply", "--replace"])
    assert.notEqual(conflict.code, 0, "user routing must block replacement")
    assert.equal(await readFile(ownedRole, "utf8"), userRouting)
    assert.deepEqual((await readdir(join(config, "agents"))).sort(), ["developer.md", "reviewer.md"])
    console.log("Package verification passed: installer-only tarball, offline two-role install, and retired design-kit rejection.")
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

// Importing this module (e.g. from unit tests) must not verify anything;
// only direct invocation runs the verifier.
if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
