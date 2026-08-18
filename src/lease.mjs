import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"

const SUPERVISOR = fileURLToPath(new URL("../scripts/vllm-lease.sh", import.meta.url))
const READY_TIMEOUT_MS = 25 * 60 * 1000
const RESTORE_TIMEOUT_MS = 25 * 60 * 1000

export const LOCAL_PROVIDER_IDS = new Set(["local", "local-developer"])

export function isLocalProvider(providerID) {
  return LOCAL_PROVIDER_IDS.has(providerID)
}

export function localProfileForAgent(agent, parentProviderID) {
  switch (agent) {
    case "developer":
      return "developer"
    case "reviewer":
      return parentProviderID === "local" ? "fast" : null
    case "risk-analyst":
      if (parentProviderID === "local-developer") return "developer"
      if (parentProviderID === "local") return "fast"
      if (parentProviderID == null) return "fast"
      return null
    default:
      return null
  }
}

export function busyError(detail) {
  const error = new Error(
    `Local GPU busy: another local task holds the vLLM host lease${detail ? ` (${detail})` : ""}. Retry after it completes.`,
  )
  error.code = "KSI_GPU_BUSY"
  return error
}

function restoreError(message) {
  const error = new Error(message ?? "Resident Developer profile restore failed; host may need manual recovery.")
  error.code = "KSI_RESTORE_FAILED"
  return error
}

function terminateChild(child) {
  try {
    child.stdin?.end()
  } catch {}
  try {
    child.stdout?.destroy()
  } catch {}
  try {
    child.stderr?.destroy()
  } catch {}
  try {
    child.kill("SIGKILL")
  } catch {}
}

function trackChild(child) {
  let readyWaiter = null
  let restoredWaiter = null
  const reader = createInterface({ input: child.stdout })

  const settleReady = (value, error) => {
    if (!readyWaiter) return
    const waiter = readyWaiter
    readyWaiter = null
    clearTimeout(waiter.timer)
    error ? waiter.reject(error) : waiter.resolve(value)
  }
  const settleRestored = (value, error) => {
    if (!restoredWaiter) return
    const waiter = restoredWaiter
    restoredWaiter = null
    clearTimeout(waiter.timer)
    error ? waiter.reject(error) : waiter.resolve(value)
  }

  reader.on("line", (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    switch (msg.type) {
      case "ready":
        settleReady({ type: "ready", profile: msg.profile })
        break
      case "busy":
        settleReady(undefined, busyError())
        break
      case "transition-failed":
        settleReady(undefined, new Error(`Local profile transition failed (${msg.profile ?? "?"})`))
        break
      case "restored":
        settleRestored({ type: "restored" })
        break
      case "recovery-required":
        {
          const error = restoreError("Resident Developer profile restore failed; host left fail-closed.")
          settleReady(undefined, error)
          settleRestored(undefined, error)
        }
        break
      default:
        break
    }
  })

  child.on("error", (error) => {
    settleReady(undefined, error)
    settleRestored(undefined, error)
  })
  child.on("exit", (code, signal) => {
    const reason = `Lease supervisor exited (code=${code ?? "none"}, signal=${signal ?? "none"})`
    settleReady(undefined, new Error(reason))
    settleRestored(undefined, new Error(reason))
  })

  return {
    ready(timeout) {
      return new Promise((resolve, reject) => {
        const waiter = { resolve, reject }
        readyWaiter = waiter
        waiter.timer = setTimeout(
          () => settleReady(undefined, new Error("Timed out waiting for local profile readiness")),
          timeout,
        )
      })
    },
    restored(timeout) {
      return new Promise((resolve, reject) => {
        const waiter = { resolve, reject }
        restoredWaiter = waiter
        waiter.timer = setTimeout(
          () => settleRestored(undefined, restoreError("Timed out waiting for resident Developer profile restore")),
          timeout,
        )
      })
    },
  }
}

export class LeaseManager {
  constructor({ supervisorPath = SUPERVISOR, supervisorEnv = {}, maxConcurrent = 2 } = {}) {
    this.supervisorPath = supervisorPath
    this.supervisorEnv = supervisorEnv
    this.maxConcurrent = maxConcurrent
    this.current = null
    this.recoveryError = null
  }

  async acquire({ profile, sessionID, callID }) {
    if (this.recoveryError) throw this.recoveryError
    if (this.current) {
      if (this.current.restoring) await this.current.restorePromise
      if (this.current) {
        const lease = this.current
        if (lease.profile !== profile || lease.sessionID !== sessionID) {
          throw busyError(`profile=${lease.profile} session=${lease.sessionID}`)
        }
        if (lease.callIDs.has(callID)) return lease
        if (lease.callIDs.size >= this.maxConcurrent) {
          throw busyError(`profile=${profile} active=${lease.callIDs.size} max=${this.maxConcurrent}`)
        }
        lease.callIDs.add(callID)
        try {
          await lease.readyPromise
          return lease
        } catch (error) {
          lease.callIDs.delete(callID)
          throw error
        }
      }
    }

    const nonce = randomUUID()
    const child = spawn(this.supervisorPath, [profile, nonce], {
      env: { ...process.env, ...this.supervisorEnv },
      stdio: ["pipe", "pipe", "inherit"],
    })
    const track = trackChild(child)
    const lease = {
      nonce,
      profile,
      sessionID,
      callID,
      callIDs: new Set([callID]),
      childCalls: new Map(),
      child,
      track,
      released: false,
      ready: false,
      restoring: false,
    }

    this.current = lease
    try {
      lease.readyPromise = track.ready(READY_TIMEOUT_MS)
      await lease.readyPromise
      lease.ready = true
      return lease
    } catch (error) {
      if (error?.code === "KSI_RESTORE_FAILED") this.recoveryError = error
      if (this.current === lease) this.current = null
      terminateChild(child)
      throw error
    }
  }

  async release(lease) {
    if (!lease || lease.released || this.current !== lease) return
    lease.released = true
    lease.restoring = true
    const restorePromise = (async () => {
      let failure
      try {
        lease.child.stdin?.write("release\n")
        lease.child.stdin?.end()
        await lease.track.restored(RESTORE_TIMEOUT_MS)
      } catch (error) {
        console.error(`[ksi-harness] resident Developer restore failed: ${error.message}`)
        failure = error
        this.recoveryError = error
      } finally {
        terminateChild(lease.child)
        if (this.current === lease) this.current = null
      }
      if (failure) throw failure
      this.recoveryError = null
    })()
    lease.restorePromise = restorePromise
    await restorePromise
  }

  async releaseCall({ sessionID, callID }) {
    const lease = this.current
    if (!lease || lease.sessionID !== sessionID || !lease.callIDs.has(callID)) return
    lease.callIDs.delete(callID)
    for (const [childSessionID, childCallID] of lease.childCalls) {
      if (childCallID === callID) lease.childCalls.delete(childSessionID)
    }
    if (lease.callIDs.size === 0) await this.release(lease)
  }

  bindChild({ sessionID, callID, childSessionID }) {
    const lease = this.current
    if (!lease || lease.sessionID !== sessionID || !lease.callIDs.has(callID)) return false
    lease.childCalls.set(childSessionID, callID)
    return true
  }

  async releaseChild(childSessionID) {
    const lease = this.current
    const callID = lease?.childCalls.get(childSessionID)
    if (!lease || !callID) return false
    lease.childCalls.delete(childSessionID)
    await this.releaseCall({ sessionID: lease.sessionID, callID })
    return true
  }

  async releaseFor({ sessionID }) {
    const lease = this.current
    if (lease && lease.sessionID === sessionID) await this.release(lease)
  }

  async leaseAllowsSession(sessionID, client) {
    const lease = this.current
    if (!lease) return false
    if (lease.sessionID === sessionID) return true
    if (!client?.session?.get) return false
    try {
      const response = await client.session.get({ path: { id: sessionID } })
      const data = response?.data ?? response
      return !!data?.parentID && data.parentID === lease.sessionID
    } catch {
      return false
    }
  }
}
