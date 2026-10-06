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
- Commit `1e64c2a`; pinned notifier copy updated to the same commit (verify ok:true). Ledger commit `8d9448e`.
- Independent test-runner `ses_ef08d5b49ffejcK2yMoCZVTPfe` (at `8d9448e`): check 144/143/0/1, targeted 41/41, whitespace/status clean, 9/9 hashes preserved, global policy = exactly 3 approved bullet replacements, runtime `1e64c2a` payload 7/7 identical, installed-message 105/105 assertions (step 4 + renumbered 5–8 + prior contracts), A/B/C doc citations verified with no stale shipped contradiction. Residuals (low, deferred): historical quote in `2026-10-04-autonomy-gaps.md:23` is a dated record already annotated as historical in product-state; notifier README restates A/B but not C (C lives in runtime step 8 and the parent README). Live pickup/real behavior intentionally unverified.
- Limits: emitted contracts/docs only; live pickup and real design/report behavior unverified. No product edits/runs/restart/push.

## Project-binding review (follow-on 3, same slice — user request 2026-10-06)

User asked to review the OD runtime/ports/projects and whether the flow has a
problem after the product session reported a stopped chain ("프로젝트에 묶인 작업
유형이 프로토타입이라 소스 수정 산출을 지원하지 않는다").

- Runtime verified read-only: daemon 127.0.0.1:7456 (health ok, v0.23.1) and
  tailnet 100.116.163.1:7456; remote-workspace gateway 127.0.0.1:17456 (403 on /);
  `open-design` container running; tailscale serve active. Projects: EVENTOUCH
  `9db026a4` (baseDir the product checkout), `ksi-deploy-smoke`, KSI-CCTV
  `cf18904b`. EVENTOUCH was re-created by the product session; `aabf3621` is gone.
- Root cause confirmed: folder imports carry `scenarioBinding`
  (`example-web-prototype`, provenance `automatic_default`) and the od-next
  `strategyBinding.taskProfile` `prototype`. od-next supports only
  prototype/ppt/marketing/hyperframes — **no code profile**, so "rebind od-next
  to code" is not a supported path. Source-only edits with untouched canonical
  entry → `od_next_canonical_deliverable_invalid` → outcome `blocked`, which can
  stop automatic continuation.
- Supported alternative found: an explicit scenario plugin in `start_run`
  (`od-code-migration` patch-edit/build-test/diff-review; `od-design-refine`
  direction→patch→critique→handoff) stamps an `explicit_user` scenario binding;
  `POST /api/projects/:id/scenario/restore-automatic` reverts. Whether the
  strategy evaluation changes under an explicit scenario is unverified — must be
  tested in the product session's actual run.
- Guide "Run mechanics"/"Registering" updated with the binding facts; global
  policy EN/KO design bullets gained the blocked-continuation clause; product-state
  and the source-registration ledger reconciled the EVENTOUCH id drift.
- Limits: all checks were read-only probes (daemon API, container files, plugin
  metadata); no design run, no binding mutation, no restart. The recommended
  alternatives are supported mechanisms, not verified outcomes.

## Resident context + review bundle (follow-on 4, same slice)

Approved 2026-10-06 ("이 부분까지 모두 개선"): complete OD-usage items 3–6 —
resident product context, review-delivery bundle, skill observations table, and
accessibility/motion review inputs — plus the registration scenario-path record.

- RED: three new notification-contract tests failed (`/tmp/opencode/ksi-od-context-bundle/red.log`); GREEN 44/44 after the message changes.
- Surfaces: notifier step 3 (keyboard/focus + accessibility + motion states; resident `product-context.md`), report sentence (review bundle), guide (resident-context subsection, bundle paragraph, skill observations table, review-input list, registration line), global policy EN/KO, README, examples ×2.
- Commit `c43fbea`; pinned notifier copy updated to the same commit (verify ok:true). Full check 146/146 pass/0 fail/1 optional skip; 9/9 config hashes preserved. Independent test-runner verification recorded below.
- Limits: emitted contracts/docs only; live pickup, real review runs and product-session context-file creation unverified.

## Goal usage + first-cycle protocol (follow-on 5, same slice)

Approved 2026-10-06 ("goal 을 언제 에이전트가 쓰는지 … 나머지도 모두 개선해줘"):
goal-mode proposal signals, user-facing goal recipe, first-cycle evidence
protocol, recurring-defect patterns in the resident context, and the design-system
attachment candidate.

- Surfaces: global policy Session-goals bullet (when to propose / when not / proposal contents), examples/autonomous-development.md goal bullet, README §05 goal recipe (how to start/pause/resume, Plan/scope limits), guide (recurring-defects line in resident context, first-cycle evidence subsection, design-system candidate note).
- Docs/policy only — no notifier or code change; pinned runtime stays `c43fbea`.
- Checks/commit recorded below. Limits: guidance only; goal behavior and the first-cycle protocol are validated in real sessions.

## Naming rule — "Local Codex" (follow-on 6, same slice)

User asked why agents keep presenting the locally installed OpenDesign as "Local Codex"
(structural OD problem or our guidance?). Root cause: (1) OpenDesign's own MCP
instructions list "Local Codex" as the user-facing product name for local execution,
so agents comply; (2) our guidance mirrored that vendor label without a user-facing
naming rule. Fix: user-facing copy says **"OpenDesign (로컬 실행)"**; "Local Codex" is
a vendor mode label only — never introduced as a separate product/agent/CLI; the
environment's explicit user preference overrides the vendor default. Applied to
global policy KO, guide EN, README. Docs/policy only — no code/runtime change.
Historical records keep their original wording (not rewritten).

## Writeback + external-intake rules (follow-on 7, same slice)

From the 2026-10-06 EVENTOUCH audit (read-only): the session's latest OD run
reported `od-owned` workspace while the checkpoint claimed source-direct was
blocked and Build transcribes — a silent degradation; and the user's
cross-machine OD export (24MB zip) sat in the repo root with no recorded
adoption map.

- Guide: "Writeback degradation" paragraph (od-owned storage = capability
  regression to re-verify/record/report, not a silent transcribe switch) and
  "External OD export intake" subsection (extract outside the product repo,
  adoption map, place inside the connected root for runs, report the map).
- Global policy KO design bullet: the two matching clauses.
- Docs/policy only; no code/runtime change. Checks/commit below.

## Environment fix — codex MCP crash-loop (follow-on 8, same slice)

User asked whether MCP instability should be fixed rather than disabling Code
Mode. Log evidence: `mcp connect failed server=codex` dozens of times (all codex,
none other) — `/home/ksi/.local/bin/codex mcp-server` spawns without a TTY
("stdin is not a terminal"), exits, retries; each retry churns the tool catalog
(the "tool list appears/disappears" symptom). Sessions also manually
disconnect/reconnect the opendesign MCP (recovery attempts, extra churn);
opendesign "resource templates — Method not found" warnings are harmless noise.

- Fix: `~/.config/opencode/opencode.jsonc` codex server `enabled: false` with a
  comment; backup `/tmp/opencode/ksi-mcp-fix/opencode.jsonc.before-1628`.
- Verified: config parses (codex false, others true); no new WARN failures after
  the edit (3-min observation); runtime reports codex not registered (disconnect
  404). Revert = restore backup or `enabled: true`.
- Conclusion recorded: Code Mode was not the cause; the EVENTOUCH `codemode:false`
  diagnostic is unnecessary unless flapping recurs after this fix.

## Environment fix 2 — opendesign MCP proxy EPIPE handling (follow-on 9)

The only observed opendesign MCP crash was `uncaught exception: Error: write
EPIPE` (proxy exiting code 1 when the client closed the pipe — normal disconnect
treated as a crash, causing reconnect churn). The deployed bundle
`~/.local/share/od-mcp-host/proxy.cjs` had no broken-pipe handling.

- Patch: `isBrokenPipe` + `exitQuietly` — EPIPE / ERR_STREAM_DESTROYED on
  uncaught exception or unhandled rejection now exits 0 quietly instead of
  reporting a crash. Localized (lines ~26451-26478), `node --check` OK.
- Backup `/tmp/opencode/ksi-mcp-fix/proxy.cjs.before`; diff
  `/tmp/opencode/ksi-mcp-fix/proxy-epipe.patch` (34 lines). The repo's
  `mcp-host-entry.ts.example` does not contain this handler, so the fix lives
  only in the deployed bundle — reapply from the patch after any redeploy.
- Running proxies keep the old code until their sessions end; new spawns use the
  patched bundle. Live EPIPE quiet-exit will be visible in the log on the next
  client disconnect (no more "[od mcp] uncaught exception ... EPIPE").
- Remaining noise: opendesign "failed to list MCP resource templates — Method not
  found" warnings are client-side calls to an unsupported method (harmless).
  Codex retries continue only in sessions started before the config change
  (this harness session included); new sessions no longer load codex.

## Environment fix 3 — codex MCP fully removed (follow-on 10)

User decided the codex MCP will not be used (delegation/media generation move to
OpenDesign). The `enabled:false` entry was removed from
`~/.config/opencode/opencode.jsonc` and replaced with a tombstone comment (why it
was stale, where delegation lives now, how to re-add). Backup
`/tmp/opencode/ksi-mcp-fix/opencode.jsonc.before-removal`; parse verified — mcp
servers now opendesign/mobbin/playwright/context7 only.

EVENTOUCH observation (same check): the newest runs are **folder-backed** with
`baseDir` = the product checkout (source-direct writeback working again; the
older od-owned runs were the pre-fix ones), and two runs were active at check
time. The earlier audit concern about silent transcribe degradation is resolved
in the current state; checkpoint header/body consistency and the post-full-swap
test-suite rewrite remain open on the product side.

## Push + EVENTOUCH remaining-items status (follow-on 11)

User: "남은 것 모두 진행해줘" (2026-10-06).

- Harness push: `origin/main` (github.com/khakisketch/KSI-Opencode-Harness) — see the
  push record below.
- EVENTOUCH adoption map (observed, recorded here since the product repo was
  active): the cross-machine OD export (`493d5d55-….zip`, extracted at
  `/tmp/opencode/od-batch`) was consumed as a **full-swap rebuild**: `1876efa`
  vendored the OD bundle as the new product shell, `2f3fbcd` dropped OD
  scaffolding, then OD-authored iterations `45ec662`→`07b2cbd` (creation
  flow/overview/sidebar) landed as product commits. The product session should
  mirror this map in its own record and archive/remove the repo-root zip.
- Product-side remaining items are **in-flight in the active EVENTOUCH session**
  (2 design runs running at check time; source-direct folder-backed writeback
  working): checkpoint header/body consistency, post-full-swap test-suite
  rewrite, zip archiving. Not edited from here — one writer; the product session
  owns that workspace.

## Stop-recovery guidance (follow-on 12, same slice)

From today's incident: the EVENTOUCH session (`ses_efe9d3ab…`) stopped at 09:11/09:16
UTC with `Failed to drain Session` / `AI.Error: The request contains invalid
parameters` (provider-layer rejection; same AI.Error class as today's `Model is
unavailable` and `Referenced reasoning item` errors in other sessions), leaving
uncommitted work in the `field-operation` worktree that the checkpoint did not
mention.

- Global policy: checkpoint Current State now names active worktrees and any
  uncommitted work; new "recover from unexpected stops" bullet (preserve work
  first → retry → compact/fresh session from checkpoint → provider/model check;
  delivered ≠ processed).
- examples/autonomous-development.md: same recovery bullet (parity).
- docs/troubleshooting.md: diagnosis bullet (`grep "Failed to drain"`, AI.Error
  classes, never delete the worktree or replay runs).
- guides/working-state-template.md: Current State line mentions worktrees/uncommitted.
- Classification recorded: the stop was provider/environment, not harness.

README polish (same day): flow diagram now shows the current design loop
(audit-first / direction options → source implementation → required review run →
defect list → refinement); "세션이 멈춘 것 같아" recovery line added to the
natural-language section; one blocked line added to the design section. Version
pins verified current (beta.6 = latest/next). Commit `b9523e4`, pushed; check
147/146/0 and package check passed.

## Verification / closeout

- RED: seven new notification-contract tests failed on missing advice/metadata (`/tmp/opencode/ksi-visual-ownership/red.log`); 12 existing tests passed. One compatibility assertion then caught the missing explicit blind-regeneration warning; restored it without changing the test.
- GREEN: messages + notifier suites 37/37 pass; full `npm run check` 140 total / 139 pass / 0 fail / 1 optional Compose skip. Logs `green.log`, `check.log` in the same directory. Nine config/native-role hashes unchanged.
- Reviewer `ses_ef2751567ffeYft7eI70xSrP29`: no code/policy conflicts found; the two flagged pending items were the not-yet-committed plan and pinned-copy adoption, not implementation defects. Seven scenario groups consumed the new guidance: small visual repair → design compact refinement; nonvisual shared-file bug → Build with sequential ownership; entry-invalid verified UI → design review; intermediate/report-only → no fabricated UI/refinement authority; stalled/rejected → quality unmet; authorized same-brand redesign → structural freedom with invariants; missing render/Plan/pause → respect blockers/native boundaries. This is constrained interpretation, not observed live agent execution or visual-quality validation.
- Source commit `24702e11e195fd3ece95aad568ef48eeb6f0f457` on main includes the plan; the existing pinned notifier copy was updated to that exact commit (7 files). Both reviewer pending items are resolved. No new workspace or native agent; unfamiliar worktrees retained.
- Independent test-runner `ses_ef272f946ffeAQrNnE4Bc7WCm3` at `24702e1`: `npm run check` exit0 (140 total / 139 pass / 0 fail / 1 optional Compose skip), `npm run check:package` exit0, messages/notifier targeted37/37 exit0, diff and committed whitespace checks exit0, clean Git. Logs `final-{check,package,targeted}.log` under `/tmp/opencode/ksi-visual-ownership`.
- Same test-runner: 9/9 native config/role hashes preserved; global policy differs from backup in exactly six single-bullet replacements (105 lines unchanged). `node scripts/install-design-notifier.mjs --verify` exit0/ok:true/commit24702e1/changed+missing+extra empty; independent source/installed `hashTree` comparison 7/7 equal. Actual installed `buildDelivery` imports: 55 assertions over valid/entry-invalid/failed/intermediate/paused cases, no failures. Logs `final-{runtime,hashcompare,runtime-contract}.log`.
- Limits: no product edits/design runs/other-session writes, no service restart/push/publication. Live notifier pickup is unverified; policy refreshed through the harness instruction channel. Unit/runtime-contract and scenario-interpretation checks do not prove agent obedience or visual quality. Real design improvement must be demonstrated by the product session's rendered review/refinement and changed-flow evidence. Human product acceptance remains rejected/unproven, not silently closed.
