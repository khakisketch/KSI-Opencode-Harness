import test from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { npmTarget, installedCliTarget } from "../scripts/check-package.mjs"

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
