# design-notifier (OpenCode V2 plugin)

Delivers OpenDesign run completion to the OpenCode session that asked for the
run, so the user does not have to poll or ask again. The notification is
advisory: the receiving agent verifies the run and reports to the user; the
plugin never claims success, never retries generation and never implements.

## What it does

- Records `{requestId → sessionID}` when a session calls
  `opendesign_start_run`, before the response can be lost.
- Attaches the returned run id (`execute.after`) and re-keys the record to
  `run:<runId>@<sessionID>`.
- Polls the local OpenDesign daemon (`GET /api/runs/:id`, default 60 s) and
  admits exactly one session notification per run on a terminal status
  (`succeeded` / `failed` / `canceled`).
- Recovers across restarts: state lives on disk; a lost `start_run` response is
  reconciled by `clientRequestId` (`GET /api/runs?projectId=`) for up to 24 h —
  it never starts a replacement run.
- Handles the previous failure modes: `deliverableValid:false` output is
  reported as unverified, a terminal question is relayed for the agent to
  surface, a deleted session is orphaned (never delivered to another session),
  and duplicate notifications are suppressed by a deterministic `msg_...` id.

## Policy

| Situation | Behavior |
| --- | --- |
| Waiting, session idle | queue delivery + auto wake (`resume:true`) |
| Session busy | `delivery:"queue"` — does not interrupt the current turn |
| Notifier paused | message is admitted without auto execution (`resume:false`) |
| Target session deleted | marked `orphaned`; no cross-session delivery, no new agent |
| Plan-mode session | wakes, but the message requires analysis/report only |
| Design output invalid | message forbids claiming a deliverable; no auto retry |

## Files

- `index.js` — plugin entry (`setup`), tool registration, delivery adapter.
- `lib/notifier.js` — binding capture, polling, delivery policy, recovery.
- `lib/daemon.js` — read-only daemon client (`/api/runs`).
- `lib/messages.js` — classification and the notification text.
- `lib/state.js` — durable JSON state (atomic writes, lock, log rotation).

## State

Default directory: `~/.local/state/opencode-design-notifier/`

- `bindings.json` — records keyed `req:<requestId>` or
  `run:<runId>@<sessionID>`; states: `requested`, `tracking`, `delivered`,
  `orphaned`, `unresolved`.
- `paused` — presence pauses automatic wake deliveries.
- `events.log` — bounded JSONL diagnostics; never stores prompts or content.

Environment overrides: `KSI_DESIGN_NOTIFIER_STATE_DIR`,
`KSI_DESIGN_NOTIFIER_DAEMON_URL`, `KSI_DESIGN_NOTIFIER_POLL_MS`.
Plugin options: `{ stateDir, daemonUrl, pollMs }`.

## `design_runs` tool

- `list` — tracked runs, pause state, state directory.
- `watch` — bind an existing run to the calling session (recovery path when
  the automatic binding was lost; also usable to re-notify a session).
- `pause` / `resume` — control automatic wake deliveries globally.

## Activation

Add the plugin directory to the global plugin list and let OpenCode reload:

```jsonc
{
  "plugins": [
    "/path/to/ksi-opencode-harness/plugins/design-notifier"
  ]
}
```

## Limits

- Same-host only: the OpenCode server process must reach the daemon gateway
  (default `http://127.0.0.1:7456`).
- Notifications are pull-based (poll interval); expect up to one poll cycle of
  latency after a run finishes.
- If the OpenCode server is stopped entirely, deliveries happen after it
  restarts (state is durable).
- The notifier does not know about goal-pause state or workspace policy; use
  `paused` for an explicit stop, and Plan mode remains restricted natively.
