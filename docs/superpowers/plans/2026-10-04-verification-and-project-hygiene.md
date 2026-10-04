# Verification & project hygiene — workstream ledger

Updated: 2026-10-04
Owner: OpenCode Build
Status: complete (technical)

## Objective (user-directed: "모델 라우팅 가이드 빼고 모두 개선해줘")
Close the gaps found in the 2026-10-04 usage audit:
1. test-runner independent verification had lapsed (0 uses since 2026-09-25); final checks were
   run by the Primary.
2. EVENTOUCH design runs always validated `entry_missing` — root cause: no declared
   `metadata.entryFile` plus two root HTML files, so entry inference always failed (project-config
   gap, not a prompt/agent bug).
3. Goal mode was never proposed for multi-hour unattended work.
Excluded by the user: model routing guide (subscription vs opencode-go).

## Actions & evidence
A. Verification roles restored — global `~/.config/opencode/AGENTS.md` (private backup
   `workflow-hygiene-20261004.5c56d4`, prior sha256 `a8016a9d…`):
   - Skills: "Final verification of a milestone or closeout is executed by `test-runner`
     (independent run), not the Primary; record the test-runner session id, command and result in
     the ledger. `reviewer` reviews, `developer` implements bounded tasks; use these roles by
     default instead of letting all three collapse into the Primary."
   - Session goals: "For multi-hour or unattended work … propose goal mode with explicit
     turn/token/duration limits …; create or resume the goal only after the user agrees."
B. EVENTOUCH project entry declared: `PATCH /api/projects/eventouch-a82e`
   `metadata.entryFile = "eventouch-operations.html"` (HTTP 200; existing `skipDiscoveryBrief`
   preserved; verified via daemon GET and MCP `get_project`). Future runs validate against the
   canonical entry (`valid` / `entry_not_touched`) instead of always `entry_missing`.
   `docs/integrations/opendesign.md` gained a pre-commissioning entryFile check.
C. Goal proposal rule encoded (see A).
D. Model routing guide — excluded by the user.
E. Connection-test sessions: 26 total, last created 2026-10-01 01:37 KST, none in the last 3 days;
   cleanup remains backlog, no deletion performed.

## Verification (rule A applied on day one)
- First independent run: test-runner session `ses_efa8404ddffe6eHgEw2aoAMO3D` executed
  `npm run check` → exit 0, tests 108 / pass 107 / fail 0 / skipped 1; log
  `/tmp/opencode/ksi-hygiene-testrunner-check.log`.
- EVENTOUCH entry confirmed on both the daemon HTTP API and MCP `get_project`.
- AGENTS.md diff reviewed; private backup kept.

## Limits / follow-ups
- The EVENTOUCH entry change takes full effect on the next real design run; no new run was started
  for verification (generation needs separate approval).
- Connection-test session cleanup remains backlog (E2).
