#!/usr/bin/env node
import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { isAbsolute, join } from "node:path"
import { buildNativeBundle } from "../src/native-bundle.mjs"

const usage = "Usage: ksi-opencode install --target <absolute OpenCode config directory> [--apply] [--replace] [--developer-test-runner] [--with-design-kit]"

function options(args) {
  if (args[0] !== "install") throw new Error(usage)
  const result = { target: null, apply: false, replace: false, developerTestRunner: false, withDesignKit: false }
  for (let index = 1; index < args.length; index++) {
    const arg = args[index]
    if (arg === "--target" && !result.target && args[index + 1]) result.target = args[++index]
    else if (arg === "--apply") result.apply = true
    else if (arg === "--replace") result.replace = true
    else if (arg === "--developer-test-runner") result.developerTestRunner = true
    else if (arg === "--with-design-kit") result.withDesignKit = true
    else throw new Error(usage)
  }
  if (!result.target || !isAbsolute(result.target)) throw new Error(usage)
  return result
}

async function kind(path) {
  try {
    const stat = await lstat(path)
    if (stat.isSymbolicLink()) throw new Error(`Refusing symlink: ${path}`)
    return stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other"
  } catch (error) {
    if (error?.code === "ENOENT") return "absent"
    throw error
  }
}

async function inspect(target, bundle) {
  const rootKind = await kind(target)
  if (rootKind !== "absent" && rootKind !== "directory") throw new Error(`Target must be a directory: ${target}`)
  const directories = new Set()
  for (const path of bundle.keys()) {
    const parts = path.split("/")
    for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join("/"))
  }
  for (const dir of directories) {
    const status = await kind(join(target, dir))
    if (status !== "absent" && status !== "directory") throw new Error(`Managed path must be a directory: ${join(target, dir)}`)
  }
  const changes = []
  for (const [relativePath, after] of bundle) {
    const path = join(target, relativePath)
    const status = await kind(path)
    if (status !== "absent" && status !== "file") throw new Error(`Managed path must be a file: ${path}`)
    const before = status === "file" ? await readFile(path, "utf8") : null
    if (before === after) continue
    changes.push({ path: relativePath, status: before === null ? "create" : "conflict", before, after })
  }
  return changes
}

function hasUserRouting(frontmatterFile) {
  const frontmatter = frontmatterFile.match(/^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  // Conservative: YAML permits indentation, quoted keys, and flow mappings.
  // A false-positive refusal is safer than dropping user routing on replace.
  return frontmatter !== undefined && /\b(?:model|variant|steps)\b["']?[ \t]*:/.test(frontmatter)
}

async function apply(target, changes) {
  await mkdir(target, { recursive: true })
  const directories = new Set()
  for (const { path } of changes) {
    const parts = path.split("/")
    for (let index = 1; index < parts.length; index++) directories.add(parts.slice(0, index).join("/"))
  }
  for (const directory of directories) {
    await mkdir(join(target, directory), { recursive: true })
  }
  for (const change of changes) {
    const path = join(target, change.path)
    if (change.status === "create") {
      await writeFile(path, change.after, { flag: "wx" })
      continue
    }
    if (await kind(path) !== "file" || await readFile(path, "utf8") !== change.before) {
      throw new Error(`Conflict changed during install: ${path}`)
    }
    const backup = `${path}.bak-${Date.now()}-${randomUUID().slice(0, 8)}`
    await copyFile(path, backup, 1)
    await writeFile(path, change.after)
    change.backup = backup
  }
}

async function main() {
  const parsed = options(process.argv.slice(2))
  const bundle = await buildNativeBundle({ developerTestRunner: parsed.developerTestRunner, withDesignKit: parsed.withDesignKit })
  const changes = await inspect(parsed.target, bundle)
  if (parsed.apply && !parsed.replace && changes.some((change) => change.status === "conflict")) {
    throw new Error("Existing native file conflict; review the preview, then pass --apply --replace to back up and replace it.")
  }
  if (parsed.apply && parsed.replace && changes.some((change) => change.status === "conflict" && change.path.startsWith("agents/") && hasUserRouting(change.before))) {
    throw new Error("Existing native role has model, variant, or steps frontmatter; migrate those user-owned fields manually before replacement.")
  }
  if (parsed.apply && changes.length) await apply(parsed.target, changes)
  process.stdout.write(`${JSON.stringify({ target: parsed.target, applied: parsed.apply, changes }, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
