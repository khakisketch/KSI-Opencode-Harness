import test from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../bin/ksi-opencode.mjs", import.meta.url))

function run(target, ...args) {
  const result = spawnSync(process.execPath, [cli, "install", "--target", target, ...args], { encoding: "utf8" })
  return { ...result, data: result.stdout ? JSON.parse(result.stdout) : null }
}

async function withTarget(fn) {
  const root = await mkdtemp(join(tmpdir(), "ksi-native-install-test-"))
  try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
}

test("preview is read-only; apply creates only two custom native agents", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    const preview = run(target)
    assert.equal(preview.status, 0, preview.stderr)
    assert.equal(preview.data.applied, false)
    assert.equal(preview.data.changes.length, 2)
    await assert.rejects(lstat(target), { code: "ENOENT" })

    const applied = run(target, "--apply")
    assert.equal(applied.status, 0, applied.stderr)
    assert.equal(applied.data.applied, true)
    assert.deepEqual((await readdir(target)).sort(), ["agents"])
    assert.deepEqual((await readdir(join(target, "agents"))).sort(), ["developer.md", "reviewer.md"])
    assert.match(await readFile(join(target, "agents", "developer.md"), "utf8"), /mode: subagent/)
    const again = run(target, "--apply")
    assert.equal(again.status, 0, again.stderr)
    assert.equal(again.data.changes.length, 0)
  })
})

test("the removed design-kit flag fails loudly and writes nothing", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    const result = run(target, "--with-design-kit", "--apply")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /with-design-kit.*removed/i)
    await assert.rejects(lstat(target), { code: "ENOENT" })
  })
})

test("the removed --developer-test-runner flag fails loudly and writes nothing", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    const result = run(target, "--developer-test-runner", "--apply")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /developer-test-runner.*removed/i)
    await assert.rejects(lstat(target), { code: "ENOENT" })
  })
})

test("an existing user Test Runner file is preserved and stays outside the bundle", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    await mkdir(join(target, "agents"), { recursive: true })
    await writeFile(join(target, "agents", "test-runner.md"), "existing user Test Runner role\n")
    const installed = run(target, "--apply")
    assert.equal(installed.status, 0, installed.stderr)
    assert.equal(await readFile(join(target, "agents", "test-runner.md"), "utf8"), "existing user Test Runner role\n")
    assert.deepEqual((await readdir(join(target, "agents"))).sort(), ["developer.md", "reviewer.md", "test-runner.md"])
  })
})

test("a legacy installed design role is left untouched for explicit migration", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    await mkdir(join(target, "agents"), { recursive: true })
    await writeFile(join(target, "agents", "design.md"), "legacy KSI Design role\n")
    const installed = run(target, "--apply")
    assert.equal(installed.status, 0, installed.stderr)
    assert.equal(await readFile(join(target, "agents", "design.md"), "utf8"), "legacy KSI Design role\n")
    assert.deepEqual((await readdir(join(target, "agents"))).sort(), ["design.md", "developer.md", "reviewer.md"])
  })
})

test("different existing role blocks all writes until explicit replacement; replacement backs it up", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    await mkdir(join(target, "agents"), { recursive: true })
    const role = join(target, "agents", "developer.md")
    await writeFile(role, "existing user Developer\n")
    const blocked = run(target, "--apply")
    assert.notEqual(blocked.status, 0)
    assert.match(blocked.stderr, /conflict/i)
    assert.equal(await readFile(role, "utf8"), "existing user Developer\n")
    await assert.rejects(lstat(join(target, "agents", "reviewer.md")), { code: "ENOENT" })

    const replaced = run(target, "--apply", "--replace")
    assert.equal(replaced.status, 0, replaced.stderr)
    const backup = (await readdir(join(target, "agents"))).find((name) => name.startsWith("developer.md.bak-"))
    assert.ok(backup)
    assert.equal(await readFile(join(target, "agents", backup), "utf8"), "existing user Developer\n")
    assert.match(await readFile(role, "utf8"), /mode: subagent/)
  })
})

test("replacement refuses to discard user-owned native model, variant, or steps", async () => {
  for (const field of ['model: "provider/custom"', "variant: high", "steps: 47", "  model: provider/custom", '"variant": high', "'steps': 47"]) {
    await withTarget(async (root) => {
      const target = join(root, "config")
      await mkdir(join(target, "agents"), { recursive: true })
      const role = join(target, "agents", "developer.md")
      const original = `---\n${field}\n---\nExisting Developer\n`
      await writeFile(role, original)
      const result = run(target, "--apply", "--replace")
      assert.notEqual(result.status, 0, `${field}: replacement unexpectedly succeeded`)
      assert.match(result.stderr, /model|variant|steps/i)
      assert.equal(await readFile(role, "utf8"), original)
      assert.deepEqual(await readdir(join(target, "agents")), ["developer.md"])
    })
  }
})

test("updating an earlier install leaves old built-in overrides and commands untouched for explicit migration", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    await mkdir(join(target, "agents"), { recursive: true })
    await mkdir(join(target, "commands"))
    await writeFile(join(target, "agents", "build.md"), "existing Build override\n")
    await writeFile(join(target, "agents", "research.md"), "existing Research role\n")
    await writeFile(join(target, "agents", "design-critic.md"), "existing Design Critic role\n")
    await writeFile(join(target, "commands", "review.md"), "existing command\n")
    const installed = run(target, "--apply")
    assert.equal(installed.status, 0, installed.stderr)
    assert.equal(await readFile(join(target, "agents", "build.md"), "utf8"), "existing Build override\n")
    assert.equal(await readFile(join(target, "agents", "research.md"), "utf8"), "existing Research role\n")
    assert.equal(await readFile(join(target, "agents", "design-critic.md"), "utf8"), "existing Design Critic role\n")
    assert.equal(await readFile(join(target, "commands", "review.md"), "utf8"), "existing command\n")
  })
})

test("installer does not rewrite existing JSONC or register KSI as a plugin", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    await mkdir(target)
    const config = join(target, "opencode.jsonc")
    const original = '{\n  // user model and plugin config\n  "agents": {"developer": {"model": "provider/model#high", "steps": 47}},\n  "plugins": ["other-plugin"]\n}\n'
    await writeFile(config, original)
    const installed = run(target, "--apply")
    assert.equal(installed.status, 0, installed.stderr)
    assert.equal(await readFile(config, "utf8"), original)
    assert.doesNotMatch(installed.stdout, /ksi-opencode-harness.*plugins/)
    assert.doesNotMatch(await readFile(join(target, "agents", "developer.md"), "utf8"), /\n(?:model|steps):/)
  })
})

test("installer refuses a symlink in a managed destination", async () => {
  await withTarget(async (root) => {
    const target = join(root, "config")
    const elsewhere = join(root, "elsewhere")
    await mkdir(target)
    await mkdir(elsewhere)
    await symlink(elsewhere, join(target, "agents"))
    const result = run(target, "--apply")
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /symlink/i)
    assert.deepEqual(await readdir(elsewhere), [])
  })
})
