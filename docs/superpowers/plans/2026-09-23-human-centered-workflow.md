# Human-Centered Workflow Slice — Plan Ledger (public sanitized summary)

Status: in_progress (in-progress user-approved work, no completion claimed)
Date: 2026-09-23 to 2026-09-24
Branch: `improve/human-centered-workflow-20260923` from `da8ed9550ea7f13986fbdaa378fb443d25abe4e0`
Product state: `docs/superpowers/product-state.md`
Private full ledger: archived locally only (not in public source); this file is the public summary.

> m02 Operational evidence consistency was accepted by the user on 2026-09-24 at the authorized slice-close boundary and is recorded done; this ledger does not merge, release, or accept m03.

## Objective

Implement outcome-first Build communication plus Design Primary live-preview collaboration with narrow authorization, in an isolated worktree that preserves original main's uncommitted docs. Role and permission runtime behavior changed as documented in prompts, permissions, packaging gates, and tests.

## Human-visible acceptance (end-to-end, pending user check — not claimed)

- Build reports headline what a user can do/see, what is incomplete, and the next product result, with only genuinely necessary decisions and tests/review as supporting evidence; failed checks stay headline blockers.
- Design collaborates via a human-openable localhost live prototype/story URL showing baseline vs revision, with interactive inspection plus desktop/mobile PNGs where authorized; server/tool consent stays separate from visual approval and production acceptance.
- Plan, Design, and Build read as peer user-selected Primaries with bounded workers; no approval is inferred from source.

## Scope (public summary)

- Outcome-first Build wording plus Plan-use wording; failed Test Runner/Reviewer checks as headline blockers.
- Design live-preview collaboration wording with deliberate approval and inspected-evidence guards retained.
- Peer Plan/Design/Build diagram and role wording in README and architecture docs.
- Design Primary foundation: small ambiguity-aware brief, project design-system entrypoint template, live preview plus iteration plus accessibility/interaction/visual critique, honest handoff. No new subagents beyond the approved hidden critic.
- Narrow Design delegation: Design Primary may dispatch exactly two local read-only children — explore and new hidden design-critic — with single-line artifact/version plus desktop/mobile PNG evidence. No Research/external child, no developer, no recursion, no Design as target.
- Build design-task role removed; post-approval integrated fidelity is checked by Reviewer visual-fidelity mode with no code writes.
- Permission fail-closed hardening for Design and critic paths (scoped preview, read/skill, secret-boundary, malformed-value handling) as conservative validators; no OS sandbox or secret-isolation claim.
- Public tarball boundary: `package.json files` ships exactly eight public docs; `docs/superpowers/**` (product-state, ledgers, specs) is excluded from the npm tarball and stays source-checkout only.
- Product-state records m01 done, m02 done (accepted 2026-09-24), and m03 in_progress. No m03 slice close claimed.

## Actual decisions preserved

- Isolated worktree/branch used; original main dirty work preserved and never deleted manually.
- Prior README routing/proof, architecture sample, troubleshooting classes, verification dated entries, and m02 ledger integrated additively; no silent overwrite of m02/m03 history.
- Portable model-routing sample keeps five explicit entries with no extra entries and no forced mapping claim; hidden design-critic stays unpinned and inherits native selection unless the user pins it.
- Critic evidence is single-line with artifact/version plus two workspace-relative PNG claims (desktop plus mobile, each with a directory prefix); placeholders, absolute paths, traversal, single-PNG, and duplicate evidence lines are rejected with specific errors. Accepted strings are claims, never proof of existence, inspection, or approval.
- Hook backstop denies critic writer/shell/task and external/network/MCP use by child caller identity; native read-only permissions stay the primary guard with timing uncertainty stated, not as an unconditional dual-enforcement claim.
- A user-authorized reversible local experiment briefly pointed global sessions at the uncommitted candidate worktree (paths redacted); revert is one config line plus a full process restart. Local experiment only — not release or slice acceptance.
- New upstream revisions are pinned only after source review and compatibility checks; KSI contains no fork or copy of official upstream Superpowers.

## Executed checks (dated, commands plus counts; writer-targeted unless noted)

- 2026-09-23 foundation: `node --test test/design.test.mjs` 36 pass / 0 fail; `npm run check:package` pass; `git diff --check` clean. No live browser/server run; no preview URL or PNG inspection claimed.
- 2026-09-23 hardening: independent Test Runner on pre-repair revision `npm run check` 236/236, check:package pass, pack dry-run contains both new Design docs, diff-check clean; original main paths unchanged.
- 2026-09-23 pre-bookkeeping: independent Test Runner `npm run check` 236/236, check:package pass, pack dry-run 41 files including both new docs, diff-check pass; original main paths unchanged. No exact-final verification claimed after the bookkeeping edit.
- 2026-09-23 delegation: `node --test test/design.test.mjs test/index.test.mjs test/package.test.mjs` 112 pass / 0 fail; `node --test test/design.test.mjs test/contracts.test.mjs test/package.test.mjs` 68 pass / 0 fail; `node --test test/index.test.mjs` 61 pass / 0 fail; `git diff --check` clean.
- 2026-09-23 audit/contract repair: `node --test test/audit-routing.test.mjs test/contracts.test.mjs test/design.test.mjs test/index.test.mjs` 131 pass / 0 fail; `git diff --check` clean; routing-sample diff empty; original main 4 modified plus 2 untracked unchanged.
- 2026-09-23 isolated offline metadata smoke on actual OpenCode 1.18.31 with task-owned temporary home/config pointing only at the candidate file URL (paths redacted): `debug config`, `debug agent design-critic`, and `debug agent design` each exit 0. Config metadata only — not child dispatch, hook lifecycle, PNG inspection, preview, or user acceptance.
- 2026-09-23 post-switch: independent Test Runner on fresh global config `debug config/agent` each exit 0 (metadata only); independent Reviewer severity High notes all global sessions depend on uncommitted code — consciously accepted as reversible local experiment with rollback documented.
- 2026-09-23 design-task removal: `node --test test/design.test.mjs test/index.test.mjs test/contracts.test.mjs test/audit-routing.test.mjs test/package.test.mjs test/goal-federation.test.mjs` 147 pass / 0 fail; `git diff --check` clean; original main 4 modified plus 2 untracked unchanged.
- 2026-09-23 reviewer Mode fail-closed: `node --test test/contracts.test.mjs test/index.test.mjs` 87 pass / 0 fail; `git diff --check` clean.
- 2026-09-23 native pair fail-closed: `node --test test/design.test.mjs` 43 pass / 0 fail; `git diff --check` clean.
- 2026-09-23 tarball boundary: `node --test test/package.test.mjs` 10 pass / 0 fail; `npm run check:package` pass; `npm pack --dry-run` path/size inspection only 37 files including exactly eight public docs under `docs/`, zero internal-state hits; `git diff --check` clean.
- 2026-09-23 permission-scope repair: `node --test test/design.test.mjs` 46 pass / 0 fail; `node --test test/package.test.mjs` 10 pass / 0 fail; `git diff --check` clean.
- 2026-09-24 Design permission hardening: `node --test test/design.test.mjs` 49 pass / 0 fail, then 53 pass / 0 fail after read/skill merge fix, then 55 pass / 0 fail after secret-boundary overlap fix; each with `git diff --check` clean and original main unchanged.
- 2026-09-24 prerelease docs/package gate: `node --test test/package.test.mjs` 11 pass / 0 fail; `npm run check:package` pass; `git diff --check` clean.
- 2026-09-24 manifest plus visual-duplicate repair: `node --test test/package.test.mjs test/contracts.test.mjs test/index.test.mjs` 100 pass / 0 fail; `npm run check:package` pass; `git diff --check` clean; original main 4 modified plus 2 untracked unchanged.
- 2026-09-24 candidate `0.4.0-beta.0` prerelease metadata/docs (provisional, no publication): version bump plus exact version checks, two-independent-plugin install wording, `next`-tag publish gate wording, historical evidence preserved with candidate scope separated; targeted checks only, final full suite/pack/review owned by Primary. At that snapshot neither slice was marked complete (m02 completed later the same day — see Reconciliation below); no Design visual/user acceptance and no published link claimed.
- m02 reference (same workstream family): `npm run check` 222/222 on committed HEAD with docs/state-only dirty worktree; `npm run check:package` pass; `npm pack --dry-run` 38 files with no tarball; `git diff --check` pass.

## Boundaries (not verified here; Primary owns independent tests/review)

- No full suite author run after the final sanitization edit; no commit, push, merge, tag, npm publish, network, live model, browser, or preview/server run in this sanitization turn.
- Live Design visual pilot, PNG inspection, child-dispatch lifecycle, stable commit/pin, source-public disclosure rights/brand approval, and m03 user end-to-end acceptance remain pending human decisions (m02 acceptance recorded 2026-09-24 — see Reconciliation below).
- Tarball-gate pass is not source-public approval; a public Git release still needs human data/classification review before push. No secret-free or legal claim is made.
- Compatibility baseline is OpenCode 1.18.29 and Node >= 20; other OS/versions are unverified until actually tested. CI badge (when present) reflects the published main commit only, not uncommitted changes.
- m02 done (accepted 2026-09-24 — see Reconciliation below); m03 stays in_progress with no slice close, no live/visual approval, and no publication action claimed.
- Candidate `0.4.0-beta.0` is a provisional prerelease preparation only, not a completion or release-success claim; no commit, push, tag, npm publish, or network action in this turn.

## Reconciliation — m02 slice close (2026-09-24)

Scope: valid slice-close boundary explicitly authorized by the user on 2026-09-24 for m02 only; single writer in the candidate, no commit/push and no original-main edits in this turn.
Status: m02 Operational evidence consistency is done (user acceptance 2026-09-24, evidence in the m02 public ledger); m03 human-centered live Design visual flow remains in_progress unaccepted — no m03 acceptance claimed.
Preflight: candidate branch `improve/human-centered-workflow-20260923` at committed HEAD `da8ed9550ea7f13986fbdaa378fb443d25abe4e0`; original main keeps its prior 4-modified-plus-2-untracked docs/state work, unchanged by this turn.
Checks in this turn (writer-targeted, product-state/ledger scope): `node --test test/index.test.mjs` and `git diff --check`; pre-edit snapshot 67/67 pass with diff-check clean; post-edit 66/67 pass with diff-check clean — the single failure pins the pre-close m02 `in_progress` state (`test/index.test.mjs:1260`) and needs a source/test update outside this turn's allowed paths, so verification stays pending for Primary; no full-suite rerun invented here.
Boundaries: public prerelease `0.4.0-beta.0` stays intended only, not published; historical dated entries above are preserved as snapshots and not rewritten as though completed earlier; live Design visual pilot, PNG inspection, and approved artifact remain pending human decisions.

## Public release note — scope-note-only correction (2026-09-24, user-approved exceptional narrow scope)

User-approved factual metadata-only correction: docs scope text plus product-state scope-note line only; Goal, m02/m03 status, Current-slice acceptance, Next, and Backlog unchanged. m03 remains in_progress with no live Design visual/Human acceptance; public beta intent only with npm auth ENEEDAUTH at last preflight; no commit, push, tag, publish, live preview/test success, or release claimed.
