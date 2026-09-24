# Operational evidence consistency — plan ledger

Updated: 2026-09-23. Scope approved by Build; single-writer Developer execution, no helpers/subagents.

## Objective

Improve operational continuity and make routing/verification/failure claims understandable and auditable, docs/state only.

## Allowed write paths

- `docs/superpowers/plans/2026-09-23-operational-evidence.md` (this ledger)
- `docs/superpowers/product-state.md`
- `README.md`
- `docs/architecture.md`
- `docs/troubleshooting.md`
- `docs/verification.md`

## Forbidden shared files

All other paths — especially machine OpenCode config (path redacted), `examples/model-routing.json`, plugin source/runtime, tests, `instructions/harness.md`, and `.opencode/working-state.md` (Build-owned checkpoint; do not touch).

## Baseline (verified 2026-09-23, fresh — not reused)

- Branch: `main`, HEAD: `da8ed9550ea7f13986fbdaa378fb443d25abe4e0`, `git status --short`: clean.
- Prior `main @ da8ed955` observation treated as stale until re-verified above.

## Changes

1. **Ledger (this file):** records approved scope, baseline, and per-file intent.
2. **Product state:** new harness `docs/superpowers/product-state.md`; current slice `Operational evidence consistency` left `in_progress`, linked to this ledger. No user acceptance claimed, slice not marked complete.
3. **README:** qualify the undated `200+ tests` claim with dated/scoped pointer to `docs/verification.md`; clarify `examples/model-routing.json` is an optional, non-enforcing portable sample that may differ from machine-local routing. No model values changed; no machine choices promoted to portable defaults.
4. **Architecture:** tighten the existing routing-sample paragraph (already non-enforcing) so the sample-vs-machine-local distinction is explicit. No model values changed.
5. **Troubleshooting:** add privacy-preserving diagnostics separating (a) plugin/startup or role-load, (b) task permission/contract rejection, (c) child startup/execution, (d) provider/model request failures — each with minimal redacted evidence and fresh-process guidance. No fix claimed for the unresolved generic server error.
6. **Verification:** `docs/verification.md` was an allowed path but intentionally left unchanged in the first implementation pass (history preserved with dates/limits; no new pass claimed). Updated in the 2026-09-23 evidence follow-up below with the dated Test Runner results.

## Acceptance criteria

- Ledger exists at the allowed path for the approved scope.
- Product-state exists with the current slice in progress and ledger link.
- README/architecture state the sample's optional non-enforcing nature without changing model values or porting machine choices.
- README's undated `200+ tests` claim removed or qualified in favor of dated/scoped evidence.
- Troubleshooting distinguishes the four failure classes with redacted evidence and fresh-process guidance.
- Historical verification keeps dates/limits; no user acceptance claimed; slice not complete.
- No runtime/model/provider/MCP/config change, commit, push, install, release, or live/billable call.

## Targeted verification

- `git diff --check` clean.
- New Markdown links manually validated; product-state schema checked against the harness contract.
- Initial pass left independent Test Runner/Reviewer dispatch to Primary; both have since completed — see Final evidence below (this supersedes that deferral for test execution).

## Escalate if

Pre-existing dirty edits overlap a target, the checkout is not the harness repo, or acceptance would require changing model routing/runtime behavior.

## Review repair (2026-09-23, same task)

Failure: independent review (ID redacted) reported three low-severity clarity findings — L1 duplicate failure taxonomies without a mapping (`docs/troubleshooting.md:35-44,57-66`); L2 current slice duplicated in Next slices (`docs/superpowers/product-state.md:18-24`); L3 OpenCode versions 1.18.29 and 1.18.31 co-occurring without distinct-context explanation (`docs/troubleshooting.md:9`, `docs/verification.md:17`, `INSTALL.md:11`).
Evidence: the review report findings above; verified against current worktree files before editing (no dates invented; `INSTALL.md` was read-only and outside repair paths, untouched; `docs/verification.md` was allowed but intentionally unchanged in that pass — see evidence follow-up below).
Changes: troubleshooting gains a triage→evidence mapping paragraph (broad 3 categories route to actionable 4 classes) and a version-context note (1.18.29 = this investigation + compatibility baseline; 1.18.31 in `verification.md` = distinct evidence-tool check; neither proves same-run compatibility); product-state Next slices now `(none)` with no invented candidate while the current slice stays `in_progress`. Slice not marked complete; no acceptance claimed.

## Evidence follow-up (2026-09-23, same task)

Failure: final review (ID redacted) Low-1 — this ledger misstated `docs/verification.md` as outside repair paths (it was allowed; corrected above); Low-2 — README points to `verification.md`, which had no current 2026-09-23 / 222-test entry.
Evidence: independent Test Runner report (ID redacted) on committed HEAD `da8ed9550ea7f13986fbdaa378fb443d25abe4e0` with the 5-path docs/state-only dirty worktree (results quoted verbatim from that report; no full suite rerun here — exact-final-revision rerun left to Primary).
Changes: ledger wording corrected (this file); `docs/verification.md` gains a dated/scoped 2026-09-23 entry recording the 222/222 results with committed-HEAD-vs-dirty-worktree distinction and explicit boundaries (no live/quality/cost/acceptance). Historic counts and compatibility scope preserved.

## Final evidence (2026-09-23, same task)

Failure: final review (ID redacted) L-2 — this ledger still deferred independent Test Runner/Reviewer to Primary; L-4 — README mentioned `npm test` while dated evidence is for `npm run check` (which subsumes it). Both traceability/clarity only, not acceptance blockers.
Evidence (superseded by Evidence reconciliation below; kept for audit trail): independent Test Runner (ID redacted) on committed HEAD `da8ed9550ea7f13986fbdaa378fb443d25abe4e0` with the six-path docs/state-only dirty worktree (`README.md`, `docs/architecture.md`, `docs/troubleshooting.md`, `docs/verification.md`, this ledger, product-state) — results quoted verbatim from that report, no full suite rerun here: `npm run check` 222/222 pass; `npm run check:package`, `npm pack --dry-run` (38 files, 87.2 kB package / 274.3 kB unpacked, no tarball), and `git diff --check` all exit 0; no forbidden paths/live calls. Final review verdict: technically ready for user acceptance review, no High/Medium findings, prior L1/L2/L3 addressed. Known low follow-ups not taken into files here: the `INSTALL.md:66` "권장 mapping" versus optional/no-endorsement wording (outside allowed paths). Note: the `docs/verification.md` entry records the earlier five-path run (86.4 kB / 272.1 kB); the final six-path numbers above live in this ledger because `docs/verification.md` is outside this turn's allowed paths.
Changes: README Proof now names `npm run check` (including its `node --test` suite) as the source of dated/scoped evidence with no separate `npm test` invocation claimed (this file's turn); ledger deferral superseded by the recorded runs above. Acceptance gate: the slice stays `in_progress` per product-state and user end-to-end acceptance remains pending — nothing marked complete. No-live/quality/cost/release boundaries preserved; no committed/clean tree claimed.

## Evidence reconciliation (2026-09-23, same task)

Failure: final review (ID redacted) M-1/L-1 — latest run not durably recorded; L-2 — this ledger still cited the prior report; L-6 — nonblocking `INSTALL.md:66` terminology issue noted in ledger but absent from product-state backlog. No High findings; slice ready for user acceptance viewing once record gaps are addressed.
Evidence: latest independent Test Runner (ID redacted) on committed HEAD `da8ed9550ea7f13986fbdaa378fb443d25abe4e0` with the six-path docs/state-only dirty worktree at its snapshot — quoted verbatim, no suite rerun here: `npm run check` 222/222; `npm run check:package` pass; `npm pack --dry-run` 38 files / 88.0 kB / 276.4 kB / shasum `405ccebbe6e6f7f4400ec7022bf21e3bd17726a6`, no tarball; `git diff --check` pass; no forbidden paths/live calls. This runner preceded this follow-up record patch, so it is the measured pre-record snapshot — NOT bitwise exact for the resulting tree, and no slice acceptance is claimed. Run-size differences across runs (86.4 → 87.2 → 88.0 kB) reflect docs changing after each run. A Primary-dispatched test reruns after this writer stops; its outcome will be reported in chat/ledger only if available, not pretended to predate itself.
Changes: `docs/verification.md` gains the dated follow-up entry above; this ledger's latest-run reference replaced (prior report kept marked superseded for audit trail); product-state Backlog gains the nonblocking `INSTALL.md:66` item. Current slice/milestone unchanged; Next slices stay none; all historical dated evidence preserved. No live/model/quality/cost/user-acceptance claim.

## Human acceptance — slice close (2026-09-24, same workstream)

Scope: valid slice-close boundary explicitly authorized by the user on 2026-09-24 for m02 only; m03 remains in_progress unaccepted and no m03 acceptance is claimed here.
Acceptance: user explicitly accepted m02 Operational evidence consistency in the current conversation on 2026-09-24; no acceptance screen is invented and no visual artifact is claimed.
Preflight: candidate branch `improve/human-centered-workflow-20260923` at committed HEAD `da8ed9550ea7f13986fbdaa378fb443d25abe4e0`; original main keeps its prior 4-modified-plus-2-untracked docs/state work, unchanged by this turn.
Checks in this turn (writer-targeted, product-state/ledger scope): `node --test test/index.test.mjs` pre-edit 67/67 pass, post-edit 66/67 pass, with `git diff --check` clean in both snapshots; the single post-edit failure is the pre-close m02 `in_progress` assertion (`test/index.test.mjs:1260`) requiring a source/test update outside this turn's allowed paths — reported as failure with verification status pending per the slice-close contract; no independent full-suite rerun invented here.
Boundaries: public prerelease `0.4.0-beta.0` stays intended only, not published; no commit, push, merge, tag, npm publish, network, live, or browser action; historical dated entries above are preserved as snapshots and not rewritten as though completed earlier.
