# Product State - KSI OpenCode Harness

Updated: 2026-10-02

## Goal

Long-running product development where OpenDesign owns product/visual design and this harness owns engineering
execution — Build/Plan leading, truthful scoped continuity and verification, and no duplicated design authority.

Archive: 2026-09-23 m02 goal "Make operational continuity and routing/verification/failure claims
understandable and auditable without changing runtime behavior." superseded at m02 slice close 2026-09-24;
preserved for audit, not active.

## Milestones

| id | milestone | status | evidence |
| --- | --- | --- | --- |
| m01 | Long-running orchestration (coordinator-only Build, continuity, Research/design-task) | done | docs/superpowers/plans/2026-09-15-long-running-orchestration.md |
| m02 | Operational evidence consistency (docs/state only) | done | docs/superpowers/plans/2026-09-23-operational-evidence.md + user acceptance 2026-09-24 |
| m03 | Human-centered workflow (outcome-first Build, live-preview Design) | superseded | Design-primary premise removed 2026-09-30; docs/superpowers/plans/2026-09-23-human-centered-workflow.md kept as history |
| m04 | Design workspace separation (retire OpenCode Design + kit, adopt OpenDesign) | in_progress | Conditional Mobbin/brief transfer, snapshot handoff and preview/product ownership guidance applied; user end-to-end flow acceptance separate; docs/superpowers/plans/2026-10-02-design-reference-handoff.md |
| m05 | Three-role beta release and readable onboarding | in_progress | GitHub main Korean README renewal and npm0.5.0-beta.2/next published; clean public consumer verified; user README/workflow acceptance pending; docs/superpowers/plans/2026-10-01-readme-beta2-release.md |
| m06 | Autonomous local execution with design ownership preserved | in_progress | Exact approved policy applied globally; source0682659 pushed, npm0.5.0-beta.3/next published and public18-file consumer verified; real-development acceptance separate; docs/superpowers/plans/2026-10-01-autonomous-execution.md |

## Current slice

- Name: global-browser-toolkit (m06 supplement; pinned CLIs/official skills installed globally, sandboxed browser/axe capability checks and source/consumer/preservation/review verified; source974d97f committed locally, no engineering work remains in this task; real-development acceptance pending)
- Acceptance (user-visible): Existing native Plan/Build/Superpowers/Context7/design-workspace ownership remains intact. Browser commands and official skills are usable across this host/user's projects; Build chooses one driver and proportionate actual-product checks without extra user tool administration. No competing harness, V1 plugin, enforced continuation loop or project dependency/CI rewrite. Disposable setup-fixture evidence is not customer-product auth/API/WCAG or human workflow acceptance.
- Plan ledger: docs/superpowers/plans/2026-10-02-global-browser-toolkit.md
- Scope note: m03 is superseded rather than completed; its live-preview Design acceptance was never claimed and is no longer the intended workflow

## Next slices (미완(in_progress/blocked/proposed)만; done/abandoned/false_positive_complete 제외)

- m04 design-workspace-separation — remaining: Human end-to-end acceptance of the design flow; reference/snapshot/preview ownership supplement is applied, no live generation claimed
- m05 three-role-beta-release — remaining: user acceptance of the published README/workflow; GitHub/npm publication and public consumer installation verified
- m06 autonomous-local-execution — remaining: user real-development acceptance; source/public beta.3 delivery verified, not a long-running behavior guarantee

## Backlog

- Optional ergonomic wording polish (non-blocking review): more explicit base-ambiguity/submodule-detection hints if needed in real use; existing HEAD/base inspection and isolation skill cover them. Canonical guide pointer stays authoritative after integration; do not read unrelated product docs as the harness guide.
- Remaining tooling follow-up: global Playwright CLI/agent-browser/official skills and agent-browser's bundled axe are now prepared under user-approved tools-first scope; standalone Lighthouse/virtual-reader tooling and real desktop/audio setup remain separate. V2 native LSP runtime is absent per current migration docs; structural-navigation alternatives need scoped evaluation. A future verification-evidence helper needs a demonstrated gap/approved design, not a new orchestrator or idle auto-fixer. No single-project-only restriction or product dependency/CI rewrite.
- Future release polish (non-blocking beta.4 review): clarify packaged conditional latest warning after explicit default promotion, and add exact README/INSTALL version-pin guards. Existing pins/default install are correct; do not republish immutable beta.4 or start a new release implicitly.
- Codex intermittent connection-test failures: investigate if recurring; not a release blocker per user. Account policy restrictions are expected, not an installation defect.
- Design integration: DGX MCP now uses host-side exact-revision HTTP proxy; same-client outage and actual container restart/read verified 2026-10-01, no mutation replay. Host-process crash/reboot supervision and default artifact-entry lookup remain unverified/problematic; explicit file arguments work.
- Upstream daemon baseline resolved by test-fixture repair: pin fake executable rather than host primary, and make archive fixtures owner-private. Full native suite 2026-10-01: 912 files pass/4 skipped, 12134 tests pass/0 fail/16 skipped; /tmp/opencode/od-closeout-daemon-full.log. Production security checks/assertions unchanged; source committed locally as1bd12b5eb (ksi/remote-workspace), not pushed to the original upstream repository.
- MCP idle/relaunch verified: same client/process reads after31min idle, isolated proxy termination then normal client relaunch/read pass; /tmp/opencode/od-closeout-idle.log. Automatic host-crash supervision and actual reboot are not claimed.
- Global design workflow guidance in ~/.config/opencode/AGENTS.md: Local Codex default, actual server/project lookup, DGX execution not client-PC execution, explicit artifact-to-engineering handoff. Verified checks reused only for valid same-target context; changes/errors/restarts or active-context expiry require resolution. Live refresh/static invariants verified; no measured latency improvement claim. Later read-only review found EVENTOUCH registered with a valid HTML artifact in a managed design folder; this does not prove linkage to its product repository. Earlier absent-project observation is superseded, not a reason to create a replacement.
- EVENTOUCH's separate codex MCP reports Connection closed; design MCP is connected and hosted Local Codex execution previously verified. Do not conflate these integrations; no fix to unrelated MCP configured as part of global guidance change.

## Delivery checkpoint (2026-10-01)

- Global browser toolkit (2026-10-02, host setup/local-only source974d97f): pinned Playwright CLI0.1.22/agent-browser0.38.2 and official global skills prepared; native skill loading/advertisement confirmed. Existing system Chrome retained sandboxing for both drivers; independent disposable HTTP capability sessions exercised real actions/keyboard/save/backend-file/reload/390px/screenshots/logs, plus bundled axe4.12.1 and independent-cwd launch. Evidence /tmp/opencode/ksi-browser-toolkit-20261002/smoke-summary.json, raw sandbox/audit reports and four inspected screenshots. Exact global policy edits,368 prior file hashes and existing global npm versions preserved; source64/0/1 and packed consumer pass, independent read-only review no implementation defect. Only owned browsers/fixture server closed; four unrelated worktrees retained. No product auth/API/WCAG/audio/human acceptance claim, core config/permission/model/native-agent/upstream change, new orchestrator/forced loop, project dependency/CI rewrite, remote push/publication or restart. Ledger docs/superpowers/plans/2026-10-02-global-browser-toolkit.md.

- Ergonomic guidance supplement (2026-10-02, local-only): outcome-first comfortable defaults, agent-managed workspace/session/integration/owned-cleanup and change-focused actual-product browser/a11y guidance applied globally. Exact intended edits and86 config/role/upstream-skill preservation hashes verified; independent read-only interpretation review no Critical/Important findings. Source7a2aab4 integrated via fast-forward to main; pre-integration/merged checks64pass/0fail/1opt-in skip and packed consumer pass: /tmp/opencode/ksi-ergonomic-{final,merged}-{check,package}.log. Session returned to main and only proven task-owned ergonomic-workflow tree/merged branch removed non-forced; four unrelated worktrees preserved. No new CLI/skill/plugin/config/permission/service changes or remote/npm delivery; public beta.4 remains unchanged. Human end-to-end/comfort acceptance pending, not a runtime/browser/audio guarantee. Ledger docs/superpowers/plans/2026-10-02-ergonomic-workflow.md.

- Approved main/npm0.5.0-beta.4 delivery completed, including explicitly authorized latest/default promotion after standard browser approvals. Public next/latest bothbeta.4; prior versions retained, no immutable republish. Public reviewed-tarball/SHA512/all18 source+installed bytes, exact-version and unversioned default installs, read-only preview/exactly3roles/repeat/no automatic policy application/GitHub README verified: /tmp/opencode/ksi-beta4-public-latest.log(source82216fd; release contente2263b5). Fresh final check64pass/0fail/1opt-in skip, packed consumer and isolated nativeV2 metadata pass: /tmp/opencode/ksi-beta4-final-{check,package,isolated}.log. Earlier authentication/approval expirations resolved without credential collection, auth bypass or npm modification; no design generation/service changes. Ledger docs/superpowers/plans/2026-10-02-design-handoff-beta4-release.md; human workflow acceptance remains separate.

- Design-reference supplement (2026-10-02): canonical shared policy applied globally and refreshed, original guidance preserved except explicit Build-implements/Plan-reviews clarification; config/roles/Mobbin/UI/upstream hashes unchanged. Source68a0b07 integrated main locally; final/merged check64/0fail/1skip, packed18-file consumer and isolated native V2 metadata passed; independent review no Critical/Important issue. No new remote/npm release, design run, inner MCP setup or service restart. Previous beta.3 evidencebbfeae4 is pushed; follow-up source remains local-only. Ledger docs/superpowers/plans/2026-10-02-design-reference-handoff.md. Human workflow/visual acceptance is separate.

- Autonomous policy source0682659 pushed and beta.3 published to next; latest0.4.0-beta.2 preserved. Public tarball/integrity and18 installed bytes, read-only preview/exactly3 roles/repeat/no automatic policy merge verified. Closeout fresh rerun on2026-10-02: /tmp/opencode/ksi-beta3-closeout-public.log. Native prompts/config/models/permissions/upstream skills and customized live Reviewer preserved; no restart. User real-development acceptance still separate.

- User-approved Korean workflow-first README renewal and main push + npm0.5.0-beta.2/next delivered. Browser login/publish approval resolved earlier authentication blockers. Source200d86e pushed; registry nextbeta.2/latest0.4.0-beta.2 (unchanged), beta.1 retained. Harness64/0fail/1skip, packed consumer and isolated V2 checks pass; fresh public consumer verifies exact tarball/source17 files, no-write preview, exactly3-role apply and repeat idempotence. Public GitHub/npm README bytes match. Ledger: docs/superpowers/plans/2026-10-01-readme-beta2-release.md. No DGX restart; human rendered README/design acceptance remains separate.

- User authorized commit/deployment closeout. KSI implementation/docs committed as e72e78f on refactor/retire-design-opendesign; separate daemon/web/contracts changes committed locally as1bd12b5eb. Unrelated upstream critique-opt-out-skill.md preserved untracked.
- Current DGX deployment verified: health200/ok true, Labs200/active, runtime gateway/connector modules match source. Global45-line policy and on-demand template already applied; no service restart needed. They remain separately managed user configuration, not installer-managed files.
- User selected local main integration. After fast-forward-only pull, main fast-forwarded to f3e4c18; merged-tree check64 pass/0fail/1 opt-in skip and packed offline three-role install pass. No push/npm publication performed; existing0.5.0-beta.1 and dist-tags unchanged. Separate upstream source worktree remains preserved.
