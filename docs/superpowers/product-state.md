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

- Name: design-handoff-beta4-delivery (m04 supplement; source/main and public npm beta.4/next/latest delivered and verified; technical delivery complete, no authorized engineering task remains; human workflow acceptance separate)
- Acceptance (user-visible): OpenCode conditionally researches and transfers inspected references; Local Codex receives accessible images/links/pattern intent without assumed MCP inheritance; direction approval is tied to actual required-file content; Build verifies the real product server separately from the design preview. No new orchestrator/reverse execution/configuration/runtime is added. Guidance/source verification is not live design quality or user workflow acceptance.
- Plan ledger: docs/superpowers/plans/2026-10-02-design-handoff-beta4-release.md
- Scope note: m03 is superseded rather than completed; its live-preview Design acceptance was never claimed and is no longer the intended workflow

## Next slices (미완(in_progress/blocked/proposed)만; done/abandoned/false_positive_complete 제외)

- m04 design-workspace-separation — remaining: Human end-to-end acceptance of the design flow; reference/snapshot/preview ownership supplement is applied, no live generation claimed
- m05 three-role-beta-release — remaining: user acceptance of the published README/workflow; GitHub/npm publication and public consumer installation verified
- m06 autonomous-local-execution — remaining: user real-development acceptance; source/public beta.3 delivery verified, not a long-running behavior guarantee

## Backlog

- Future release polish (non-blocking beta.4 review): clarify packaged conditional latest warning after explicit default promotion, and add exact README/INSTALL version-pin guards. Existing pins/default install are correct; do not republish immutable beta.4 or start a new release implicitly.
- Codex intermittent connection-test failures: investigate if recurring; not a release blocker per user. Account policy restrictions are expected, not an installation defect.
- Design integration: DGX MCP now uses host-side exact-revision HTTP proxy; same-client outage and actual container restart/read verified 2026-10-01, no mutation replay. Host-process crash/reboot supervision and default artifact-entry lookup remain unverified/problematic; explicit file arguments work.
- Upstream daemon baseline resolved by test-fixture repair: pin fake executable rather than host primary, and make archive fixtures owner-private. Full native suite 2026-10-01: 912 files pass/4 skipped, 12134 tests pass/0 fail/16 skipped; /tmp/opencode/od-closeout-daemon-full.log. Production security checks/assertions unchanged; source committed locally as1bd12b5eb (ksi/remote-workspace), not pushed to the original upstream repository.
- MCP idle/relaunch verified: same client/process reads after31min idle, isolated proxy termination then normal client relaunch/read pass; /tmp/opencode/od-closeout-idle.log. Automatic host-crash supervision and actual reboot are not claimed.
- Global design workflow guidance in ~/.config/opencode/AGENTS.md: Local Codex default, actual server/project lookup, DGX execution not client-PC execution, explicit artifact-to-engineering handoff. Verified checks reused only for valid same-target context; changes/errors/restarts or active-context expiry require resolution. Live refresh/static invariants verified; no measured latency improvement claim. Later read-only review found EVENTOUCH registered with a valid HTML artifact in a managed design folder; this does not prove linkage to its product repository. Earlier absent-project observation is superseded, not a reason to create a replacement.
- EVENTOUCH's separate codex MCP reports Connection closed; design MCP is connected and hosted Local Codex execution previously verified. Do not conflate these integrations; no fix to unrelated MCP configured as part of global guidance change.

## Delivery checkpoint (2026-10-01)

- Approved main/npm0.5.0-beta.4 delivery completed, including explicitly authorized latest/default promotion after standard browser approvals. Public next/latest bothbeta.4; prior versions retained, no immutable republish. Public reviewed-tarball/SHA512/all18 source+installed bytes, exact-version and unversioned default installs, read-only preview/exactly3roles/repeat/no automatic policy application/GitHub README verified: /tmp/opencode/ksi-beta4-public-latest.log(source82216fd; release contente2263b5). Fresh final check64pass/0fail/1opt-in skip, packed consumer and isolated nativeV2 metadata pass: /tmp/opencode/ksi-beta4-final-{check,package,isolated}.log. Earlier authentication/approval expirations resolved without credential collection, auth bypass or npm modification; no design generation/service changes. Ledger docs/superpowers/plans/2026-10-02-design-handoff-beta4-release.md; human workflow acceptance remains separate.

- Design-reference supplement (2026-10-02): canonical shared policy applied globally and refreshed, original guidance preserved except explicit Build-implements/Plan-reviews clarification; config/roles/Mobbin/UI/upstream hashes unchanged. Source68a0b07 integrated main locally; final/merged check64/0fail/1skip, packed18-file consumer and isolated native V2 metadata passed; independent review no Critical/Important issue. No new remote/npm release, design run, inner MCP setup or service restart. Previous beta.3 evidencebbfeae4 is pushed; follow-up source remains local-only. Ledger docs/superpowers/plans/2026-10-02-design-reference-handoff.md. Human workflow/visual acceptance is separate.

- Autonomous policy source0682659 pushed and beta.3 published to next; latest0.4.0-beta.2 preserved. Public tarball/integrity and18 installed bytes, read-only preview/exactly3 roles/repeat/no automatic policy merge verified. Closeout fresh rerun on2026-10-02: /tmp/opencode/ksi-beta3-closeout-public.log. Native prompts/config/models/permissions/upstream skills and customized live Reviewer preserved; no restart. User real-development acceptance still separate.

- User-approved Korean workflow-first README renewal and main push + npm0.5.0-beta.2/next delivered. Browser login/publish approval resolved earlier authentication blockers. Source200d86e pushed; registry nextbeta.2/latest0.4.0-beta.2 (unchanged), beta.1 retained. Harness64/0fail/1skip, packed consumer and isolated V2 checks pass; fresh public consumer verifies exact tarball/source17 files, no-write preview, exactly3-role apply and repeat idempotence. Public GitHub/npm README bytes match. Ledger: docs/superpowers/plans/2026-10-01-readme-beta2-release.md. No DGX restart; human rendered README/design acceptance remains separate.

- User authorized commit/deployment closeout. KSI implementation/docs committed as e72e78f on refactor/retire-design-opendesign; separate daemon/web/contracts changes committed locally as1bd12b5eb. Unrelated upstream critique-opt-out-skill.md preserved untracked.
- Current DGX deployment verified: health200/ok true, Labs200/active, runtime gateway/connector modules match source. Global45-line policy and on-demand template already applied; no service restart needed. They remain separately managed user configuration, not installer-managed files.
- User selected local main integration. After fast-forward-only pull, main fast-forwarded to f3e4c18; merged-tree check64 pass/0fail/1 opt-in skip and packed offline three-role install pass. No push/npm publication performed; existing0.5.0-beta.1 and dist-tags unchanged. Separate upstream source worktree remains preserved.
