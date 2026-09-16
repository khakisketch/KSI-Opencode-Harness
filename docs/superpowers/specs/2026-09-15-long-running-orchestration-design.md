# Long-running orchestration design

Status: user approved implementation in the 2026-09-15 Plan-to-Build handoff.

## Objective

Make long tasks resumable and evidence-driven while keeping native OpenCode and official Superpowers. Build orchestrates and never implements product code; Design remains a user-facing Primary with a bounded delegated entrypoint.

## Authority and scope

- Plan owns requirements, architecture and acceptance. Build decomposes execution inside that approval, schedules workers, adjudicates evidence and completion, and writes bookkeeping only.
- Developer owns all product/configuration/integration changes, including small fixes. Batch related small tasks rather than adding a direct-Build exception.
- Design owns visual/interaction choices inside product scope and prototypes only. A hidden `design-task` subagent shares its design contract but has a separate, narrower execution profile. Only Build dispatches design-task; neither Design entrypoint recursively delegates.
- Explore investigates repository facts, optionally checking a directly relevant document. Research investigates external versioned documentation, upstream source/issues and alternatives. Neither modifies project source or makes final product decisions.
- Preserve native user model/variant choices, existing shared Codex/Claude configurations, official Superpowers installations, and existing opt-in Developer Test Runner behavior.

## Strict Build capabilities

Build has source reading, bounded repository evidence, questions/todos/skills and authorized task calls. Deny general shell, production edits and arbitrary MCP/custom execution. Allow only concrete bookkeeping paths for checkpoint, approved plan/spec documents and execution reports. Apply effective permissions and a narrow native before-tool check; do not claim an OS sandbox or shell-effect classification.

Repository evidence is prerequisite: a fixed-command Git reader reports worktree/HEAD/status and creates task-scoped immutable review artifacts including staged, unstaged and relevant untracked files. It returns paths and fingerprints, not a full diff in Parent context. Snapshot verification detects relevant content drift. It never commits, changes the index, invokes diff drivers/textconv/hooks, restores files or follows escaping paths/symlinks.

## Conversation, execution state and memory

Conversation is transient. Existing specs/project instructions own durable decisions. One selected task-progress ledger (existing tracker or SDD per-plan ledger) owns plan execution progress. `.opencode/working-state.md` remains the short resumability cache, not a second task database.

Native lifecycle records may retain task/session identity and unfinished calls; these are transport/recovery evidence, not a competing product plan. After compaction or process restart, require repository/checkpoint reconciliation before new Primary dispatch. Persist at semantic milestones; do not promise a checkpoint immediately before an unexpected interruption.

Keep native automatic compaction and existing user token settings. Inject bounded recovery pointers into compaction context, not all logs/history. Do not invent a percentage threshold or force a new Primary session per task. Use a fresh child for an independent task; same-task resume must resolve a real child owned by the calling parent, with compatible role/worktree/task binding. Missing identity blocks instead of silently starting again.

## Evidence and output

Worker reports distinguish completed implementation from verified completion. Review packages identify exact scoped content, including dirty/untracked changes without requiring commits. Independent reviewers get requirements, actual diff, tests and unknowns; Primary adjudicates findings and integration rather than duplicating the whole review.

Explore/Research return answer, evidence, implications, unknowns, coverage and references. Long results are retained as attributable task artifacts and reduced to a bounded Parent preview with an explicit pointer; no silent truncation or promotion of partial output to success. Read-only investigators do not gain unrestricted edit for report storage.

## Design sufficiency and approval

Before UI implementation, Build judges whether a relevant approved artifact or actual established design system/pattern resolves the task. Unresolved material hierarchy/interaction/fidelity requires Design; unrelated agreed work can continue. No keyword classifier or mandatory new design document for every tiny correction.

Delegated Design returns draft/rendered/needs-decision evidence, never Human approval. Build brokers user questions and records approval tied to artifact version/scope/user evidence. Root Design and delegated Design must not compete for the same prototype. Workers reuse approved prototype source and return missing material decisions.

## Acceptance

1. Build cannot use native production edit/shell/custom execution; allowed bookkeeping and repository observation work.
2. Explore and Research remain read-only; Research tools and sources are explicit. Design Primary and hidden design-task have distinct authority and no recursion.
3. Repository snapshot includes dirty/untracked task files and rejects unsafe paths; reviewers can inspect the exact package; later changes invalidate it.
4. Initial/restarted/compacted Primary cannot dispatch before reconciliation; stale or unrelated native task IDs are rejected.
5. Long child output is stored with provenance and an explicit bounded reference in Parent context.
6. Existing developer-helper safeguards still pass; models/variants are preserved; native step values remain user-owned.
7. Offline unit/package tests, actual native config/tool loading and targeted lifecycle smoke validate claims. Actual model-backed worker execution may be separately unavailable; report that boundary.

## Observed baseline

OpenCode 1.18.31; clean source main e11ea26 before creating improve/long-running-orchestration. Existing 65 tests pass. Active database is opencode.db; opencode-local.db has no sessions. Read-only audit at 2026-09-15T05:03:33Z sampled latest20 roots active in14days and78 descendants: Build root completed edit/write/apply_patch events215/60/38 and completed task calls74. Tool events include bookkeeping and are not a product-change count. Separate older/cap-excluded lineages contain actual compaction events; no causality/cost claim follows.

Current session Test Runner failed before execution because its loaded legacy model is unsupported. Live global model selections changed independently and must be preserved. Primary-run tests and independent code review are the fallback verification evidence, not mislabeled Test Runner execution.
