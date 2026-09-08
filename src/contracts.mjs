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

function failure(message) {
  const error = new Error(`Developer task contract rejected: ${message}`)
  error.code = "KSI_DEVELOPER_CONTRACT"
  throw error
}

function promptFor(args) {
  const prompt = typeof args?.prompt === "string" ? args.prompt : ""
  if (!prompt.trim()) failure("a nonempty prompt is required")
  if (Buffer.byteLength(prompt, "utf8") > MAX_PROMPT_BYTES) failure("task prompt exceeds the 12 KiB limit")
  return prompt
}

export function validateDeveloperTaskContract(args) {
  const prompt = promptFor(args)
  if (typeof args?.task_id === "string" && args.task_id.trim()) {
    if (!hasSection(prompt, "Failure") && !hasSection(prompt, "Failing command")) {
      failure("repair requests require `Failure:` or `Failing command:` evidence")
    }
    if (!hasSection(prompt, "Evidence")) failure("repair requests require `Evidence:`")
    return
  }
  const missing = IMPLEMENTATION_SECTIONS.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`missing required section(s): ${missing.join(", ")}`)
}

export function validateReadTaskContract(role, args) {
  const prompt = promptFor(args)
  const labels = role === "explore" ? ["Objective", "Scope"]
    : role === "test-runner" ? ["Objective", "Commands", "Scope"]
    : ["Objective", "Scope", "Evidence"]
  const missing = labels.filter((label) => !hasSection(prompt, label))
  if (missing.length) failure(`${role} requires ${missing.join(", ")}`)
}
