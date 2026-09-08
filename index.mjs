import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import { CALLS, ROLES, installAgents } from "./src/agents.mjs"
import { validateDeveloperTaskContract, validateReadTaskContract } from "./src/contracts.mjs"
import { createDeveloperTestRunnerGuard } from "./src/delegation.mjs"

const instructionPath = fileURLToPath(new URL("./instructions/harness.md", import.meta.url))

function pluginOptions(options) {
  if (options === undefined) return { developerTestRunner: false }
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new Error("KSI: plugin options must be an object.")
  }
  for (const key of Object.keys(options)) {
    if (key !== "developerTestRunner") throw new Error(`KSI: unknown plugin option ${key}.`)
  }
  if (Object.hasOwn(options, "developerTestRunner") && typeof options.developerTestRunner !== "boolean") {
    throw new Error("KSI: plugin option developerTestRunner must be a boolean.")
  }
  return { developerTestRunner: options.developerTestRunner ?? false }
}

const developerRoles = new Set(["developer", "developer-complex"])
const guardedWriterTools = new Set(["edit", "write", "apply_patch", "bash"])

export default async ({ client } = {}, options) => {
  const { developerTestRunner } = pluginOptions(options)
  const prompts = Object.fromEntries(await Promise.all(ROLES.map(async (name) => [
    name, await readFile(new URL(`./agents/${name}.md`, import.meta.url), "utf8"),
  ])))
  const callers = new Map()
  const helperGuard = createDeveloperTestRunnerGuard({ client, callers })
  let effectiveSubagentDepth
  return {
    config(config) {
      if (developerTestRunner && config.subagent_depth === undefined) config.subagent_depth = 2
      effectiveSubagentDepth = config.subagent_depth
      config.instructions ??= []
      if (!config.instructions.includes(instructionPath)) config.instructions.push(instructionPath)
      installAgents(config, prompts, { developerTestRunner })
      config.command ??= {}
      config.command.complete ??= {
        agent: "build", description: "Complete approved work with native roles and verification evidence.",
        template: "Complete the approved task under the injected KSI policy.\n\n$ARGUMENTS",
      }
      config.command.review ??= {
        agent: "build", description: "Review actual changes with independent evidence.",
        template: "Review actual changes under the injected KSI policy. Additional review focus:\n\n$ARGUMENTS",
      }
    },
    "chat.params": async (input) => { callers.set(input.sessionID, input.agent) },
    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const sessionID = event.properties.info.id
        const role = callers.get(sessionID)
        callers.delete(sessionID)
        if (developerRoles.has(role)) helperGuard.releaseSession(sessionID)
      }
      if (event.type === "message.part.updated") {
        const part = event.properties.part
        if (part?.type === "tool" && part.tool === "task") {
          helperGuard.releaseTerminal({ sessionID: part.sessionID, callID: part.callID, status: part.state.status })
        }
      }
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool === "skill" && ["grill-me", "goals"].includes(output.args?.name)) {
        throw new Error("KSI: this shared skill is excluded from OpenCode; its original installation is unchanged.")
      }
      if (guardedWriterTools.has(input.tool) && helperGuard.isActive(input.sessionID)) {
        throw new Error("KSI: a Developer Test Runner helper is active; pause edits and shell use until its terminal result is observed.")
      }
      if (input.tool !== "task") return
      const caller = callers.get(input.sessionID)
      const target = output.args?.subagent_type
      const helperCall = developerTestRunner && developerRoles.has(caller) && target === "test-runner"
      if (!helperCall && !CALLS[caller]?.includes(target)) {
        throw new Error(`KSI: task route ${caller ?? "unknown"} -> ${target ?? "unknown"} is not allowed. Only Primary Plan/Build dispatch assigned roles.`)
      }
      if (output.args.background === true) throw new Error("KSI: use foreground native tasks with explicit writer ownership.")
      if (helperCall) {
        validateReadTaskContract("test-runner", output.args)
        if (effectiveSubagentDepth === undefined || effectiveSubagentDepth < 2) {
          throw new Error("KSI: Developer Test Runner assistance requires native subagent_depth of at least 2; set subagent_depth: 2 or remove the explicit lower value.")
        }
        await helperGuard.acquire({ sessionID: input.sessionID, callID: input.callID })
        return
      }
      if (typeof target === "string" && target.startsWith("developer")) validateDeveloperTaskContract(output.args)
      else validateReadTaskContract(target, output.args)
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "task") return
      if (helperGuard.releaseAfter({ sessionID: input.sessionID, callID: input.callID })) {
        output.title = `Author-requested Test Runner feedback (not independent acceptance): ${output.title}`
      }
    },
    dispose: async () => { helperGuard.dispose() },
  }
}
