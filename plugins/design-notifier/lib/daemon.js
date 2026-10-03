// Read-only client for the local OpenDesign daemon HTTP API.
//
// The daemon exposes run status on the host-side gateway (default
// http://127.0.0.1:7456). This module performs reads only: it never starts,
// cancels, resumes or mutates a design run.

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled"]);

export function isValidRunId(value) {
  return typeof value === "string" && (UUID_RE.test(value) || ULID_RE.test(value));
}

export function createDaemon({ baseUrl, timeoutMs = 10000, fetchImpl } = {}) {
  const base = String(baseUrl || "http://127.0.0.1:7456").replace(/\/+$/, "");
  const doFetch = fetchImpl ?? globalThis.fetch;

  async function getJson(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(`${base}${path}`, {
        method: "GET",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        const error = new Error(`daemon responded ${response.status} for ${path}`);
        error.status = response.status;
        try {
          error.body = String(await response.text()).slice(0, 300);
        } catch {}
        throw error;
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getRun(runId) {
    if (!isValidRunId(runId)) throw new Error(`invalid run id: ${String(runId).slice(0, 80)}`);
    return getJson(`/api/runs/${encodeURIComponent(runId)}`);
  }

  // List runs, optionally scoped to a project. The daemon returns the full
  // run records; callers match on `clientRequestId` themselves.
  async function listRuns({ projectId } = {}) {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    const body = await getJson(`/api/runs${query}`);
    return Array.isArray(body?.runs) ? body.runs : [];
  }

  // Find an existing run for a start request whose response was lost.
  // Matches the daemon's stored `clientRequestId`.
  async function findByRequestId({ requestId, projectId } = {}) {
    if (typeof requestId !== "string" || !requestId) return null;
    const runs = await listRuns({ projectId });
    const matches = runs.filter((run) => run && run.clientRequestId === requestId);
    if (matches.length > 1) {
      matches.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    }
    const match = matches[0];
    if (!match) return null;
    return isValidRunId(match.id) ? match : null;
  }

  return { baseUrl: base, isValidRunId, getRun, listRuns, findByRequestId };
}
