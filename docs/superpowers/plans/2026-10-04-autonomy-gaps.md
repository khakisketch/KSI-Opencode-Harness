# Autonomy gaps — workstream ledger

Updated: 2026-10-04
Owner: OpenCode Build
Status: complete (technical)

## Objective (user-directed "나머지 모두 개선해줘")
Close the three remaining pieces from the autonomy synthesis:
1. Cost guard — goals must carry limits; a usage/status summary exists.
2. Completion visibility — goal stops are reported with a fixed contract; one
   consolidated report shows goals, design-run deliveries and usage.
3. Next-task proposal — milestone/closeout reports end with top backlog
   candidates instead of waiting for the user to ask.

## Actions
A. Global `~/.config/opencode/AGENTS.md` (backup `autonomy-gaps-20261004.6b88cd`,
   prior sha256 `03407356…`):
   - Session goals: "Never create an unbounded goal: every goal carries limits,
     and its objective states the stop-report contract (final status, evidence,
     why it stopped, next options)."
   - Autonomous final report: "End every milestone/closeout report with the top
     1–3 next candidates from the product-state backlog (one-line rationale
     each); starting them still requires user authorization."
B. `scripts/work-report.mjs` (new, read-only): consolidated report — goals
   (status/tokens/turns from goals.json), design-run deliveries (notifier
   bindings + pause state, pending first), usage by project and top sessions
   (`session_v2` via read-only sqlite), worktrees + product-state Next slices for
   a given repo. Options: `--repo`, `--days`, `--json`. Unit tests
   `test/work-report.test.mjs` (4) cover section parsing, goal normalization
   (second→millisecond timestamps), binding ordering and token formatting.
C. Deliberately not built: a separate goal-completion watcher/notifier. Goal
   completion happens in-session (the session reports as it finishes) and there
   is no better delivery channel than the session/TUI; the actionable gap was
   silent limit-stops, addressed by limits + the stop-report contract. Revisit
   if a real silent-stop incident appears.

## Verification
- `node --test test/work-report.test.mjs` → 4/4.
- Live report run shows real state: 2 active goals (EVENTOUCH 14-view redesign
  `ses_efe9d3abfffe`; SIP external-runtime bundle `ses_f0e6f0de9ffe`) and one
  design run in flight (`31c01c6a` → EVENTOUCH session), plus usage by project
  and worktree inventory.
- test-runner independent closeout: session `ses_efa73e693ffeK3fg27wvs2a0Q6` ran
  `npm run check` → exit 0, tests 112 / pass 111 / fail 0 / skipped 1 (log
  `/tmp/opencode/ksi-autonomy-testrunner-check.log`).
- AGENTS.md diff reviewed; private backup kept.

## Notes
- The mandatory-limit wording in Objective/Actions/Verification above records the
  original decision, not current policy. Later the same day the user explicitly
  chose generous safety rails, no-progress auto-pause as the primary brake, and
  user-adjustable/removable limits for product-critical work. The stop-report
  contract remains required. No global cap or existing-goal change is implied.
  Reconciled in `2026-10-04-guidance-alignment.md`; retain earlier evidence as history.
- Usage costs only cover metered providers; subscription sessions show tokens
  with cost 0 (tokens remain the primary signal).
- The report is on-demand; the durable "no reminder needed" pieces are the
  closeout next-candidates rule (A) and the goal stop-report contract.
