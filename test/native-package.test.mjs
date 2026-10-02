import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

test("native installer has a new publishable npm beta version", () => {
  assert.equal(packageJson.version, "0.5.0-beta.5")
  assert.notEqual(packageJson.private, true)
})

test("package exposes a standalone installer and no OpenCode plugin entrypoint", () => {
  assert.equal(packageJson.bin?.["ksi-opencode"], "./bin/ksi-opencode.mjs")
  assert.equal(packageJson.main, undefined)
  assert.equal(packageJson.exports, undefined)
  assert.ok(packageJson.files.includes("bin/ksi-opencode.mjs"))
  assert.ok(packageJson.files.includes("src/native-bundle.mjs"))
  assert.ok(packageJson.files.includes("src/native-roles.mjs"))
  assert.ok(packageJson.files.includes("examples/project-AGENTS.md"))
  assert.ok(packageJson.files.includes("docs/integrations/opendesign.md"))
  assert.ok(!packageJson.files.includes("src/agents.mjs"), "historical plugin policy must not ship")
  assert.ok(!packageJson.files.includes("agents/"), "ship only the three custom role prompts")
  for (const name of ["developer", "test-runner", "reviewer"]) {
    assert.ok(packageJson.files.includes(`templates/agents/${name}.md`))
    assert.ok(!packageJson.files.includes(`agents/${name}.md`), "historical plugin prompts must not ship")
  }
  assert.ok(!packageJson.files.includes("templates/agents/design.md"), "retired Design role must not ship")
  assert.ok(!packageJson.files.includes("templates/agents/research.md"), "retired role must not ship")
  assert.ok(!packageJson.files.includes("templates/agents/design-critic.md"), "retired critic must not ship")
  assert.ok(!packageJson.files.includes("vendor/open-design"), "the retired design kit must not ship")
  assert.ok(!packageJson.files.includes("docs/design.md"), "retired design docs must not ship")
  assert.ok(!packageJson.files.includes("examples/design.project.jsonc"), "retired design examples must not ship")
  assert.ok(!packageJson.files.includes("index.mjs"))
  assert.ok(!packageJson.files.includes("src/"))
  assert.ok(!packageJson.files.includes("docs/releasing.md"), "maintainer release operations are not user-facing package docs")
  assert.ok(!packageJson.scripts.check.includes("plugin-v2"))
})

test("retired design artifacts are absent from the source tree", async () => {
  for (const path of [
    "templates/agents/design.md",
    "vendor/open-design",
    "docs/design.md",
    "docs/design-critique.md",
    "docs/design-system-template.md",
    "examples/design.project.jsonc",
    "examples/design-handoff.md",
  ]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: "ENOENT" }, path)
  }
})

test("native installer guidance never instructs registering KSI in plugins", async () => {
  const install = await readFile(new URL("../INSTALL.md", import.meta.url), "utf8")
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")
  const example = await readFile(new URL("../opencode.jsonc.example", import.meta.url), "utf8")
  assert.match(install, /ksi-opencode\.mjs install --target/)
  assert.match(readme, /ksi-opencode\.mjs install --target/)
  assert.doesNotMatch(example, /KSI-Opencode-Harness.*plugins|ksi-opencode-harness.*plugins/is)
  assert.match(install, /plugin-only.*(?:removed|unavailable)|runtime.*(?:removed|unavailable)/i)
})

test("guidance points design work at OpenDesign instead of a vendored kit", async () => {
  const install = await readFile(new URL("../INSTALL.md", import.meta.url), "utf8")
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8")
  const integration = await readFile(new URL("../docs/integrations/opendesign.md", import.meta.url), "utf8")
  assert.match(install, /OpenDesign/)
  assert.match(readme, /OpenDesign/)
  assert.match(integration, /start_run|read/i)
  assert.match(readme, /0\.5\.0부터 Design primary와 `--with-design-kit`은 제거되었습니다/)
  for (const text of [readme, install]) {
    assert.doesNotMatch(text, /append `--with-design-kit`/i, "guidance must not offer the removed flag")
    assert.doesNotMatch(text, /--with-design-kit.*(?:both|preview and apply)/is, "guidance must not instruct using the removed flag")
  }
})

test("retired plugin entrypoints and configuration generators are absent from source", async () => {
  for (const path of ["index.mjs", "src/plugin-v2.mjs", "scripts/generate-agent-config.mjs", "bin/ksi-continuity-inject.mjs"]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: "ENOENT" }, path)
  }
})

test("retired model routing sample is not shipped", async () => {
  assert.ok(!packageJson.files.includes("examples/model-routing.json"))
  await assert.rejects(access(new URL("../examples/model-routing.json", import.meta.url)), { code: "ENOENT" })
})
