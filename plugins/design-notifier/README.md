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
- Polls the local OpenDesign daemon (`GET /api/runs/:id`, default 60 s) through
  an **elected poller**: every location instance captures its own sessions'
  runs, but a state-lock lease (`leader.json`) elects one instance to poll and
  deliver, so the daemon is not queried per location. Overlapping ticks during
  a slow-tick lease handover are possible and are fenced by the delivery claim.
- **Wake permission is per session.** An unpaused session receives the
  completion with automatic wake (`resume:true`, `delivery:queue`). A paused
  session is not contacted at all: the terminal result is stored as `held` in
  notifier state. After `resume`, it becomes eligible for auto wake on poll ticks
  once existing delivery retry delays and any remaining pause switches permit it.
- Recovers across restarts: state lives on disk; a lost `start_run` response is
  reconciled by `clientRequestId` (`GET /api/runs?projectId=`) for up to 24 h —
  it never starts a replacement run.
- Failure modes: `deliverableValid:false` output is reported as unverified, a
  deleted session is orphaned (never delivered to another session), a vanished
  run is marked `missing`, and duplicates are prevented by a delivery claim
  under the state lock plus a deterministic `msg_...` id (OpenCode's synthetic
  endpoint returns the original admission for a repeated id — verified
  2026-10-03).
- Any verified UI output points the receiving agent at design-owned rendered
  review/refinement, regardless of the canonical artifact verdict. Small visual
  fixes are design-owned too; OpenCode coordinates and checks evidence/functionality.
  Report-only/intermediate stages are not UI output or authority for a new run.
  The advice pins the OD-usage loop: observable acceptance criteria and verified
  input access before commissioning, a required review run (review skill distinct
  from the generator) fed with actual rendered states (target viewports plus
  empty/error/loading) and confirmed to have read them, and a concrete defect list
  (what/where/user impact/desired result) tracked fixed/open — never a good/bad
  verdict. Record the skill selected per stage. For an existing-screen redesign or
  vague dissatisfaction report, run a read-only design audit first and use its
  defect list as the redesign's problem statement; for a new or ambiguous direction,
  get 2-3 lightweight direction options and a user pick before full implementation
  (skip options when the direction is already approved). Metadata `designQuality: "not_assessed"` is advisory, never a computed
  quality pass. No-improvement rounds mean quality unmet; no fixed round cap is
  imposed. Delivery/classification is unchanged; pinned copies need a verified update.
- Strategy chains are followed: when a terminal run maps a follow-up run
  (`strategyTask.terminal === false` + `nextRunId`), that completion is worded
  as intermediate ("not the final completion") and the follow-up is watched for
  the same session until the chain ends. A mapped run not yet visible on the
  daemon stays tracked within a 10-minute grace window instead of being parked
  as `missing`.
- Artifact verdict and product completion are separate: source notification
  metadata adds `productVerification: required|blocked`. An untouched HTML entry
  is not an automatic product failure/success; Build verifies actual source diff,
  build and changed flow. The internal-tool visual-system representative review
  remains a user gate before rollout. No classification/transport/retry behavior
  is changed; an installed pinned copy needs an explicit verified update.

## Policy

| Situation | Behavior |
| --- | --- |
| Waiting, session idle | queue delivery + auto wake (`resume:true`) |
| Session busy | `delivery:"queue"` — does not interrupt the current turn |
| Session paused | completion stored as `held`; session untouched until `resume` |
| Resume with held completions | eligible for auto wake on poll ticks after existing retry delays; remaining pause switches still apply (`retryAfterMs` in list) |
| Target session deleted | marked `orphaned`; no cross-session delivery, no new agent |
| Run missing on daemon | marked `missing`; kept for diagnosis, no delivery |
| Plan-mode session | wakes, but the message requires analysis/report only |
| Design output invalid | message forbids claiming a deliverable; no auto retry |

Pausing is explicit: `design_runs pause` pauses the calling session,
`design_runs pause` with `scope:"all"` pauses every session. The plugin does not
observe the goal plugin's pause state.

## Files

- `index.js` — plugin entry (`setup`), tool registration, delivery adapter.
- `lib/notifier.js` — binding capture, leader coordination, polling, delivery
  policy, recovery.
- `lib/daemon.js` — read-only daemon client (`/api/runs`).
- `lib/messages.js` — classification and the notification text.
- `lib/state.js` — durable JSON state (atomic writes, lock, leader lease, log
  rotation).

## State

Default directory: `~/.local/state/opencode-design-notifier/`

- `bindings.json` — records keyed `req:<requestId>` or
  `run:<runId>@<sessionID>`; states: `requested`, `tracking`, `held`,
  `delivered`, `orphaned`, `missing`, `unresolved`. `held` records are not
  TTL-reaped: they are stored results waiting for wake permission.
- `paused.json` — `{ "ses_...": {at} }` per-session pauses and/or
  `{ "*": {at} }` global pause.
- `leader.json` — single-poller lease `{ instanceId, at }` (60 s TTL, renewed
  every ≤20 s, released on clean unload).
- `events.log` — bounded JSONL diagnostics; never stores prompts or content.

Environment overrides: `KSI_DESIGN_NOTIFIER_STATE_DIR`,
`KSI_DESIGN_NOTIFIER_DAEMON_URL`, `KSI_DESIGN_NOTIFIER_POLL_MS`,
`KSI_DESIGN_NOTIFIER_TOOL_PREFIX`. Plugin options: `{ stateDir, daemonUrl,
pollMs, quickPollMs, initialDelayMs, toolNamePrefix, instanceLabel,
renewEveryMs, leaseTtlMs }`. The default state directory honors
`XDG_STATE_HOME` and `HOME`.

## `design_runs` tool

- `list` — tracked/held runs, pause state for the calling session, poller
  leadership, observed tool names.
- `watch` — bind an existing run to the calling session (recovery path when
  the automatic binding was lost; a run+session that was already notified is
  not re-notified).
- `pause` / `resume` — wake permission for the calling session
  (`scope:"all"` for every session).

## Install (pinned runtime)

The runtime should not load the live development tree. Copy a verified revision
into the global OpenCode config directory and let discovery load it:

```sh
node scripts/install-design-notifier.mjs            # install/update the pinned copy
node scripts/install-design-notifier.mjs --verify   # compare the copy to its manifest
node scripts/install-design-notifier.mjs --uninstall
```

The copy lands in `~/.config/opencode/plugins/design-notifier/` with an
`installed.json` manifest (source commit + SHA256 per file). Remove any
`plugins` config entry that points at the development tree so only the pinned
copy loads; the installer refuses to touch a directory that is not this plugin.

## Limits

- Same-host only: the OpenCode server process must reach the daemon gateway
  (default `http://127.0.0.1:7456`).
- Notifications are pull-based; without a delivery error or remaining pause,
  expect up to one poll cycle (default 60 s) after a run finishes or `resume`.
  Failed deliveries use exponential retry delays capped at 15 min; pause/resume
  preserves that protective delay. `design_runs list` exposes `deliveryAttempts`,
  `deliveryNextAttemptAt` and the remaining `retryAfterMs`, not a delivery guarantee.
  A capture in a non-leader location is picked up by the leader's next cycle.
- If the OpenCode server is stopped entirely, deliveries happen after it
  restarts (state is durable). A crashed leader is replaced after its lease
  expires (≤60 s) or immediately on clean unload.
- A pause that lands while a delivery is already in flight takes effect on the
  next tick; a post-claim re-check narrows but does not eliminate this window.
- `paused` is the explicit stop switch; goal-pause state and Plan mode
  restrictions are not observed (Plan remains restricted natively).
- Automatic binding requires the MCP server tool name to contain the configured
  prefix (default `opendesign`). If your server uses a different prefix, set
  `toolNamePrefix` or use `design_runs watch`; `design_runs list` shows
  `observedTools` to diagnose what the hooks actually see.
- The plugin does not produce approval records; the gated direction check
  (new visual direction, client deliverable, out-of-scope) stays a
  conversation-level decision, while default-path changes proceed to
  implementation and a result report.
