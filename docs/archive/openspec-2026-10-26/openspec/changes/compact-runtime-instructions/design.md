# Design

## Context

See proposal.md for motivation. Baseline is clean HEAD `33ca659`; deployed active
files matched that commit before this review. Measured UTF-8 sizes are common
instructions 5,129 bytes, Lead file 1,933 bytes (body 1,371), and JSONC 4,735 bytes.
Build/Plan/General/Explore descriptions account for 2,022 bytes of the JSONC.

`tests/prompt-boundaries.test.mjs:18–73` locks English prose and headings.
`tests/delegation-native-integration.mjs:1091–1111` independently repeats those
locks. Its execution chains already test direct General work, Lead execution,
optional Plan consultation, no-review completion, depth, repair and session
restrictions. `tests/agent-routing-native.mjs:72` does not await async callbacks
used for file absence at lines 125, 133 and 162; it should report them after they
settle, not immediately.

Official V2 agents/config/permissions documentation and Context7 were read on
2026-10-26. General denies questions/subagents by default; Explore's base allow
surface excludes them. Plan ordinary-file edit denial does not restrict a
General child's permissions. Later global and agent permission rules can
override shipped defaults, so effective equivalence must be checked, not assumed.

## Goals / Non-Goals

**Goals:** Shorter always-injected instructions, clear dispatch descriptions,
wording-independent structural tests, unchanged effective operating boundaries.

**Non-Goals:** New architecture, roles, workflows, permissions, skills, review
gates, benchmark quotas, broad documentation cleanup or claims of better model
judgment. Main specs and the two prior changes stay unchanged.

## Decisions

1. Put shared behavior in one common prompt; keep role descriptions focused on
   selection and the Lead body on assigned end-to-end completion. Prefer positive
   autonomy over lists of former prohibitions. Do not enforce a byte/token quota.
   Retain a short reference to established project/spec authority and loaded skill
   limits, rather than repeating OpenSpec procedures.

   Proposed common content (editable wording, not a snapshot contract):

   ```markdown
   # Operating Principles

   - **Goal.** Deliver the approved user goal as working behavior. Ground important decisions in product purpose, user context, project authority, current code and runtime evidence. Preserve confirmed contracts and distinguish them from assumptions.
   - **Ownership.** Build owns product planning, workstreams, integration and final acceptance; it may implement or delegate directly. Lead owns assigned work end-to-end. General independently executes and verifies assigned tasks. Plan advises without implementation or approval authority; Explore searches and analyzes without implementation.
   - **Autonomy.** Choose methods, tools, skills, delegation and optional independent checks to suit the task. No fixed workflow or required review stage. Respect project processes and loaded skills' boundaries; resolve routine choices without repeated approval, asking when authority, safety or major user trade-offs require it.
   - **Verification.** Verify applicable behavior against the original goal before claiming completion. For UI work inspect real rendered states and interactions. Distinguish tested, simulated and unverified results, preserve required disclosures, and fix or explicitly report unresolved material risks.
   - **Coordination.** Delegate goals, confirmed constraints, scope and completion conditions. Keep one owner per shared file or state and verify delegated results before accepting them. Start fresh children for new tasks; resume only the same assignment. Respect depth limits without self-calls, child Build or returning a task through its ancestors.
   - **Boundaries.** Preserve others' changes, approved contracts, data and provider policies, permissions and authorized resources. Protect credentials, production, shared services and unapproved device/session state. Analysis-only scope also binds descendants. For strict non-mutation apply Native session restrictions before delegation or use actual isolation; an edit denial alone does not contain shell, browser or network effects. Never bypass restrictions through other tools or agents.
   ```

2. Proposed Lead body: “Own the assigned task from investigation and design through
   implementation, verification and recovery. Work directly or use General as
   useful. Check actual results and return the outcome, evidence and unresolved
   risks to Build.” Preserve frontmatter mode/model/child allowlist exactly apart
   from shortening its dispatch description.
3. Shorten Build/Plan/General descriptions to their distinguishing responsibilities;
   restore Native Explore description by omission. Preserve Native system prompts.
   Remove default Build/notify declarations only after an isolated comparison.
   Compare General/Explore effective permissions before omitting duplicate denies;
   if ordering or actual tool behavior widens access, retain the small deny rules.
4. Remove quotation/heading locks from both test files, not behavioral checks.
   Test parseable non-empty sources, model/mode/child-edge structure, retired-role
   absence and Native effects. Review the compact prose against protected clauses;
   neither keyword regexes nor scripted models certify semantic understanding.
5. Keep all Native execution coverage. No paid-model run or new independent-review
   stage is needed for this refactor. Report byte and word changes for the common
   prompt, Lead body and descriptions separately; do not call them measured token,
   latency or quality savings.

## Risks / Trade-offs

- [Risk] Removing repeated wording loses a real boundary → Compare the complete
  candidate against original goals, ownership, honest verification, protected
  state, analysis inheritance and explicit isolation before deployment.
- [Risk] Default omission changes ordered permission effects → Compare before/after
  normalized policies and real denies in private Native fixtures; keep overrides
  that are not equivalent. Never widen Plan children or alter existing sessions.
- [Risk] Tests become weaker while prose locks disappear → Retain the real write
  failure/bytes-unchanged, child-count, depth, resume/repair and completion chains;
  count changes are not acceptance targets.

## Migration Plan

At apply, back up the three matching active source/global files and protected
preferences. Verify source tests and an isolated Native comparison first, then
install only those three files without restart or existing-session mutation.
Run installed checks and inspect actual loaded roles, models, prompts and effects.
Record current evidence without rewriting historical results, commit and push
`main`, then compare remote commit, committed bytes and installed bytes. Backups
permit authorized recovery; no automatic rollback/fallback system is added.
