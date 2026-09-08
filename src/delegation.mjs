const TERMINAL_TASK_STATES = new Set(["completed", "error"])

function ancestryFailure(detail) {
  return new Error(`KSI: Developer Test Runner assistance requires authoritative session ancestry from a fresh root Build dispatch; ${detail}.`)
}

export function createDeveloperTestRunnerGuard({ client, callers }) {
  const activeCalls = new Map()
  const helperCalls = new Map()

  function activeCallID(sessionID) {
    return activeCalls.get(sessionID)
  }

  function isActive(sessionID) {
    return activeCalls.has(sessionID)
  }

  function releaseActiveCall({ sessionID, callID }) {
    if (activeCalls.get(sessionID) !== callID) return false
    activeCalls.delete(sessionID)
    return true
  }

  function rememberHelperCall({ sessionID, callID }) {
    let calls = helperCalls.get(sessionID)
    if (!calls) {
      calls = new Set()
      helperCalls.set(sessionID, calls)
    }
    calls.add(callID)
  }

  function forgetHelperCall({ sessionID, callID }) {
    const calls = helperCalls.get(sessionID)
    if (!calls?.delete(callID)) return false
    if (calls.size === 0) helperCalls.delete(sessionID)
    return true
  }

  async function getSession(id) {
    if (!client?.session?.get) throw ancestryFailure("the official SDK client is unavailable")
    let response
    try {
      response = await client.session.get({ path: { id } })
    } catch {
      throw ancestryFailure("the official SDK session lookup failed")
    }
    if (!response?.data || response.data.id !== id) {
      throw ancestryFailure("the official SDK returned no session data")
    }
    return response.data
  }

  async function verifyRootBuildChild(sessionID) {
    const child = await getSession(sessionID)
    if (typeof child.parentID !== "string" || !child.parentID) {
      throw ancestryFailure("the caller is not a direct child session")
    }
    const parent = await getSession(child.parentID)
    if (parent.parentID || callers.get(parent.id) !== "build") {
      throw ancestryFailure("the caller parent is not a current root Build session")
    }
  }

  async function acquire({ sessionID, callID }) {
    if (activeCalls.has(sessionID)) {
      throw new Error(`KSI: Developer Test Runner helper is already active for session ${sessionID}; wait for its terminal result or request a fresh Primary dispatch.`)
    }
    activeCalls.set(sessionID, callID)
    try {
      await verifyRootBuildChild(sessionID)
      rememberHelperCall({ sessionID, callID })
    } catch (error) {
      releaseActiveCall({ sessionID, callID })
      throw error
    }
  }

  function releaseAfter({ sessionID, callID }) {
    const knownHelper = forgetHelperCall({ sessionID, callID })
    releaseActiveCall({ sessionID, callID })
    return knownHelper
  }

  function releaseTerminal({ sessionID, callID, status }) {
    if (!TERMINAL_TASK_STATES.has(status)) return false
    return releaseActiveCall({ sessionID, callID })
  }

  function releaseSession(sessionID) {
    const callID = activeCalls.get(sessionID)
    if (callID) releaseActiveCall({ sessionID, callID })
    return helperCalls.delete(sessionID) || Boolean(callID)
  }

  function dispose() {
    activeCalls.clear()
    helperCalls.clear()
  }

  return { acquire, activeCallID, isActive, releaseAfter, releaseTerminal, releaseSession, dispose }
}
