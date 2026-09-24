import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { REQUIRED_PACKAGE_FILES, INSTALL_CHECK_ROLES, npmInvocation, policyReferenceMatches, validateManifest } from "../scripts/check-package.mjs"

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))

test("declares portable plugin metadata and automatic test discovery", () => {
  assert.equal(packageJson.version, "0.4.0-beta.0")
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
    "docs/design-system-template.md",
    "docs/design-critique.md",
    "examples/design.project.jsonc",
    "examples/design-handoff.md",
  ]) {
    assert.ok(REQUIRED_PACKAGE_FILES.includes(required), `package gate does not require ${required}`)
  }
  const PUBLIC_DOCS = [
    "docs/architecture.md",
    "docs/design.md",
    "docs/design-critique.md",
    "docs/design-system-template.md",
    "docs/execution.md",
    "docs/releasing.md",
    "docs/troubleshooting.md",
    "docs/verification.md",
  ]
  for (const doc of PUBLIC_DOCS) {
    assert.ok(packageJson.files.includes(doc), `package does not explicitly ship ${doc}`)
  }
  assert.ok(!packageJson.files.includes("docs/"), "package must not ship the whole docs/ directory")
  assert.ok(!packageJson.files.includes("docs"), "package must not ship the whole docs directory")
  for (const example of ["examples/design.project.jsonc", "examples/design-handoff.md"]) {
    assert.ok(packageJson.files.includes(example), `package does not explicitly ship ${example}`)
  }
})

test("public docs whitelist is fail-closed against docs/superpowers ledgers and specs", () => {
  const PUBLIC_DOCS = [
    "docs/architecture.md",
    "docs/design.md",
    "docs/design-critique.md",
    "docs/design-system-template.md",
    "docs/execution.md",
    "docs/releasing.md",
    "docs/troubleshooting.md",
    "docs/verification.md",
  ]
  for (const doc of PUBLIC_DOCS) {
    assert.ok(REQUIRED_PACKAGE_FILES.includes(doc), `required public doc is not gated: ${doc}`)
  }
  assert.doesNotThrow(() => validateManifest([...REQUIRED_PACKAGE_FILES]))
  for (const internal of [
    "docs/superpowers/product-state.md",
    "docs/superpowers/plans/2026-09-23-human-centered-workflow.md",
    "docs/superpowers/specs/2026-09-15-long-running-orchestration-design.md",
  ]) {
    assert.throws(() => validateManifest([...REQUIRED_PACKAGE_FILES, internal]), /forbidden|superpowers/, internal)
  }
  assert.ok(
    !packageJson.files.some((entry) => entry === "docs" || entry === "docs/" || entry.startsWith("docs/superpowers")),
    "package whitelist must not reintroduce docs/ or docs/superpowers",
  )
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

test("requires runtime repository service in the package gate", () => {
  assert.ok(REQUIRED_PACKAGE_FILES.includes("src/repository.mjs"), "package gate does not require src/repository.mjs")
  assert.throws(
    () => validateManifest(REQUIRED_PACKAGE_FILES.filter((path) => path !== "src/repository.mjs")),
    /src\/repository\.mjs/,
  )
})
test("rejects credential artifact basenames but allows an example environment file", () => {
  for (const filename of [".env", ".env.production", "auth.json", "credentials.json", "credentials-prod.json", "tls.pem", "private.key", "my-credentials-backup.json", "my-auth.json", "nested/dir/MY-AUTH.JSON", "nested/dir/My-Credentials-Backup.JSON", "nested/.env", "config/MY.PEM", "config/Private.KEY"]) {
    assert.throws(
      () => validateManifest([...REQUIRED_PACKAGE_FILES, `config/${filename}`]),
      /forbidden path/,
      filename,
    )
  }
  assert.doesNotThrow(() => validateManifest([...REQUIRED_PACKAGE_FILES, "config/.env.example"]))
})

test("syntax-check covers evidence-tools and env-probe without changing package identity", () => {
  assert.match(packageJson.scripts.check, /node --check src\/evidence-tools\.mjs/)
  assert.match(packageJson.scripts.check, /node --check src\/env-probe\.mjs/)
  assert.equal(packageJson.version, "0.4.0-beta.0")
  assert.equal(packageJson.name, "ksi-opencode-harness")
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

test("package install gate asserts the hidden design-critic registration without design-task", () => {
  assert.ok(!INSTALL_CHECK_ROLES.includes("design-task"), "removed design-task leaves no install gate")
  assert.ok(INSTALL_CHECK_ROLES.includes("design-critic"), "install gate does not assert design-critic")
  assert.ok(!REQUIRED_PACKAGE_FILES.includes("agents/design-task.md"), "removed design-task needs no own prompt file")
  assert.ok(REQUIRED_PACKAGE_FILES.includes("agents/design.md"), "Design prompt file is not gated")
  assert.ok(REQUIRED_PACKAGE_FILES.includes("agents/design-critic.md"), "design-critic prompt file is not gated")
})
