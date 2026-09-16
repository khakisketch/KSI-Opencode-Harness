import { DESIGN_TASK_REVIEW_MODE } from "./agents.mjs"

const MAX_PROMPT_BYTES = 12 * 1024
const IMPLEMENTATION_SECTIONS = [
  "Objective", "Allowed write paths", "Forbidden shared files",
  "Acceptance criteria", "Targeted verification", "Escalate if",
]

function hasSection(prompt, label) {
  return prompt.split(/\r?\n/).some((line) => {
    const text = line.trimStart()
    return text.slice(0, label.length + 1).toLowerCase() === `${label.toLowerCase()}:`
      && text.slice(label.length + 1).trim().length > 0
  })
}

function failure(message, hint) {
  const suffix = hint ? `\n${hint}` : ""
  const error = new Error(`Developer task contract rejected: ${message}${suffix}`)
  error.code = "KSI_DEVELOPER_CONTRACT"
  throw error
}

const DEVELOPER_HINT = `Expected contract:
Objective: <goal>
Allowed write paths: <paths>
Forbidden shared files: <paths>
Acceptance criteria: <checks>
Targeted verification: <commands>
Escalate if: <conditions>`

const REPAIR_HINT = `Expected repair contract:
task_id: <resume same task_id>
Failure: <what failed> (or Failing command: <command>)
Evidence: <output, diff, or logs>`

const EXPLORE_HINT = `Expected contract:
Objective: <goal>
Scope: <bounds>`

const TEST_RUNNER_HINT = `Expected contract:
Objective: <goal>
Commands: <commands>
Scope: <cwd, artifacts, side effects>`

const REVIEW_HINT = `Expected contract:
Objective: <goal>
Scope: <bounds>
Evidence: <plan, diff, or sources>`

const DESIGN_TASK_HINT = `Expected contract:
Objective: <goal>
Allowed write paths: <prototype paths, or none for review>
Acceptance criteria: <rendered checks>
Evidence: <artifact version and scope>
Mode: <review, only for read-only review requests>`

export function contractHint(role, isRepair = false) {
  if (isRepair) return REPAIR_HINT
  if (role === "explore") return EXPLORE_HINT
  if (role === "test-runner") return TEST_RUNNER_HINT
  if (role === "reviewer" || role === "research") return REVIEW_HINT
  if (role === "design-task") return DESIGN_TASK_HINT
  return DEVELOPER_HINT
}

function promptFor(args, hint) {
  const prompt = typeof args?.prompt === "string" ? args.prompt : ""
  if (!prompt.trim()) failure("a nonempty prompt is required", hint)
  if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) failure("task prompt exceeds the 12 KiB limit", hint)
  return prompt
}

export function validateDeveloperTaskContract(args) {
  const isRepair = typeof args?.task_id === "string" && args.task_id.trim().length > 0
  const prompt = promptFor(args, contractHint("developer", isRepair))
  if (isRepair) {
    if (!hasSection(prompt, "Failure") && !hasSection(prompt, "Failing command")) {
      failure("repair requests require `Failure:` or `Failing command:` evidence", contractHint("developer", true))
    }
    if (!hasSection(prompt, "Evidence")) failure("repair requests require `Evidence:`", contractHint("developer", true))
    return
  }
  const missing = IMPLEMENTATION_SECTIONS.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`missing required section(s): ${missing.join(", ")}`, contractHint("developer", false))
}

export function validateReadTaskContract(role, args) {
  const prompt = promptFor(args, contractHint(role, false))
  const labels = role === "explore" ? ["Objective", "Scope"]
    : role === "test-runner" ? ["Objective", "Commands", "Scope"]
    : ["Objective", "Scope", "Evidence"]
  const missing = labels.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`${role} requires ${missing.join(", ")}`, contractHint(role, false))
}

const DESIGN_TASK_SECTIONS = ["Objective", "Allowed write paths", "Acceptance criteria", "Evidence"]

function sectionValue(prompt, label) {
  const line = prompt.split(/\r?\n/).find((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, label.length + 1).toLowerCase() === `${label.toLowerCase()}:`
  })
  if (!line) return null
  return line.slice(line.indexOf(":") + 1).trim()
}

export function isDesignTaskReviewPrompt(prompt) {
  if (typeof prompt !== "string") return false
  const mode = sectionValue(prompt, "Mode")
  return mode !== null && mode.toLowerCase() === DESIGN_TASK_REVIEW_MODE
}

export function validateDesignTaskContract(args) {
  const isRepair = typeof args?.task_id === "string" && args.task_id.trim().length > 0
  const prompt = promptFor(args, contractHint("design-task", isRepair))
  if (isRepair) {
    if (!hasSection(prompt, "Failure") && !hasSection(prompt, "Failing command")) {
      failure("repair requests require `Failure:` or `Failing command:` evidence", contractHint("design-task", true))
    }
    if (!hasSection(prompt, "Evidence")) failure("repair requests require `Evidence:`", contractHint("design-task", true))
    const mode = sectionValue(prompt, "Mode")
    if (mode !== null && mode.toLowerCase() !== DESIGN_TASK_REVIEW_MODE) {
      failure("prototype repairs must not declare `Mode:`; only `Mode: review` with `Allowed write paths: none` requests read-only review", contractHint("design-task", true))
    }
    if (mode !== null && mode.toLowerCase() === DESIGN_TASK_REVIEW_MODE) {
      const paths = sectionValue(prompt, "Allowed write paths")
      if (paths !== null && paths.toLowerCase() !== "none") {
        failure("review requests require `Allowed write paths: none` plus `Mode: review`", contractHint("design-task", true))
      }
    }
    return
  }
  if (isDesignTaskReviewPrompt(prompt)) {
    const missing = [...DESIGN_TASK_SECTIONS, "Mode"].filter((label) => !hasSection(prompt, label))
    if (missing.length) failure(`missing required design-task section(s): ${missing.join(", ")}`, contractHint("design-task", false))
    const paths = sectionValue(prompt, "Allowed write paths")
    if (!paths || paths.toLowerCase() !== "none") {
      failure("review requests require `Allowed write paths: none` plus `Mode: review`", contractHint("design-task", false))
    }
    return
  }
  const missing = DESIGN_TASK_SECTIONS.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`missing required design-task section(s): ${missing.join(", ")}`, contractHint("design-task", false))
  const paths = sectionValue(prompt, "Allowed write paths")
  if (paths && paths.toLowerCase() === "none") {
    failure("prototype requests require concrete `Allowed write paths`; use `Mode: review` with `Allowed write paths: none` for read-only review", contractHint("design-task", false))
  }
  const mode = sectionValue(prompt, "Mode")
  if (mode !== null) {
    failure("prototype requests must not declare `Mode:`; only `Mode: review` with `Allowed write paths: none` requests read-only review", contractHint("design-task", false))
  }
}
