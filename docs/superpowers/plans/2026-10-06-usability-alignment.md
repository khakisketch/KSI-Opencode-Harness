# Usability alignment Implementation Plan

Updated: 2026-10-06
Status: technically complete locally; runtime adoption and human real-use acceptance separate

> **For agentic workers:** Use executing-plans inline; one whole-change reviewer and independent final test-runner. Checklist below is the workstream ledger.

**Goal:** Reduce repeated instructions, misleading completion reports and unnecessary workspace changes through the six improvements approved by the user (“개선해줘”).

**Architecture:** Keep the native session/tool mechanisms and existing notifier. Separate execution/HTML verdict from product verification; extend read-only reporting with current Git/record consistency and local readiness. Reuse existing product-state/ledger for project bindings and native tools for pause/resume.

**Tech Stack:** Node.js ESM, node:test, Git, Markdown guidance; no dependencies.

**Spec:** Approved six-item proposal in this conversation, summarized in Scope below.

## Global Constraints

- No new orchestrator, automatic install, generation, credentials access, model/permission changes, product changes, push or publication.
- No blanket entry-verdict success exception. Source-direct output always requires actual diff/build/changed-flow verification by Build.
- Preserve native prompts and model selections. Existing installed notifier is not automatically replaced; runtime update is separately reported.
- One location, one writer: current clean main checkout; base/integration target `ea8b514`. No parallel source writers or isolation need, so no new branch/worktree.
- Global policy backup `usability-20261006.xkbczbo8`; six config/role hashes protected.

## Scope

1. Resolve current-checkout versus blanket-isolation contradiction in global and shipped guidance.
2. Notifier: unverified entry verdict is not product failure; retain daemon verdict and describe source verification and representative-review boundary.
3. Read-only report: show recorded work, record/Git inconsistencies, pending human/external decisions; unavailable sources must not look empty. Unlimited goals are informational, not an arbitrary failure warning.
4. Reuse a compact Product binding table in existing product-state/ledger; no user copy-paste between sessions required for common policy updates.
5. Explicit pause maps to goal + notifier switches in the calling session through native tools, never canceling a running design task implicitly. Resume preserves mode restrictions and never invents a goal.
6. Read-only local preparation inspection: role/policy/binding/runtime presence, no credentials/config values/network/command execution; file presence is not effective/live readiness.

## Review Focus

- Failed/canceled runs stay failures, even with an untouched entry.
- Unknown/invalid outputs must never be called successful product work or trigger regeneration automatically.
- Missing/malformed state or non-Git folders yield unknown/warnings, not fabricated completion.
- Stored binding commands/URLs are data only, never executed/fetched by readiness checks.
- Pauses/resumes remain explicit, session-scoped, native-mode-aware and distinct from external run cancellation.

## Task 1: Notification semantics

Files: `plugins/design-notifier/lib/messages.js`, `test/design-notifier-messages.test.mjs`, notifier README and integration guide.
Interface: keep `classifyRun()` daemon-artifact classifications for compatibility; `buildDelivery()` adds advisory product-verification semantics, no new states or retries.
- [x] Write tests: nonvalid successful run is verification-required, failed stays failed, representative review and pause checks included in receiving-agent contract.
- [x] Run `node --test test/design-notifier-messages.test.mjs` and observe intended failures.
- [x] Implement truthful notifications without changing transport, IDs or daemon classifications; rerun tests.

## Task 2: Status reporting

Files: new `scripts/work-status.mjs`, `scripts/work-report.mjs`, `test/work-report.test.mjs`, new `test/work-status.test.mjs`.
Interface: `inspectWorkStatus(repo)` returns recorded status, branch/HEAD, ledger reference, consistency warnings and next actions; `work-report --status` skips usage/goal state reads and prints compact local status.
- [x] Write tests for stale HEAD/unfinished ledger, missing/non-Git input, no invented acceptance and unlimited informational limits.
- [x] Run `node --test test/work-report.test.mjs test/work-status.test.mjs` RED.
- [x] Implement read-only status and unavailable-source warnings; run targeted checks GREEN.

## Task 3: Local preparation and reusable binding

Files: new `scripts/work-doctor.mjs`, new `test/work-doctor.test.mjs`, execution guide, README.
Interface: `inspectReadiness({repo,configDir,frontend})` returns local check states and needs-setup/unverified summary; source-only CLI `node scripts/work-doctor.mjs --repo PATH [--config PATH] [--frontend] [--json]`. No network or config contents.
- [x] Write fixture tests for absent roles/policy, complete local setup still not live-verified, malformed/mismatched binding, read-only behavior and CLI flags.
- [x] Run `node --test test/work-doctor.test.mjs` RED.
- [x] Implement narrow local checks; document Product binding reuse and native pause/resume mapping.

## Task 4: Guidance, records and closeout

Files: global `AGENTS.md`, examples, execution/integration guides, README, current product-state/checkpoint, previous review-once ledger.
- [x] Resolve isolation wording; add compact reusable-binding and native pause/resume guidance. Do not modify upstream skills.
- [x] Reconcile prior review-once integration/verification evidence and current active work; retain dated history as superseded, not current policy.
- [x] Whole-change reviewer; repair actionable findings with RED→GREEN where code changes.
- [x] Independent test-runner: `npm run check`, `npm run check:package`, `git diff --check`, controlled CLI fixtures, six hash preservation.
- [x] Task-owned local commits only; refresh idle checkpoint. No push/npm/runtime installation.

## Evidence / Progress

- Planning: previous investigation reproduced entry_not_touched classification and unlimited warning; confirmed live notifier matches source. Rule contradiction and stale closeout read from actual files.
- Pre-flight: report consumes status from Task 2; doctor reads only existing product binding/record metadata, never writes it. No other shared implementation interfaces.
- Ruling: implement all six within existing mechanisms; pause and cross-session continuity are operating guidance, not a new orchestration API. Local readiness cannot prove live effectiveness; report unverified even when all files are present.
- RED→GREEN logs: `/tmp/opencode/ksi-usability-{notification,status,doctor,report-extra,input}-{red,green}.log`. Targeted regressions cover untouched-entry execution, failed execution, review/pause contract, stale/missing/escaped records, malformed state shape, repository mismatch/absence and CLI invalid input.
- Full pre-review suite at ea8b514 + pending task changes: `npm run check` exit 0,129 tests/128 pass/0 fail/1 optional Docker skip; `/tmp/opencode/ksi-usability-pre-review.log`. Actual source CLI --status and doctor ran; no readiness claim.
- Independent reviewer `ses_ef32c965affeBEChx1X4LgjN3f`: no Critical/Important findings; exactly three intended global policy hunks and six protected hashes verified read-only. No product/runtime/visual acceptance inferred.
- Final: minor (deferred): M1 notifier's terminal-only productVerification two-value contract differs from report's unknown state for nonterminal input; actual delivery is terminal-gated and no completion is inferred.
- Final: minor (deferred): M2 additional binding placeholders (N/A/none/null) are not normalized as absent; all-present checks still remain live-unverified. Extend on demonstrated use, not an invented readiness claim.
- Final: Ruling: review's unexercised live runtime/catalog/product/browser/visual behavior is not verified by this task — those surfaces are unchanged or outside local source checks; runtime adoption/real-use acceptance stay explicit follow-ups — cost if wrong: deployment behavior may require further validation before delivery.
- Independent test-runner `ses_ef32a4baeffe4tsUBw0A2JSqG0` on main ea8b514 +17 task paths: `npm run check` exit0 (129/128 pass/0 fail/1 optional skip), `npm run check:package` exit0, `git diff --check` exit0; all fixture categories included. Six config/role hashes match; global diff exactly three intended hunks. Installed notifier messages remain byte-identical to ea8b514 baseline (no runtime update).
- Source CLI status/doctor JSON exit0; actual HEAD/recorded-active matched, pending acceptance/local-ahead delivery separated, all-present doctor still unverified. Independent strace doctor check: no child exec/network calls. Evidence `/tmp/opencode/ksi-usability-final-{check,package,diff}.log`, `ksi-usability-final-{status,doctor}.json`, `ksi-usability-final-doctor-strace.log`.
- Local implementation committed as `f57f211` on main. No workspace created/moved/merged or removed; four unrelated worktrees preserved. Closeout updates only this ledger/product-state; checkpoint remains private/uncommitted. Current global policy is applied, notifier source changes are not installed, GitHub/npm unchanged. Native pause orchestration is guidance, not a newly enforced/atomic API; no actual task/goal pause was performed.
