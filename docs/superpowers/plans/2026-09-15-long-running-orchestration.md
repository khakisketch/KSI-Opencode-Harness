# Long-running Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce coordinator-only Build, restore bounded evidence after compaction/restart, and connect Research and delegated Design without expanding uncontrolled recursion.

**Architecture:** Fixed repository-evidence service first; role/lifecycle integration second; portable documentation and local activation last. One writer at a time in the existing clean checkout on improve/long-running-orchestration, explicitly selected by the user. No commits are authorized; review task-scoped worktree snapshots including untracked files.

**Tech Stack:** Node >=20 ESM, native OpenCode1.18.31 plugin hooks/tools, node:test, existing dependency-free package conventions.

**Spec:** docs/superpowers/specs/2026-09-15-long-running-orchestration-design.md

## Global Constraints

- Build never implements product code; Primary writes this plan/checkpoint and execution bookkeeping only. Worker owns implementation/configuration.
- One writer per worktree; no automatic commits/push/install/release. Existing user model/variant choices and shared Codex/Claude/Superpowers installations remain intact.
- Native permissions are not an OS sandbox. Do not introduce a language/keyword classifier for visual sufficiency or arbitrary shell effects.
- Conversation is transient; one chosen progress ledger owns execution, checkpoint is only a short recovery pointer. Native task registry is not a second plan.
- Preserve existing optional Developer Test Runner guards. No arbitrary compaction percentage or undocumented config field.

## Execution ledger

This section is this plan's sole task-progress ledger; the checkpoint points here. This explicit existing-plan ledger replaces a duplicate SDD progress file for this execution. Test results and scoped review snapshots provide evidence because commits are not authorized.

| Task | State | Ownership and dependency |
|---|---|---|
| 1 Repository evidence | complete | Primary fix round after cloud-Worker opt-in block; 12/12 targeted, 77/77 full at the time; traversal + clean-verify smoke PASS; independent reviewer unavailable, Primary inspected diff |
| 2 Roles and continuity | complete | Primary (cloud Worker dispatch blocked by provider opt-in); strict Build, research/design-task roles, continuity registry/reconcile/archive, contracts; 7/7 continuity tests |
| 3 Documentation and activation | complete | Primary; policy/docs/example/package updated, mobbin 5-10 rule scaled, native debug smoke PASS, no live provider/MCP changes, no restart yet |

Preflight: Task1 and2 share the repository service interface, not a writer; Task2 and3 share package/runtime behavior and run sequentially. Task1 must support uncommitted work because the global constraints forbid commits. Task2 must preserve helper lifecycle tests. Task3 must reconcile independently changed global routing instead of restoring old models.

### Task 1: Bounded repository evidence

**Files:** Create src/repository.mjs and test/repository.test.mjs. No changes to shared index/agents/package yet.

**Interfaces:** Export createRepositoryService({ worktree }) with async status(), snapshot({ paths }), verify({ snapshot }), and readCheckpoint(). Snapshot returns a generated identifier, immutable manifestPath/diffPath, fingerprint and coverage metadata; verify returns valid plus changed/unknown evidence. Paths are explicit worktree-relative task paths. No caller-controlled commands, revisions, output roots or arbitrary executable settings.

- [ ] Write temp-Git integration tests for staged+unstaged+untracked inclusion, later content drift, pre-existing dirty baseline, filenames with spaces, path traversal/symlink rejection, sensitive-file exclusion, output-size bounds and a Git root not equal to cwd.
- [ ] Run `node --test test/repository.test.mjs` before implementation and record the meaningful failure.
- [ ] Implement fixed Git observation using execFile without a shell, disabled optional locks/fsmonitor/external diff/textconv, concrete internal artifact paths, content fingerprints and explicit excluded/truncated coverage. readCheckpoint is bounded and does not grant paths mentioned inside it.
- [ ] Run targeted tests. Return interface details, changed files and short test evidence. Primary/reviewer inspect an actual worktree snapshot before accepting.

### Task 2: Strict roles, task identity and compaction recovery

**Files:** Modify index.mjs, src/agents.mjs, src/contracts.mjs, agents/design.md, agents/explore.md, agents/developer*.md, agents/reviewer.md and relevant tests. Create src/continuity.mjs, agents/build.md, agents/research.md, and tests/fixtures needed. Share the Design contract with a generated hidden design-task entrypoint rather than duplicating its design rules.

**Interfaces:** Consume Task1 createRepositoryService. Expose native ksi_repository for bounded status/snapshot/verify and ksi_reconcile for recovery. createContinuity receives native worktree/client and repository service, and supplies native hook helpers for task before/after, events and compaction context. Validate runtime args explicitly and verify schema compatibility with actual native plugin loading.

- [ ] Add failing tests: Build refuses product edits/bash/unknown execution while bookkeeping remains usable; role graph adds Research and Build→design-task, keeps Design and worker recursion denied; native model/variant preservation; no child checkpoint writes.
- [ ] Add recovery tests: first dispatch requires reconcile, compaction/restart requires renewed reconcile, stale/wrong-parent/wrong-role task_id rejected, known child repair accepted, unknown/unfinished task identity surfaced rather than silently restarted, existing helper behavior preserved.
- [ ] Add output tests: large final task output archived under a scoped generated artifact path with session/call provenance; Parent receives bounded preview+pointer+unknown/truncation notice; write/archive failure does not masquerade as successful complete output.
- [ ] Implement effective strict Build permissions and a narrow before-tool check. Add the fixed repository/reconcile tools without exposing unrestricted shell or arbitrary output locations. Retain scoped Design prototype permissions and an explicitly narrower hidden entrypoint.
- [ ] Add bounded compaction recovery pointers and native lifecycle/task identity records where required, with explicit limits on cross-process enforcement. Do not implement a speculative distributed scheduler or automatic product approval.
- [ ] Run targeted tests then `npm run check`. Return actual diff/snapshot pointers and escalate missing native API/lifecycle evidence instead of inventing it.

### Task 3: Portable policy, diagnostics and local activation

**Files:** instructions/harness.md, README.md, INSTALL.md, docs/{architecture,execution,design,verification,troubleshooting}.md, examples/design-handoff.md, examples/design.project.jsonc, opencode.jsonc.example, package.json and package-check tests/scripts as necessary. Approved local scope: /home/ksi/.config/opencode/{AGENTS.md,opencode.jsonc,mobbin-design.md} plus a narrowly scoped OpenCode launcher only if necessary and separately justified; no shared shell/Claude/Codex changes.

**Interfaces:** Document actual Task1/2 tools and contracts. Live config must preserve all current providers/models/MCPs/plugin pins, remove misleading Build broad execution grants, align Research/Design tooling, and retain automatic compaction settings. Add a selected-field capability diagnostic if necessary; never print credential-bearing full effective config.

- [ ] Update package allowlist/checks for shipped new runtime modules and prompts. Test renamed/added roles and installed package behavior rather than retaining obsolete six-role assumptions.
- [ ] Align Superpowers mapping: fresh child per task, same-task verified resume, one ledger, dirty-state review packages, bounded reports, no automatic commit or model substitution. Explain Primary bookkeeping vs product source writes.
- [ ] Document strict Build flow, Explore/Research output fields, Design missing-decision/approval handoff, compaction/restart reconciliation and worker failure handling. Remove duplicate test command requirements and unconditional5–10-reference search rule.
- [ ] Re-read live global configuration before patching only relevant settings. Activate websearch by a scoped supported mechanism if existing process/tool registration requires it; native settings alone must not be claimed to enable a missing tool. Do not install unrelated LSP/MCP packages.
- [ ] Run `npm run check`, `npm run check:package`, `git diff --check`, native isolated config/tool discovery, and targeted no-product-write recovery/permission smoke on OpenCode1.18.31. No full raw config or external model calls without need.
- [ ] Independent reviewer checks final actual diff against spec and test evidence. Primary records remaining runtime/model boundaries, idle checkpoint and restart instructions.

## Verification baseline

- Before edits: `npm run check` passed65/65 on2026-09-15.
- Native Test Runner dispatch failed before execution due loaded unsupported legacy model; no silent replacement. Primary can execute trusted tests, reviewer independently inspects artifacts.
