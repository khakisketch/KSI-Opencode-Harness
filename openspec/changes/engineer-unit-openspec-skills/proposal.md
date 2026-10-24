# Proposal

## Why

The harness repo has no machine-readable binding of the approved unit-routing
contract (complex technical work → Engineer unit, all UX/interface work →
Design unit, small clear fixes → General/direct permitted, Build owns the
product roadmap plus integration and final acceptance; the superseded
Architect file moved byte-identical to docs/archive/agents/architect.md,
outside Native discovery/settings) plus the OpenSpec
workflow and the project-local external skills.
Intent lives in session directives and in `global/` files owned elsewhere,
so a worker cannot verify compatibility without re-reading history.

## What Changes

- Adds one OpenSpec capability `engineer-workflow` with SHALL requirements
  binding the already-approved user intent (no new product scope).
- Records the OpenSpec 1.15.0 CLI baseline (`init`/`new`/`validate` discovery
  tested, not a custom adapter) and the generated-file boundary.
- Records the staged-skills set (6 skills, review-only in `/tmp`, no global
  install) and the duplicate/replacement decisions, so Main can coordinate
  the protected legacy gate.
- No code, runtime, session, API, credential, or shared-service changes.

## Capabilities

### New Capabilities

- `engineer-workflow`: binding requirements for the Engineer-unit operating
  contract, OpenSpec workflow usage, and staged external-skills compatibility.

### Modified Capabilities

(none — no existing `openspec/specs/` capability is modified by this change)

## Impact

- New files only: `openspec/changes/engineer-unit-openspec-skills/`,
  `openspec/specs/` delta via this change, `docs/openspec-and-skills.md`.
- Generated files from official CLI (`openspec init --tools opencode`):
  `openspec/config.yaml`, `.opencode/commands/opsx-*.md`,
  `.opencode/skills/openspec-*`. No hand-written adapter.
- Existing `AGENTS.md`, `global/`, `README.md`, installation/validation docs,
  tests, scripts, and archived history are untouched.
