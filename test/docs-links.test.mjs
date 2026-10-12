// Packaged-document link guard: every relative link in a document that ships in
// the npm package must resolve to a file that also ships in the package. This
// catches links to repository-only records (docs/superpowers, integrations/)
// that would dangle for installed consumers. Anchors are not checked here;
// this guard is file-level.
import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"))

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function expand(entry) {
  const absolute = resolve(root, entry)
  if (!(await exists(absolute))) return []
  if (!(await stat(absolute)).isDirectory()) return [entry]
  const files = []
  for (const child of await readdir(absolute, { withFileTypes: true })) {
    const childEntry = `${entry}/${child.name}`
    files.push(...(child.isDirectory() ? await expand(childEntry) : [childEntry]))
  }
  return files
}

const packaged = new Set(["package.json", ...(await Promise.all(manifest.files.map(expand))).flat()])

test("relative links in packaged documents stay inside the packaged file set", async () => {
  const documents = [...packaged].filter((file) => file.endsWith(".md"))
  assert.ok(documents.includes("README.md"), "the packaged set should include README.md")
  const dangling = []
  for (const document of documents) {
    const text = await readFile(join(root, document), "utf8")
    const withoutCode = text.replace(/```[^\n]*\n[\s\S]*?```/g, "")
    for (const match of withoutCode.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
      const target = match[1].trim().split(/\s+/)[0].replace(/^<|>$/g, "")
      if (/^[a-zA-Z][\w+.-]*:/.test(target) || target.startsWith("#")) continue
      const pathPart = target.split("#")[0]
      if (!pathPart) continue
      const absolute = resolve(dirname(join(root, document)), decodeURIComponent(pathPart))
      const escaped = relative(root, absolute)
      if (escaped.startsWith("..") || escaped.split(sep)[0] === "..") {
        dangling.push(`${document} -> ${target} (outside the repository)`)
        continue
      }
      const packagedPath = escaped.split(sep).join("/")
      if (!packaged.has(packagedPath)) dangling.push(`${document} -> ${target}`)
    }
  }
  assert.deepEqual(dangling, [], `packaged documents must only link to packaged files:\n${dangling.join("\n")}`)
})
