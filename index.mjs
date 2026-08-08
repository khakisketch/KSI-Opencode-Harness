import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"

import { installAgents } from "./src/agents.mjs"
import { selectRoute } from "./src/router.mjs"

const instructionPath = fileURLToPath(new URL("./instructions/harness.md", import.meta.url))

async function loadPrompts() {
  const entries = await Promise.all(
    ["explore", "test-runner", "reviewer", "risk-analyst"].map(async (name) => [
      name,
      await readFile(new URL(`./agents/${name}.md`, import.meta.url), "utf8"),
    ]),
  )
  return Object.fromEntries(entries)
}

export default async () => {
  const prompts = await loadPrompts()

  return {
    config(config) {
      config.instructions ??= []
      if (!config.instructions.includes(instructionPath)) config.instructions.push(instructionPath)
      installAgents(config, prompts)
    },
    "chat.message": async (input, output) => {
      const route = selectRoute({ model: input.model, agent: input.agent, parts: output.parts })
      if (!route) return

      if (route.agent) output.message.agent = route.agent
      output.message.model = {
        providerID: route.providerID,
        modelID: route.modelID,
        variant: route.variant,
      }

      if (process.env.KSI_HARNESS_DEBUG === "1") {
        console.error(
          `[ksi-harness] agent=${input.agent}${route.agent ? `->${route.agent}` : ""} model=${route.modelID} effort=${route.variant} reason=${route.reason.join(",")}`,
        )
      }
    },
  }
}
