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
- The original staging scope made no code, runtime, session, API, credential,
  or shared-service changes. The approved follow-up below supersedes that limit
  only for the named harness files and backed-up global prompt installation.

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
- Original staging left existing `AGENTS.md`, `global/`, README, tests and scripts
  untouched; subsequent approved role-contract work is recorded in tasks §4.

## Approved minimal correction (2026-10-25)

The user approved removing harmful constraints, not adding another workflow.
Correct global prompts so help/focus and required disclosures remain usable,
fallback preserves selected data identity, and handoffs distinguish binding
contracts from revisable layout assumptions. Keep review anchored to the original
task rather than only the author's edit list. Correct offline audit observations
and overstated historical evidence in scripts/tests/docs. Align the capability
spec and apply backed-up prompts globally; do not change roles, models,
permissions, third-party skills, other products, or shared services. Real-product
design quality and autonomous completion remain unproven; tasks §5 stay open.

## Approved prompt-semantics correction (2026-10-26)

Follow-up to the two role-boundary recommendations, same no-new-machinery
terms: no new roles, stages/approvals, mandatory Research/Critic loops,
quotas, scores, checklists/report files, model/permission/skill changes beyond
the approved prompt sentences, or universal layout prescriptions. Design
reports the actual requested resolution — task/IA/interaction changes,
visual-only changes, and what of the original problem remains — without
inflating cosmetic refinement into structural redesign; Critic compares
before/after only across a comparable viewport/device, data/identity and
state, marks unmatched or unverified comparisons (and a missing baseline)
rather than claiming sameness, separates observation from interpretation from
proposal, treats research recommendations as hypotheses, and flags
contract-conflicting recommendations as CONTRACT-CHANGE PROPOSALs rather than
applicable defect fixes; `ux-copy` loads only when the task actually reviews
user-facing copy; Research stays evidence-only, distinguishing primary docs,
observed screens and cross-domain analogy in kind without letting weak
evidence become strong product-specific conclusions, separating observed
findings from inferred recommendations so the owner decides; Design owns
adopt/adapt/reject against the actual user task and protected constraints,
reading decision-relevant research before settling dependent decisions, while
retrospective/parallel research remains valid and may reopen a judgment.
Existing structures may remain where they already solve the problem, with
neither keeping nor changing required. No proven cost/quality effect
is claimed; tasks §5 stay open. Out of scope for this change: any
truncation/transport fix (final-text delivery already works).

## Approved Native context policy (2026-10-26)

The user explicitly requested Native handling for context settings
('압축 설정이던 뭐던 Opencode V2 네이티브로 해줘 우리 KSI로 설정하지 말고'):
remove the KSI compaction and `tool_output` context-processing overrides and
let OpenCode V2 itself choose defaults. No DCP, no forced provider-native
compaction, no copied default numbers. Role/model/permissions and other
preferences stay unchanged, as do the latest judgment guards (owned outside
this change). The 2026-10-17 compaction experiment becomes a frozen
historical fixture, not the current configuration; tasks §5 stay open and no
new live benchmark or model run is part of this change.

## Approved Native MCP V2 configuration (2026-10-26)

The user asked for MCP Native V2 cleanup plus Mobbin reconnect after
disconnect (official Mobbin MCP docs for other clients): the official
Mobbin endpoint `https://api.mobbin.com/mcp` uses StreamableHTTP+OAuth,
and the official V2 config shape is canonical `mcp.servers` (OpenCode V2
MCP-servers docs, already fetched by the parent). Convert only the `mcp`
block of `global/opencode.jsonc`: nest mobbin and context7 under
`mcp.servers`, keep both remote URLs, keep the Context7
`{env:CONTEXT7_API_KEY}` header literal with `oauth: false`, leave Mobbin
OAuth at its default, and omit legacy `enabled: true` and numeric
`timeout: 30000` so V2 Native defaults apply (default-enabled; optional
`disabled: true`). Migration is optional — the legacy shape still works —
so the old format is not diagnosed as broken. Context7 keeps its working
legacy-API-key env setup exactly. No new protocol, client registration,
timeouts or provider-fallback settings. Mobbin OAuth login stays a user
action in `/mcps`; no shell `mcp auth`, logout, token/cookie/credential
reset or auto-login. Tasks §5 stay open and no connected claim is made
from CLI inventory alone.
