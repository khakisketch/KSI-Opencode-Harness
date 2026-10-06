# Visual ownership simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all visual frontend work, including rendered design review and refinement, to the design workspace; keep OpenCode responsible for contracts, coordination, functional verification and Git.

**Architecture:** Simplify the existing policy and notifier advice, not add an orchestrator. The notifier preserves daemon verdicts and delivery semantics; UI-quality obligations depend on the verified task/output, not the canonical-entry verdict. Direct product-source UI editing remains preferred, with one writer and a supported artifact handoff when direct access is unavailable.

**Tech Stack:** Existing Markdown guidance, JavaScript notifier, Node.js built-in tests; no new dependencies.

**Spec:** Approved in this conversation: “시각적 작업은 다 … 넘기는” and “그렇게 단순화하면서 개선해줘”. This bounded change implements that in-chat contract; earlier OpenCode-led aesthetic evaluation and small-visual-edit exceptions are superseded.

**Status:** Implemented and verified locally; actual design-quality behavior remains a product-session validation obligation.

## Global Constraints

- Harness-only work. No EVENTOUCH source writes, design runs, product-session mutations, push, deployment or publication.
- Preserve functionality/data/permissions/API contracts; layout, hierarchy, responsive presentation and components may be redesigned within the authorized outcome and brand boundaries.
- Design workspace owns UI source/styles, interaction presentation, rendered analysis/review and concrete refinement, including small CSS/visual fixes. OpenCode does not substitute its own visual fixes.
- OpenCode owns business rules/API/data/auth, functional integration tests, ownership handoff and Git; same-file work is sequential.
- Keep native modes/prompts/models/permissions, goal/pause rules and conditional human direction/representative approval gates intact.
- No new automatic loop, runtime quality classifier or claimed aesthetic score. A stalled round means quality unmet, not success; no fixed refinement-round cap.
- Update existing global policy and pinned notifier copy with backups and verification; no service restart. Guidance is not enforcement or proof of live design quality.

## Review Focus

- An entry-invalid successful source edit must still receive design-review guidance after actual output verification.
- Valid artifact, report-only output and intermediate plan stage must not be mistaken for quality pass or authority to spawn a new run.
- Failed/cancelled/missing-output work must not be upgraded to success or blindly replayed.
- Small visual repair stays design-owned; a nonvisual API/permission/persistence defect stays engineering-owned; shared UI files have one writer.
- User rejection invalidates acceptance, while historical commits/tests remain implementation evidence. Harness completion does not claim repaired product visuals.

## Workspace and evidence

- Primary: current checkout `/home/ksi/Desktop/KSI-Projects/KSI-Opencode-Harness`, branch/target `main`, base `8aa350eecdc69e041fe4e45fb36276aefa5f6901`, initially clean. No isolation needed: one writer; existing unfamiliar worktrees retained.
- Root cause evidence: integration guide previously exempted approved-pattern visual fixes and made coordinating-agent aesthetic review primary; notifier quality advice was gated by artifact-valid verdict (`messages.js` step 3). Pilot ledger recorded generated/rendered changes but no criteria-linked design review/refinement evidence. User rejected the bold result; no acceptance claimed.
- Pre-flight: notifier advice, shipped guide/examples and live global policy must state the same ownership contract. State records must distinguish policy/code verification from real design outcomes.

### Task 1: Notifier output-contract regression

**Files:** `test/design-notifier-messages.test.mjs`, `plugins/design-notifier/lib/messages.js`, `plugins/design-notifier/README.md`.
**Interfaces:** `buildDelivery({run, sessionID, ...})` remains unchanged; advisory metadata adds `designQuality: "not_assessed"` without changing classification, message IDs or wake/delivery behavior.

- [x] Add table-driven tests for valid/entry_not_touched/no_artifact successful runs, report-only and intermediate caution, failed/cancelled runs and design-owned review/repair; assert actual emitted advice/metadata, not documentation source text.
- [x] Run `node --test test/design-notifier-messages.test.mjs` and observe intended missing-advice/metadata failures.
- [x] Replace artifact-valid-only quality advice with output-contract-aware design-owned review/refinement instructions; preserve original verdict and gates.
- [x] Run targeted notifier tests and `npm run check`; all tests must pass (optional Compose skip reported separately).

### Task 2: One ownership contract, small evidence handoff

**Files:** `docs/integrations/opendesign.md`, `docs/{architecture,execution}.md`, `examples/{project-AGENTS,autonomous-development}.md`, `README.md`, `/home/ksi/.config/opencode/AGENTS.md`; reconcile `docs/superpowers/product-state.md`, pilot ledger and `.opencode/working-state.md`.
**Interfaces:** Compact brief = purpose/problem, invariants vs redesign freedom, actual source/states/references, expected files and acceptance. Existing task record = criterion/defect → design review finding → revision/render evidence → fixed/open + functional check; no new registry.

- [x] Back up global policy/pinned runtime and record native config/role hashes.
- [x] Replace competing routing/self-evaluation rules; design analyzes/implements/renders/reviews/refines, OpenCode checks evidence and actual functional flow. Small visual fixes use compact refinement, not fresh intake/full audit.
- [x] Keep new direction/client/scope/review-first and representative rollout gates; UI direct edits can precede quality pass but are provisional and not completion evidence alone.
- [x] Reconcile stale pilot/state claims: user rejected bold result; product refinement belongs in the product session; autonomous quality loop remains unverified.
- [x] Fresh reviewer tests consuming guidance against the five Review Focus classes; record interpretation limits, not visual-quality success.
- [x] Independent test-runner runs `npm run check`, `npm run check:package`, targeted tests and diff checks; verifies native hashes, global-policy scope and no product writes.
- [x] Commit task-owned files, update the existing pinned notifier copy, independently verify installed hashes/metadata and final repo state; reconcile ledger/checkpoint and report live-pickup/real-use limits. No push/restart.

## OD-usage loop refinement (follow-on, same slice)

Approved in conversation (2026-10-06 "그렇게 개선해줘") after the user asked how to
use OD better: make the design-review run a required stage, feed it actual rendered
states, standardize its output as a fix list, write observable acceptance criteria,
verify input access before commissioning, and record skill selection per stage.

- RED: two new notification-contract tests failed (`/tmp/opencode/ksi-od-usage/red.log`) — review-run requirement and observable-criteria/input-access advice absent.
- GREEN: messages + notifier suites 39/39 pass (`green.log`). Global policy bullet 43 + KO section, shipped guide §Design-quality loop, notifier README, examples ×2 and README aligned to the same contract.
- Backup/preservation: `/tmp/opencode/ksi-od-usage/` (policy backup, notifier copy, 9 config/role hashes).
- Implementation commit `e40ebbb`; independent test-runner `ses_ef0b3b84affeU0M9vGdvX9BIjB`: check142/pass141/fail0/skip1, targeted39/39, whitespace/status clean, 9/9 hashes preserved, global policy = exactly the two intended bullets, pinned payload 7/7 equal, 96 installed-message contract assertions pass; two nuances flagged (R5 skill-recording parity in 3 docs; missing literal assertions for "distinct review skill"/"scroll depth").
- Nuances closed in `d6f7c83`: parity text added to README/project-AGENTS/notifier README; two assertions added and mutation-checked (phrase removal → both tests RED, restore → 39/39 GREEN; log `mutation.log`). Full check re-run 142/141/0/1 (`check2.log`); pinned runtime re-installed at `d6f7c83` (verify ok:true).
- Limits: live plugin pickup unverified; emitted contracts/docs consistency ≠ visual quality or live agent obedience. Real validation remains the product session's rendered review/refinement evidence.

## Direction options + audit-first + user-state reporting (follow-on 2, same slice)

Approved 2026-10-06 ("그렇게 해줘") from the ranked list: (1) lightweight direction
options before full implementation when the direction is new/ambiguous, (2) a
read-only design audit of the actual current screens before redesigning, using its
defect list as the redesign's problem statement. Additionally folded in from the
user's same-day feedback about unreadable progress reports and approval-waiting:
(3) user-state reporting (usable level now → blockers and who unblocks them →
what you will do next) and no naked next-candidate endings — continue within an
active goal/authorized mandate with recommended defaults, only genuine
material/irreversible decisions or external inputs return to the user.

- RED: two new notification-contract tests failed (`/tmp/opencode/ksi-od-direction-audit/red.log`); one wording hyphen gap fixed RED→GREEN (`green.log`, 41/41).
- GREEN: full `npm run check` 144 total / 143 pass / 0 fail / 1 optional Compose skip (`check.log`); 9/9 config/role hashes preserved.
- Surfaces: notifier advice step 4 (renumbered 5–8), guide loop step 1 + renumber, global policy EN/KO design bullets + closeout-report bullet, examples ×2, README, notifier README.
- Backup: `/tmp/opencode/ksi-od-direction-audit` (policy, notifier copy, 9 hashes).
- Commit `1e64c2a`; pinned notifier copy updated to the same commit (verify ok:true). Independent test-runner verification recorded below.
- Limits: emitted contracts/docs only; live pickup and real design/report behavior unverified. No product edits/runs/restart/push.

## Verification / closeout

- RED: seven new notification-contract tests failed on missing advice/metadata (`/tmp/opencode/ksi-visual-ownership/red.log`); 12 existing tests passed. One compatibility assertion then caught the missing explicit blind-regeneration warning; restored it without changing the test.
- GREEN: messages + notifier suites 37/37 pass; full `npm run check` 140 total / 139 pass / 0 fail / 1 optional Compose skip. Logs `green.log`, `check.log` in the same directory. Nine config/native-role hashes unchanged.
- Reviewer `ses_ef2751567ffeYft7eI70xSrP29`: no code/policy conflicts found; the two flagged pending items were the not-yet-committed plan and pinned-copy adoption, not implementation defects. Seven scenario groups consumed the new guidance: small visual repair → design compact refinement; nonvisual shared-file bug → Build with sequential ownership; entry-invalid verified UI → design review; intermediate/report-only → no fabricated UI/refinement authority; stalled/rejected → quality unmet; authorized same-brand redesign → structural freedom with invariants; missing render/Plan/pause → respect blockers/native boundaries. This is constrained interpretation, not observed live agent execution or visual-quality validation.
- Source commit `24702e11e195fd3ece95aad568ef48eeb6f0f457` on main includes the plan; the existing pinned notifier copy was updated to that exact commit (7 files). Both reviewer pending items are resolved. No new workspace or native agent; unfamiliar worktrees retained.
- Independent test-runner `ses_ef272f946ffeAQrNnE4Bc7WCm3` at `24702e1`: `npm run check` exit0 (140 total / 139 pass / 0 fail / 1 optional Compose skip), `npm run check:package` exit0, messages/notifier targeted37/37 exit0, diff and committed whitespace checks exit0, clean Git. Logs `final-{check,package,targeted}.log` under `/tmp/opencode/ksi-visual-ownership`.
- Same test-runner: 9/9 native config/role hashes preserved; global policy differs from backup in exactly six single-bullet replacements (105 lines unchanged). `node scripts/install-design-notifier.mjs --verify` exit0/ok:true/commit24702e1/changed+missing+extra empty; independent source/installed `hashTree` comparison 7/7 equal. Actual installed `buildDelivery` imports: 55 assertions over valid/entry-invalid/failed/intermediate/paused cases, no failures. Logs `final-{runtime,hashcompare,runtime-contract}.log`.
- Limits: no product edits/design runs/other-session writes, no service restart/push/publication. Live notifier pickup is unverified; policy refreshed through the harness instruction channel. Unit/runtime-contract and scenario-interpretation checks do not prove agent obedience or visual quality. Real design improvement must be demonstrated by the product session's rendered review/refinement and changed-flow evidence. Human product acceptance remains rejected/unproven, not silently closed.
