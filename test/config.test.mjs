import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const root = new URL("..", import.meta.url)

test("default configuration preserves native Plan primary and child use", async () => {
  const text = await readFile(new URL("opencode.jsonc.example", root), "utf8")
  const config = JSON.parse(text.split("\n").filter(line => !/^\s*\/\//.test(line)).join("\n"))
  assert.deepEqual(config.agents, { plan: { mode: "all" } })
  assert.equal(config.plugins, undefined)
  assert.equal(config.mcp, undefined)
})
