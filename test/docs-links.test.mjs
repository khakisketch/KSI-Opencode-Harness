// Check local documentation links, not npm package contents. Anchors are not checked.
import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir, stat } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))

async function expand(entry) {
  const absolute = resolve(root, entry)
  if (!(await stat(absolute)).isDirectory()) return [entry]
  const files = []
  for (const child of await readdir(absolute, { withFileTypes: true })) {
    const childEntry = `${entry}/${child.name}`
    files.push(...(child.isDirectory() ? await expand(childEntry) : [childEntry]))
  }
  return files
}

const documents = (await Promise.all(["README.md", "docs", "examples"].map(expand)))
  .flat().filter(file => file.endsWith(".md"))

test("relative documentation links resolve inside the repository", async () => {
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
      try { await stat(absolute) } catch { dangling.push(`${document} -> ${target}`) }
    }
  }
  assert.deepEqual(dangling, [], `broken documentation links:\n${dangling.join("\n")}`)
})
