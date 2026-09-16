import assert from "node:assert/strict"
import { execFile as execFileCallback } from "node:child_process"
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import test from "node:test"

import { createRepositoryService } from "../src/repository.mjs"

const execFile = promisify(execFileCallback)

async function git(cwd, args) {
  return execFile("git", args, { cwd, encoding: "utf8" })
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ksi-repository-"))
  await git(root, ["init", "--initial-branch=main"])
  await git(root, ["config", "user.email", "test@example.invalid"])
  await git(root, ["config", "user.name", "Repository Test"])
  await writeFile(path.join(root, "tracked.txt"), "base\n")
  await mkdir(path.join(root, "nested"))
  await writeFile(path.join(root, "nested", "initial.txt"), "initial\n")
  await git(root, ["add", "."])
  await git(root, ["commit", "-m", "initial"])
  return root
}

async function withFixture(run) {
  const root = await fixture()
  try {
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test("status identifies the actual Git root and bounded dirty summary from a subdirectory", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, "tracked.txt"), "dirty\n")
    const nested = path.join(root, "nested")
    const result = await createRepositoryService({ worktree: nested }).status()

    assert.equal(result.supported, true)
    const expectedRoot = await realpath(root)
    assert.equal(result.root, expectedRoot)
    assert.equal(result.head.unborn, false)
    assert.equal(result.summary.unstaged, 1)
    assert.deepEqual(result.paths.map((entry) => entry.path), ["tracked.txt"])
  })
})

test("snapshot packages staged, unstaged, and untracked task files with content and index evidence", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, "tracked.txt"), "staged\n")
    await git(root, ["add", "tracked.txt"])
    await writeFile(path.join(root, "tracked.txt"), "unstaged after staged\n")
    await writeFile(path.join(root, "new file.txt"), "untracked\n")

    const service = createRepositoryService({ worktree: root })
    const snapshot = await service.snapshot({ paths: ["tracked.txt", "new file.txt"] })
    const manifest = JSON.parse(await readFile(snapshot.manifestPath, "utf8"))
    const diff = await readFile(snapshot.diffPath, "utf8")

    assert.match(snapshot.identifier, /^[a-f0-9-]{36}$/)
    assert.equal(snapshot.coverage.complete, true)
    assert.match(diff, /unstaged after staged/)
    assert.match(diff, /untracked/)
    assert.equal(manifest.files.find((file) => file.path === "tracked.txt").index.length, 1)
    assert.equal(manifest.files.find((file) => file.path === "tracked.txt").worktree.hash.length, 64)
  })
})

test("snapshot preserves pre-existing dirty context without attributing it to the requested scope", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, "nested", "initial.txt"), "pre-existing dirty\n")
    await writeFile(path.join(root, "tracked.txt"), "task dirty\n")

    const snapshot = await createRepositoryService({ worktree: root }).snapshot({ paths: ["tracked.txt"] })
    const manifest = JSON.parse(await readFile(snapshot.manifestPath, "utf8"))

    assert.equal(manifest.baseline.outsideScope.unstaged, 1)
    assert.equal(manifest.baseline.scope.unstaged, 1)
    assert.equal(manifest.files.length, 1)
    assert.equal(manifest.files[0].path, "tracked.txt")
  })
})

test("verify detects later mutations, renames, deletions, and newly added files inside a requested directory", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, "nested", "initial.txt"), "changed\n")
    const service = createRepositoryService({ worktree: root })
    const snapshot = await service.snapshot({ paths: ["nested"] })

    await git(root, ["mv", "nested/initial.txt", "nested/renamed.txt"])
    await writeFile(path.join(root, "nested", "later.txt"), "later\n")
    const result = await service.verify({ snapshot })

    assert.equal(result.valid, false)
    assert.deepEqual(result.changed.map((entry) => entry.path).sort(), ["nested/initial.txt", "nested/later.txt", "nested/renamed.txt"])
  })
})

test("rejects traversal, pathspec magic, input symlinks, and artifact-root symlinks", async () => {
  await withFixture(async (root) => {
    const service = createRepositoryService({ worktree: root })
    await assert.rejects(() => service.snapshot({ paths: ["../outside"] }), /relative task path/i)
    await assert.rejects(() => service.snapshot({ paths: [":(glob)*"] }), /pathspec/i)
    await symlink("tracked.txt", path.join(root, "link.txt"))
    await assert.rejects(() => service.snapshot({ paths: ["link.txt"] }), /symlink/i)

    await mkdir(path.join(root, ".opencode"))
    const artifactTarget = await mkdtemp(path.join(tmpdir(), "ksi-artifact-target-"))
    await symlink(artifactTarget, path.join(root, ".opencode", "artifacts"))
    await assert.rejects(() => service.snapshot({ paths: ["tracked.txt"] }), /artifact.*symlink/i)
    await rm(artifactTarget, { recursive: true, force: true })
  })
})

test("reports sensitive, binary, and oversized files as exclusions instead of leaking them into review artifacts", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, ".env"), "TOKEN=must-not-appear\n")
    await writeFile(path.join(root, ".env.example"), "TOKEN=example\n")
    await writeFile(path.join(root, "binary.dat"), Buffer.from([0, 1, 2, 0]))
    await writeFile(path.join(root, "large.txt"), "x".repeat(300 * 1024))
    const snapshot = await createRepositoryService({ worktree: root }).snapshot({
      paths: [".env", ".env.example", "binary.dat", "large.txt"],
    })
    const diff = await readFile(snapshot.diffPath, "utf8")

    assert.equal(snapshot.coverage.complete, false)
    assert.deepEqual(
      snapshot.coverage.excluded.map((entry) => [entry.path, entry.reason]).sort(),
      [[".env", "sensitive"], ["binary.dat", "binary"], ["large.txt", "oversized"]],
    )
    assert.doesNotMatch(diff, /must-not-appear/)
    assert.match(diff, /TOKEN=example/)
  })
})

test("verify detects tampered artifacts and supports bounded checkpoint and non-Git evidence", async () => {
  await withFixture(async (root) => {
    const service = createRepositoryService({ worktree: root })
    const snapshot = await service.snapshot({ paths: ["tracked.txt"] })
    await chmod(snapshot.diffPath, 0o644)
    await writeFile(snapshot.diffPath, "tampered\n")
    const tampered = await service.verify({ snapshot })
    assert.equal(tampered.valid, false)
    assert.match(tampered.unknown[0].reason, /artifact/i)

    await mkdir(path.join(root, ".opencode"), { recursive: true })
    await writeFile(path.join(root, ".opencode", "working-state.md"), "x".repeat(80 * 1024))
    const checkpoint = await service.readCheckpoint()
    assert.equal(checkpoint.exists, true)
    assert.equal(checkpoint.truncated, true)
    assert.equal(Buffer.byteLength(checkpoint.content), 64 * 1024)

    const nonGit = await mkdtemp(path.join(tmpdir(), "ksi-non-git-"))
    try {
      const status = await createRepositoryService({ worktree: nonGit }).status()
      assert.deepEqual(status, { supported: false, reason: "not-git-worktree" })
    } finally {
      await rm(nonGit, { recursive: true, force: true })
    }
  })
})

test("reports an unborn Git repository and an explicitly missing checkpoint", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ksi-unborn-git-"))
  try {
    await git(root, ["init", "--initial-branch=main"])
    const service = createRepositoryService({ worktree: root })

    const status = await service.status()
    const checkpoint = await service.readCheckpoint()

    assert.equal(status.supported, true)
    assert.deepEqual(status.head, { oid: null, unborn: true })
    assert.deepEqual(checkpoint, { supported: true, exists: false, reason: "missing-checkpoint" })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("verify reports incomplete coverage as invalid even without drift", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, ".env"), "TOKEN=secret\n")
    const service = createRepositoryService({ worktree: root })
    const snapshot = await service.snapshot({ paths: [".env"] })
    assert.equal(snapshot.coverage.complete, false)
    const result = await service.verify({ snapshot })
    assert.equal(result.valid, false)
    assert.equal(result.unknown[0].reason, "incomplete-coverage")
  })
})

test("snapshot from a subdirectory resolves root-relative scopes", async () => {
  await withFixture(async (root) => {
    await writeFile(path.join(root, "tracked.txt"), "subdir check\n")
    const service = createRepositoryService({ worktree: path.join(root, "nested") })
    const snapshot = await service.snapshot({ paths: ["tracked.txt"] })
    assert.deepEqual(snapshot.coverage.excluded, [])
    assert.deepEqual(snapshot.coverage.included, ["tracked.txt"])
    const result = await service.verify({ snapshot })
    assert.equal(result.valid, true)
  })
})

test("snapshot captures staged deletions and staged-only content", async () => {
  await withFixture(async (root) => {
    await git(root, ["rm", "tracked.txt"])
    const service = createRepositoryService({ worktree: root })
    const deleted = await service.snapshot({ paths: ["nested", "tracked.txt"] })
    assert.ok(deleted.coverage.included.includes("tracked.txt"))

    await git(root, ["reset", "--hard", "HEAD"])
    await writeFile(path.join(root, "tracked.txt"), "staged only\n")
    await git(root, ["add", "tracked.txt"])
    await git(root, ["show", "HEAD:tracked.txt"]).then(async ({ stdout }) => {
      await writeFile(path.join(root, "tracked.txt"), stdout)
    })
    const stagedOnly = await service.snapshot({ paths: ["tracked.txt"] })
    const diff = await readFile(stagedOnly.diffPath, "utf8")
    assert.match(diff, /staged only/)
  })
})

test("verify rejects traversal identifiers", async () => {
  await withFixture(async (root) => {
    const service = createRepositoryService({ worktree: root })
    const snapshot = await service.snapshot({ paths: ["tracked.txt"] })
    const bad = await service.verify({ snapshot: { ...snapshot, identifier: "../../outside" } })
    assert.equal(bad.valid, false)
    assert.equal(bad.unknown[0].reason, "invalid-snapshot")
    assert.equal((await service.verify({ snapshot })).valid, true)
  })
})
