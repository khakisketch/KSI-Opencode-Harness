#!/usr/bin/env node
import {
  buildContinuityInjection,
  readContinuityContext,
  readProductStateSlice,
} from "../src/continuity-context.mjs"

async function readStdin() {
  if (process.stdin.isTTY) return ""
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString("utf8")
}

try {
  const raw = await readStdin()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = null
  }
  // Valid hook JSON uses its cwd; malformed/missing stdin falls back to
  // process.cwd(). A missing checkpoint still yields empty output with
  // exit 0; output stays within the shared bound.
  const cwd = payload && typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd()
  const [checkpoint, product] = await Promise.all([
    readContinuityContext(cwd).catch(() => null),
    readProductStateSlice(cwd).catch(() => null),
  ])
  // The shared builder keeps the combined total within the unified
  // injection bound with an explicit marker when the product part must be
  // clipped, dropped, or reported unavailable. A missing product file stays
  // silent; malformed/oversized/unreadable product state emits a bounded
  // marker line instead. Silent otherwise.
  const additionalContext = buildContinuityInjection({ checkpoint, product })
  if (additionalContext) {
    const output = `${JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    })}\n`
    process.stdout.write(output)
  }
} catch {
  // Session-start injection is best-effort; never fail the session.
}
process.exit(0)
