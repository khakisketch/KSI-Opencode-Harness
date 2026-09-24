export const REVIEWER_VISUAL_MODE = "visual-fidelity"

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

const REVIEWER_MODE_HINT = `Reviewer Mode contract: ordinary code review must not declare \`Mode:\`; for post-approval visual-fidelity declare \`Mode: visual-fidelity\` plus \`Allowed write paths: none\` plus \`Evidence:\` with approved artifact/version plus integration diff/baseline plus TWO workspace-relative PNGs (desktop/1280 and mobile/390). No VLM READ or visual approval is claimed at dispatch; PNG paths are claims.`

const DESIGN_CRITIC_HINT = `Expected contract:
Objective: <goal>
Scope: <bounds>
Evidence: <single-line artifact version plus TWO workspace-relative desktop/mobile PNG captures; paths are claims, not proof of file existence/image READ/visual approval>`

export function contractHint(role, isRepair = false) {
  if (isRepair) return REPAIR_HINT
  if (role === "explore") return EXPLORE_HINT
  if (role === "test-runner") return TEST_RUNNER_HINT
  if (role === "reviewer" || role === "research") return REVIEW_HINT
  if (role === "design-critic") return DESIGN_CRITIC_HINT
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
  if (role === "reviewer" && hasSection(prompt, "Mode")) {
    failure("reviewer ordinary code review must not declare `Mode:`; use `Mode: visual-fidelity` only via the visual-fidelity contract", `${REVIEW_HINT}\n${REVIEWER_MODE_HINT}`)
  }
  const labels = role === "explore" ? ["Objective", "Scope"]
    : role === "test-runner" ? ["Objective", "Commands", "Scope"]
    : ["Objective", "Scope", "Evidence"]
  const missing = labels.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`${role} requires ${missing.join(", ")}`, contractHint(role, false))
}

function sectionValue(prompt, label) {
  const line = prompt.split(/\r?\n/).find((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, label.length + 1).toLowerCase() === `${label.toLowerCase()}:`
  })
  if (!line) return null
  return line.slice(line.indexOf(":") + 1).trim()
}

function designCriticEvidenceLines(prompt) {
  return prompt.split(/\r?\n/).filter((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, "Evidence:".length).toLowerCase() === "evidence:"
  })
}

function designCriticEvidence(prompt, hint) {
  const lines = designCriticEvidenceLines(prompt)
  if (lines.length > 1) {
    failure("design-critic requires a single-line `Evidence:`; multiple Evidence lines are ambiguous", hint)
  }
  const evidence = sectionValue(prompt, "Evidence") ?? ""
  if (/^\s*(none|n\/a|todo|tbd|placeholder|pending|no captures? yet)\.?\s*$/i.test(evidence)) {
    failure("design-critic Evidence must not be placeholder-only; supply actual PNG capture paths with viewport references", hint)
  }
  if (!/artifact/i.test(evidence) || !/(v\d|version)/i.test(evidence)) {
    failure("design-critic requires explicit artifact/version in `Evidence:`", hint)
  }
  const rawTokens = evidence.match(/\S+\.png/gi) ?? []
  const tokens = rawTokens.map((token) => token.replace(/[),;:.!?'"]+$/g, ""))
  if (tokens.length < 2) {
    failure("design-critic requires TWO workspace-relative PNG capture references (desktop and mobile) in single-line `Evidence:`; path strings are claims, not proof of file existence/image READ/visual approval", hint)
  }
  for (const token of tokens) {
    if (/^([/\\]|[A-Za-z]:|\\\\)/.test(token)) {
      failure(`design-critic rejects absolute capture path ${token}; supply workspace-relative PNG claims`, hint)
    }
    if (token.split(/[\\/]/).includes("..")) {
      failure(`design-critic rejects traversal capture path ${token}; supply workspace-relative PNG claims`, hint)
    }
    if (!token.includes("/")) {
      failure(`design-critic requires workspace-relative PNG paths with a directory prefix; bare file ${token} is not accepted and paths are claims, not proof`, hint)
    }
  }
  const lower = tokens.map((token) => token.toLowerCase())
  const hasDesktop = lower.some((token) => token.includes("desktop") || token.includes("1280"))
  const hasMobile = lower.some((token) => token.includes("mobile") || token.includes("390"))
  if (!hasDesktop || !hasMobile) {
    failure("design-critic requires desktop and mobile PNG captures distinguished by desktop/1280 and mobile/390 in `Evidence:`; path strings are claims, not proof", hint)
  }
}

export function validateDesignCriticContract(args) {
  const isRepair = typeof args?.task_id === "string" && args.task_id.trim().length > 0
  const prompt = promptFor(args, contractHint("design-critic", isRepair))
  if (isRepair) {
    if (!hasSection(prompt, "Failure") && !hasSection(prompt, "Failing command")) {
      failure("repair requests require `Failure:` or `Failing command:` evidence", contractHint("design-critic", true))
    }
    if (!hasSection(prompt, "Evidence")) failure("repair requests require `Evidence:`", contractHint("design-critic", true))
    designCriticEvidence(prompt, contractHint("design-critic", true))
    return
  }
  const missing = ["Objective", "Scope", "Evidence"].filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`design-critic requires ${missing.join(", ")}`, contractHint("design-critic", false))
  designCriticEvidence(prompt, contractHint("design-critic", false))
}

export function isReviewerVisualPrompt(prompt) {
  if (typeof prompt !== "string") return false
  const mode = sectionValue(prompt, "Mode")
  return mode !== null && mode.toLowerCase() === REVIEWER_VISUAL_MODE
}

function reviewerVisualEvidence(prompt, hint) {
  const evidenceLines = prompt.split(/\r?\n/).filter((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, "Evidence:".length).toLowerCase() === "evidence:"
  })
  if (evidenceLines.length > 1) {
    failure("reviewer visual-fidelity requires a single `Evidence:` line; duplicate Evidence lines are ambiguous", `${hint}\n${REVIEWER_MODE_HINT}`)
  }
  const evidence = sectionValue(prompt, "Evidence") ?? ""
  if (!evidence.trim()) {
    failure("reviewer visual-fidelity requests require `Evidence:` with approved artifact/version plus integration diff/baseline plus TWO PNGs", `${hint}\n${REVIEWER_MODE_HINT}`)
  }
  if (!/artifact/i.test(evidence) || !/(v\d|version)/i.test(evidence)) {
    failure("reviewer visual-fidelity requires explicit approved artifact/version in `Evidence:`", hint)
  }
  if (!/diff|baseline/i.test(evidence)) {
    failure("reviewer visual-fidelity requires the integration diff/baseline in `Evidence:`", hint)
  }
  const rawTokens = evidence.match(/\S+\.png/gi) ?? []
  const tokens = rawTokens.map((token) => token.replace(/[),;:.!?'"]+$/g, ""))
  if (tokens.length < 2) {
    failure("reviewer visual-fidelity requires TWO workspace-relative PNG capture references (desktop and mobile) in `Evidence:`", hint)
  }
  for (const token of tokens) {
    if (/^([/\\]|[A-Za-z]:|\\\\)/.test(token)) {
      failure(`reviewer visual-fidelity rejects absolute capture path ${token}; supply workspace-relative PNG claims`, hint)
    }
    if (token.split(/[\\/]/).includes("..")) {
      failure(`reviewer visual-fidelity rejects traversal capture path ${token}; supply workspace-relative PNG claims`, hint)
    }
    if (!token.includes("/")) {
      failure(`reviewer visual-fidelity requires workspace-relative PNG paths with a directory prefix; bare file ${token} is not accepted`, hint)
    }
  }
  const lower = tokens.map((token) => token.toLowerCase())
  const hasDesktop = lower.some((token) => token.includes("desktop") || token.includes("1280"))
  const hasMobile = lower.some((token) => token.includes("mobile") || token.includes("390"))
  if (!hasDesktop || !hasMobile) {
    failure("reviewer visual-fidelity requires desktop and mobile PNG captures distinguished by desktop/1280 and mobile/390 in `Evidence:`", hint)
  }
}

function reviewerVisualMarker(prompt, hint, isRepair) {
  const modes = prompt.split(/\r?\n/).filter((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, "Mode:".length).toLowerCase() === "mode:"
  })
  if (modes.length > 1) {
    failure("reviewer visual-fidelity requires a single `Mode:` line; duplicate Mode lines are ambiguous", hint)
  }
  const mode = sectionValue(prompt, "Mode")
  if (mode === null || mode.toLowerCase() !== REVIEWER_VISUAL_MODE) {
    failure("reviewer visual-fidelity requests must declare `Mode: visual-fidelity`; ordinary code review must not declare `Mode:`", hint)
  }
  const paths = sectionValue(prompt, "Allowed write paths")
  if (paths === null || !paths.trim()) {
    failure("reviewer visual-fidelity requests require `Allowed write paths: none`", `${hint}\n${REVIEWER_MODE_HINT}`)
  }
  const pathLines = prompt.split(/\r?\n/).filter((candidate) => {
    const text = candidate.trimStart()
    return text.slice(0, "Allowed write paths:".length).toLowerCase() === "allowed write paths:"
  })
  if (pathLines.length > 1) {
    failure("reviewer visual-fidelity requires a single `Allowed write paths:` line; duplicate Allowed write paths lines are ambiguous", `${hint}\n${REVIEWER_MODE_HINT}`)
  }
  if (paths.toLowerCase() !== "none") {
    failure("reviewer visual-fidelity requests require `Allowed write paths: none`", hint)
  }
  if (!hasSection(prompt, "Evidence")) {
    failure("reviewer visual-fidelity requests require `Evidence:` with approved artifact/version plus integration diff/baseline plus TWO PNGs", hint)
  }
  void isRepair
}

export function validateReviewerVisualContract(args) {
  const isRepair = typeof args?.task_id === "string" && args.task_id.trim().length > 0
  const prompt = promptFor(args, contractHint("reviewer", isRepair))
  if (isRepair) {
    if (!hasSection(prompt, "Failure") && !hasSection(prompt, "Failing command")) {
      failure("repair requests require `Failure:` or `Failing command:` evidence", contractHint("reviewer", true))
    }
    if (!hasSection(prompt, "Evidence")) failure("repair requests require `Evidence:`", contractHint("reviewer", true))
    reviewerVisualMarker(prompt, contractHint("reviewer", true), true)
    reviewerVisualEvidence(prompt, contractHint("reviewer", true))
    return
  }
  const missing = ["Objective", "Scope", "Mode", "Allowed write paths", "Evidence"].filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`reviewer visual-fidelity requires ${missing.join(", ")}`, contractHint("reviewer", false))
  reviewerVisualMarker(prompt, contractHint("reviewer", false), false)
  reviewerVisualEvidence(prompt, contractHint("reviewer", false))
}
