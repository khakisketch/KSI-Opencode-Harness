# Design

## Context

- Original staging baseline: repo HEAD `adeaa3c`. `global/` agent/config/runtime files were owned by
  another workstream with uncommitted changes present; the original staging did
  not touch them. Reference contract: complex technical → Engineer,
  UX/interface → Design, small fixes → General/direct, Build owns roadmap +
  integration/final acceptance; `architect.md` moved byte-identical
  (sha256 e29693ea…, 9014 bytes) to `docs/archive/agents/architect.md`;
  `agents.architect` settings entry removed, no default edges; preserved
  until Plan advisory validation is actually sufficient, final deletion
  undecided (archive file itself owned outside this change).
- OpenSpec CLI 1.15.0 (`@fission-ai/openspec`, MIT, repo
  `github.com/Fission-AI/OpenSpec`) installed globally; `init --tools opencode`
  discovery-tested in a probe dir before running in-repo. Generated shape:
  `openspec/` + 6 `opsx-*` commands + 6 `openspec-*` skills. Chat form for this
  tool is `/opsx-propose` (hyphen), not `/opsx:propose`.
- Only the `spec-driven` schema exists in this CLI version
  (`openspec schemas` output); artifacts are proposal → specs → design → tasks.
- `propose`/`apply`/`update`/`sync`/`archive` are flexible workflow steps, not
  forced gates; small bug/style fixes are exempt per user directive.
- Model candidates named by Main (DeepSeek/GLM/Muse/Luna variants) are NOT
  quality-verified and are therefore not baked in as requirements.

## Goals / Non-Goals

**Goals:**

- Bind the approved Engineer-unit contract in SHALL form so future workers
  can validate compatibility mechanically.
- Keep OpenSpec usage canonical: official CLI + official schemas only.
- Stage (not install) the 6 gap-filling external skills with full provenance.

**Non-Goals:**

- No additional global skill installation; the historical staging gate and
  later installation are recorded in tasks §2/§5.
- The 2026-10-24 role-contract audit retires the repo-bundled
  `task-first-ux-review` and custom detector; this change's original staging
  scope did not install them globally.
- No new manager/router/memory-state framework or mandatory checklists.
- No mass rewrite of existing README/global role contracts or old history.

## Approved correction decisions (2026-10-25, baseline `58e75b6`)

- Replace overbroad prohibitions rather than adding stages: preserve useful help,
  visible managed focus, required provenance and honest prototype/simulation
  disclosure. Missing media must not silently substitute another selected asset.
- Existing handoffs separate authoritative constraints from revisable layouts;
  important reviews use original intent, not just the author's checklist. Link
  applicable reference principles to rendered choices without a new report form.
- The offline audit counts explicitly completed observed calls; image paths and
  command matches are candidates, not task relevance or test success. Report
  incomplete status and file/identity coverage rather than an independent-session
  census. No new evaluator or dependencies.
- OpenSpec owns testable requirements; `global/` owns concise executable prompts.
  Keep both coherent, without copying whole prompts into specs. Backup and compare
  installed bytes before/after applying only approved prompt files. No service or
  session restart, model/permission change, third-party skill edit or product edit.
- Static/regression/Native fixture checks verify mechanics only. Retain all four
  empirical gaps in tasks §5; no archive or product-quality claim from these checks.

## Decisions

1. **One capability (`engineer-workflow`)** instead of per-skill capabilities —
   the skills are staged, not adopted, so requirements bind the workflow and
   compatibility rules, not skill internals.
2. **`skip_specs` NOT set** — this change carries a real spec delta, so
   validation runs against it.
3. **Staging dir under `/tmp/opencode/`** (private, random suffix) with
   original bytes preserved; provenance file records source SHA, license,
   hashes, and SKILL paths.
4. **Duplicates rejected with rationale**: `designing-frontend-interfaces`
   (duplicates Impeccable), `reviewing-interface-quality` (duplicates
   Impeccable audit and the task-first lens now consolidated into Design's
   own task-comparison rule plus external UX skills). Documented, not
   installed.

## Risks / Trade-offs

- Risk: OpenSpec CLI version drift (propose/apply/archive surface may differ
  in future versions). Mitigation: version pinned in spec (1.15.0) and doc
  notes to report actual-vs-expected differences.
- Risk: staged skill content drifts from upstream. Mitigation: source SHAs
  recorded; re-review on update, never silent copy.
- Trade-off: single capability is coarser than per-skill specs, but matches
  the staged-not-adopted state; per-skill requirements belong to the future
  adoption change, not this one.

## Approved prompt-semantics correction (2026-10-26)

- Same no-new-machinery terms as the 2026-10-25 correction: replace and
  consolidate existing prompt sentences in `design.md`/`critic.md`/`research.md`
  bodies only (frontmatter byte-identical), conditionalize `ux-copy` on actual
  copy review, and keep original-task/managed-focus/media-identity/simulation
  guards intact. No new roles, stages, loops, quotas, scores, checklists,
  report files, model/permission/skill changes, or universal layout rules.
- Research keeps no final-decision authority; out of scope is any
  truncation/transport fix (final-text delivery already works). Design (when
  primary) owns UI-scope completion, never product-wide sign-off; Critic
  stays terminal with no subagents.

## Approved Native context policy (2026-10-26)

- Production `global/opencode.jsonc` omits top-level `compaction` and
  `tool_output` so OpenCode V2 Native chooses its own defaults; no KSI
  values, no DCP, no forced provider-native compaction, no replacement
  default numbers. All other bytes (roles, models, permissions, provider
  body, MCP, share/update/depth) are preserved.
- The 2026-10-17 compaction experiment is a frozen historical fixture:
  its recorded numbers stay intact as experiment provenance and are not
  the current production configuration. Live-test variants remain manual
  opt-in only with labels clarified as historical; no paid run, refactor
  or deletion. Tasks §5 stay open.

## Approved Native MCP V2 configuration (2026-10-26)

- Production `global/opencode.jsonc` carries the MCP block only as
  `mcp.servers` with two remote servers: `mobbin`
  (`https://api.mobbin.com/mcp`, OAuth default, no explicit auth fields)
  and `context7` (`https://mcp.context7.com/mcp`, `CONTEXT7_API_KEY`
  header `{env:CONTEXT7_API_KEY}` literal, `oauth: false`). No
  `enabled: true`, no numeric `timeout`, no per-purpose timeout object:
  default activation applies and deactivation is `"disabled": true`.
- `docs/installation.md` teaches the V2 shape (`mcp.servers`,
  `disabled: true`, user `/mcps` OAuth); unrelated historical records are
  preserved byte-for-byte.
- `tests/capabilities.test.mjs` guards the parsed V2 source objects
  (two server URLs, auth separation, default fields omitted) with the
  repo's JSONC comment-strip idiom; no secrets, no weakened guards.
- Parent-owned and out of this slice: global deploy, `/mcps` user-login
  evidence, installed-routing checks. Tasks §5 stay open.
