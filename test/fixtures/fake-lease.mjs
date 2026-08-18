#!/usr/bin/env node
const [profile, nonce] = process.argv.slice(2)

function emit(type, extra = {}) {
  process.stdout.write(`${JSON.stringify({ type, profile, nonce, ...extra })}\n`)
}

emit("acquiring")
emit("ready")

let released = false
process.stdin.on("data", (chunk) => {
  if (chunk.toString().includes("release") && !released) {
    released = true
    emit("restoring")
    if (profile === "recovery-fail") {
      emit("recovery-required")
      process.exit(0)
    }
    emit("restored", { ok: true })
    process.exit(0)
  }
})
process.stdin.on("end", () => {
  if (!released) {
    released = true
    emit("restoring")
    emit("restored", { ok: true })
    process.exit(0)
  }
})
