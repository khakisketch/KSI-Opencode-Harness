import test from "node:test"
import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

test("package exposes a standalone installer and no OpenCode plugin entrypoint", () => {
  assert.equal(packageJson.bin?.["ksi-opencode"], "./bin/ksi-opencode.mjs")
  assert.equal(packageJson.main, undefined)
  assert.equal(packageJson.exports, undefined)
  assert.ok(packageJson.files.includes("bin/ksi-opencode.mjs"))
  assert.ok(packageJson.files.includes("src/native-bundle.mjs"))
  assert.ok(packageJson.files.includes("src/native-roles.mjs"))
  assert.ok(packageJson.files.includes("examples/project-AGENTS.md"))
  assert.ok(!packageJson.files.includes("src/agents.mjs"), "historical plugin policy must not ship")
  assert.ok(!packageJson.files.includes("agents/"), "ship only the four custom role prompts")
  for (const name of ["design", "developer", "test-runner", "reviewer"]) {
    assert.ok(packageJson.files.includes(`templates/agents/${name}.md`))
    assert.ok(!packageJson.files.includes(`agents/${name}.md`), "historical plugin prompts must not ship")
  }
  assert.ok(!packageJson.files.includes("templates/agents/research.md"), "retired role must not ship")
  assert.ok(!packageJson.files.includes("templates/agents/design-critic.md"), "retired critic must not ship")
  assert.ok(!packageJson.files.includes("index.mjs"))
  assert.ok(!packageJson.files.includes("src/"))
  assert.ok(!packageJson.scripts.check.includes("plugin-v2"))
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

test("retired plugin entrypoints and configuration generators are absent from source", async () => {
  for (const path of ["index.mjs", "src/plugin-v2.mjs", "scripts/generate-agent-config.mjs", "bin/ksi-continuity-inject.mjs"]) {
    await assert.rejects(access(new URL(`../${path}`, import.meta.url)), { code: "ENOENT" }, path)
  }
})

test("optional Playwright MCP example is disabled and discloses download behavior", async () => {
  const example = await readFile(new URL("../examples/design.project.jsonc", import.meta.url), "utf8")
  assert.match(example, /"servers"\s*:\s*\{/)
  assert.match(example, /"enabled"\s*:\s*false/)
  assert.match(example, /npx.*may download and execute/i)
})

test("retired model routing sample is not shipped", async () => {
  assert.ok(!packageJson.files.includes("examples/model-routing.json"))
  await assert.rejects(access(new URL("../examples/model-routing.json", import.meta.url)), { code: "ENOENT" })
})

test("design kit and complete neutral reference system are included with provenance", async () => {
  for (const path of [
    "vendor/open-design/UPSTREAM.md",
    "vendor/open-design/LICENSE",
    "vendor/open-design/skills/frontend-design/SKILL.md",
    "vendor/open-design/skills/frontend-design/LICENSE.txt",
    "vendor/open-design/skills/impeccable-design-polish/SKILL.md",
    ...["typography", "color", "anti-ai-slop", "state-coverage", "accessibility-baseline", "animation-discipline"].map((name) => `vendor/open-design/craft/${name}.md`),
    "vendor/open-design/skills/web-design-guidelines/SKILL.md",
    "vendor/open-design/skills/web-design-guidelines/LICENSE",
    "vendor/open-design/skills/web-design-guidelines/references/guidelines.md",
    "vendor/open-design/design-systems/default/manifest.json",
    "vendor/open-design/design-systems/default/DESIGN.md",
    "vendor/open-design/design-systems/default/tokens.css",
  ]) {
    await access(new URL(`../${path}`, import.meta.url))
  }
  assert.ok(packageJson.files.includes("vendor/open-design"))
  const provenance = await readFile(new URL("../vendor/open-design/UPSTREAM.md", import.meta.url), "utf8")
  assert.match(provenance, /1b47e60bd46641469fcd8b69c496c4e3a548bc28/)
  assert.match(provenance, /web-design-guidelines.*MIT/s)
})
