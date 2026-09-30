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

## Current slice

- Name: design-workspace-separation (m04; source change, OpenDesign deployment, KSI design guidance, and global Design migration complete; user-visible acceptance pending)
- Acceptance (user-visible end-to-end): the harness installs only Developer/Test Runner/Reviewer; real design work happens in OpenDesign (people directly, Build through the MCP capability) against the KSI design-system package; the container's OpenCode runs on the user's real providers; and no session has to leave Build for a Design primary — Human end-to-end check still pending
- Plan ledger: docs/superpowers/plans/2026-09-30-design-workspace-separation.md
- Scope note: m03 is superseded rather than completed; its live-preview Design acceptance was never claimed and is no longer the intended workflow

## Next slices (미완(in_progress/blocked/proposed)만; done/abandoned/false_positive_complete 제외)

- m04 design-workspace-separation — remaining: Human end-to-end acceptance of the design flow

## Backlog

- (none open) — the 2026-09-23 item about `INSTALL.md` "권장 mapping" wording was resolved when INSTALL.md was rewritten on 2026-09-30
