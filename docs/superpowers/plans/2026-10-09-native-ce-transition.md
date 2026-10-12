# Native-first global Compound Engineering transition

> Execution record for the user's approved operating-environment transition,
> not a new KSI framework or a product-development experiment.

**Goal:** Retire global Superpowers bootstrap, use native agents plus optional
Compound Engineering `compound-engineering-v3.30.4`, preserve product continuity.
**Architecture:** Native Plan/Build coordinate; General implements/tests;
Explore investigates; retained Reviewer is optional independent review.
OpenDesign keeps all visual source/rendered-review ownership.
**Spec / approval:** User's numbered 1–6 request, explicitly resolved through
the question card as “지금 1~6 전체 전환”. The appended baseline-first discussion
does not defer this approved transition. Installation is authorized; external
push/publication, product experiments and other-session interruption are not.
**Workspace/base:** canonical `main`, `260f53f`; no new worktree, no product writes.

## Rendered-review contract validation (2026-10-10)

Status: technically complete

- Authority: user approved the proposed environment probes, bounded completion
  guidance/custom-instruction alignment and one read-only EVENTOUCH comparison
  review ("진행해주세요"); interruption recovery continued that same action.
  No product source/data, upstream runtime, model, permission, service restart,
  Cloud switch, push, publication or deployment changes are authorized.
- Follow-up user direction (2026-10-10, same session): (1) apply design-side
  global principles ("Product Design & Frontend Ownership") to the OpenDesign
  `customInstructions` setting — product-UX quality plus autonomous completion
  responsibility, deliberately without forcing a specific skill, fixed iteration
  count, layout style or OpenCode orchestration rules; (2) raise the Build-side
  delegation contract — delegate scope, purpose and preservation constraints, not
  a presolved defect list or fix direction; the design workspace owns discovery→
  refinement; Build verifies function/contracts/integration and routes remaining
  visual defects back to design; business-rule or product-direction changes go to
  the user. Applied to `~/.config/opencode/AGENTS.md` (OpenDesign boundary), the
  integration contract, notifier guidance and the setting itself.
- Workspace/base: canonical `main` at `91865f7`, clean before work. Native inline
  coordination and guidance edits; connected design execution owns visual review.
  Existing ledger/checkpoint remain authoritative; no new framework or CE pipeline.
- Private evidence/rollback root:
  `/tmp/opencode/ksi-design-ownership-20261010-kes0mjjz/`. Existing global policy
  and custom-instruction values backed up; snapshots contain no credentials.
- P1/P2: image-only probe `1b0e4e6a-2604-421d-b4de-8c80935f5980` succeeded in a
  newly created, unseeded conversation. Native transcript proves `view_image`
  called via `exec`, followed by `input_image` with decoded PNG SHA256 matching
  the supplied 390px capture exactly. Native thread has no fork parent and one
  turn, distinct from the implementation/review conversation. This validates
  captured-image observation and fresh context, not live browser/UX quality.
  Normalized daemon events omit this image invocation; missing event text alone
  cannot establish that earlier reviewers never saw images.
- P3: built-in image-export probe returned HTTP501, desktop-runtime-only. This
  specific renderer is unavailable here; other inner-browser capabilities remain
  unverified. Actual product captures plus verified native image consumption are
  the supported evidence path for this task; no browser install/server restart.
- P4: the probe and the review run both delivered the project-bound `Design
  refine` body as the primary skill, chat mode included; `server.ts:10100–10124`
  replaces the primary `skillBody` with the binding. In the actual review run the
  requested extra skill WAS delivered after it as `## Composed skill —
  web-design-guidelines` (verified in the composed prompt) — composed additions
  survive the plugin override when the plugin ships its own SKILL.md. The
  reviewer correctly noted the refine workflow's patch step conflicts with the
  read-only request and stopped at inspection. No project rebinding or upstream
  modification; a requested extra skill must still be verified in the run's
  effective prompt before it is relied on.
- Product evidence conflict: initial EVENTOUCH baseline was `1f624be`; subsequent
  unrelated work modified console CSS, list/checkin sources and browser tests.
  Preserved untouched. Earlier rebuild review `4c074ba6` references overwritten
  capture hashes and an older source snapshot; recovery scanning (1,159 PNGs,
  zero hits) confirmed those inputs are gone. The review therefore used the
  current frozen snapshot with explicit labels — no same-revision comparison or
  current-product quality is claimed from reused filenames — and the product's
  own ledger was not modified.
- Custom instructions (setting, applied 2026-10-10): a draft was applied first
  (`od-setting.after.json`), then replaced by the user-supplied text
  (`design-custom-instructions.user.md` → `od-setting.user.json`; 4,434 chars,
  readback exact, other config fields hash-unchanged; original `null` preserved
  in `od-setting.before.json`). The review run's composed prompt carried the
  then-active draft (subject-markers verified); runs after the replacement carry
  the user text. Setting text is user-owned configuration, not duplicated here.
- Review validation (`fb86129d-b2a7-47a2-96d4-9910e6749e16`): succeeded in a new
  unseeded chat conversation `ef6e0260`. `no_artifact` is expected for a
  read-only review, not a failure. Native verification: new thread `01a1263d`
  (no fork parent, one turn, model gpt-6-luna); all six frozen capture hashes
  decoded from the reviewer's `input_image` data exactly matched the expected
  captures (`exactCapturesConsumed: true`); composed prompt 39,374 bytes
  (sha256 `1ade54b3…`) contained the review task, the plugin-bound body, the
  composed `web-design-guidelines` block and the draft custom instructions.
  Product tree unchanged (status normalized + frozen file hashes; receipts in
  `review-receipt.json`/`review-receipt-extra.json`; composed prompt saved).
- Design-reported open defects (captured states at the 2026-10-10 03:28
  list-ops revision; reported, not adjudicated here): (1) `현재 입장` metric not
  prominent and the single check-in action not integrated into the tile
  (390/320 evidence); (2) no recent-activity rows or full-history link despite
  the page contract (all captured widths). The reviewer recorded the console.css
  working-hash difference from the captured revision and could not confirm the
  exact stylesheet revision used; unverified: loading/error, axe/screen-reader,
  reduced-motion, physical devices, non-overview chrome, routes/permissions.
  The earlier rebuild review's "no open defect" result stays historical (its
  captures were overwritten); no same-revision comparison was possible. The
  findings belong to the product workstream; no product source/data was touched.
- Verification: `TMPDIR=/tmp/opencode npm run check` — 220 total, 218 pass,
  0 fail, 2 existing optional skips (final state after all edits); notifier unit
  file 35/35 pass after red→green updates; `npm run check:package` passed
  (installer-only tarball, offline two-role install, retired flags rejected);
  `git diff --check` clean. No runtime code, model, permission, service or
  upstream-source change; no push, publication or deployment.
- Delivery/next: local commits `a2a5816` + `0428813`; pinned notifier copy
  updated to source `0428813` (`--verify` ok; only `README.md` and
  `lib/messages.js` differ from the prior copy — previous copy backed up in the
  evidence root) and the managed service acknowledged `opencode reload`. Next:
  one real delegated design improvement observed against the user's criterion —
  how many user-facing problems the design workspace finds and resolves
  autonomously without extra user direction. EVENTOUCH findings and the
  reviewer's `od-next` suggestions remain advisory to the product workstream.
  Resolved 2026-10-12: subsequent design-run notifications delivered with the
  updated guidance text (steps 2a/3/3a/4/7), so the pinned copy is effective.

## Autonomous design delegation validation (2026-10-12)

Status: technically complete — awaiting the user's evaluation/acceptance

- Authority: user's validation directive — keep the three harness commits, no
  further harness structural changes before this validation, run one real design
  delegation on the EVENTOUCH operations home with purpose + preservation
  constraints ONLY (no presolved defects or fix directions), measure autonomous
  discovery/completion, keep validation separate from remote sync, and work in
  an isolated environment. No push/publication/deployment; no product-branch
  writes; product WIP from the other workstream untouched.
- Isolation: new worktree `.worktrees/eventouch-ops-validation` (branch
  `design/ops-autonomy-validation`, base `1f624be` = the frozen capture
  revision); new OD project `EVENTOUCH Ops Validation (isolated)` via
  `POST /api/import/folder`. The folder was registered in the remote-workspace
  picker state (`connections.json`) + gateway restart WITHOUT container
  recreation (the `/home/ksi/Desktop` mount already exposed the path); read and
  write access probed (write→read→delete). Isolated fixture served the worktree
  on port 46779 (same fixture DB schema; env incl. `EVENTOUCH_DEV_QUICK_LOGIN`).
- Delegation: brief carried purpose, target route, context pointers and
  preservation constraints only (`validation-brief.txt`); every previously found
  UX problem and solution direction was excluded.
- Runs and independent receipts (source-direct; `no_artifact` expected):
  - `9ba65814` (implementation, refine pipeline inherited): autonomously
    discovered the missing live check-in activity signal; test-first regression
    test; `experience.js` +6/-3, `console.css` +16/-3 (최근 입퇴장 section: max 2
    stored records, name/IN-OUT/short time/correction badge, 전체 기록 보기,
    `canChecks` gate; non-LIVE keeps the menu tile). Disclosed its own render
    limitation honestly.
  - Host capture r1 → `3fb36c37` (rendered review, fresh conversation): 12/12
    before/after captures consumed with exact hashes; delivered prompt carried
    the plugin body + composed `web-design-guidelines` + the user's global
    principles text; found one P2 (mobile activity metadata 11px < shared 14px)
    and no other defect; disclosed the read-only/refine conflict.
  - `cff755fa` (refinement): mobile override → `var(--small)`; focused test 1/1.
  - Build objective re-verification: metadata 14px at 320/390/1280, no overflow,
    all controls ≥44px, history destination (`checks`) renders; r2 captures
    (`validation-r2-*`; the 1280 file is byte-identical to r1).
  - `c7251c98` (re-check review, fresh conversation): 6 images consumed;
    verdict “P2 closed — no open rendered defect in these states”.
- Evaluation (the user's frame; corrected 2026-10-12): the implementation run
  autonomously discovered one user-facing defect (the missing live check-in
  activity signal); the second defect (mobile activity metadata 11px < the
  shared 14px token) was introduced by that implementation and caught by the
  host-coordinated independent rendered review. Both were fixed and reverified.
  Not addressed by this pass: the earlier read-only review's “현재 입장 tile
  integration” item (design chose its own priorities within scope).
  Design-decision requests from the user: 0 — but the cycle was host-assisted
  (fixture serving, captures, review commissioning) and included user
  continuation/error prompts, so it is not evidence of fully hands-off
  autonomous completion. Functional regressions: none observed in the checked
  scope — `npm test` 327/155/0/172 (172 skipped for unavailable isolated
  PostgreSQL test config), route/permission/metric/stage logic untouched,
  other-screen spot captures normal. Unverified: loading/error/empty-data
  states, axe/screen-reader, reduced-motion, physical devices, some
  route/permission variants. Note: the 1024 “before” capture differs from the
  Oct-10 frozen set (re-captured by the other workstream at 13:21; 5 of 6
  byte-identical) — recorded, not used as a same-revision claim.
- Result freeze: isolated-branch commit `c8f65ba` (3 files, +78/-3). Not merged
  or pushed; the product branch and its WIP untouched. The OD project and the
  worktree remain for inspection; the validation fixture was stopped after use.
- Operations note (corrected 2026-10-12): tool-call interruptions occurred while
  other activity shared the same evidence area. The observed cancellation
  notices read "Command cancelled because the server restarted", so the
  concurrent-driver cause was not conclusively established; keep single
  command/single driver discipline for shared areas and record an
  interruption's cause as unknown when it is unproven. A parallel session's
  traces (OpenChamber/4096 probing, one fixture start and a page probe) appeared
  in the shared evidence root on 10-11 19:23–19:46 and an untracked full
  `design-inputs` copy landed in the isolated worktree at 19:33 — preserved,
  not attributed to the design runs.
- Harness improvement proposals — APPLIED 2026-10-12 on the user's approval
  ("그래 하네스 개선해봐"), docs-only: (1) the host-capture handoff recipe is now
  in the integration guide (serve/verify-entry/capture-naming/receipts/reuse
  rules); (2) the review-receipt schema (thread identity, delivered-instruction
  markers, consumed-image hashes, source hashes, verdict, fixed/open list) is
  recorded as standard practice in the same guide; (3) the four evaluation
  criteria are recorded as the standing delegation-evaluation frame; (4) the
  single-driver note for shared working areas is in `docs/execution.md`. No
  installer, runtime, agent or permission changes.

## Harness audit corrections (2026-10-12)

Status: technically complete

- Authority: user direction — explain the harness and audit docs/README/other
  parts, then apply the identified corrections and legacy cleanup ("모두
  개선해주세요 레거시나 더이상 안쓰는 거 정리 및 정정"). Local commits only; no
  push/publication/deployment.
- Record accuracy: the evaluation and operations note in the section above were
  corrected; working-state and product-state summaries reconciled with the
  2026-10-12 state (host-assisted cycle, bounded regression claim, unproven
  interruption cause, ahead-of-origin delivery state).
- Diagnostics: `scripts/work-doctor.mjs` no longer treats the optional
  Developer/Reviewer bundle as a required prerequisite — a native-first
  environment reports `unverified` instead of `needs-setup`; regression test
  added in `test/work-doctor.test.mjs`; the doctor description in
  `docs/execution.md` updated.
- Docs: packaged-doc links fixed (`docs/integrations/opendesign.md`,
  `docs/verification.md`) with a new packaged-link guard
  (`test/docs-links.test.mjs`); notifier resume wording aligned to the
  implementation ("eligible on a later poll tick, subject to existing retry
  delays"); capture-recipe claims reframed as observed cases, not general
  causes; the architecture opening distinguishes the npm package from
  repository-only records; README, `examples/project-AGENTS.md` and
  `examples/autonomous-development.md` audit-first phrasing aligned with the
  design-owned discovery contract; the shipped Developer prompt no longer cites
  Superpowers; the deployment record points to the current host-side MCP proxy.
- Legacy cleanup: unused retired-flow asset `.github/assets/pipeline.svg`
  removed (recoverable from Git history). `.gitignore` was reviewed and left
  unchanged: the ignored `design-previews/` material is still local review
  content.
- EVENTOUCH write-path check (2026-10-12, on user request): daemon and container
  healthy; all three EVENTOUCH paths connected, mounted rw, and a container
  write→read→delete probe succeeded on each; recent product runs edited real
  files (mtimes inside their run windows) and the validation diff is on disk.
  Corrected the guide's writeback check: `workspace.storage.kind: od-owned` is
  not a regression signal — working runs report it too; the check now uses the
  actual file change plus a probe when in doubt. Observation for a user
  decision: `/home/ksi/Desktop` is still a connected root and an rw mount in
  the container although the 2026-10-06 record says the parent bind was
  reverted; nothing was changed without approval.
- Checks: `npm run check` — 222 total / 220 pass / 0 fail / 2 optional skips;
  `npm run check:package` passed; `git diff --check` clean. Documentation,
  template and read-only helper changes only: no runtime, provider/model,
  permission, service, release or external-delivery change.

## Remote-workspace root coverage (2026-10-12)

Status: technically complete — applied live 2026-10-12

- Authority: user direction — first "우회보다는 허용이 낫지 않나" (replace the
  exact-path workaround pattern with root-based allowance), then "그래요
  해봐요". This step changes source, tests and docs only; the live gateway
  restart and the `/home/ksi/Desktop` cleanup await separate confirmation.
- Change: `connector.isConnected` now treats a connected canonical project root
  as covering its canonical subdirectories (`withinRoot` exported from
  `path-policy.mjs`; path-relative, so sibling name prefixes never match), and
  `connectProject` returns `ready` without recreation for an already-covered
  path — the manual `connections.json` edit the validation needed is no longer
  necessary. Guards unchanged: canonical realpath resolution, credential roots,
  home root, symlink escapes, active-run refusal, verified rollback.
- Rationale: the container already mounts a connected root's whole tree, so the
  former exact-path check added no protection inside a mounted root while
  forcing manual state edits and one recreation per worktree. The mount is the
  real boundary; the still-present `/home/ksi/Desktop` root and rw mount is the
  broader exposure and is to be removed in the live step.
- Tests: `connector.test.mjs` +2 — a root covers its canonical descendants
  without new mounts and after reload; a sibling sharing a path-name prefix is
  not covered and still recreates.
- Checks: `npm run check` — 224 total / 222 pass / 0 fail / 2 optional skips;
  `git diff --check` clean (source checks at commit time; live application and
  verification recorded below).
- Live application (applied 2026-10-12, 0 non-terminal runs): private backups
  of the live modules and state in
  `~/.local/state/ksi-harness-backups/remote-workspace-state-20261012/` (with
  SHA256SUMS); the updated `connector.mjs`/`path-policy.mjs` copied into
  `~/.local/share/od-remote-workspace/`; gateway user service restarted
  ("Remote workspace gateway ready", 127.0.0.1:17456 listening);
  `/home/ksi/Desktop` and the two redundant EVENTOUCH-worktree entries removed
  from `connections.json` and `projects.compose.json` (paths 9→6, volumes
  8→6); one container recreation (a first compose attempt failed on the missing
  token env with no partial state; retried with the service env file).
- Live verification: mounts = connected roots only (Desktop gone; the EVENTOUCH
  root covers its worktrees); container write→read→delete probes OK on the
  EVENTOUCH main worktree, `eventouch-postgres` and `eventouch-ops-validation`;
  internal `connected` = true for the unregistered ops-validation path
  (descendant coverage, no manual entry) and false for an unconnected project;
  security profile retained (CapDrop=ALL, CapEff=0, NoNewPrivs=1, seccomp +
  `ksi-codex-userns` AppArmor, not privileged); MCP `list_projects` returns all
  projects.
- Follow-up: a supported disconnect/cleanup endpoint remains a follow-up;
  connection removal is still a documented operator edit.

## CE philosophy alignment (2026-10-12)

Status: technically complete

- Authority: user direction — "설치한 것들에 맞게 맞추는 게 맞겠죠? CE를 쓰면 CE"
  and "CE의 철학에 맞추고 중복 충돌 및 불필요한 거 걷어내면서 개선해봅시다".
  Operating guidance and docs only; no tool, runtime, permission, service or
  external-delivery change.
- Principle: the selected working method owns its mechanics. KSI keeps purpose,
  approval boundaries, preservation and cross-tool handoffs; it no longer
  prescribes branch/worktree mechanics over a running CE workflow, no longer
  mandates a parallel KSI ledger when the method produces its own record, and
  no longer blanket-rejects the shipping workflows' documented effects.
- Live global `~/.config/opencode/AGENTS.md` (private backup and before/after
  SHA256 in `/tmp/opencode/ksi-ce-align-20261012/`; before `e1b9e959…d8d5`,
  after `04ad60d4…4840`; diff = exactly the four intended hunks): CE
  method-governance sentence, one-record rule, workspace-mechanics rule,
  shipping-invocation authorization. Effective immediately for new turns.
- Repository (this commit): `examples/autonomous-development.md` plan bullet,
  shipping bullet and workspaces section compressed/aligned (8 bullets → 3);
  `docs/execution.md` workspace-lifecycle section compressed to what stays
  with Build regardless of method, record table + canonical-record paragraph
  aligned, shipping-invocation authorization added;
  `examples/project-AGENTS.md` record pointer; `README.md` workspace
  paragraphs.
- Unchanged boundaries: deployment/registry publication/new credential access
  approvals; OpenDesign ownership; preservation of user work; one writer per
  shared file.
- Checks: `npm run check` — 224 total / 222 pass / 0 fail / 2 optional skips;
  `git diff --check` clean.
- Follow-up (only on observed need): the status helper parses only
  `docs/superpowers` ledger pointers; if CE artifacts become primary records in
  a project, extend the pointer or accept an unknown status then.

## Git policy alignment with Compound Engineering (2026-10-12)

Status: technically complete

- Authority: user direction — align the branch/worktree/commit policy with
  Compound Engineering v3.30.4: feature-branch default with reuse, worktree
  only for actual isolation, Build owning Git integration, no new KSI
  plugin/agent/registry, no double review, existing approval scope preserved.
- Comparison performed against the installed CE 3.30.4: `ce-work`
  `references/workspace-setup.md` (default branch → create a feature branch;
  otherwise continue on the invoked branch without renaming; a worktree only
  when the user asked this session; pre-work dirty files are recorded and never
  committed/published), `references/execution-strategy.md` (worker isolation is
  the method's own concern; the orchestrator owns canonical commits),
  `ce-worktree` (detect existing isolation first; one branch checked out in one
  worktree), `references/shipping-workflow.md` (review-receipt gate; push/PR as
  documented effects; merging stays with the user).
- Differences found and fixed (minimal edits): (1) KSI said the native flow
  "works in the current checkout" without a branch default — now a feature
  branch is the default (created from the default branch when needed, the
  workstream's existing feature branch reused), and a worktree is only for
  actual isolation (concurrent writers/sessions, parallel development, checkout
  protection); (2) nothing prevented running ce-code-review and the separate
  Reviewer on the same change — now explicitly one or the other; (3) merge was
  unspecified in the shipping authorization — now "merging stays the user's
  decision unless separately granted". A CE workflow's own branch/workspace
  handling (including internal worker isolation) owns that work; no KSI
  workspace procedure is layered on top.
- Applied: live global `~/.config/opencode/AGENTS.md` (exactly 3 hunks; private
  backup and before/after SHA256 in `/tmp/opencode/ksi-git-align-20261012/`;
  before `04ad60d4…`, after `ad9436c8…`); repository
  `examples/autonomous-development.md` (workspaces bullet, self-review bullet,
  shipping bullet), `docs/execution.md` (workspace-lifecycle intro,
  review-depth paragraph, external-delivery paragraph), `README.md` (branch
  paragraph, review sentence).
- Unchanged: no new plugin/agent/registry; no CE upstream edit; local-commit
  and preservation rules; a CE workflow's push/PR effects and the
  deployment/registry/credential gates.
- Checks: `npm run check` — 224 total / 222 pass / 0 fail / 2 optional skips;
  `git diff --check` clean; global diff reviewed hunk-by-hunk.
- Remaining verification: real-use observation only — the next actual product
  task should confirm feature-branch reuse and worktree-when-needed behavior;
  no code or runtime check is pending.

## Native-first consolidation: removals (2026-10-12)

Status: technically complete

- Authority: user direction — "OpenCode가 이미 제공하는 기능은 네이티브에 맡기고,
  CE가 잘하는 것은 CE에 맡기며, KSI에는 우리 제품 개발에만 필요한 책임과 판단
  기준을 남기는 것이 좋겠습니다" and "명시적 비활성화보다는 쓰지 않거나
  불필요하거나 안쓰면 제거해버려" (remove, do not disable).
- Runtime removals (outside git; private backups preserved):
  `~/.config/opencode/opencode.jsonc` — the developer/test-runner/reviewer
  entries deleted entirely (no disabled flags remain; agents now plan/explore/
  general; before `b1c61da4…`, after `351be069…`); `~/.config/opencode/agents/`
  — all eight archived role files moved to
  `~/.local/state/ksi-harness-backups/agent-removals-20261012/` (config agents
  dir now empty); `~/.agents/skills/ui-ux-pro-max` removed from discovery and
  archived at `~/.local/state/ksi-harness-backups/ui-ux-pro-max-20261012/`
  (live catalog confirmed the skill is no longer available).
- Policy/docs: independent review runs through the CE review skill
  (ce-code-review); the separate KSI Reviewer seat is removed and the
  double-review rule is gone with it. The KSI parallel-development procedure is
  removed — a CE workflow follows its execution strategy and native runs use
  OpenCode's subagent capability; Build integrates and owns the final claim.
  OD guidance no longer assigns any review role to UI-reference skills. Docs
  swept: global AGENTS.md, README, architecture, execution, opendesign, both
  examples, troubleshooting.
- Principle recorded: Native-first → existing specialized tools (CE) → only
  problems neither solves get a minimal KSI rule.
- Checks: `npm run check` — 224/222/0/2; `git diff --check` clean; JSONC parse
  verified (agents: plan, explore, general).
- Remaining verification: effective catalog of the shared server (skill removal
  auto-reloaded; agent-config effect to confirm on next catalog inspection) and
  real-use observation in the next product task.
- Follow-up (same day): effective catalog verified via the local API — agents =
  build/plan/general/explore (reviewer absent); skills = 59 total, 34 `ce-*`,
  ui-ux-pro-max absent. The shipped example policies
  (`examples/autonomous-development.md`, `examples/project-AGENTS.md`) were
  compressed: the OpenDesign and delegation sections now keep the KSI-specific
  ownership, gates and evidence distinctions and defer procedure to the
  integration/execution guides instead of restating them.

## Current operating alignment (2026-10-10)

Status: technically complete

- Authority: the user approved the proposed bounded inconsistency repair
  ("그래요 불일치 등 개선해주세여") after the read-only findings. This is a
  documentation/checkpoint exception to the observation freeze, not approval for
  a new runtime, Goal reinstall, agent/skill/model/permission changes, product
  intervention or remote delivery.
- Workspace/base: the existing canonical `main` checkout at `6f42519`, clean
  tracked/index/untracked state before work; 14 local commits ahead of cached
  `origin/main` (`1840aad`). No fetch, push, new branch/worktree or other-session
  intervention. Native inline execution follows the host's current-checkout
  policy; this coherent documentation repair does not need a delegated worker.
  CE work guidance is used only for scoped implementation/local verification;
  no standalone shipping or cross-model engine is commissioned.
- Observed inconsistencies: checkpoint header/body HEAD disagreement; removed
  Goal pause/behavior checks still listed as current work; preparation-only
  outcome and pending-cutover backlog wording; operational docs still preferring
  Developer/Superpowers and creating/resuming goals. The existing status helper
  read this ledger's status as `unknown` before repair.
- Scope: README/INSTALL, architecture/execution guidance and their two optional
  policy examples, current product-state and the ignored checkpoint. Clarify
  current native General + optional CE operation separately from the unchanged
  Developer/Reviewer source installer and historical three-role npm beta.8.
  Keep the older General-delegation heading anchor for historical links.
- Current decisions: Build selects methods without a user-selected A/B/C mode,
  forced labels or a no-mixing rule. Descriptive method/skill usage may be
  recorded for observation, and material cost/scope/security changes still need
  approval. The earlier A/B/C comparison wording below is historical and does
  not override this agent-selected-method contract.
- Goal evidence clarification: removal verification established a valid v2
  state file and active1/complete2 counts, not field-by-field invariance. A
  changed hash and one-byte size difference do not prove that the only change
  was periodic accounting. Preserved `active` records are inert on the verified
  Goal-free service and need no pause/clear/reinstall. Other listeners remain
  unverified, not proven to share that effective state.
- Verification contract: no runtime-code behavior change or new tests required;
  use existing source/package tests, local Markdown-link/anchor and statement
  reconciliation, and the read-only work-status helper. Refresh the checkpoint
  to the resulting Git HEAD at closeout. Runtime catalogs from 2026-10-09 are
  dated prior evidence, not a new live/model/continuity/product acceptance test.
- Outcome: aligned current General/optional-CE instructions and removed
  operational Goal-create/resume advice from the active guides/examples;
  retained installer commands, role templates and beta.8 version pins. Corrected
  pending-cutover backlog/current-cache wording and marked preparation outcomes
  historical. The ignored checkpoint selects this exact ledger section and uses
  one HEAD field rather than a second stale body revision. After this repair,
  structural/runtime freeze and real-use observation remain the default.
- Verification (2026-10-10, base `6f42519` + the eight task-owned Markdown diffs):
  `TMPDIR=/tmp/opencode npm run check` — 217 total, 215 pass, 0 fail, 2 existing
  optional skips (real isolated Compose, auto-only final-summary overlay).
  `TMPDIR=/tmp/opencode npm run check:package` — passed: offline disposable
  two-role consumer, removed flags rejected, legacy role/routing preserved.
  Local Markdown-link/anchor inspection — 64 links across all eight changed
  documents, 0 broken; both current General and legacy Developer anchors valid.
  Statement/checkpoint assertions passed (Goal-free resume, agent-vs-skill
  boundary, no stale body HEAD/pause request, checkpoint <=80lines/6KiB).
  `git diff --check` passed. Runtime/installer/template/script/test/manifest
  paths have no diff from the base; no global configuration was edited.
- Record/status evidence: before repair, `work-report --status --json` returned
  ledger status `unknown`; with the explicit current-section selector, read-only
  assertions returned `in progress` during work with zero warnings and no
  publication/deployment inference. Closeout selects `technically complete`;
  the checkpoint HEAD and clean-tree state are refreshed after the local commit.
- Evidence strategy: documentation/cache only, no behavior-bearing runtime code
  changed; existing tests used unchanged and no new/red test claimed. Scoped
  local assertions and source/package checks replace a new prose-only test
  suite. No independent Reviewer, provider-backed General/CE execution, real
  product/browser test or fresh-session resume experiment was performed here.
  Faster development, improved search decisions and autonomous completion are
  still observation questions, not established by these checks.
- Delivery/next: task-owned local commit only; checkpoint stays ignored. No
  push/PR/publication/deployment, service reload/restart, model/permission/plugin
  change or product task commissioned. Next is an authorized product goal in
  its own existing record; OpenChamber/4096 and CE-path compatibility stay
  separate, approval-gated work.

## Preserved contracts

- Do not change native Plan/Build/General/Explore system prompts, other models,
  permissions, MCP, unrelated plugins, or another tool's independent install.
- Preserve `docs/superpowers/`, `.superpowers/sdd/`, PRDs, plans, evidence, Git
  and state-script paths. No project `ce-setup` or generated document by default.
- General remains multipurpose, Muse Spark high, without a General-specific cap.
  Preserve Developer/Test Runner definitions and routing before disabling them;
  keep customized Reviewer and its independent read-only contract.
- Skills are optional tools, not a mandatory whole pipeline. CE cannot authorize
  unapproved push/PR/deploy, code disclosure, extra model/service use or installs.
- Do not interrupt/pause another session or Goal. Cutover requires a safe owning
  session boundary and an authenticated route to the actual serving process.
- No npm release, default-bundle rewrite or new custom agent/skill in this task.

## Survey / verified evidence (2026-10-09)

- Host OpenCode `2.0.24`. Managed service PID796278 has no foreground drains at
  lookup. Its authenticated native CLI reads confirm global sources
  `/home/ksi/.config/opencode/opencode.json`, `opencode.jsonc`, that directory's
  agents/plugins and `/home/ksi/.opencode` discovery. Superpowers is active,
  15 upstream skills among 39; no CE skills. Goal/notifier plugins are active.
- General effective model = Muse Spark 1.3 Contributor high, no `steps` or system
  override. Developer = same model, steps80; Test Runner = LongCat, steps24;
  Reviewer = Muse Spark xhigh, steps32. Native General and Developer both deny
  child delegation; they are not identical profiles. Keep assignment scope,
  author-test evidence and fresh independent-review children; do not copy the
  Developer system prompt or its finite cap into General.
- OpenChamber app PID3021 owns OpenCode PID4902. Launch metadata selects
  `/home/ksi/.config/openchamber/opencode.managed.json`; this supplements, not
  substitutes for proving, actual resolved global config. It contains browser
  exclusion and the app's agent-tool plugin, no role/skill overrides.
  Bare explicit-server/proxy calls return401. Recovered through the installed
  official CLI's existing authentication client (`cli-http.js:requestJson`),
  without manual credential extraction, copied headers or shared passwords.
  Actual app proxy confirms PID4902/version2.0.24 and both global documents plus
  its managed document. It has no foreground drains at lookup; Site's official
  session-status command reports idle, but the native Goal remains active.
- OpenChamber catalog discrepancy: root and explicit harness/Site/EVENTOUCH
  locations return no plugins, only native unconfigured agent profiles and two
  skills, despite configuration discovery naming the global documents. Explicit
  location resolution is confirmed; the wrong-location hypothesis is rejected.
  Do not infer effective global model/skill activation from source documents,
  or compensate with project-local copies. Source/router/cache cause remains
  unverified; investigate supported scoped reload only at the safe boundary.
- A third host listener, PID195177 at port4096, also uses the host home/config
  defaults. Its explicit native client requires authentication; it is not the
  discovered managed service. Preserve it, do not restart it or extract secrets.
  Its live drains/catalog remain unverified. The separate design-container
  process has a different home and is not a host-global migration target.
- Native goals: Site Intelligence session `ses_f0e6f0de9ffeYR7ZKuiu9uth3z` is
  active; Safety Edge is budgetLimited; EVENTOUCH goal complete. Project-list
  design statuses are terminal/not-started; notifier has two stale failed
  requests with no run IDs, not confirmed in-flight executions. No switches changed.
- Site Intelligence main is clean, 150 local commits ahead at lookup. Safety
  Edge has tracked/untracked Replay changes; EVENTOUCH PostgreSQL worktree has
  untracked design evidence. Preserve all; no ownership transfer or intervention.
- Inspected OpenCode skill/plugin roots, compatibility skill roots and legacy
  manifests show no active Superpowers symlink or package-manifest dependency.
  The native package plugin is the confirmed registration source; caches and
  unrelated tool installs are not authorized cleanup targets.
- Official release tag resolves to `efcb657d9a5733ccc154c36cc7d3d78b4136eb23`.
  Tag-specific installer/plugin source confirms a V2 `setup` registering skills
  and commands, without a controller bootstrap. Its package version is3.30.4;
  ce-ideate/ce-explain/ce-work/ce-compound are present with sibling-reference
  dependencies. Static evidence, not installation or runtime compatibility proof.
- Private backup/evidence:
  `/tmp/opencode/ksi-native-ce-transition-20261009-x32huz_j/`.
  Seven owner-confirmed configuration/policy/role files backed up; manifest
  preserves SHA256, UID and modes; owner-private directory/files.
  Authenticated native API captures are private. CLI stdout must target a regular
  file for large responses; pipe captures truncated skill/OpenAPI JSON and are
  not accepted as catalog evidence. No sensitive contents copied into Git.

### Extended dependency inventory (2026-10-09, later read-only pass)

- `opencode plugin list` confirms exactly three active plugin sources: pinned
  `superpowers` (JSONC entry), `local.goal-mode.server` 0.1.54 (goal plugin) and
  local `ksi.design-notifier` auto-discovered from `~/.config/opencode/plugins/`
  (not a JSONC entry). Compound Engineering is not installed yet.
- The resolved skill catalog is 39 skills: 15 superpowers; built-in `opencode` and
  `report`; 17 discovered from compatibility roots — 8 KSI (client-intake, contract,
  design-proposal, labor-report, project-docs, proposal-message, quotation,
  tier-proposal) plus docs, docx, google-workspace, import-memory, morning, pdf,
  pptx, skill-creator and xlsx from `~/.claude/skills/synced/<bucket>/`; `grill-me`
  and `ui-ux-pro-max` from `~/.agents/skills`; `agent-browser`, `mobbin-design` and
  `playwright-cli` from `~/.config/opencode/skills`. No duplicate IDs observed.
  Global JSONC has no `skills` array; discovery is via roots only.
- Official V2 docs confirm the discovery set (global `~/.config/opencode/skills`;
  compatibility `~/.claude/skills` and `~/.agents/skills`; project
  `.opencode|.claude|.agents/skills`; explicit `skills` arrays) and plugin discovery
  including the global plugins directory. `opencode debug paths|config|agents`,
  `opencode plugin list` all work against the managed service.
- Active agents: build/plan (primary), general/explore/developer/reviewer/test-runner
  (subagents) plus hidden built-ins. Test Runner's residual global file and routing
  are confirmed active. `design.md`, `design-critic.md` and `research.md` exist only
  as inactive `.bak-*` files in the global agents dir; their final disposition is a
  cleanup-stage item, not an active role.
- Active MCP servers in resolved config and live session tools: context7, mobbin,
  opendesign (od-mcp-host proxy), playwright. `opencode mcp list` returned
  "No MCP servers configured", disagreeing with both the resolved config and the
  live tools; do not use that command as the active-MCP source of truth in 2.0.24.
- Candidate corrections: `impeccable-design-polish` and `web-design-guidelines` are
  not global installs — they exist only as OpenDesign project assets in
  `EVENTOUCH .../.od-skills/` (with design-review, frontend-design, od-design-refine),
  used by current runs; preserve. `frontend-design` is a Claude Code official plugin
  cache under `~/.claude/plugins/`, not OpenCode-discovered. GStack is not installed
  in any user config root; only OpenDesign's own catalog references it upstream.
  `ui-ux-pro-max` is active via the shared `~/.agents/skills` root; OpenCode-side
  de-listing should use a `skill` permission deny rather than deleting a shared
  install, and stays a separate single-variable decision from the SP/CE switch.
  '고리' is not present in the active inventory; identification is still pending.
- Goals re-check: Safety Edge and EVENTOUCH goals are complete; the Site Intelligence
  goal remains active — cutover gate unchanged. No runtime, config, product or
  shared-install change occurred in this read-only pass.

## Ordered execution and checks

- [x] **1. Survey and backup:** real process/config identities, effective native
  catalog/routing, goals/designs, foreign Git status, owner/private backups.
  Actual OpenChamber reads recovered; catalog discrepancy and the third listener
  are explicit unresolved survey limits. Backups revalidated after interruption.
- [x] **2. Confirm safe cutover:** superseded by the user's explicit “모두 개선해줘”
  instruction. Applied while the Site Intelligence goal stayed active (its session
  idle); a formal pause in that owning session is still recommended (session-scoped
  tools cannot pause another session's goal). Listener4096 stayed unverified;
  OpenChamber catalogs rechecked (still separate/empty). Applied at the owner's
  instruction with backups and rollback bytes in place.
- [x] **3. Apply backed-up global cutover:** done — Superpowers entry replaced by
  pinned CE v3.30.4; goal plugin pinned0.1.54 with `auto_continue:false` added;
  cli.json entry pinned; Developer/Test Runner disabled via `disabled:true` plus
  agent-file rename (`agents/*.md.bak-1791546420134`) because config-only `disabled`
  did not suppress file-based re-registration; Reviewer untouched.
- [x] **4. Simplify global policy:** done — the prepared native-first AGENTS.md
  applied with two recorded updates (delegated-design direction default; Goal
  auto-continuation default off). No native prompts changed.
- [x] **5. Refresh and verify actual servers:** done at catalog level —
  `opencode reload` → “Configuration reloaded”; plugin list shows compound-engineering
  `efcb657` (matches the verified tag), goal0.1.54, notifier; `/api/skill`60 with
  34 `ce-*`, zero superpowers; `/api/agent` has no developer/test-runner and no
  superpowers text; `/api/command`41 including `ce-*`; MCP keys unchanged;
  behavioral auto-continuation-off confirmation still pending idle observation.
  OpenChamber-managed server still returns an empty catalog (process env:
  `OPENCODE_CONFIG=…opencode.managed.json`, `OPENCODE_DISABLE_CLAUDE_CODE`);
  pre-existing, needs a user decision before touching that server. Listener4096
  remains password-protected and untouched.
- [x] **6. Cross-project smoke and closeout:** catalog-level smoke in
  KSI-Site-Intelligence-Platform and KSI-Binance-Trader — both show the identical
  global60-skill catalog (34 `ce-*`, `lfg`, no superpowers) with no per-project
  install or generated docs. Repo checks: `npm run check`217/215/0/2 (the same two
  optional skips); the updated notifier test passes. Closeout in this ledger,
  product-state and checkpoint; efficiency, product acceptance and external
  delivery remain unclaimed.

### Applied change inventory and rollback map (2026-10-09)

All applied changes are outside Git; byte copies + SHA256 are in the evidence root
(`pre-cutover-*`, `pre-cutover-manifest.json`).

- `/home/ksi/.config/opencode/opencode.jsonc` → plugins (CE pin, goal0.1.54 with
  `auto_continue:false`), agents developer/test-runner `disabled:true` + comments.
  Diff vs backup: 16 changed lines only; MCP/other sections untouched.
- `/home/ksi/.config/opencode/cli.json` → goal entry pinned0.1.54.
- `/home/ksi/.config/opencode/AGENTS.md` → native-first replacement (~6.1KB).
- `~/.config/opencode/agents/developer.md`/`test-runner.md` → renamed to
  `*.md.bak-1791546420134` (recoverable copies also in the evidence root).
- Repo consistency (delegated-direction default): `docs/integrations/opendesign.md`
  (3 spots), `README.md`, `docs/walkthrough.md`, `examples/project-AGENTS.md`,
  `examples/autonomous-development.md`, `plugins/design-notifier/README.md` and the
  delivered notifier guidance; `test/design-notifier-messages.test.mjs` updated to
  the new contract; all covered by `npm run check`.
- Rollback: restore the pre-cutover globals (or per-file copies), rename the agent
  files back, revert the repo commit and run `opencode reload`.

### Goal plugin verified facts and safe-disable plan (2026-10-09)

- User-recommended direction recorded: default global operation without goal
  auto-continuation, observe whether it is missed, re-enable only on repeated real
  need. `ksi.design-notifier` is a separate system and stays untouched.
- Verified installed artifact: `@prevalentware/opencode-goal-plugin` v0.1.54
  (plugin id `local.goal-mode.server`; cache also holds0.1.49). Both configs use
  the unpinned `@latest` tag — consider pinning the verified0.1.54 when the entry
  is next edited. Configured in JSONC (server options; currently only
  `restricted_agents:[plan]`) and in `cli.json` (TUI list).
- Verified behavior in the installed dist: idle continuation with `auto_continue`
  default true; no-progress pause (50-token floor, 2 turns); auto-turn/elapsed/
  token budgets with wrap-up; close prompts require an audit of real artifacts
  ("close with evidence or blocker"); `MAX_CHECKPOINTS=8`,
  `CHECKPOINT_CHAR_LIMIT=280`. The user's summary is accurate — continuation plus
  re-audit reminders, not blind repetition.
- State: `~/.local/share/opencode-goal-plugin/goals.json`,154638bytes, mode `0600`,
  owner uid1000, keys archives/goals/version2 (v3 migrates on next write). Preserve
  this file (private copy + hash) before any plugin edit; never downgrade the
  plugin against it without isolating it.
- Safe procedure at the authorized boundary: (1) pause active goals in their owning
  sessions — session-scoped tools cannot pause another session's goal from here;
  the Site Intelligence goal is the current one and its pause also clears a
  transition gate; (2) take a private copy + hash of the state file; (3) apply the
  soft lever `options.auto_continue:false` in JSONC (keeps commands/tools/state;
  one-line and reversible) rather than removing the plugin entry; (4) verify no
  auto-continuation in a fresh session and that goal data/history remain intact;
  (5) observe friction; full entry removal from JSONC+cli.json stays a later
  decision, not this step.
- Attribution note: turning Goal off inside the same window as the SP→CE switch
  makes any reduction in re-entry/verification a combined-stack effect. The
  mechanical part (auto turns) is directly observable, so record auto-turn counts
  before/after instead of reading fewer turns as verified-quality improvement.

## Review focus

- Actual server differs from the managed CLI: require both identities/catalogs.
- Config/Markdown precedence can revive retired agents: check actual catalogs.
- Shared installs or references look like duplicates: archive only owned active
  OpenCode registrations, never delete shared source or historical records.
- CE workflows propose external effects: scope/permissions still govern execution.
- Reload during a Goal/design drain can change a running task: do not cut over
  until the owning session is safe; retain exact rollback bytes and pending work.

## Preparation outcome / blocker (historical, superseded)

This section preserves the pre-cutover findings, not the current action list.
The later cutover/removal records and current alignment section govern resume.

Survey and private backup prepared; **no global cutover, role disabling, install,
policy replacement, server restart, new execution Goal or product trial performed**.
Prepared policy candidate is private and inactive. Required blockers are the
active Site Intelligence Goal and unverified shared listener at4096. OpenChamber
authentication is recovered, not a remaining credential request; its runtime
catalog discrepancy still needs safe-boundary investigation. The candidate is
91lines/6026bytes versus active124lines/51353bytes, chmod600, not applied;
SHA256 `c2cd30137097e46729be4aec0602930d24835f899bb1319655760587fe90d330`.
All seven backed-up live files remain byte-identical after the interruption.
Continue from step2 when safety/access conditions are resolved; do not repeat
approval of the already selected transition scope. No timing/efficiency or
complete migration claim is made by these preparation records.

Later same-day read-only inventory (above) extended the candidate list and
corrected three assumptions: OpenDesign project skills are not global legacy
installs; a Claude-official plugin is not a KSI skill; shared compatibility roots
(`~/.claude/skills`, `~/.agents/skills`) belong to other tools and are not
OpenCode-owned deletion targets. Blockers unchanged: active Site Intelligence
goal, unverified listener4096, OpenChamber catalog discrepancy.

**Cutover applied (same day, user instruction “모두 개선해줘”).** The recorded plan
executed with private backups; see the applied-change inventory above. Residual
items: Site goal formal pause (owning session), listener4096 unverified,
OpenChamber-managed server catalog still empty (pre-existing env), and behavioral
confirmation of Goal auto-continuation off pending idle observation. Efficiency,
product acceptance and external delivery remain unclaimed.

## Observation phase (user decision, 2026-10-09)

- User accepted the cutover as appropriate and directed: stop harness/instruction
  changes; use the configuration on real product work; keep OpenDesign's own
  review/improvement loop untouched (the delegated-direction edit was KSI-side
  guidance only, not an OpenDesign internal change).
- Observe in the next real work: development speed (request → working
  functionality), user intervention (unnecessary questions/approvals), continuity
  cost (a new session's re-collection cost), quality (find/fix/re-verify
  iterations). No harness edits, tool additions or forced CE pipelines while
  observing.
- Deferred until observed need: duplicate/overlapping-skill review (KSI8,
  ui-ux-pro-max, CE overlaps), further policy edits, UI/UX Pro Max hide.
- Delivery status: local commits through `c879102` plus this record; `origin/main`
  remains `1840aada`; nothing pushed, published or deployed — not remote delivery.
- Environment residuals stay separate from methodology: the Site goal remains
  recorded `active` in the preserved state file (inert after plugin removal;
  formal pause/clear would need a temporary pinned reinstall), OpenChamber
  catalog issue, listener4096 verification.
- CE document-path integration check (2026-10-09, verified against the installed
  v3.30.4): CE artifact trees resolve from a repo-local
  `.compound-engineering/config.yaml` `docs_root` (validated, symlink-safe,
  `config.yaml` only — never a global setting); CE-owned trees include plans,
  ideation, solutions and `STRATEGY.md`. KSI's `work-status.mjs`/`work-doctor.mjs`
  parse only `docs/superpowers/plans/<file>.md` ledger pointers (code-confirmed),
  so CE-generated documents would not be recognized by the status tools; the
  native Plan agent can only write `~/.opencode/plan/`, so CE plan persistence
  belongs to Build. No project contains any CE artifact yet (harness, Site,
  EVENTOUCH, Binance checked) — a latent gap, not an active fault.
- Interim rule (no new changes, fits “one record per workstream”): the KSI ledger
  stays the single canonical record; CE documents are supporting material linked
  from it; `ce-plan` runs in Build only and never duplicates an already approved
  plan. Re-evaluate a path-compatibility change (status tools reading CE locations
  alongside the legacy path) only with observed real-use friction; do not add
  per-project CE config now.
- Mode comparison frame (user proposal 2026-10-09): label each real task by mode —
  A native-only, B native + selective CE (current default), C full CE workflow —
  and judge each with the same four metrics; do not mix modes within one task.
  A suits small/clear work; C must justify its process cost on large tasks.
  `ce-compound` is kept only if it demonstrably reduces later re-investigation
  (continuity metric). Native Plan/Build/General/Explore are the base; CE skills
  are auxiliary and must earn their keep.
- Goal plugin removal (2026-10-09, user decision): entries removed from the global
  JSONC and cli.json; verified after reload — 2 plugins (CE + design-notifier),
  38 commands (the three goal commands gone), skills unchanged (60, 34 `ce-*`);
  goal state file preserved and valid (v2; active1/complete2; only a 1-byte
  periodic accounting write after the pre-removal copy). Reinstall recipe
  (pinned0.1.54 + options) kept as a JSONC comment; plugin cache and both state
  copies retained.

### Observation evaluation rubric (confirmed 2026-10-09)

Method-selection clarification (2026-10-10): the approved native-first,
agent-selected-method contract takes precedence over the earlier comparison
labels. A/B/C is optional descriptive shorthand, not a mode selector, required
task label or prohibition on using a useful skill during native execution.

Unit: one real product task = one existing task record, noting relevant
methods/skills, model, task type and duration when available.

- Primary criteria: outcome correctness (works in the real product with actual
  execution/reload/persistence and regression evidence — never self-reported);
  speed (request → completed functionality, first useful change); user
  intervention (unnecessary questions, approvals, re-approvals); continuity
  (time/questions to resume in a new session, repeated investigation of settled
  decisions); quality iterations (find/fix/re-verify rounds, post-completion
  leakage).
- Secondary criteria: method-selection fit (A/B/C vs difficulty, verification
  depth vs risk, per-delegation reason/return quality/re-instruction count);
  real CE gain (reduced re-investigation, earlier defect discovery;
  `ce-compound` judged only by reduced re-investigation on a later task); cost
  (tokens/time) as an auxiliary signal only — never a standalone verdict;
  boundary compliance (no unapproved push/deploy, other projects and data
  protected, backups/rollback intact).
- Judging rules: compare same-model, similar-difficulty tasks; record material
  method/model/scope changes instead of enforcing mode purity. No generalization
  from a single task (2–3 per task type before judging); historical Superpowers
  records and optional A/B/C descriptions are contextual comparisons, not
  controlled efficiency proof. Adjust the selection policy only on repeated
  observed under- or over-use of CE.
- Excluded from verdicts: token/document-volume reduction alone; static counts
  of skills or agents.

Preparation verification above `260f53f`: `git diff --check` passes, the new
product-state plan link resolves, all seven live/source backup hashes match,
private directory700/backup+candidate600 confirmed. Only this ledger and
product-state are pending tracked-record changes. No source test replay for
record-only preparation, no claimed role/skill/new-session smoke result.
