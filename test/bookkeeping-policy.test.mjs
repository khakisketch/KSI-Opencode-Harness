import test from "node:test"
import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, parse } from "node:path"
import plugin from "../index.mjs"

test("allows session-directory bookkeeping when worktree is an ancestor root", async () => {
  const hooks = await plugin({ directory: "/home/ksi", worktree: "/" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-root", agent: "build" })
  const allow = (tool, args) => hooks["tool.execute.before"]({ tool, sessionID: "b-root" }, { args })
  await assert.doesNotReject(() => allow("write", { filePath: "/home/ksi/docs/superpowers/plans/example.md", content: "x" }))
  await assert.doesNotReject(() => allow("edit", { filePath: "/home/ksi/.opencode/working-state.md", oldString: "a", newString: "b" }))
})

test("still rejects product files when worktree is an ancestor root", async () => {
  const hooks = await plugin({ directory: "/home/ksi", worktree: "/" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-root-deny", agent: "build" })
  const product = "/home/ksi/Desktop/KSI-Projects/KSI-Opencode-Harness/src/agents.mjs"
  await assert.rejects(
    () => hooks["tool.execute.before"]({ tool: "edit", sessionID: "b-root-deny" }, { args: { filePath: product, oldString: "a", newString: "b" } }),
    /Build never implements/,
  )
})

test("keeps worktree-relative bookkeeping allowed", async () => {
  const hooks = await plugin({ directory: "/tmp/ksi-no-such-worktree", worktree: "/tmp/ksi-no-such-worktree" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-wt", agent: "build" })
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "edit", sessionID: "b-wt" },
    { args: { filePath: ".opencode/working-state.md", oldString: "a", newString: "b" } },
  ))
})

test("adds directory-relative bookkeeping edit patterns when directory differs from worktree", async () => {
  const hooks = await plugin({ directory: "/home/ksi", worktree: "/" })
  const config = {}
  hooks.config(config)
  const edit = config.agent.build.permission.edit
  assert.equal(edit["*"], "deny")
  assert.equal(edit[".opencode/**"], "allow")
  assert.equal(edit["docs/superpowers/plans/**"], "allow")
  assert.equal(edit["home/ksi/.opencode/**"], "allow")
  assert.equal(edit["home/ksi/docs/superpowers/plans/**"], "allow")
})

test("keeps static bookkeeping patterns when directory matches worktree", async () => {
  const hooks = await plugin({ directory: "/tmp/ksi-same", worktree: "/tmp/ksi-same" })
  const config = {}
  hooks.config(config)
  const edit = config.agent.build.permission.edit
  assert.equal(edit["*"], "deny")
  assert.equal(edit[".opencode/**"], "allow")
  assert.equal(edit["docs/superpowers/plans/**"], "allow")
  assert.equal(edit["home/ksi/.opencode/**"], undefined)
})

test("reads the checkpoint at the directory root when worktree is an ancestor root", async () => {
  const fakeHome = await mkdtemp(join(tmpdir(), "ksi-fake-home-"))
  try {
    await mkdir(join(fakeHome, ".opencode"), { recursive: true })
    await writeFile(join(fakeHome, ".opencode", "working-state.md"), "# Working State\n\nfixture-marker-ancestor-root\n", "utf8")
    const worktreeRoot = parse(fakeHome).root
    const hooks = await plugin({ directory: fakeHome, worktree: worktreeRoot })
    hooks.config({})
    const output = { system: [] }
    await hooks["experimental.chat.system.transform"]({ sessionID: "bookkeeping-fixture" }, output)
    assert.equal(output.system.length, 1)
    assert.equal(typeof output.system[0], "string")
    assert.match(output.system[0], /fixture-marker-ancestor-root/)
  } finally {
    await rm(fakeHome, { recursive: true, force: true })
  }
})

test("denies a nested subdirectory bookkeeping path when a git root exists above", async () => {
  const root = await mkdtemp(join(tmpdir(), "ksi-nested-root-"))
  try {
    await mkdir(join(root, ".git"), { recursive: true })
    const nested = join(root, "sub")
    await mkdir(nested, { recursive: true })
    const hooks = await plugin({ directory: nested, worktree: root })
    const config = {}
    hooks.config(config)
    const edit = config.agent.build.permission.edit
    assert.equal(edit["sub/.opencode/**"], undefined)
    assert.equal(edit["sub/docs/superpowers/plans/**"], undefined)
    await hooks["chat.params"]({ sessionID: "b-nested", agent: "build" })
    await assert.rejects(
      () => hooks["tool.execute.before"](
        { tool: "edit", sessionID: "b-nested" },
        { args: { filePath: join(nested, ".opencode", "working-state.md"), oldString: "a", newString: "b" } },
      ),
      /Build never implements/,
    )
    await assert.doesNotReject(() => hooks["tool.execute.before"](
      { tool: "edit", sessionID: "b-nested" },
      { args: { filePath: join(root, ".opencode", "working-state.md"), oldString: "a", newString: "b" } },
    ))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("allows Build bookkeeping for the exact product-state.md path", async () => {
  const hooks = await plugin({ directory: "/tmp/ksi-no-such-worktree", worktree: "/tmp/ksi-no-such-worktree" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-product", agent: "build" })
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "edit", sessionID: "b-product" },
    { args: { filePath: "docs/superpowers/product-state.md", oldString: "a", newString: "b" } },
  ))
  await assert.doesNotReject(() => hooks["tool.execute.before"](
    { tool: "write", sessionID: "b-product" },
    { args: { filePath: "docs/superpowers/product-state.md", content: "x" } },
  ))
})

test("allows product-state.md at the ancestor-root session directory and keeps product files denied", async () => {
  const hooks = await plugin({ directory: "/home/ksi", worktree: "/" })
  hooks.config({})
  await hooks["chat.params"]({ sessionID: "b-product-root", agent: "build" })
  const allow = (tool, args) => hooks["tool.execute.before"]({ tool, sessionID: "b-product-root" }, { args })
  await assert.doesNotReject(() => allow("write", { filePath: "/home/ksi/docs/superpowers/product-state.md", content: "x" }))
  await assert.rejects(
    () => allow("edit", { filePath: "/home/ksi/docs/superpowers/other.md", oldString: "a", newString: "b" }),
    /Build never implements/,
  )
  await assert.rejects(
    () => allow("edit", { filePath: "/home/ksi/docs/superpowers/product-state.md.bak", oldString: "a", newString: "b" }),
    /Build never implements/,
  )
  await assert.rejects(
    () => allow("edit", { filePath: "src/example.mjs", oldString: "a", newString: "b" }),
    /Build never implements/,
  )
})

test("exposes the product-state.md bookkeeping pattern including the ancestor-root prefix", async () => {
  const { BUILD_BOOKKEEPING_EDIT } = await import("../src/agents.mjs")
  assert.equal(BUILD_BOOKKEEPING_EDIT["docs/superpowers/product-state.md"], "allow")
  const hooks = await plugin({ directory: "/home/ksi", worktree: "/" })
  const config = {}
  hooks.config(config)
  assert.equal(config.agent.build.permission.edit["home/ksi/docs/superpowers/product-state.md"], "allow")
})

test("keeps the Build edit allowlist on the single bookkeeping source", async () => {
  const { BUILD_BOOKKEEPING_EDIT, BUILD_PERMISSION } = await import("../src/agents.mjs")
  assert.equal(BUILD_PERMISSION.edit, BUILD_BOOKKEEPING_EDIT)
  assert.equal(BUILD_PERMISSION.edit["docs/superpowers/product-state.md"], "allow")
  assert.equal(BUILD_PERMISSION.edit["*"], "deny")
})
