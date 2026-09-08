import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { REQUIRED_PACKAGE_FILES, npmInvocation, validateManifest } from "../scripts/check-package.mjs"

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

test("declares portable plugin metadata and automatic test discovery", () => {
  assert.equal(packageJson.version, "0.2.0")
  assert.equal(packageJson.type, "module")
  assert.equal(packageJson.main, "./index.mjs")
  assert.equal(packageJson.exports, "./index.mjs")
  assert.match(packageJson.description, /OpenCode plugin/i)
  assert.equal(packageJson.repository.url, "https://github.com/khakisketch/KSI-Opencode-Harness")
  assert.equal(packageJson.scripts.test, "node --test")
  assert.match(packageJson.scripts.check, /node --test$/)
  assert.doesNotMatch(packageJson.scripts.test, /[*?]/)
  assert.doesNotMatch(packageJson.scripts.check, /[*?]/)
})

test("production files allowlist excludes checks, CI, tests, and temporary assets", () => {
  const files = packageJson.files
  assert.ok(files.includes("scripts/audit-routing.mjs"))
  assert.ok(!files.includes("scripts/"))
  assert.ok(!files.some((entry) => /(?:^|\/)(?:\.github|test|tests|tmp|temp)(?:\/|$)/i.test(entry)))
  assert.ok(!files.includes("scripts/check-package.mjs"))
})

test("package manifest validation rejects missing critical and forbidden paths", () => {
  assert.throws(() => validateManifest(["index.mjs"]), /missing required file/)
  assert.throws(() => validateManifest([...REQUIRED_PACKAGE_FILES, "tests/fixture.txt"]), /forbidden path/)
})

test("accepts the complete manifest and normalizes Windows separators", () => {
  for (const required of ["LICENSE", "scripts/audit-routing.mjs", "src/audit-metrics.mjs"]) {
    assert.ok(REQUIRED_PACKAGE_FILES.includes(required), `required shipped file is not gated: ${required}`)
  }
  assert.deepEqual(
    validateManifest(REQUIRED_PACKAGE_FILES.map((path) => path.replaceAll("/", "\\"))),
    REQUIRED_PACKAGE_FILES,
  )
})

test("rejects credential artifact basenames but allows an example environment file", () => {
  for (const filename of [".env", ".env.production", "auth.json", "credentials.json", "credentials-prod.json", "tls.pem", "private.key"]) {
    assert.throws(
      () => validateManifest([...REQUIRED_PACKAGE_FILES, `config/${filename}`]),
      /forbidden path/,
      filename,
    )
  }
  assert.doesNotThrow(() => validateManifest([...REQUIRED_PACKAGE_FILES, "config/.env.example"]))
})

test("requires npm_execpath and never enables shell execution", () => {
  assert.throws(() => npmInvocation(["pack"], ".", {}, ""), /npm run check:package/)
  const invocation = npmInvocation(["pack"], ".", {}, "C:\\Program Files\\npm\\npm-cli.js")
  assert.equal(invocation.command, process.execPath)
  assert.deepEqual(invocation.args, ["C:\\Program Files\\npm\\npm-cli.js", "pack"])
  assert.equal(invocation.options.shell, false)
})
