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
| m05 | Three-role beta release and readable onboarding | in_progress | User approved GitHub/npm beta release and separate-tool installation boundaries 2026-09-30; same release ledger |

## Current slice

- Name: three-role-beta-release (m05; user prioritized harness release and README over optional CLI troubleshooting)
- Acceptance (user-visible): GitHub source/release and npm `0.5.0-beta.1` are available; a clean consumer can preview/apply exactly three roles; README explains actual responsibilities, usage, and separate optional tool installation. Design direction/production implementation acceptance remains separately pending under m04.
- Plan ledger: docs/superpowers/plans/2026-09-30-design-workspace-separation.md
- Scope note: m03 is superseded rather than completed; its live-preview Design acceptance was never claimed and is no longer the intended workflow

## Next slices (미완(in_progress/blocked/proposed)만; done/abandoned/false_positive_complete 제외)

- m04 design-workspace-separation — remaining: Human end-to-end acceptance of the design flow
- m05 three-role-beta-release — remaining: reviewed documentation, public GitHub/npm publication and published-package installation verification

## Backlog

- Codex intermittent connection-test failures: investigate if recurring; not a release blocker per user. Account policy restrictions are expected, not an installation defect.
- Design integration: automatic MCP recovery after daemon/container restart and default artifact-entry lookup remain unverified/problematic; explicit project reconnect and explicit file arguments work.
