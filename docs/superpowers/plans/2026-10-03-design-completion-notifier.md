# Design completion notifier — workstream ledger

Updated: 2026-10-03
Owner: OpenCode Build (this session)
Status: technically complete; user real-run acceptance pending

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
- Live activation (private backup
  `/home/ksi/.local/state/ksi-harness-backups/design-notifier-20261003.121883`): global
  `plugins` entry added; plugin loaded (`events.log` setup records). Seven instances exist
  because OpenCode loads the global plugin **per active location** (7 project directories);
  they share the state dir and delivered exactly once in testing. `location` is now recorded
  in the setup log line for diagnosis.
- Hook capture verified live: a read-only `opendesign_list_projects` call appeared in
  `observedTools` (`execute.before` fires for MCP tools, including Code Mode nested calls);
  raw tool names use the `opendesign_start_run` underscore form, which `isStartRunTool`
  matches. Real `start_run` capture remains to be observed on the user's next design run
  (extractRunId matches the verified `ok()` wrapping:
  `content:[{type:"text", text: JSON.stringify(payload)}]`, `payload.id` = run id).
- E2E delivery (scratch session `ses_efeac34dfffeiorYtVo7ruF0n3`, model
  `muse-spark-1.3-contributor#low`; existing terminal runs only, **no new generation**):
  1. paused + run `78da352e…` → admitted with `resume:false`: inbox item present, context
     empty, session cost 0 (no execution).
  2. resumed + run `f64f2576…` → one delivery event with `resume:true`; the idle session
     executed a turn without user input (cost 0.00213, in/out 21079/79) and reported the
     `entry_not_touched`/invalid verdict correctly with no regeneration.
  3. Dedup: exactly two synthetic messages in context, one `delivered` event per run,
     inbox empty afterwards. Evidence: `/tmp/opencode/ksi-design-notifier-e2e.json`.
- Guard preserved: `test/native-package.test.mjs` ("never instructs registering KSI in
  plugins") rejected an example-config mention of the harness plugin path; the example change
  was reverted instead of relaxing the guard, and activation guidance lives only in
  `docs/integrations/opendesign.md` + the plugin README.
- Independent review (`reviewer`, read-only, session `ses_efea9685affeFhcLf5rSzOcnBP`): ran
  23/23 tests; one Critical (multi-instance check-then-deliver race; "exactly one" doc overclaim),
  Important items (watch/re-notify doc contradiction; `orphaned` conflated a daemon-missing run;
  prefix matching undocumented), and minor robustness notes (structured MCP output, corrupt
  non-object JSON, tmp-file cleanup, tick fatal handling, options docs). One-scope fix pass:
  - Delivery claim under the state lock (`store.claimDelivery`, 120 s TTL) → concurrent instances
    cannot both deliver; `store.mutate` now skips the write when nothing changed; tick failures are
    logged (`tick-fatal`); corrupt non-object JSON is preserved; stale temp files are reaped; attach
    without any session id keeps the request record instead of keying `@unknown`.
  - New `missing` state (run absent on the daemon) distinct from `orphaned` (deleted session);
    reap/cap treat both as final.
  - `extractRunId` also reads `structuredContent`/`structuredOutput`; `toolNamePrefix` option/env
    for renamed MCP servers (default `opendesign`), documented with `observedTools` diagnosis.
  - Docs corrected: claim + deterministic id semantics, no "re-notify" claim for `watch`, states and
    options/env lists, prefix limitation.
- Server dedup verified empirically (probe `msg_454415d7…`): posting the same synthetic `id` twice
  returned the original admission and the inbox held exactly one item — the deterministic id makes
  a re-send a session-level no-op even across the claim TTL.
- Post-review suite: notifier tests 26/26; full `npm run check` 94 pass / 0 fail / 1 opt-in skip
  (`/tmp/opencode/ksi-design-notifier-check3.log`).

## Hardening pass 2 (2026-10-03, user approved "그렇게 하자")

Approved direction: keep the thin connector and improve the *safety* of the
structure — (1) session-level wake permission, (2) no lock-less writes and
separated held/delivered states, (3) one poller instead of per-location polling,
(4) a pinned runtime copy instead of point the config at the dev tree, (5) defer
event streams and keep polling.

- Semantic change: **held completions live in notifier state, not in the
  session inbox.** The plugin context exposes no inbox list/cancel API, so a
  paused session is not contacted at all; `resume` delivers held completions
  with auto wake. (Replaces the pass-1 `resume:false` inbox admission.)
- Implementation: `be421d9` (plugin 0.2.0) — `paused.json` per-session/global
  wake permission, `held` state (not TTL-reaped), state-lock leader lease
  (`leader.json`, 60 s TTL, ≤20 s renew, released on unload) with per-instance
  capture and single-poller delivery, `withLock` now fails the write after a
  5 s timeout instead of proceeding unlocked, `scripts/install-design-notifier.mjs`
  (SHA256 manifest, `--verify`, `--uninstall`, refuses non-plugin targets).
- Tests: notifier suite 36/36 (held/resume, per-session isolation, global
  switch, leader gating/takeover/release, lock-timeout failure, legacy pause
  migration, installer); full `npm run check` 104 pass / 0 fail / 1 opt-in skip
  (`/tmp/opencode/ksi-design-notifier-check4.log`).
- Pinned install verified live: manifest commit `be421d9`, 7 files, `--verify`
  ok; global config entry pointing at the repo removed (private backup
  `design-notifier-pin-20261003.821d07`); `opencode plugin list` shows only
  `/home/ksi/.config/opencode/plugins/design-notifier/index.js`; auto-discovery
  of the config-dir plugin copy confirmed.
- Live E2E on the pinned runtime (new scratch session
  `ses_efe919192ffe4GKJ8ivvdT8GFR`, low model; existing terminal run
  `78da352e…`; no new generation): paused → `held` with **cost 0 and inbox 0**
  (inbox observed via `GET /api/session/{id}/inbox`; session untouched) → resume → delivered
  `resume:true wasHeld:true` within one
  leader tick → session executed the turn automatically (cost 0.0021329,
  in/out 21103/82) and reported the invalid verdict correctly; delivered-event
  count stayed 1 across a further tick (dedup). Evidence
  `/tmp/opencode/ksi-design-notifier-hardening.json`. One `leader-claimed` per
  reload batch confirms single-poller election with 7 locations.
- Transition artifact: 7 `tick-fatal: store.isPaused is not a function` entries
  during a mid-edit reload; no errors after the final reload batches.
- Deferred by design: daemon event/SSE subscription (item 5) — polling remains
  the single mechanism until a demonstrated need.
- Not included: approval-hash binding (direction approval stays conversational).
- Known limits: resume latency ≤ one poll cycle; leader takeover ≤ lease TTL
  after a crash; goal-pause state not observed (explicit `paused` only).

## Policy alignment — finish-and-report default (2026-10-03, user-directed)

User approved the clarified flow ("이렇게 개선해봐"): one instruction → brief →
design → implementation → tests → result report without intermediate "shall I?"
gates; the design is shown together with the implemented result; stop only for
external delivery, irreversible/costly actions, and new brand/identity-level
direction (plus client-facing deliverables and explicit "review first"
requests); keep non-dependent work moving while a run or check is pending.

- Global `~/.config/opencode/AGENTS.md` updated after private backup
  (`design-autonomy-20261003.0445ff`, original sha256 `50659393…`): the design
  bullets now default to finishing and reporting with the preview, gate only
  the listed cases, keep non-dependent engineering moving while waiting, and
  state that visual design quality comes from OpenDesign's harness (Build does
  not substitute its own design). "Local Codex" phrasing clarified as
  OpenDesign's local execution mode.
- Notifier message step 3 (`lib/messages.js`) and its test now instruct the
  receiving agent to default to finishing within authorized scope and to stop
  only for new direction / client deliverable / out-of-scope (or an explicit
  user request). Docs aligned: `docs/integrations/opendesign.md`
  (result-interpretation row, handoff approval paragraph, notifier section) and
  plugin README.
- Verification: notifier suite 39/39; full `npm run check` 107 pass / 0 fail /
  1 opt-in skip; pinned copy reinstalled and `--verify` green.
- Post-pass independent review (reviewer session `ses_efe8db196ffeoNuUKM6expruqE`,
  no Critical; tests matched claimed numbers). One-scope fixes: pause re-check
  after the delivery claim (narrows the pause-vs-delivery window; the residual
  window is documented), hook/tool lock-error surfacing (`hook-error`,
  `pause failed: …`), corrupt `paused.json` preserved aside and logged, installer
  staged directory swap and argument guards, docs wording corrected ("elected
  poller", overlap/pause limits). Tests added: concurrent leadership claims
  (exactly one winner), held→tracking regression on a re-activated run, corrupt
  `paused.json`. Suite 39/39; full `npm run check` 107 pass / 0 fail / 1 opt-in
  skip (`/tmp/opencode/ksi-design-notifier-check5.log`).
