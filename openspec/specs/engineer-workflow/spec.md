# Engineer-Workflow Specification

## Purpose

The engineer-workflow capability binds the approved unit-routing contract,
the canonical OpenSpec workflow, and the staged external-skills
compatibility rules for this harness repo. It introduces no new product
behavior beyond making that intent verifiable.

## Requirements

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
