import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { CALLS, ROLES, installAgents, DESIGN_REVIEW_PERMISSION, DESIGN_REVIEW_DENIED_TOOLS } from "./src/agents.mjs"
import { validateDesignTaskContract, validateDeveloperTaskContract, validateReadTaskContract, isDesignTaskReviewPrompt } from "./src/contracts.mjs"
import { createDeveloperTestRunnerGuard } from "./src/delegation.mjs"
import { createRepositoryService } from "./src/repository.mjs"
import { createContinuity } from "./src/continuity.mjs"
import { buildContinuityInjection, findWorktreeRoot, readContinuityContext, readProductStateSlice } from "./src/continuity-context.mjs"
import { createEvidenceTools } from "./src/evidence-tools.mjs"

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

const developerRoles = new Set(["developer"])
const guardedWriterTools = new Set(["edit", "write", "apply_patch", "bash"])

// Prompts backed by files. design-task shares the Design contract prompt.
const PROMPT_FILES = ["explore", "developer", "test-runner", "reviewer", "research", "build"]

function isInsideWorktree(worktree, filePath) {
  if (typeof filePath !== "string" || !filePath || typeof worktree !== "string" || !worktree) return null
  const absolute = isAbsolute(filePath) ? filePath : resolve(worktree, filePath)
  const location = relative(worktree, absolute)
  if (!location || location === ".." || location.startsWith(`..${sep}`) || isAbsolute(location)) return null
  return location.split(sep).join("/")
}

function isBookkeepingLocation(location) {
  return location === ".opencode" || location.startsWith(".opencode/")
    || location === "docs/superpowers/plans" || location.startsWith("docs/superpowers/plans/")
    || location === "docs/superpowers/product-state.md"
}

function isBookkeepingPath(bookkeepingRoot, filePath) {
  if (typeof filePath !== "string" || !filePath) return false
  if (typeof bookkeepingRoot !== "string" || !bookkeepingRoot) return false
  let location = null
  try {
    location = isInsideWorktree(bookkeepingRoot, filePath)
  } catch {
    return false
  }
  return Boolean(location && isBookkeepingLocation(location))
}

function prependPrompt(output, note) {
  if (output?.args && typeof output.args.prompt === "string" && note) {
    output.args.prompt = `${note}\n\n${output.args.prompt}`
  }
}

export default async ({ client, directory, worktree } = {}, options) => {
  const { developerTestRunner } = pluginOptions(options)
  const designPrompt = await readFile(new URL("./agents/design.md", import.meta.url), "utf8")
  const prompts = Object.fromEntries(await Promise.all(PROMPT_FILES.map(async (name) => [
    name, await readFile(new URL(`./agents/${name}.md`, import.meta.url), "utf8"),
  ])))
  const callers = new Map()
  const designReviewSessions = new Set()
  const continuityInjectedSessions = new Set()
  let bookkeepingRoot = null
  if (typeof directory === "string" && directory) {
    try {
      bookkeepingRoot = await findWorktreeRoot(directory)
    } catch {
      bookkeepingRoot = directory
    }
    if (typeof bookkeepingRoot !== "string" || !bookkeepingRoot) bookkeepingRoot = directory
  } else if (typeof worktree === "string" && worktree) {
    bookkeepingRoot = worktree
  } else {
    bookkeepingRoot = null
  }
  for (const tool of DESIGN_REVIEW_DENIED_TOOLS) {
    const denied = tool === "edit"
      ? DESIGN_REVIEW_PERMISSION.edit?.["*"] === "deny"
      : (DESIGN_REVIEW_PERMISSION[tool] ?? DESIGN_REVIEW_PERMISSION["*"]) === "deny"
    if (!denied) {
      throw new Error(`KSI: design-task review denial drifted for tool ${tool}; mirror DESIGN_REVIEW_DENIED_TOOLS from DESIGN_REVIEW_PERMISSION.`)
    }
  }
  const designReviewDeniedTools = new Set(DESIGN_REVIEW_DENIED_TOOLS)
  const helperGuard = createDeveloperTestRunnerGuard({ client, callers })
  const repository = typeof bookkeepingRoot === "string" && bookkeepingRoot ? createRepositoryService({ worktree: bookkeepingRoot }) : null
  const continuity = createContinuity({ worktree: bookkeepingRoot, repository })
  const evidenceTools = createEvidenceTools({ worktree: bookkeepingRoot, repository, continuity })
  // Shared best-effort reader for the combined continuity block (checkpoint
  // plus product slice, kept within the unified injection bound by the shared
  // builder). Returns the combined string, or null when there is nothing to
  // inject (missing checkpoint and silent/missing product). Never throws.
  const readCombinedBlock = async () => {
    let snapshot = null
    try {
      snapshot = await readContinuityContext(bookkeepingRoot)
    } catch {
      // Checkpoint injection is best-effort; the product block below still stands.
      snapshot = null
    }
    let product = null
    try {
      product = await readProductStateSlice(bookkeepingRoot)
    } catch {
      // Product-state injection is best-effort; the checkpoint above already stands.
      product = null
    }
    // A missing product file stays silent while a
    // malformed/oversized/unreadable one emits a bounded marker line.
    try {
      return buildContinuityInjection({ checkpoint: snapshot, product })
    } catch {
      return null
    }
  }
  let effectiveSubagentDepth
  return {
    tool: evidenceTools,
    config(config) {
      if (developerTestRunner && config.subagent_depth === undefined) config.subagent_depth = 2
      effectiveSubagentDepth = config.subagent_depth
      config.instructions ??= []
      if (!config.instructions.includes(instructionPath)) config.instructions.push(instructionPath)
      installAgents(config, prompts, { developerTestRunner, designPrompt, directory, worktree, bookkeepingRoot })
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
        designReviewSessions.delete(sessionID)
        continuityInjectedSessions.delete(sessionID)
        continuity.forgetSession(sessionID)
        if (developerRoles.has(role)) helperGuard.releaseSession(sessionID)
      }
      if (event.type === "session.compacted") {
        try {
          continuity.markCompacted(event.properties?.info?.id)
        } catch {
          continuity.markCompacted()
        }
        // Re-arm continuity injection (both the message path and the
        // system-transform fallback) so the next request re-injects
        // the (post-compaction) block; presence after compaction matters.
        try {
          const compactedID = event.properties?.info?.id
          if (typeof compactedID === "string" && compactedID) {
            continuityInjectedSessions.delete(compactedID)
          }
        } catch {
          // Re-arm is best-effort; both paths still dedupe per session.
        }
      }
      if (event.type === "message.part.updated") {
        const part = event.properties.part
        if (part?.type === "tool" && part.tool === "task") {
          helperGuard.releaseTerminal({ sessionID: part.sessionID, callID: part.callID, status: part.state.status })
        }
      }
    },
    // Continuity injection never creates parts. Raw part pushes on
    // "chat.message" are forbidden here: output parts are full Part objects
    // with schema-required fields (id, sessionID, messageID, time) and
    // OpenCode's part sync aggregates by sessionID, so pushing a bare
    // `{ type: "text", text }` part crashes child session creation
    // ("Expected string aggregate field sessionID"). The primary path below
    // only mutates the text of an existing part (object identity and all
    // other fields untouched); when no eligible text part exists it does
    // nothing. The experimental.chat.system.transform path (plain strings)
    // remains as a deduped fallback for requests where "chat.message" did
    // not inject. Both paths share continuityInjectedSessions so a session
    // never receives the block twice.
    "chat.message": async (input, output) => {
      try {
        const sessionID = input?.sessionID
        if (!sessionID || typeof bookkeepingRoot !== "string" || !bookkeepingRoot) return
        if (continuityInjectedSessions.has(sessionID)) return
        if (!output || !Array.isArray(output.parts)) return
        let target = null
        for (const part of output.parts) {
          if (part && part.type === "text" && typeof part.text === "string") target = part
        }
        if (!target) return
        const combined = await readCombinedBlock()
        if (!combined) return
        target.text = `${target.text}\n\n${combined}`
        continuityInjectedSessions.add(sessionID)
      } catch {
        // Context injection is best-effort; never block the message.
      }
    },
    "experimental.chat.system.transform": async (input, output) => {
      try {
        const sessionID = input?.sessionID
        if (!sessionID || typeof bookkeepingRoot !== "string" || !bookkeepingRoot) return
        // The message path takes precedence; this transform only fills in
        // when it did not already inject for this session.
        if (continuityInjectedSessions.has(sessionID)) return
        if (!output || !Array.isArray(output.system)) return
        const combined = await readCombinedBlock()
        if (combined) {
          output.system.push(combined)
          continuityInjectedSessions.add(sessionID)
        }
      } catch {
        // Context injection is best-effort; never block the request.
      }
    },
    "experimental.session.compacting": async (_input, output) => {
      try {
        if (output && Array.isArray(output.context)) {
          output.context.push(continuity.compactionContext())
          let snapshot = null
          try {
            if (typeof bookkeepingRoot === "string" && bookkeepingRoot) {
              snapshot = await readContinuityContext(bookkeepingRoot)
            }
          } catch {
            // Checkpoint body is best-effort; the pointers above already stand.
            snapshot = null
          }
          let product = null
          try {
            if (typeof bookkeepingRoot === "string" && bookkeepingRoot) {
              product = await readProductStateSlice(bookkeepingRoot)
            }
          } catch {
            // Product-state body is best-effort; the pointers above already stand.
            product = null
          }
          // The shared builder keeps the combined total within the unified
          // injection bound, as on the system-transform path.
          const combined = buildContinuityInjection({ checkpoint: snapshot, product })
          if (combined) output.context.push(combined)
        }
      } catch {
        // Compaction pointers are best-effort; never block compaction.
      }
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool === "skill" && ["grill-me", "goals"].includes(output.args?.name)) {
        throw new Error("KSI: this shared skill is excluded from OpenCode; its original installation is unchanged.")
      }
      if (guardedWriterTools.has(input.tool) && helperGuard.isActive(input.sessionID)) {
        throw new Error("KSI: a Developer Test Runner helper is active; pause edits and shell use until its terminal result is observed.")
      }
      if (designReviewDeniedTools.has(input.tool) && designReviewSessions.has(input.sessionID)) {
        throw new Error("KSI: design-task review session is read-only under DESIGN_REVIEW_PERMISSION; return VISUAL PASS/FAIL/BLOCKED-no-render without edits.")
      }
      const caller = callers.get(input.sessionID)
      if (caller === "build" && guardedWriterTools.has(input.tool)) {
        const filePath = output.args?.filePath ?? output.args?.path
        if ((input.tool === "edit" || input.tool === "write") && isBookkeepingPath(bookkeepingRoot, filePath)) {
          // Allowed: checkpoint, plan ledger, and scoped execution reports only.
        } else {
          throw new Error("KSI: Build never implements product code. Delegate this change to a Worker with explicit paths and acceptance criteria; Build writes only execution bookkeeping.")
        }
      }
      if (caller === "build" && input.tool === "lsp") {
        throw new Error("KSI: Build uses Explore and Developer evidence for code intelligence; no direct LSP use.")
      }
      if (input.tool !== "task") return
      const target = output.args?.subagent_type
      if (caller === "design" || target === "design") {
        throw new Error(`KSI: task route ${caller ?? "unknown"} -> ${target ?? "unknown"} is not allowed. Design is an independent Primary and does not dispatch tasks in v1.`)
      }
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
      if (typeof target === "string" && target === "developer") validateDeveloperTaskContract(output.args)
      else if (target === "design-task") validateDesignTaskContract(output.args)
      else validateReadTaskContract(target, output.args)
      if (caller === "plan" || caller === "build") {
        const taskId = typeof output.args?.task_id === "string" && output.args.task_id.trim() ? output.args.task_id : null
        if (taskId) {
          const resume = await continuity.checkResume({ parentId: input.sessionID, target, taskId })
          if (!resume.ok) throw new Error(`KSI: ${resume.reason}`)
          if (resume.unverified && repository) prependPrompt(output, `[Continuity: ${resume.note}. Proceed only with the repair evidence already in this prompt.]`)
        }
        const reconciled = await continuity.ensureReconciled({ sessionId: input.sessionID, agent: caller })
        if (reconciled.fresh && reconciled.summary && !reconciled.degraded) {
          prependPrompt(output, `[Continuity reconcile]\n${reconciled.summary}`)
        }
        await continuity.noteDispatch({ parentId: input.sessionID, target })
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "task") return
      const afterTarget = input.args?.subagent_type ?? output.args?.subagent_type
      const afterPrompt = input.args?.prompt ?? output.args?.prompt
      if (afterTarget === "design-task" && isDesignTaskReviewPrompt(afterPrompt)) {
        const reviewChildId = output?.metadata?.sessionId ?? output?.metadata?.session_id
        if (reviewChildId === undefined || reviewChildId === null || String(reviewChildId).trim() === "") {
          throw new Error("KSI: untracked design-task review session: completion metadata has no child session id, so read-only review cannot be enforced; re-dispatch the review.")
        }
        designReviewSessions.add(String(reviewChildId))
      }
      if (helperGuard.releaseAfter({ sessionID: input.sessionID, callID: input.callID })) {
        output.title = `Author-requested Test Runner feedback (not independent acceptance): ${output.title}`
      }
      try {
        if (typeof output?.output === "string") {
          const archived = await continuity.archiveIfLarge({
            sessionId: input.sessionID, callID: input.callID,
            target: input.args?.subagent_type ?? output.args?.subagent_type, text: output.output,
          })
          if (archived.truncated) {
            const pointer = archived.pointer ? `\nFull output archived at: ${archived.pointer}` : "\nFull output could not be archived; this preview may omit uncertainty."
            output.output = `${archived.text}\n\n[Continuity: output exceeded the bounded preview; findings above are a preview, not a success claim.${pointer}]`
          }
        }
      } catch {
        // Archiving is best-effort; the original result stands when it fails.
      }
      try {
        const childId = output?.metadata?.sessionId ?? output?.metadata?.session_id
        if (childId) {
          await continuity.noteResult({
            parentId: input.sessionID, childId: String(childId),
            target: input.args?.subagent_type ?? output.args?.subagent_type,
            fingerprint: output?.metadata?.fingerprint, state: "completed",
          })
        }
      } catch {
        // Registry writes are best-effort recovery evidence.
      }
    },
    dispose: async () => { helperGuard.dispose() },
  }
}
