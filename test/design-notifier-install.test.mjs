import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  installDesignNotifier,
  resolveTargetDir,
  uninstallDesignNotifier,
  verifyInstall,
} from "../scripts/install-design-notifier.mjs"

async function makeSource(root) {
  await mkdir(join(root, "lib"), { recursive: true })
  await writeFile(join(root, "package.json"), `${JSON.stringify({ name: "ksi-design-notifier", version: "9.9.9" })}\n`)
  await writeFile(join(root, "index.js"), "export default {}\n")
  await writeFile(join(root, "lib", "a.js"), "export const a = 1\n")
}

test("resolveTargetDir honors XDG_CONFIG_HOME and the home fallback", () => {
  assert.equal(
    resolveTargetDir({ env: { XDG_CONFIG_HOME: "/xdg" }, home: "/home/u" }),
    "/xdg/opencode/plugins/design-notifier",
  )
  assert.equal(
    resolveTargetDir({ env: {}, home: "/home/u" }),
    "/home/u/.config/opencode/plugins/design-notifier",
  )
})

test("install writes a hashed manifest, verify detects drift, uninstall removes the copy", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-notifier-install-"))
  try {
    const source = join(root, "source")
    const target = join(root, "target")
    await makeSource(source)

    const manifest = await installDesignNotifier({ sourceDir: source, targetDir: target, commit: "abc123" })
    assert.equal(manifest.version, "9.9.9")
    assert.equal(manifest.commit, "abc123")
    assert.ok(manifest.files["index.js"])
    assert.ok(manifest.files["lib/a.js"])

    const verified = await verifyInstall({ targetDir: target })
    assert.equal(verified.ok, true)
    assert.deepEqual(verified.changed, [])

    await writeFile(join(target, "lib", "a.js"), "export const a = 2\n")
    const drifted = await verifyInstall({ targetDir: target })
    assert.equal(drifted.ok, false)
    assert.deepEqual(drifted.changed, ["lib/a.js"])

    await uninstallDesignNotifier({ targetDir: target })
    const gone = await verifyInstall({ targetDir: target })
    assert.equal(gone.ok, false)
    assert.match(gone.reason, /installed\.json/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("install refuses to replace a directory that is not this plugin", async () => {
  const root = await mkdtemp(join(tmpdir(), "design-notifier-install-"))
  try {
    const source = join(root, "source")
    const target = join(root, "target")
    await makeSource(source)
    await mkdir(target, { recursive: true })
    await writeFile(join(target, "package.json"), `${JSON.stringify({ name: "something-else" })}\n`)
    await assert.rejects(
      () => installDesignNotifier({ sourceDir: source, targetDir: target }),
      /refusing to touch/,
    )
    // The unrelated directory was left untouched.
    const pkg = JSON.parse(await readFile(join(target, "package.json"), "utf8"))
    assert.equal(pkg.name, "something-else")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const flag of ["--help", "-h", "--unknown"]) {
  test(`${flag} cannot install the default notifier as a side effect`, async () => {
    const root = await mkdtemp(join(tmpdir(), "notifier-cli-readonly-"))
    try {
      const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/install-design-notifier.mjs", import.meta.url)), flag], {
        cwd: root, env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: root }, encoding: "utf8",
      })
      await assert.rejects(access(join(root, "opencode", "plugins", "design-notifier")), /ENOENT/)
      if (flag === "--unknown") {
        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /unknown.*--unknown/i)
      } else {
        assert.equal(result.status, 0, result.stderr)
        assert.match(result.stdout, /usage:/i)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

for (const args of [["--target"], ["--target", "--verify"], ["--verify", "--uninstall"]]) {
  test(`${args.join(" ")} cannot mutate the existing default notifier`, async () => {
    const root = await mkdtemp(join(tmpdir(), "notifier-cli-invalid-"))
    try {
      const target = join(root, "opencode", "plugins", "design-notifier")
      await makeSource(target)
      const before = await readFile(join(target, "package.json"), "utf8")
      const result = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/install-design-notifier.mjs", import.meta.url)), ...args], {
        cwd: root, env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: root }, encoding: "utf8",
      })
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, /requires a path|mutually exclusive/)
      assert.equal(await readFile(join(target, "package.json"), "utf8"), before)
      await assert.rejects(access(join(target, "installed.json")), /ENOENT/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}
