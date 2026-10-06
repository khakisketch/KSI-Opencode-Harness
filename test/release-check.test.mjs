import test from "node:test"
import assert from "node:assert/strict"

import { checkVersionPins, extractVersionPins } from "../scripts/release-check.mjs"

test("extractVersionPins finds every pinned version string", () => {
  const text = [
    "npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.6 -- ksi-opencode install",
    "**Beta `0.5.0-beta.6`** · [MIT](LICENSE)",
  ].join("\n")
  assert.deepEqual(extractVersionPins(text), ["0.5.0-beta.6", "0.5.0-beta.6"])
})

test("checkVersionPins fails when a pin does not match the package version", () => {
  const result = checkVersionPins({
    version: "0.5.0-beta.7",
    readme: "package=ksi-opencode-harness@0.5.0-beta.6",
    install: "package=ksi-opencode-harness@0.5.0-beta.6",
  })
  assert.equal(result.ok, false)
  assert.match(result.problems.join("\n"), /beta\.6/)
  assert.match(result.problems.join("\n"), /beta\.7/)
})

test("checkVersionPins fails when no pin exists at all", () => {
  const result = checkVersionPins({ version: "0.5.0-beta.6", readme: "no pins here", install: "" })
  assert.equal(result.ok, false)
  assert.match(result.problems.join("\n"), /no version pins found/i)
})

test("checkVersionPins passes when every pin matches", () => {
  const result = checkVersionPins({
    version: "0.5.0-beta.6",
    readme: "npm exec --package=ksi-opencode-harness@0.5.0-beta.6 and **Beta `0.5.0-beta.6`**",
    install: "npm exec --package=ksi-opencode-harness@0.5.0-beta.6",
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.problems, [])
})

// Guard: the real repository files must stay in sync, so CI catches pin drift.
test("repository README/INSTALL pins match package.json", async () => {
  const { readFile } = await import("node:fs/promises")
  const root = new URL("..", import.meta.url)
  const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"))
  const readme = await readFile(new URL("README.md", root), "utf8")
  const install = await readFile(new URL("INSTALL.md", root), "utf8")
  const result = checkVersionPins({ version: pkg.version, readme, install })
  assert.ok(result.pins.length > 0, "expected at least one version pin")
  assert.equal(result.ok, true, result.problems.join("\n"))
})
