# Design completion notifier — workstream ledger

Updated: 2026-10-03
Owner: OpenCode Build (this session)
Status: implementing

## Objective
Close the OpenDesign completion loop for the KSI workflow: when an OpenDesign
run finishes, the *originating OpenCode session* is notified automatically
instead of relying on the user to ask again. Delivery is an advisory
notification; verification and implementation decisions stay with the OpenCode
agent and the user.

## Approved scope (user request 2026-10-03: "아무튼 너가 말한 대로 개선을 해줘")
- Durable run↔session binding recorded before the start response can be lost.
- Completion detection with a polling fallback (no new generation, no retry).
- Delivery into the original session via the native session synthetic inbox
  (`delivery: queue`; `resume: false` while paused).
- Restart/compaction recovery from durable state, duplicate suppression by
  deterministic message id and per-(run, session) binding key.
- Policy: paused → hold without auto-execution; Plan mode → report only;
  deleted session → orphaned (never deliver elsewhere, never spawn an agent).
- No new orchestrator: a single local OpenCode V2 plugin, no second primary,
  no automatic design generation, no npm publication, no Cloud.

## Non-goals
- Regenerating or retrying any design run automatically.
- Cross-machine delivery; the daemon and OpenCode server must be reachable on
  this host (default `http://127.0.0.1:7456`).
- Replacing native background subagent notifications or goal state.
- Packaging in the npm tarball (repo-only component for now; revisit on a
  distribution decision).

## Design summary
Component: `plugins/design-notifier/` (V2 plugin, pure JS ESM, no deps).
- `setup(ctx)` registers `ctx.tool.hook("execute.before"/"execute.after")`,
  a `design_runs` tool (list/watch/pause/resume), and a poller.
- Binding capture: `execute.before` records `{requestId, sessionID, ...}` for
  `opendesign_start_run`; `execute.after` parses the run id and re-keys the
  binding to `run:<runId>@<sessionID>`.
- Lost response: bindings without a run id are reconciled via
  `GET /api/runs?projectId=` matching `clientRequestId`; give up to
  `unresolved` after 24h (no blind retry).
- Polling: default 60s (configurable), per-run status via
  `GET /api/runs/:id`; terminal = succeeded|failed|canceled.
- Delivery: `ctx.session.synthetic` with a policy message built from the run's
  `deliverableValid/deliverableValidation/failure*` fields; deterministic
  `msg_...` id; one delivery per (run, session).
- State: `~/.local/state/opencode-design-notifier/` (`bindings.json`,
  `paused`, `events.log`); env override `KSI_DESIGN_NOTIFIER_STATE_DIR`.

## Verification plan
1. Unit/integration tests under `test/` with fake store/daemon/deliver:
   binding capture, lost-response recovery, dedup, restart recovery, pause,
   session-deleted orphan, parse failures (RED→GREEN where practical).
2. `npm run check` and `node scripts/check-package.mjs` unchanged and green.
3. Live activation (after private config backup): plugin loaded, hook observed
   for a read-only opendesign tool call, E2E delivery to a scratch session
   using an existing terminal run, dedup re-check. No new generation run.
4. Independent reviewer pass on plugin code before closeout.

## Evidence log
- Implementation: `plugins/design-notifier/` (index + state/daemon/messages/notifier
  libs, package.json, README), tests `test/design-notifier-{state,messages,notifier,plugin}.test.mjs`,
  doc section in `docs/integrations/opendesign.md`, example entry in `opencode.jsonc.example`.
  V2 2.0.22 tool hooks carry `sessionID`/`result` (verified in `@opencode/plugin` types);
  delivery uses `ctx.session.synthetic`; daemon reads use `GET /api/runs/:id` and
  `/api/runs?projectId=` (host gateway, read-only).
- Tests: new suite 23 pass / 0 fail; full `npm run check` 91 pass / 0 fail / 1 opt-in skip
  (`/tmp/opencode/ksi-design-notifier-check.log`).
- (pending) live activation evidence and independent review.
