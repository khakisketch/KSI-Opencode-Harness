# Spec Delta

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

- **WHEN** a small, unambiguous fix is requested
- **THEN** General or a direct edit is permitted without unit routing.

#### Scenario: Integration and acceptance question

- **WHEN** integration scope or final acceptance is at stake
- **THEN** Build decides; no unit claims product-wide acceptance.

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

### Requirement: Staged-skills compatibility

The workflow SHALL preserve existing skill IDs, avoid same-ID collisions,
require an MIT license plus script/permission review for any selected-gap
skill, and never execute a destructive installer. Project-local adoption
of 6 skills is decided; later global installation stays pending under
active-config protection, with no fixed approval phase.

#### Scenario: Additive global install considered

- **WHEN** a staged skill is proposed for additive global installation
- **THEN** its gap rationale, license, script/permission review, and overlap
  mapping are cited from `docs/openspec-and-skills.md`, existing IDs and
  the active role config are left untouched, the osmontero `install.sh`
  (destructive: removes non-repo skills, replaces global config) is never
  executed, and workers do not write global state.

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
