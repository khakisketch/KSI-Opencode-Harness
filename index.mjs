import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"

import { installAgents, UNRESTRICTED_PERMISSION } from "./src/agents.mjs"
import { selectRoute } from "./src/router.mjs"
import { LeaseManager, isLocalProvider, localProfileForAgent } from "./src/lease.mjs"

const instructionPath = fileURLToPath(new URL("./instructions/harness.md", import.meta.url))

async function loadPrompts() {
  const entries = await Promise.all(
    ["developer", "explore", "test-runner", "reviewer", "risk-analyst"].map(async (name) => [
      name,
      await readFile(new URL(`./agents/${name}.md`, import.meta.url), "utf8"),
    ]),
  )
  return Object.fromEntries(entries)
}

export default async ({ client, leaseManager } = {}) => {
  const prompts = await loadPrompts()
  const leases = leaseManager ?? new LeaseManager()
  const sessionModels = new Map()

  function parentProviderFor(sessionID) {
    return sessionModels.get(sessionID)?.providerID
  }

  return {
    config(config) {
      config.instructions ??= []
      if (!config.instructions.includes(instructionPath)) config.instructions.push(instructionPath)
      installAgents(config, prompts)
      config.permission = { ...UNRESTRICTED_PERMISSION }
      for (const [name, definition] of Object.entries(config.agent ?? {})) {
        if (name !== "plan") definition.permission = { ...UNRESTRICTED_PERMISSION }
      }
    },
    "chat.message": async (input, output) => {
      const agent = input.agent ?? output.message.agent
      const resolvedModel = input.model ?? output.message.model
      if (resolvedModel && input.sessionID) {
        sessionModels.set(input.sessionID, {
          providerID: resolvedModel.providerID,
          modelID: resolvedModel.modelID,
          variant: input.variant ?? output.message.model?.variant ?? resolvedModel.variant,
        })
      }
      const route = selectRoute({
        model:
          resolvedModel && {
            ...resolvedModel,
            variant: input.variant ?? output.message.model?.variant ?? resolvedModel.variant,
          },
        agent,
        parts: output.parts,
      })
      if (!route) return

      sessionModels.set(input.sessionID, {
        providerID: route.providerID,
        modelID: route.modelID,
        variant: route.variant,
      })

      if (isLocalProvider(route.providerID)) {
        const allowed = await leases.leaseAllowsSession(input.sessionID, client)
        if (!allowed) {
          throw new Error(
            `Local agent "${agent}" is not bound to an active harness lease. Run it through the task tool so the host vLLM profile is acquired safely.`,
          )
        }
      }

      if (route.agent) output.message.agent = route.agent
      const routedModel = {
        providerID: route.providerID,
        modelID: route.modelID,
      }
      if (route.variant) routedModel.variant = route.variant
      output.message.model = routedModel

      if (process.env.KSI_HARNESS_DEBUG === "1") {
        console.error(
          `[ksi-harness] agent=${agent}${route.agent ? `->${route.agent}` : ""} model=${route.modelID} effort=${route.variant} reason=${route.reason.join(",")}`,
        )
      }
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "task") return
      const subagent = output.args?.subagent_type
      if (!subagent) return
      const profile = localProfileForAgent(subagent, parentProviderFor(input.sessionID))
      if (!profile) return
      if (output.args?.background === true) {
        throw new Error(
          `Local background subagent "${subagent}" is not supported; use foreground tasks so Build controls the active wave and the host lease is held safely.`,
        )
      }
      await leases.acquire({ profile, sessionID: input.sessionID, callID: input.callID })
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "task") return
      if (output?.metadata?.background === true && output.metadata.sessionId) {
        leases.bindChild({
          sessionID: input.sessionID,
          callID: input.callID,
          childSessionID: output.metadata.sessionId,
        })
        return
      }
      await leases.releaseCall({ sessionID: input.sessionID, callID: input.callID })
    },
    event: async ({ event }) => {
      if (event.type === "session.created") return
      if (event.type === "session.status") {
        const status = event.properties?.status
        if (status?.type !== "idle") return
        const sid = event.properties?.sessionID
        if (await leases.releaseChild(sid)) return
        const lease = leases.current
        if (lease && lease.sessionID === sid && lease.childCalls.size === 0) {
          try {
            await leases.release(lease)
          } catch {}
        }
      }
    },
    dispose: async () => {
      if (leases.current) {
        try {
          await leases.release(leases.current)
        } catch {}
      }
    },
  }
}
