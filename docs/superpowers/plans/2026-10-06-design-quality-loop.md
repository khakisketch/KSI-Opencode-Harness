# Design-quality loop — designer-like OpenDesign usage

Updated: 2026-10-06
Status: in progress
Owner: OpenCode Build

## Approved outcome (user 2026-10-06)

"나머지 모두 개선해줘" — implement the design-pipeline improvements discussed
after the user reported that direct OpenDesign use produces much better quality
than the OpenCode-driven one-shot flow:

1. Skill chain: each design run selects the task-appropriate skill from the
   actually installed OpenDesign skill list (generation → polish → review).
2. Evaluation: OpenCode evaluates the rendered result itself (screenshots,
   references, brand/quality bar) and produces a concrete defect list.
3. Refinement loop: concrete refinement runs until the bar is met — **no fixed
   round cap** (user explicitly rejected an arbitrary cap); stop when met or a
   full round shows no measurable improvement, then report remaining gaps.
4. Engine: keep `codex` temporarily (no Claude subscription yet); revisit later.

## Scope and workspace

- Global AGENTS.md (design bullet + Korean design section + retry wording),
  docs/integrations/opendesign.md, examples ×2, README.md, notifier message
  source + tests, and the previously installed pinned notifier runtime copy
  (local update, verified; no service restart).
- No product repositories, design generation, push/npm, dependencies, mounts,
  credentials, model/permission changes. One writer, current checkout, main,
  base 5d763f4.
- Global policy backup `design-loop-20261006.ou3d1yte`; six config/role hashes.
- Previously installed runtime: version 0.2.0, commit 61984160…

## Checklist

- [x] Notifier message + tests (RED→GREEN).
- [x] Global/guide/examples/README guidance.
- [x] Full checks + independent review/test-runner.
- [x] Commit; pinned notifier runtime update + verify; closeout.

## Closeout

- Implementation committed `aefd698`; pinned notifier runtime updated to the same
  commit and `--verify` returned `ok:true` (7 files; changed/missing/extra empty).
  No service restart; the running service may keep serving the old copy until
  plugins reload. No push/npm.

## Evidence

- RED/GREEN logs: `/tmp/opencode/ksi-design-loop-notify-{red,green}.log`.
- Full pre-review: check exit0 (129/128 pass/0 fail/1 optional skip), package exit0,
  diff exit0 — `/tmp/opencode/ksi-design-loop-{check,package}.log`.
- Skill names cited in the guide were verified against the daemon's actual
  `list_skills` output on 2026-10-06 (163 skills); the guide instructs adapting
  from the live list if names change.
- Reviewer `ses_ef30b88a3ffeabYpsOqPCQIhMK` (read-only): no Critical/Important;
  four relaxations consistent across EN/KO, retry-vs-refinement contradiction
  resolved, gates/one-writer untouched, notifier stays advisory, six hashes
  match, runtime still old. Minor fixes: "measurable" defined in the guide
  (done); engine pin kept in global policy only, not in the shipped generic
  guide (ruling: environment-specific value belongs in global policy/ledger).
- Test-runner `ses_ef30a9d57ffe39gWzcqWm7P6OM`: check exit0 (129/128/0/1),
  package exit0, diff exit0, targeted notify 10/10; six hashes match; global
  diff = exactly the four intended semantic edits; installed runtime confirmed
  old (`0.2.0`, commit 61984160…). Logs
  `/tmp/opencode/ksi-design-loop-final-{check,package,diff,notify}.log`.

## First real pilot — agency-home (2026-10-06)

- Pipeline: od-next strategy v2.0.4 (plan → execute; runs `cafd8f8a` → `549c4884`),
  agent codex, skill `frontend-design`. Plan stage produced no files; execute
  stage produced the real source edits.
- Result: `features/agency-ui.js` + `styles/theme.css` (+201/−19) — stats as one
  value-first summary band with dividers, section heads, divider-based dense
  lists (card chrome removed), heading rule, button hover/active/touch states,
  900/600px responsive incl. 2×2 mobile stats. Commit `5f7b92f` on
  feat/eventouch-visual-system; data/routing/copy/brand tokens preserved.
- Verification: rendered at 1440×900 and 390×844 (before/after captures at
  `/tmp/opencode/evdesign-{before-desktop,before-mobile,agency-desktop,agency-mobile}.png`);
  console clean except the static-server `/api/health` 404 (absent server API,
  not a regression); the 준비 view still renders.
- Interpretation: `no_artifact` + strategy outcome "blocked
  (od_next_canonical_deliverable_invalid)" are expected here — the canonical
  HTML entry is intentionally untouched for source-direct edits; evidence is the
  actual source diff plus the render check.
- Status: representative-screen review pending with the user (single review per
  the review-once flow). Rollout to remaining screens only after approval.
- Leftover: pipeline materials `.od-frames/` (untracked) remain in the repo;
  clean up on request.

## Verification limits

- Prose/interpretation and message-text tests only. Real design quality awaits
  the first real loop (pilot target still open: KSI-CCTV is connected; the
  EVENTOUCH source project is no longer registered and needs reconnection).
  No product acceptance or deployment claim.
