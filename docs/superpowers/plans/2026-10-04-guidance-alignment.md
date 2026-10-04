# Guidance alignment — workstream ledger

Updated: 2026-10-04
Status: technically verified; local integration pending
Owner: OpenCode Build

## Approved scope

User approved the preceding bounded review with “개선해줘”: retain native
Build/Plan/Explore prompts, reconcile current policy with shipped guidance and
state, distinguish approved requirements from implementation evidence, and add
conditional next-task judgment without mandatory product-wide audits.
No model, permission, custom-role, plugin, goal, publication or deployment changes.

## Workspace

- Owned workspace: `.worktrees/guidance-alignment`
- Branch: `fix/guidance-alignment-20261004`
- Base and agreed local integration target: `main` at `407155365715fd57c174d516c27b14ab026479e6`
- Global AGENTS.md private backup: `guidance-alignment-20261004.f9ve7d7q`
- Configuration/custom-role SHA256 preservation snapshot: six files in that backup.

## Checklist

- [x] Read actual global policy, main source, checkpoint, product state and active ledger.
- [x] Confirm bounded scope and user's approval; create owned isolated workspace.
- [x] Baseline `npm run check`: 112 tests / 111 pass / 0 fail / 1 opt-in skip.
- [x] Align guidance and current state; annotate superseded historical decisions.
- [x] Independent read-only review of scope, contradictions and judgment scenarios.
- [x] Independent final source/package verification and configuration preservation.
- [ ] Verified local commit, integration, affected checks and owned-workspace cleanup.

## Verification contract

Existing suite/package checks cover installer behavior and packaging, not agent
judgment quality. Prose-only changes do not get exact-wording tests. Read-only
review must consider: a small bug fix, next-task prioritization with an obsolete
backlog item, implementation contradicting approved requirements, and default
design integration versus a new-direction gate. Review is interpretation evidence,
not a live product acceptance or proof of improved average model behavior.

## Evidence

- Official V2 agent `system` replaces the provider base; AGENTS.md remains an
  additional source, and instruction conflicts are not automatically resolved:
  https://opencode.ai/v2/docs/agents and https://opencode.ai/v2/docs/instructions.
- No native prompt replacement needed or authorized in this change.
- Actual global AGENTS.md updated (not only an optional example): requirements vs
  implementation state; conditional priorities; scoped requests; goal-relevant
  closeout candidates without invented counts; explicit review-first handoff gate.
- Reviewer `ses_ef9ab5b19ffeUtbxtQQvhx5mU7`: four interpretation scenarios reviewed;
  two gate-list omissions and one ambiguous supersession phrase identified and
  repaired. Focused recheck reports all three resolved, no outstanding findings.
  The notifier's actual message already includes review-first; no plugin edit.
- Independent test-runner `ses_ef9ab18deffeAxPByM7NN13gGc` initial run:
  `npm run check` exit 0, 112 tests / 111 pass / 0 fail / 1 opt-in skip;
  `npm run check:package` exit 0 (installer-only tarball/offline three-role install);
  `git diff --check` exit 0. Logs: `/tmp/opencode/ksi-guidance-alignment-{check,package,diff}.log`.
  Config/custom-role preservation: six SHA256 matches, zero mismatches/missing.
  Post-repair run by the same independent test-runner on staged documentation at
  source HEAD `4071553`: `npm run check` exit 0 (112/111/0/1),
  `npm run check:package` exit 0 and `git diff --cached --check` exit 0 including
  the added ledger. Logs: `/tmp/opencode/ksi-guidance-alignment-final-{check,package,diff}.log`.
  Six config/custom-role hashes still match. Global AGENTS.md is an intentional,
  separately reviewed edit, not one of those preserved paths.
  Integrated checks remain pending; no improved model-quality claim.
