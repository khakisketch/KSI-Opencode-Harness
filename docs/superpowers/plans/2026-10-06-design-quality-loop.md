# Design-quality loop — designer-like OpenDesign usage

Updated: 2026-10-06
Status: in progress
Owner: OpenCode Build

## Latest disposition (2026-10-06)

User rejected the bold pilot result ("디자인 … 문제 많은데요"). This is not
representative-screen approval, and no wider rollout is authorized. Source writing
and rendering worked; the recorded runs do not demonstrate an autonomous,
criteria-linked design review/refinement loop. The later approved contract routes
all visual analysis/UI edits/rendered review/refinement to the design workspace,
with OpenCode coordinating and checking functional/evidence obligations. See
`2026-10-06-visual-ownership.md`; product refinement stays in the product session.

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

## Pilot 2 — bold editorial direction (2026-10-06, user: "더 과감 혹은 새로")

- Runs `04ed48ea` (plan) → `40a41c17` (execute), skill `frontend-design`.
- Result: warm full-width hero band (`--action` fill, white type, h1 clamp
  34–48px), the live KPI moved out of the summary band into the hero (mono,
  clamp 48–68px, tabular numerals), 3px brand rules above section headings,
  stats band 4→3 columns, inverted primary button inside the band. Copy, data
  and behavior unchanged; mobile stacks the band.
- Mid-run: a full-block CSS patch failed on context; the agent re-read and
  applied smaller patches (no partial corruption) — confirmed by the final diff.
- Verification: rendered at 1440×900 and 390×844; console clean except the
  static `/api/health` 404; captures `evbold-after-{desktop,mobile}.png` vs the
  previous `evdesign-agency-{desktop,mobile}.png`.
- Status: user rejected this result; neither direction is accepted by this record. Committed with
  "style: bold editorial redesign of agency-home".

## Harness learnings (pilot 1, 2026-10-06)

- The notifier delivers only the stage bound to the session; od-next expands one
  request into plan→execute runs, so the follow-up stage must be tracked through
  the run's strategy mapping (a background watcher was used). **Fixed the same
  day:** the notifier now words intermediate stages as non-final and watches the
  mapped follow-up run for the same session until the chain ends (10-minute
  visibility grace); commit `feat: follow strategy chains in design completion
  notifications`; pinned runtime updated.
- Strategy outcome `blocked` (`od_next_canonical_deliverable_invalid`) and
  `no_artifact` are expected for entry-untouched source-direct work; the source
  diff + render check is the evidence (now documented in the guide).
- Skill catalogue vs installed bodies: `design-taste-frontend` / `gpt-taste` are
  landing-page skills ("not dashboards"); the full-body `frontend-design` fits
  product UI. Design-system-required skills ran fine with the repository tokens.
- Pipeline artifacts (`.od-frames/`) land untracked in the project; keep them
  out of product commits (now documented in the guide).

## Verification limits

- Harness guidance/message/interpretation tests and actual source-write/render
  observations are recorded above; they do not prove a design-quality pass. The
  EVENTOUCH source project was re-registered (`aabf3621`), both pilots ran and the
  bold result was rejected. No criteria-linked autonomous design-review/refinement
  loop, product acceptance or deployment is claimed. Pipeline staging directories
  noted as leftovers above were subsequently cleaned; those notes are historical.
