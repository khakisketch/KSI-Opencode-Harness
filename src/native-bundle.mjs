import { readFile } from "node:fs/promises"
import { NATIVE_ROLE_NAMES, nativeRoleDefinition } from "./native-roles.mjs"

function frontmatter(definition) {
  const lines = [
    "---",
    `description: ${JSON.stringify(definition.description)}`,
    `mode: ${definition.mode}`,
    `permissions: ${JSON.stringify(definition.permissions)}`,
  ]
  if (definition.hidden) lines.push("hidden: true")
  return `${lines.join("\n")}\n---\n\n${definition.system.trim()}\n`
}

export async function buildNativeBundle(options) {
  if (options !== undefined) throw new Error("buildNativeBundle no longer accepts options: the developerTestRunner variant was removed with Test Runner")
  const bundle = new Map()
  for (const name of NATIVE_ROLE_NAMES) {
    const definition = nativeRoleDefinition(name)
    const prompt = await readFile(new URL(`../templates/agents/${name}.md`, import.meta.url), "utf8")
    bundle.set(`agents/${name}.md`, frontmatter({
      ...definition,
      system: prompt,
    }))
  }
  return bundle
}
