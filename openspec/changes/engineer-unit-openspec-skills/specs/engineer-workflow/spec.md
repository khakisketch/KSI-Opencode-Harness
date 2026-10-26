# Engineer-Workflow Specification

## Purpose

The engineer-workflow capability binds the approved unit-routing contract,
the canonical OpenSpec workflow, and the staged external-skills
compatibility rules for this harness repo. It introduces no new product
behavior beyond making that intent verifiable.

## ADDED Requirements

### Requirement: Unit routing contract

Complex technical implementation SHALL route to the Engineer unit, all
UX/interface work SHALL route to the Design unit, small clear fixes may go to
General or direct edits, and Build owns the product roadmap plus
integration and final acceptance. Engineer is an owner-unit, not the
product whole.

#### Scenario: Complex technical task arrives

- **WHEN** a complex technical implementation task enters the workflow
- **THEN** the Engineer unit owns it end-to-end within its assignment.

#### Scenario: UI change arrives

- **WHEN** any UX/interface change is requested (all sizes)
- **THEN** the Design unit owns it, not Engineer.

#### Scenario: Small clear fix arrives

- **WHEN** a small, unambiguous technical fix is requested
- **THEN** General or a direct edit is permitted without unit routing; a small UI fix still belongs to the Design unit and may use General for a settled slice.

#### Scenario: Integration and acceptance question

- **WHEN** integration scope or final acceptance is at stake
- **THEN** Build decides; no unit claims product-wide acceptance.

### Requirement: Work-unit ownership

Engineer SHALL own multi-step technical units with unresolved
implementation decisions, cross-file/contract/state changes, or
test/repair loops. General SHALL execute only bounded, already-decided
slices and SHALL NOT own a unit or make architecture, product or UX
decisions. Design SHALL own every UX/interface unit, including small UI
fixes, and MAY use General for settled UI slices without transferring
design ownership. One unit SHALL have one owner.

#### Scenario: Multi-step technical unit

- **WHEN** a task needs discovery, technical contract decisions, multiple
  files, or test/repair iterations
- **THEN** Engineer owns it; General receives only settled slices.

#### Scenario: Settled slice grows

- **WHEN** an assigned General slice needs discovery, design or multi-round
  coordination
- **THEN** the work returns to the owning Engineer or Design unit rather
  than General inventing scope.

#### Scenario: Small UI change

- **WHEN** a small UX/interface change is requested
- **THEN** Design owns it; Design executes simple single-file UI changes
  directly or uses General for a settled UI slice without becoming the design
  owner.

#### Scenario: Mixed technical and UX feature

- **WHEN** a product feature spans technical and UX units
- **THEN** Build (or the leading owner) defines the shared interface contract
  (API/data shapes, state transitions, error/recovery payloads, and
  file/browser ownership) before parallel or sequential execution; pure
  non-visual data/event wiring to an existing UI component may be completed
  within Engineer's integration while UX/interface changes remain with Design.

#### Scenario: UI result delivered

- **WHEN** a UI unit's implementation is delivered
- **THEN** Design verifies the actual rendered result against the original
  task, research/reference and design intent; an optional independent
  Critic review adds findings but does not transfer ownership or product
  acceptance.

#### Scenario: Explore or Research

- **WHEN** the question is bounded retrieval or source extraction
- **THEN** Explore is sufficient; **WHEN** sources conflict or
  alternatives, applicability or unknowns must be assessed, **THEN**
  Research is used.

### Requirement: Task-fit decisions and evidence boundaries

Owners SHALL establish product purpose, user environment, journey role and
domain invariants from project authority and connected code before decomposing
non-trivial work. Handoffs SHALL separate binding contracts from revisable
layout assumptions; author briefs SHALL NOT silently become product authority.

#### Scenario: Important UI assignment or review

- **WHEN** an important UI task is assigned or independently reviewed
- **THEN** original user goals and protected contracts govern the review, not
  only the author's edit list; applicable reference principles are checked
  against rendered decisions without a new mandatory report or score target.

#### Scenario: Accessible guidance and honest disclosure

- **WHEN** UI guidance, focus or provenance is refined
- **THEN** useful help, visible managed focus (including headings), and required
  prototype/simulation or decision-critical limits remain available; internal
  agent chatter is not confused with necessary product information.

#### Scenario: Media unavailable

- **WHEN** selected media is missing, expired or unavailable
- **THEN** recovery preserves selected asset/time/source identity and offers
  alternatives explicitly under the product contract, without fake pixels or
  silent data substitution.

#### Scenario: Mechanism or observation evidence reported

- **WHEN** checks, captures or offline session audits are reported
- **THEN** status/coverage limitations are explicit: path reads and command
  matches are observations, not relevance or success; incomplete calls and
  duplicate/anonymous snapshots do not establish an independent-session census,
  and no such evidence alone certifies comprehension, UX or product completion.

### Requirement: Loop boundaries

Cross-role calls SHALL require a distinct subdeliverable and SHALL NOT
bounce the same unit between roles. No role SHALL call itself or send the
same task back through an ancestor; depth limits bound the tree. Plan
SHALL remain analysis-only and SHALL NOT authorize implementation through
descendants.

#### Scenario: Cross-role loop

- **WHEN** a permitted role calls another role on the same unit
- **THEN** the call has a distinct subdeliverable, ownership stays fixed,
  no role calls itself or sends the task back through an ancestor, and
  depth limits bound the tree.

#### Scenario: Plan delegates analysis

- **WHEN** Plan calls Explore, Research or Critic for planning evidence
- **THEN** the call is limited to an analysis subdeliverable, and Plan does
  not call implementation-capable Engineer, Design or General or authorize
  implementation.

#### Scenario: Plan consultation

- **WHEN** requirements, priorities or direction are ambiguous, a major
  transition is due, or local fixes stall
- **THEN** the owner may consult Plan with original intent and actual
  evidence; Plan advises but does not authorize implementation.

### Requirement: External skills and detector policy

The workflow SHALL NOT bundle self-developed skills or a custom edit-hook
plugin. It SHALL use installed external skills from official sources and
the official Impeccable `detect --json` manual path. Removing a custom
plugin accepts the loss of automatic post-edit summaries. A skill workflow
that requires subagents, servers or writes unavailable to Research/Critic
SHALL be applied only as a scoped lens, with unavailable parts reported.

#### Scenario: Web UI edit

- **WHEN** Design edits web UI
- **THEN** it runs the installed official Impeccable detector manually and
  treats a clean source scan as source-only, not rendered UX verification.

#### Scenario: Skill needs unavailable operations

- **WHEN** an installed skill's full workflow needs subagents, a server or
  writes the role cannot perform
- **THEN** the role applies the allowed parts and reports the remainder as
  unavailable rather than bypassing permissions.

### Requirement: Canonical OpenSpec workflow usage

Workers SHALL use the official OpenSpec CLI (baseline 1.15.0) and its
`spec-driven` schema artifacts when appropriate for spec-affecting changes,
with no fixed every-step pipeline, and SHALL report when the installed CLI
surface actually differs from this baseline.

#### Scenario: Spec-affecting change

- **WHEN** a change alters requirements or product contracts
- **THEN** official artifacts (proposal/specs/design/tasks) record it as
  appropriate, small bug/style fixes are exempt, critic proposals alone do
  not count as requirements, and only a completed change is archived —
  routine completion is never forced through archive.

#### Scenario: CLI drift detected

- **WHEN** `openspec --help` / `schemas` / `templates` output differs from
  the 1.15.0 baseline recorded here
- **THEN** the worker records the actual commands and schema in the change
  instead of following obsolete instructions.

### Requirement: OpenSpec artifact ownership

Build SHALL own requirement approval, integration and archive; Engineer
SHALL own technical artifact content; Design SHALL own UX content; Plan MAY
analyze and propose but SHALL NOT write approved artifacts. A skill's
proposal/planning boundary SHALL take precedence over otherwise-continuing
implementation.

#### Scenario: Artifact update

- **WHEN** an approved OpenSpec artifact needs content changes
- **THEN** the owning Build/Engineer/Design role updates it; Plan does not
  write it and implementation evidence does not redefine the requirement.

#### Scenario: Proposal boundary

- **WHEN** an OpenSpec proposal or planning skill reaches its planning
  boundary
- **THEN** work stops at that boundary even if implementation was later
  requested; a new approval is needed to implement.

### Requirement: Staged-skills compatibility

The workflow SHALL preserve existing skill IDs, avoid same-ID collisions,
require a permissive license (MIT or Apache-2.0) plus script/permission review
for any external or trial skill, never execute a destructive installer, and
apply global changes only under active-config protection.

#### Scenario: Additive global install considered

- **WHEN** a staged or trial skill is installed project-locally or globally
- **THEN** its gap rationale, license (MIT for the 6 gap skills; MIT or
  Apache-2.0 for trial skills `diagnosing-bugs` and `ux-copy`),
  script/permission review, and overlap mapping are cited from
  `docs/openspec-and-skills.md`, existing IDs are preserved, the osmontero
  `install.sh` (destructive: removes non-repo skills, replaces global config)
  is never executed, trial skills are retained only if they reduce rework over
  2–3 real tasks, and workers do not mutate unapproved global state.

#### Scenario: Discovery is not application proof

- **WHEN** a skill is discovery-listed or permission-listed for a role
- **THEN** that alone is not proof of actual application; no change may
  mandate running all 6 skills, and each run cites its own evidence.

### Requirement: Architect file retention

The superseded Architect role file SHALL remain byte-identical at
`docs/archive/agents/architect.md`, outside Native discovery and settings
(the `agents.architect` JSON entry is removed, no default edges); it is
preserved until Plan advisory validation is actually sufficient, and final
deletion is undecided.

#### Scenario: Routing lookup excludes Architect

- **WHEN** default unit routing or discovery lists candidates
- **THEN** Architect is not offered (no settings entry, no default edges)
  while the archive file stays intact and owned outside this change.

#### Scenario: Final placement undecided

- **WHEN** Plan advisory validation is still insufficient
- **THEN** no final delete-or-keep decision is recorded; the file stays
  preserved and the decision stays open.

### Requirement: No unverified model requirements

The workflow SHALL NOT bake unverified model identifiers as requirements;
only adopted, evidence-backed selections may enter specs.

#### Scenario: Model selection

- **WHEN** a model is proposed for a role
- **THEN** it remains advisory prose until quality-verified, and specs
  reference roles and acceptance evidence, not model IDs.

### Requirement: Prompt role-boundary semantics

Role prompts SHALL report the actual problem resolution without inflating
cosmetic refinement into structural redesign, and SHALL load `ux-copy` only
when the task actually reviews user-facing copy. This correction SHALL
introduce no new roles, stages/approvals, mandatory Research/Critic loops,
quotas, scores, checklists/report files, or universal layout prescriptions,
and SHALL make no model/permission/skill changes beyond replacing the
approved prompt sentences.

#### Scenario: Existing structure already solves the problem

- **WHEN** the actual user task is resolved under protected constraints
  without changing the existing structure
- **THEN** keeping that structure counts as success, structural change is not
  required, and no cost/quality effect is claimed without real-task evidence.

#### Scenario: Design completes and reports a UI unit

- **WHEN** Design completes and reports any assigned UI unit, including a
  partially resolved one
- **THEN** it reports the actual requested resolution — task/IA/interaction
  changes, visual-only changes, and what of the original problem remains —
  owns adopt/adapt/reject over references and research, reads
  decision-relevant research before settling dependent decisions, and accepts
  retrospective or parallel research as valid input that may reopen a judgment;
  the existing structure may remain where it already solves the task, with
  neither keeping nor changing it required.

#### Scenario: Critic reviews a change

- **WHEN** Critic reviews an assigned change
- **THEN** it compares before/after only across a comparable viewport/device,
  data/identity and state, distinguishes changed from unchanged, and marks
  unmatched or unverified comparisons rather than claiming sameness (marking
  a missing baseline as a limit, with no fixed output form); it treats caller
  claims and supplied research recommendations as hypotheses, not truth,
  separates observation from interpretation from proposal, respects binding
  contracts while challenging only revisable choices — flagging a
  recommendation that conflicts with a binding contract as a CONTRACT-CHANGE
  PROPOSAL rather than an applicable defect fix — and neither downgrades
  structural findings into tweaks nor inflates cosmetic refinement
  into redesign.

#### Scenario: Research hands off evidence

- **WHEN** Research returns findings
- **THEN** it distinguishes primary docs, observed screens and cross-domain
  analogy in kind, keeps weak evidence and analogy from becoming strong
  product-specific design/technical conclusions, separates observed findings
  from inferred recommendations with their limits explicit so the owner can
  decide, and makes no final decisions.

### Requirement: Native context policy

Production configuration SHALL omit context-processing overrides so
OpenCode V2 Native chooses its own defaults: no KSI compaction values, no
DCP, no forced provider-native compaction, and no custom memory/prune/
summary prompt or provider compaction hook. Role, model, permission and
other preference entries SHALL remain as they are under this correction;
this requirement SHALL NOT be read as a perpetual ban on future unrelated
user-approved model, role or settings changes.

#### Scenario: Production config carries context overrides

- **WHEN** the production `global/opencode.jsonc` is read
- **THEN** it contains no top-level `compaction` or `tool_output` object
  and no DCP or compaction-agent override; no replacement default numbers
  are pinned anywhere in its place.

#### Scenario: Historical experiment referenced

- **WHEN** the 2026-10-17 compaction continuity experiment is cited
- **THEN** it is treated as a frozen historical fixture, not the current
  production configuration; its recorded numbers stay intact as experiment
  provenance and no new live benchmark or model run is required.

### Requirement: Native MCP server configuration

Production MCP configuration SHALL use the canonical V2 `mcp.servers`
shape with the two approved remote servers and default activation; legacy
`enabled` and NUMERIC `timeout` fields SHALL be omitted (purpose-specific
timeout objects remain valid when separately needed — this migration pins
none) and secrets SHALL stay as env references. Mobbin OAuth login SHALL
remain a user action in `/mcps`.

#### Scenario: Production config declares MCP servers

- **WHEN** the production `global/opencode.jsonc` is read
- **THEN** `mcp.servers` carries `mobbin`
  (`https://api.mobbin.com/mcp`, no explicit auth fields) and `context7`
  (`https://mcp.context7.com/mcp`, `CONTEXT7_API_KEY` header
  `{env:CONTEXT7_API_KEY}` literal, `oauth: false`); neither server pins
  `enabled` nor a numeric `timeout`, and no `disabled` entry is present
  for an active server.

#### Scenario: Mobbin unused

- **WHEN** Mobbin is not wanted
- **THEN** its entry MAY carry V2 `"disabled": true` or be removed; the
  harness works without it.

#### Scenario: Mobbin wanted but OAuth expired or revoked

- **WHEN** Mobbin is wanted but its OAuth session has expired or been revoked
- **THEN** the configuration is kept as-is — an expired or revoked session
  never triggers automatic deactivation or removal — the state is reported
  as needs-auth, and re-authentication is performed by the user in `/mcps`;
  recovery is verified by an actual readonly tool call, never by CLI
  inventory alone. No shell auth command, logout, token/cookie/credential
  reset or auto-login is part of this change.
