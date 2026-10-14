import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const root = new URL("..", import.meta.url)

test("default configuration preserves native Plan primary and child use", async () => {
  const text = await readFile(new URL("opencode.jsonc.example", root), "utf8")
  const config = JSON.parse(text.split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n"))
  assert.deepEqual(config, {
    $schema: "https://opencode.ai/config.json",
    agents: { plan: { mode: "all" } },
  })
})

test("repository stays private and has no custom runtime entrypoints", async () => {
  const config = JSON.parse(await readFile(new URL("package.json", root), "utf8"))
  assert.equal(config.private, true)
  assert.equal(config.bin, undefined)
  assert.equal(config.main, undefined)
  assert.equal(config.exports, undefined)
  assert.equal(config.dependencies, undefined)
  assert.deepEqual(config.scripts, { check: "node --test" })
})
