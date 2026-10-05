# Product-aware design workflow — workstream ledger

Updated: 2026-10-05
Status: technically verified; local integration pending
Owner: OpenCode Build

## Approved outcome

User approved the preceding bounded proposal with “그렇게 개선해줘”: use Local
Codex as a design specialist working from actual product context, not an isolated
mockup generator. Strengthen the existing context/brief → UI artifact → faithful
product integration → product verification workflow. Direct product-source editing
is a capability-dependent, separately scoped option, not assumed or enabled here.

## Scope and workspace

- Existing global AGENTS.md plus shipped integration/execution guides and optional examples.
- Retain native Build/Plan/Explore prompts, model/permission/custom-role/plugin settings.
- No EVENTOUCH frontend edit, design generation, mount change, installation or deployment.
- Owned workspace `.worktrees/product-aware-design`, branch `fix/product-aware-design-20261005`.
- Base/integration target: local main `de1924f`.
- Global policy backup: `product-aware-design-20261005.d2mk9el0`; six config/role SHA256 baselines.

## Checklist

- [x] Confirm approved scope, inspect current guidance and actual prior project metadata.
- [x] Create owned workspace; baseline check: 112 tests / 111 pass / 0 fail / 1 opt-in skip.
- [x] Define product-context inputs, supported output contract and faithful integration.
- [x] Tighten approved-pattern exception and completion evidence without new approval gates.
- [x] Independent scenario review and source/package/preservation checks.
- [ ] Local commit/integration, integrated checks and safe owned-workspace cleanup.

## Verification limits

Prose-only guidance receives scenario interpretation review, not exact-wording
tests. Existing installer/package tests check regressions and delivery contents,
not design quality or live agent compliance. No provider-backed design/probe is
authorized by this harness-workflow task. Required live product/design acceptance
remains pending until a separately authorized product task uses the flow.

## Relevant evidence

- Previous read-only EVENTOUCH metadata: design entry `eventouch-operations.html`
  in managed design storage `/app/.od/projects/eventouch-a82e`; metadata did not
  establish product source linkage or framework execution. Not re-observed here.
- Existing integration guide already separates design authority from product
  integration and forbids concurrent writers; this change fills context/output
  and route-selection gaps rather than adding another agent or orchestrator.
- Actual global AGENTS.md receives four focused operating rules. The canonical
  integration guide contains minimum-context fields, a reusable compact brief,
  supported output/fallback rules, faithful adaptation and scoped feedback,
  source-direct capability prerequisites and completion evidence. Shipped examples
  and execution/architecture docs point to that flow; no helper/API/schema added.
- Independent reviewer `ses_ef5f63181ffecqEVTT5jXGSiBz` reviewed the six scoped
  scenarios: existing pattern versus new hierarchy, managed HTML versus source
  access, HTML-only adaptation, routine versus material integration differences,
  missing-design completion and source-direct ownership. No Medium/High/Critical
  findings; one nonblocking phrasing variation, same meaning. Interpretation only,
  not a model-behavior or visual-quality claim.
- Independent test-runner `ses_ef5f57912ffefy0eGr0HUfRuJT` at base `de1924f` plus
  pending docs: `npm run check` exit 0 (112 tests / 111 pass / 0 fail / 1 opt-in skip),
  `npm run check:package` exit 0 (offline installer/package verification),
  `git diff --check` exit 0. Six config/custom-role hashes match; actual global
  AGENTS.md is intentionally changed and separately backed up/reviewed.
  Logs: `/tmp/opencode/ksi-product-aware-design-{check,package,diff}.log`.
- Initial background reviewer/test-runner were cancelled without findings or
  verification; bounded foreground replacements supplied the evidence above.
  No result from cancelled helpers is treated as verification. Integrated check pending.
