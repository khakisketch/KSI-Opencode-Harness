import test from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { mkdtemp, mkdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { npmTarget, installedCliTarget } from "../scripts/check-package.mjs"
import * as packageCheck from "../scripts/check-package.mjs"

const installer = fileURLToPath(new URL("../bin/ksi-opencode.mjs", import.meta.url))

async function withTarget(fn) {
  const directory = await mkdtemp(join(tmpdir(), "ksi-retired-flags-test-"))
  try { await fn(join(directory, "config")) } finally { await rm(directory, { recursive: true, force: true }) }
}

function runCli(args) {
  const result = spawnSync(process.execPath, [installer, ...args], { encoding: "utf8" })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test("npm target drives the trusted npm CLI script with the current Node binary", () => {
  const npm = npmTarget({ npm_execpath: "/usr/lib/node_modules/npm/bin/npm-cli.js" }, "/usr/bin/node")
  assert.deepEqual(npm, { command: "/usr/bin/node", baseArgs: ["/usr/lib/node_modules/npm/bin/npm-cli.js"] })
  // argv stays an array of absolute paths: no shell string, no bare-name lookup.
  assert.ok(npm.baseArgs.every((arg) => typeof arg === "string"))
})

test("npm target fails descriptively without an absolute npm_execpath instead of guessing", () => {
  assert.throws(() => npmTarget({}), /npm run check:package/)
  assert.throws(() => npmTarget({ npm_execpath: "" }), /npm run check:package/)
  assert.throws(() => npmTarget({ npm_execpath: "relative/npm-cli.js" }), /npm run check:package/)
  assert.throws(() => npmTarget({ npm_execpath: 42 }), /npm run check:package/)
})

test("installed CLI target keeps the standalone .bin executable on POSIX", () => {
  const cli = installedCliTarget({ installRoot: "/root", packageDir: "/pkg", platform: "linux" })
  assert.equal(cli.command, join("/root", "node_modules", ".bin", "ksi-opencode"))
  assert.deepEqual(cli.baseArgs, [])
  assert.equal(cli.executable, cli.command)
})

test("installed CLI target asserts the .cmd shim and runs bin JS through Node on Windows", () => {
  const cli = installedCliTarget({ installRoot: "C:\\root", packageDir: "C:\\pkg", platform: "win32", execPath: "C:\\node.exe" })
  assert.equal(cli.command, "C:\\node.exe")
  assert.deepEqual(cli.baseArgs, [join("C:\\pkg", "bin", "ksi-opencode.mjs")])
  assert.ok(cli.present.some((entry) => entry.endsWith("ksi-opencode.cmd")))
  assert.ok(cli.present.includes(join("C:\\pkg", "bin", "ksi-opencode.mjs")))
  assert.equal(cli.executable, null)
})

test("packed-consumer verifier exercises both removed installer flags", async () => {
  assert.equal(typeof packageCheck.verifyRetiredFlags, "function")
  await withTarget(async (target) => {
    const commands = []
    await packageCheck.verifyRetiredFlags((args) => {
      commands.push(args)
      return runCli(args)
    }, target)
    assert.deepEqual(commands, [
      ["install", "--target", target, "--with-design-kit", "--apply"],
      ["install", "--target", target, "--developer-test-runner", "--apply"],
    ])
  })
})

test("packed-consumer verifier rejects a removed flag that silently succeeds", async () => {
  assert.equal(typeof packageCheck.verifyRetiredFlags, "function")
  await withTarget(async (target) => {
    await assert.rejects(packageCheck.verifyRetiredFlags((args) =>
      args.includes("--developer-test-runner") ? { code: 0, stderr: "" } : runCli(args), target), /must fail loudly/)
  })
})

test("packed-consumer verifier rejects a usage error without a removal message", async () => {
  assert.equal(typeof packageCheck.verifyRetiredFlags, "function")
  await withTarget(async (target) => {
    await assert.rejects(packageCheck.verifyRetiredFlags((args) =>
      args.includes("--developer-test-runner") ? { code: 1, stderr: "Usage: ksi-opencode install" } : runCli(args), target), /removed/i)
  })
})

test("packed-consumer verifier rejects target creation by a rejected flag", async () => {
  assert.equal(typeof packageCheck.verifyRetiredFlags, "function")
  await withTarget(async (target) => {
    await assert.rejects(packageCheck.verifyRetiredFlags(async (args) => {
      if (args.includes("--developer-test-runner")) await mkdir(target)
      return runCli(args)
    }, target), /must not create the target/)
  })
})
