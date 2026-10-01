# Product State - KSI OpenCode Harness

Updated: 2026-09-30

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
| m04 | Design workspace separation (retire OpenCode Design + kit, adopt OpenDesign) | in_progress | docs/superpowers/plans/2026-09-30-design-workspace-separation.md |
| m05 | Three-role beta release and readable onboarding | in_progress | GitHub/npm 0.5.0-beta.1 published and clean consumer installation verified; user README/workflow acceptance pending; same release ledger |

## Current slice

- Name: three-role-beta-release (m05; publication and installation verification complete; user README/workflow acceptance pending)
- Acceptance (user-visible): GitHub source/release and npm `0.5.0-beta.1` are available; a clean consumer can preview/apply exactly three roles; README explains actual responsibilities, usage, and separate optional tool installation. Design direction/production implementation acceptance remains separately pending under m04.
- Plan ledger: docs/superpowers/plans/2026-09-30-design-workspace-separation.md
- Scope note: m03 is superseded rather than completed; its live-preview Design acceptance was never claimed and is no longer the intended workflow

## Next slices (미완(in_progress/blocked/proposed)만; done/abandoned/false_positive_complete 제외)

- m04 design-workspace-separation — remaining: Human end-to-end acceptance of the design flow
- m05 three-role-beta-release — remaining: user acceptance of the published README/workflow; GitHub/npm publication and public consumer installation verified

## Backlog

- Codex intermittent connection-test failures: investigate if recurring; not a release blocker per user. Account policy restrictions are expected, not an installation defect.
- Design integration: DGX MCP now uses host-side exact-revision HTTP proxy; same-client outage and actual container restart/read verified 2026-10-01, no mutation replay. Host-process crash/reboot supervision and default artifact-entry lookup remain unverified/problematic; explicit file arguments work.
- Upstream daemon baseline resolved by test-fixture repair: pin fake executable rather than host primary, and make archive fixtures owner-private. Full native suite 2026-10-01: 912 files pass/4 skipped, 12134 tests pass/0 fail/16 skipped; /tmp/opencode/od-closeout-daemon-full.log. Production security checks and assertions unchanged; source changes remain uncommitted.
- MCP idle/relaunch verified: same client/process reads after31min idle, isolated proxy termination then normal client relaunch/read pass; /tmp/opencode/od-closeout-idle.log. Automatic host-crash supervision and actual reboot are not claimed.
- Global design workflow guidance in ~/.config/opencode/AGENTS.md: Local Codex default, actual server/project lookup, DGX execution not client-PC execution, explicit artifact-to-engineering handoff. Compacted108→45 lines,11651→7026 bytes; template now on-demand in guides/working-state-template.md. Verified checks reused only for valid same-target context; changes/errors/restarts or active-context expiry require resolution. Live refresh/static invariants verified; no measured latency improvement claim. EVENTOUCH design MCP connected but same-name design project absent: verify association, do not create a replacement blindly.
- EVENTOUCH's separate codex MCP reports Connection closed; design MCP is connected and hosted Local Codex execution previously verified. Do not conflate these integrations; no fix to unrelated MCP configured as part of global guidance change.
