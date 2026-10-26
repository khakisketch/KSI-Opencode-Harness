# Engineer-Workflow Specification

## Purpose

The engineer-workflow capability binds the approved unit-routing contract,
the canonical OpenSpec workflow, and the staged external-skills
compatibility rules for this harness repo. It introduces no new product
behavior beyond making that intent verifiable.

## Requirements

### Requirement: Unit routing contract

Build SHALL own product goal, planning, work decomposition, parallelism, dependencies, integration and final acceptance; it MAY implement directly or use General directly — NOT ONLY tiny/single-file/UI-free work — with no mandatory Lead routing by complexity/file-count/domain. When a unit IS assigned to Lead, Lead SHALL own the full task; small clear fixes (technical or UI) MAY go Build-direct or to General with no obligatory Lead stage; domain content SHALL never itself force Lead or specialist routing.

#### Scenario: Complex technical task arrives

- **WHEN** a complex technical implementation task enters the workflow
- **THEN** Build decides the assignment with no mandatory Lead routing by complexity/file-count/domain; when assigned to Lead, the Lead unit owns it end-to-end from research/UX/design through implementation/test/recovery/completion within its assignment.

#### Scenario: UI change arrives

- **WHEN** any UX/interface change is requested (all sizes)
- **THEN** routing follows assignment, not domain: small clear UI fixes may go Build-direct or General, larger units may go Lead or Build-direct/General as Build decides; no Design routing is imposed, and an assigned Lead owns the whole workflow from research/UX/design through implementation/test/recovery/completion.

#### Scenario: Small clear fix arrives

- **WHEN** a small, unambiguous fix is requested
- **THEN** Build handles it direct or via General with no obligatory Lead stage.

#### Scenario: Integration and acceptance question

- **WHEN** integration scope or final acceptance is at stake
- **THEN** Build decides; no unit claims product-wide acceptance.

#### Scenario: Planning and dependency question

- **WHEN** planning order or cross-unit dependencies are at stake
- **THEN** Build decides the sequence and shared contracts; Plan advises only.

### Requirement: Work-unit ownership

Lead SHALL own the full assigned task from research/UX/design through implementation/test/recovery/completion; it may implement directly and may use zero/one/several General workers sequentially/parallel as useful (not management-only) and remains accountable for the actual result. General SHALL own its assigned task execution: given an objective and scope it may investigate, make local design/UX/implementation decisions, and execute multi-file test/repair inside that scope. General SHALL complete its task, self-verify and return results/evidence normally, reporting material uncertainty upward; it gains no child/question capabilities (Native baseline) and takes on no mandated independent review — discovery, multi-file work, design or architecture questions alone are not escalation triggers, and explicit task-local review/analysis restrictions plus higher-priority security policies remain valid. Explore SHALL use Native code/web search with read-only analysis, analyzing and reporting its searched scope; it is neither product-acceptance owner nor implementation worker. Session reuse follows the same task. One unit SHALL have one owner.

#### Scenario: Multi-step technical unit

- **WHEN** a task needs discovery, contract decisions, multiple files, or test/repair iterations
- **THEN** an assigned Lead owns the full task from research/UX/design through implementation/test/recovery/completion (direct implementation plus zero/one/several Generals as useful), and General owns any task execution assigned to it within its objective and scope.

#### Scenario: Settled slice grows

- **WHEN** an assigned General task encounters discovery, design or multi-round coordination needs
- **THEN** General continues within its scope — investigating, deciding locally, executing multi-file test/repair — self-verifying, completing and returning results normally, reporting material uncertainty upward; it spawns no reviewer and gains no child/question capabilities, while explicit task-local or security-policy restrictions remain valid.

#### Scenario: Small UI change

- **WHEN** a small UX/interface change is requested
- **THEN** it may go Build-direct or General; if assigned to Lead, Lead owns the whole workflow; domain UI never forces Lead or Design routing.

#### Scenario: Mixed technical and UX feature

- **WHEN** a product feature spans technical and UX concerns
- **THEN** Build (or Lead within scope) defines the shared interface contract (API/data shapes, state transitions, error/recovery payloads, file/browser ownership) before parallel or sequential execution.

#### Scenario: UI result delivered

- **WHEN** a delivered unit contains UI content
- **THEN** the assigned responsible owner verifies the actual rendered result against the original task and protected contracts with applicable UI/render/interaction evidence plus code/tests/regression/runtime/persistence/failure as applicable; General self-verification stands for General-owned work and Build keeps final integration/acceptance; an OPTIONAL fresh-General check — only when Build (for product/integration/important risk) or Lead (for its OWN assigned scope) chooses it for a useful specific verification question — adds findings without transferring ownership or acceptance.

#### Scenario: Explore or Research

- **WHEN** the question is bounded retrieval or source extraction
- **THEN** Explore handles it with Native code/web search plus read-only analysis, reporting its searched scope; **WHEN** broader investigation, implementation or review inside an assigned objective and scope is needed, **THEN** General owns that task execution.

### Requirement: Task-fit decisions and evidence boundaries

Owners SHALL ground non-trivial work in product purpose, user environment, journey role and domain invariants before decomposing. Handoffs SHALL separate binding contracts from revisable assumptions. Applicable runtime/render/persistence/failure evidence SHALL be preserved; no quality claim SHALL rest on role counts or model variants.

#### Scenario: Important UI assignment or review

- **WHEN** an important task is assigned or independently reviewed
- **THEN** original user goals and protected contracts govern the review, not only the author's edit list; applicable reference principles are checked against rendered decisions without a new mandatory report or score target.

#### Scenario: Accessible guidance and honest disclosure

- **WHEN** UI guidance, focus or provenance is refined
- **THEN** useful help, visible managed focus (including headings), and required prototype/simulation or decision-critical limits remain available; internal agent chatter is not confused with necessary product information.

#### Scenario: Media unavailable

- **WHEN** selected media is missing, expired or unavailable
- **THEN** recovery preserves selected asset/time/source identity and offers alternatives explicitly under the product contract, without fake pixels or silent data substitution.

#### Scenario: Mechanism or observation evidence reported

- **WHEN** checks, captures or offline session audits are reported
- **THEN** status/coverage limitations are explicit: path reads and command matches are observations, not relevance or success; incomplete calls and duplicate/anonymous snapshots do not establish an independent-session census, and no such evidence alone certifies comprehension, UX or product completion.

### Requirement: Loop boundaries

Calls SHALL require a distinct subdeliverable with ownership fixed. No role SHALL call itself, Build SHALL NOT run as a child, and no task SHALL return through an ancestor. Build/Lead child allowlists include plan+general+explore (Build also lead); Plan runs mode `all` as a deliberate consultation exception (user-selectable OR optional Build/Lead advisory call — never a forced Plan stage or approval gate). The ceiling stays 3; the optional Build→Lead→Plan→General advisory chain MAY reach depth 3 when consultation is chosen (never required). Plan SHALL remain analysis-only with its approval scope preserved: ANALYSIS-ONLY delegation within scope and depth, never an implementation bypass, never an approver/mandater/vetoer of independent verification nor a review dispatcher; a Plan at the cap analyzes directly and returns the gap (no bypass).

#### Scenario: Cross-role loop

- **WHEN** a permitted role calls another role on the same unit
- **THEN** the call has a distinct subdeliverable, ownership stays fixed, no role calls itself or sends the task back through an ancestor, and depth limits bound the tree.

#### Scenario: Plan delegates analysis

- **WHEN** Plan delegates any work for planning evidence
- **THEN** the delegation stays analysis-only within Plan's approval scope and depth (Explore, or General for analysis only under explicit boundaries), and Plan authorizes no implementation and mandates/vetoes no verification; no blanket role-based ban is claimed as a Native feature.

#### Scenario: Plan consultation

- **WHEN** requirements, priorities or direction are ambiguous, a major transition is due, or local fixes stall
- **THEN** direction advice is obtained from user-selected Plan or from an optional Build/Lead advisory call to Plan (mode `all` as a deliberate consultation exception, not claimed as a Native default; no forced Plan stage and no Plan approval gate); Plan advises but does not authorize implementation, approve requirements/products, or approve/mandate/veto independent verification.

#### Scenario: Depth-3 helper needed in tests only

- **WHEN** the optional Build→Lead→Plan→General advisory chain is exercised
- **THEN** it MAY reach the retained ceiling of 3 when consultation is chosen — never required; production graphs are not capped at ≤2 by mandate, an isolated depth-3 fixture remains only a ceiling proof (not a new operating role and not widened production permissions), and a Plan at the cap analyzes directly and returns the gap.

### Requirement: External skills and detector policy

The workflow SHALL impose no mandated skill-load stages, mandatory lenses or sequences, role-owned CSS authorship, blanket visual prescriptions, or single-file-only limits. Tools and installed external skills SHALL be available on demand; each loaded skill's own limits are honored. General MAY use UX, research and security skills with no configuration whitelist. No new router, plugin, reviewer profile, report, scorecard or mandatory loop SHALL be introduced.

#### Scenario: Web UI edit

- **WHEN** web UI is edited
- **THEN** Impeccable detector use is optional — applied only when chosen as appropriate for the task, with no mandatory lens or sequence — and a clean source scan counts as source-only, never rendered verification.

#### Scenario: Skill needs unavailable operations

- **WHEN** an installed skill's full workflow needs subagents, a server or writes the role cannot perform
- **THEN** the role applies the allowed parts and reports the remainder as unavailable rather than bypassing permissions; loaded external or higher-authority skills' own limits are honored as stated limits.

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

Build SHALL own requirement approval, integration and archive; Lead SHALL own assigned-workflow artifact content; Plan MAY analyze and propose but SHALL NOT write approved artifacts. A skill's proposal/planning boundary SHALL take precedence over otherwise-continuing implementation.

#### Scenario: Artifact update

- **WHEN** an approved OpenSpec artifact needs content changes
- **THEN** the owning Build/Lead role updates it; Plan does not write it and implementation evidence does not redefine the requirement.

#### Scenario: Proposal boundary

- **WHEN** an OpenSpec proposal or planning skill reaches its planning boundary
- **THEN** work stops at that boundary even if implementation was later requested; a new approval is needed to implement.

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

Role prompts SHALL state short whole-workflow responsibility without merged multi-method prescriptions, forced skill stages, mandatory lenses, CSS-authorship mandates, blanket visual preferences, or single-file-only limits. The common contract SHALL center on goal, evidence, autonomy, responsibility and boundaries. No new roles beyond Lead, stages, loops, quotas, scores, checklists, report files, or layout prescriptions SHALL be introduced.

#### Scenario: Existing structure already solves the problem

- **WHEN** the actual user task is resolved under protected constraints without changing the existing structure
- **THEN** keeping that structure counts as success, structural change is not required, and no cost/quality effect is claimed without real-task evidence.

#### Scenario: Design completes and reports a UI unit

- **WHEN** the assigned owner completes any assigned unit with UI content, including a partially resolved one
- **THEN** it reports the actual requested resolution — task/IA/interaction changes, visual-only changes, and what of the original problem remains — with the existing structure allowed to stand where it already solves the task.

#### Scenario: Critic reviews a change

- **WHEN** a fresh General session is chosen to independently review a change against the original task plus actual output
- **THEN** it compares before/after only across a comparable viewport/device, data/identity and state, marks unmatched or unverified comparisons rather than claiming sameness, separates observation from interpretation from proposal, and flags contract-conflicting recommendations as CONTRACT-CHANGE PROPOSALs; it imposes no quota, score target or report file.

#### Scenario: Research hands off evidence

- **WHEN** evidence is gathered for the owner
- **THEN** Lead (or General within its assigned task, or Explore for searched evidence with read-only analysis) distinguishes primary docs, observed screens and cross-domain analogy in kind, keeps weak evidence from becoming strong product-specific conclusions, and separates observed findings from inferred recommendations so the owner decides; no new researcher role decides.

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
### Requirement: Five operating profiles and Native autonomy

Five default profiles SHALL operate: Build (primary), Plan (mode `all` — user-selectable OR optional Build/Lead advisory call), Lead (whole-workflow subagent owning the full assigned task), General (broad Native subagent: no child calls, no question tool), Explore (read-centric search subagent). KSI narrows on General and Explore SHALL be removed; removing Research/Design/Critic routing removes roles, not their research/UX/verification abilities.

#### Scenario: General receives an objective and scope

- **WHEN** General is assigned an objective and scope
- **THEN** it owns that task execution — investigating, making local design/UX/implementation decisions, executing multi-file test/repair, using UX/research/security skills as needed with no KSI configuration whitelist and no permanent KSI tool/skill whitelist — self-verifying, completing and returning results/evidence normally, and reporting material uncertainty upward; it gains no child/question capabilities (Native baseline) and takes on no mandated independent review, while explicit task-local review/analysis restrictions and higher-priority security policies remain valid.

#### Scenario: Explore searches beyond local files

- **WHEN** Explore handles a location + reference question
- **THEN** it may use Native code and web search within read-centric bounds; it still writes nothing and calls no subagent.

#### Scenario: Plan advises via consultation

- **WHEN** Plan is selected (user) or optionally called (Build/Lead advisory) for direction advice
- **THEN** it runs the Native prompt and permissions with mode-`all` breadth minus implementation (no custom system or allowlist; no implementation and no requirement/product approval; never an approver/mandater/vetoer of independent verification nor a review dispatcher), excluding implemented work by reconciling commits, working tree and files first; if it delegates any work it stays analysis-only within its approval scope and depth (General for analysis only, under explicit boundaries — never an implementation bypass); no Plan stage is forced and no Plan approval gate exists.

### Requirement: Result verification with OPTIONAL independent checks and enforced boundaries

Actual verification IS required; default work SHALL end when requirements are verified. Independent LLM critique SHALL NOT be a default stage, pass-gate, or mandatory question; no quota, no omission report, and no mandatory critic→fix→critic pipeline SHALL be imposed. Build chooses optional product/integration/risk checks and Lead for its OWN in-scope assignment; General self-verifies and escalates uncertainty; Plan never approves or mandates verification.

#### Scenario: Work completes without independent review

- **WHEN** requirements are verified with applicable code/tests/regression/runtime/render/interactions/persistence/failure evidence against the original task
- **THEN** the work MAY complete as verified without an independent LLM check, a per-task review question, or a justification report for not choosing review. This does not waive required evidence or unresolved material risks; Build retains final integration and acceptance.

#### Scenario: Optional independent check when chosen

- **WHEN** Build (for product/integration/important risk, including a specific integration-risk check) or Lead (for its OWN assigned scope within existing authorized resources/contracts/costs) chooses an independent check for a useful specific verification question
- **THEN** reproducible tests/static analysis come first, and a fresh uninvolved General session reviews the original task plus actual diffs/renders/evidence and returns findings without mutating the unit; Lead needs no Build approval within its authorized scope and Build may still request a specific integration-risk check; `No issue found` is valid, with no compelled findings or design-taste churn; concurrency/data-loss/security/migration/repeated-failure/UX-flow uncertainty alone never forces this check.

#### Scenario: Chosen check finds a real unresolved risk

- **WHEN** a chosen independent check reports a real unresolved risk
- **THEN** the owner resolves the material risk with a fix or evidence-backed refutation, or reports the affected outcome as unverified; it MAY choose a proportionate recheck without a mandatory critic→fix→critic pipeline or quota. Required security/safety checks and contractual human signoffs remain; no mandatory AI critic is added.

#### Scenario: Enforced non-mutation required

- **WHEN** a review must provably not mutate
- **THEN** the parent applies Native session denies (or a sandboxed fixture env) before spawning, and tests assert the denied operation fails closed with bytes unchanged; edit-deny alone does not stop shell/browser/network effects, and tests for the OPTIONAL capability prove mechanics only with no production gate/profile/plugin added.

### Requirement: Retired operating profile removal and backup

Superseded specialist operating files SHALL be removed from the repo and from
deployment; their last-approved contents SHALL stay recoverable from private
backups only. No `disabled` tombstone, hidden entry, or custom loader SHALL
stand in for removal.

#### Scenario: Default routing lookup after removal

- **WHEN** default unit routing or discovery lists candidates
- **THEN** only Build/Lead/General/Plan/Explore are offered; the four removed
  operating files exist in neither the repo nor the deployed agents directory,
  and no retired id resolves to a session.

#### Scenario: Retired call attempted

- **WHEN** a fresh call targets a retired operating id
- **THEN** it fails closed (AgentNotFound/absent-catalog error or explicit
  deny) and creates no child session; probe-level effects alone are never
  presented as exclusion proof.

#### Scenario: Originals retained privately

- **WHEN** the removed files' last-approved contents are needed
- **THEN** they are recovered from the private backups (receipts in the apply
  evidence dir), never auto-restored into the operating configuration; the
  archive `docs/archive/agents/architect.md` stays retained unchanged.
