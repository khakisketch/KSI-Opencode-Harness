import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REQUIRED_PACKAGE_FILES, INSTALL_CHECK_ROLES, npmInvocation, policyReferenceMatches, validateManifest } from "../scripts/check-package.mjs"

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

test("declares portable plugin metadata and automatic test discovery", () => {
  assert.equal(packageJson.version, "0.3.0")
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

test("ships the Design workflow documentation and model-free examples", () => {
  for (const required of [
    "docs/design.md",
    "examples/design.project.jsonc",
    "examples/design-handoff.md",
  ]) {
    assert.ok(REQUIRED_PACKAGE_FILES.includes(required), `package gate does not require ${required}`)
  }
  assert.ok(packageJson.files.includes("docs/"), "package does not ship the docs directory")
  for (const example of ["examples/design.project.jsonc", "examples/design-handoff.md"]) {
    assert.ok(packageJson.files.includes(example), `package does not explicitly ship ${example}`)
  }
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
  for (const required of ["LICENSE", "agents/design.md", "scripts/audit-routing.mjs", "src/audit-metrics.mjs", "src/evidence-tools.mjs", "src/env-probe.mjs"]) {
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

test("accepts a policy reference through an aliased installed root but rejects an unrelated policy", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "ksi-policy-reference-"))
  try {
    const canonicalRoot = join(workDir, "canonical")
    const aliasedRoot = join(workDir, "alias")
    const policyRelativePath = join("instructions", "harness.md")
    const canonicalPolicy = join(canonicalRoot, policyRelativePath)
    const aliasedPolicy = join(aliasedRoot, policyRelativePath)
    const unrelatedPolicy = join(workDir, "unrelated", policyRelativePath)
    await mkdir(join(canonicalRoot, "instructions"), { recursive: true })
    await mkdir(join(workDir, "unrelated", "instructions"), { recursive: true })
    await writeFile(canonicalPolicy, "installed policy")
    await writeFile(unrelatedPolicy, "unrelated policy")
    await symlink(canonicalRoot, aliasedRoot, process.platform === "win32" ? "junction" : "dir")

    assert.equal(await policyReferenceMatches([canonicalPolicy], aliasedPolicy), true)
    assert.equal(await policyReferenceMatches([unrelatedPolicy], aliasedPolicy), false)
    assert.equal(await policyReferenceMatches([join(workDir, "missing")], aliasedPolicy), false)
    await assert.rejects(() => policyReferenceMatches([null], aliasedPolicy), { code: "ERR_INVALID_ARG_TYPE" })
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
})

test("package install gate asserts the hidden design-task registration", () => {
  assert.ok(INSTALL_CHECK_ROLES.includes("design-task"), "install gate does not assert design-task")
  assert.ok(!REQUIRED_PACKAGE_FILES.includes("agents/design-task.md"), "design-task shares agents/design.md and needs no own prompt file")
  assert.ok(REQUIRED_PACKAGE_FILES.includes("agents/design.md"), "shared design-task prompt file is not gated")
})
