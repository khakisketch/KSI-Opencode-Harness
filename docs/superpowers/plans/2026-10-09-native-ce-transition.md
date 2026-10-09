# Native-first global Compound Engineering transition

> Execution record for the user's approved operating-environment transition,
> not a new KSI framework or a product-development experiment.

**Goal:** Retire global Superpowers bootstrap, use native agents plus optional
Compound Engineering `compound-engineering-v3.30.4`, preserve product continuity.
**Architecture:** Native Plan/Build coordinate; General implements/tests;
Explore investigates; retained Reviewer is optional independent review.
OpenDesign keeps all visual source/rendered-review ownership.
**Spec / approval:** User's numbered 1–6 request, explicitly resolved through
the question card as “지금 1~6 전체 전환”. The appended baseline-first discussion
does not defer this approved transition. Installation is authorized; external
push/publication, product experiments and other-session interruption are not.
**Workspace/base:** canonical `main`, `260f53f`; no new worktree, no product writes.

## Preserved contracts

- Do not change native Plan/Build/General/Explore system prompts, other models,
  permissions, MCP, unrelated plugins, or another tool's independent install.
- Preserve `docs/superpowers/`, `.superpowers/sdd/`, PRDs, plans, evidence, Git
  and state-script paths. No project `ce-setup` or generated document by default.
- General remains multipurpose, Muse Spark high, without a General-specific cap.
  Preserve Developer/Test Runner definitions and routing before disabling them;
  keep customized Reviewer and its independent read-only contract.
- Skills are optional tools, not a mandatory whole pipeline. CE cannot authorize
  unapproved push/PR/deploy, code disclosure, extra model/service use or installs.
- Do not interrupt/pause another session or Goal. Cutover requires a safe owning
  session boundary and an authenticated route to the actual serving process.
- No npm release, default-bundle rewrite or new custom agent/skill in this task.

## Survey / verified evidence (2026-10-09)

- Host OpenCode `2.0.24`. Managed service PID796278 has no foreground drains at
  lookup. Its authenticated native CLI reads confirm global sources
  `/home/ksi/.config/opencode/opencode.json`, `opencode.jsonc`, that directory's
  agents/plugins and `/home/ksi/.opencode` discovery. Superpowers is active,
  15 upstream skills among 39; no CE skills. Goal/notifier plugins are active.
- General effective model = Muse Spark 1.3 Contributor high, no `steps` or system
  override. Developer = same model, steps80; Test Runner = LongCat, steps24;
  Reviewer = Muse Spark xhigh, steps32. Native General and Developer both deny
  child delegation; they are not identical profiles. Keep assignment scope,
  author-test evidence and fresh independent-review children; do not copy the
  Developer system prompt or its finite cap into General.
- OpenChamber app PID3021 owns OpenCode PID4902. Launch metadata selects
  `/home/ksi/.config/openchamber/opencode.managed.json`; this supplements, not
  substitutes for proving, actual resolved global config. It contains browser
  exclusion and the app's agent-tool plugin, no role/skill overrides.
  Bare explicit-server/proxy calls return401. Recovered through the installed
  official CLI's existing authentication client (`cli-http.js:requestJson`),
  without manual credential extraction, copied headers or shared passwords.
  Actual app proxy confirms PID4902/version2.0.24 and both global documents plus
  its managed document. It has no foreground drains at lookup; Site's official
  session-status command reports idle, but the native Goal remains active.
- OpenChamber catalog discrepancy: root and explicit harness/Site/EVENTOUCH
  locations return no plugins, only native unconfigured agent profiles and two
  skills, despite configuration discovery naming the global documents. Explicit
  location resolution is confirmed; the wrong-location hypothesis is rejected.
  Do not infer effective global model/skill activation from source documents,
  or compensate with project-local copies. Source/router/cache cause remains
  unverified; investigate supported scoped reload only at the safe boundary.
- A third host listener, PID195177 at port4096, also uses the host home/config
  defaults. Its explicit native client requires authentication; it is not the
  discovered managed service. Preserve it, do not restart it or extract secrets.
  Its live drains/catalog remain unverified. The separate design-container
  process has a different home and is not a host-global migration target.
- Native goals: Site Intelligence session `ses_f0e6f0de9ffeYR7ZKuiu9uth3z` is
  active; Safety Edge is budgetLimited; EVENTOUCH goal complete. Project-list
  design statuses are terminal/not-started; notifier has two stale failed
  requests with no run IDs, not confirmed in-flight executions. No switches changed.
- Site Intelligence main is clean, 150 local commits ahead at lookup. Safety
  Edge has tracked/untracked Replay changes; EVENTOUCH PostgreSQL worktree has
  untracked design evidence. Preserve all; no ownership transfer or intervention.
- Inspected OpenCode skill/plugin roots, compatibility skill roots and legacy
  manifests show no active Superpowers symlink or package-manifest dependency.
  The native package plugin is the confirmed registration source; caches and
  unrelated tool installs are not authorized cleanup targets.
- Official release tag resolves to `efcb657d9a5733ccc154c36cc7d3d78b4136eb23`.
  Tag-specific installer/plugin source confirms a V2 `setup` registering skills
  and commands, without a controller bootstrap. Its package version is3.30.4;
  ce-ideate/ce-explain/ce-work/ce-compound are present with sibling-reference
  dependencies. Static evidence, not installation or runtime compatibility proof.
- Private backup/evidence:
  `/tmp/opencode/ksi-native-ce-transition-20261009-x32huz_j/`.
  Seven owner-confirmed configuration/policy/role files backed up; manifest
  preserves SHA256, UID and modes; owner-private directory/files.
  Authenticated native API captures are private. CLI stdout must target a regular
  file for large responses; pipe captures truncated skill/OpenAPI JSON and are
  not accepted as catalog evidence. No sensitive contents copied into Git.

### Extended dependency inventory (2026-10-09, later read-only pass)

- `opencode plugin list` confirms exactly three active plugin sources: pinned
  `superpowers` (JSONC entry), `local.goal-mode.server` 0.1.54 (goal plugin) and
  local `ksi.design-notifier` auto-discovered from `~/.config/opencode/plugins/`
  (not a JSONC entry). Compound Engineering is not installed yet.
- The resolved skill catalog is 39 skills: 15 superpowers; built-in `opencode` and
  `report`; 17 discovered from compatibility roots — 8 KSI (client-intake, contract,
  design-proposal, labor-report, project-docs, proposal-message, quotation,
  tier-proposal) plus docs, docx, google-workspace, import-memory, morning, pdf,
  pptx, skill-creator and xlsx from `~/.claude/skills/synced/<bucket>/`; `grill-me`
  and `ui-ux-pro-max` from `~/.agents/skills`; `agent-browser`, `mobbin-design` and
  `playwright-cli` from `~/.config/opencode/skills`. No duplicate IDs observed.
  Global JSONC has no `skills` array; discovery is via roots only.
- Official V2 docs confirm the discovery set (global `~/.config/opencode/skills`;
  compatibility `~/.claude/skills` and `~/.agents/skills`; project
  `.opencode|.claude|.agents/skills`; explicit `skills` arrays) and plugin discovery
  including the global plugins directory. `opencode debug paths|config|agents`,
  `opencode plugin list` all work against the managed service.
- Active agents: build/plan (primary), general/explore/developer/reviewer/test-runner
  (subagents) plus hidden built-ins. Test Runner's residual global file and routing
  are confirmed active. `design.md`, `design-critic.md` and `research.md` exist only
  as inactive `.bak-*` files in the global agents dir; their final disposition is a
  cleanup-stage item, not an active role.
- Active MCP servers in resolved config and live session tools: context7, mobbin,
  opendesign (od-mcp-host proxy), playwright. `opencode mcp list` returned
  "No MCP servers configured", disagreeing with both the resolved config and the
  live tools; do not use that command as the active-MCP source of truth in 2.0.24.
- Candidate corrections: `impeccable-design-polish` and `web-design-guidelines` are
  not global installs — they exist only as OpenDesign project assets in
  `EVENTOUCH .../.od-skills/` (with design-review, frontend-design, od-design-refine),
  used by current runs; preserve. `frontend-design` is a Claude Code official plugin
  cache under `~/.claude/plugins/`, not OpenCode-discovered. GStack is not installed
  in any user config root; only OpenDesign's own catalog references it upstream.
  `ui-ux-pro-max` is active via the shared `~/.agents/skills` root; OpenCode-side
  de-listing should use a `skill` permission deny rather than deleting a shared
  install, and stays a separate single-variable decision from the SP/CE switch.
  '고리' is not present in the active inventory; identification is still pending.
- Goals re-check: Safety Edge and EVENTOUCH goals are complete; the Site Intelligence
  goal remains active — cutover gate unchanged. No runtime, config, product or
  shared-install change occurred in this read-only pass.

## Ordered execution and checks

- [x] **1. Survey and backup:** real process/config identities, effective native
  catalog/routing, goals/designs, foreign Git status, owner/private backups.
  Actual OpenChamber reads recovered; catalog discrepancy and the third listener
  are explicit unresolved survey limits. Backups revalidated after interruption.
- [ ] **2. Confirm safe cutover:** Site Intelligence owner pauses/finishes;
  reuse the working official OpenChamber authentication client, and resolve the
  third listener through its supported connection. Recheck serving processes'
  drains and dependent runs; an idle drain alone does not pause a live Goal's
  implementation/review contract. Never pause another Goal implicitly.
- [ ] **3. Apply backed-up global cutover:** replace only the Superpowers plugin
  entry with the official pinned CE git-spec; eliminate confirmed OpenCode-owned
  active duplicates only. Preserve upstream/cache/other-tool copies and history.
  Disable Developer/Test Runner while keeping their settings recoverable; verify
  that later agent-file discovery does not resurrect them. Reviewer unchanged.
- [ ] **4. Simplify global policy:** apply the prepared private AGENTS candidate
  after checking it against preserved contracts. No native system-prompt edits,
  recursive orchestration or required per-task framework stages. Verify exact
  non-target settings/role hashes and semantic config preservation.
- [ ] **5. Refresh and verify actual servers:** use supported scoped reload; a
  disruptive restart requires the verified safe boundary. Confirm CE's exact
  resolved tag/source and requested skills/commands, no Superpowers registration,
  no bootstrap in a new session, inactive retired roles, unchanged native prompts,
  models/permissions/MCP/notifier and Reviewer. Registration is not functional proof.
- [ ] **6. Cross-project smoke and closeout:** in two existing project locations,
  verify effective global catalog and read-only skill use from fresh task-owned
  sessions, no project installs/setup/docs or product modification. Inspect rendered
  prompt context for absence of bootstrap; retain response/evidence limits. Review
  the actual config/policy diff, reconcile records, report technical completion
  separately from product acceptance, efficiency benchmarking and external delivery.

## Review focus

- Actual server differs from the managed CLI: require both identities/catalogs.
- Config/Markdown precedence can revive retired agents: check actual catalogs.
- Shared installs or references look like duplicates: archive only owned active
  OpenCode registrations, never delete shared source or historical records.
- CE workflows propose external effects: scope/permissions still govern execution.
- Reload during a Goal/design drain can change a running task: do not cut over
  until the owning session is safe; retain exact rollback bytes and pending work.

## Current outcome / blocker

Survey and private backup prepared; **no global cutover, role disabling, install,
policy replacement, server restart, new execution Goal or product trial performed**.
Prepared policy candidate is private and inactive. Required blockers are the
active Site Intelligence Goal and unverified shared listener at4096. OpenChamber
authentication is recovered, not a remaining credential request; its runtime
catalog discrepancy still needs safe-boundary investigation. The candidate is
91lines/6026bytes versus active124lines/51353bytes, chmod600, not applied;
SHA256 `c2cd30137097e46729be4aec0602930d24835f899bb1319655760587fe90d330`.
All seven backed-up live files remain byte-identical after the interruption.
Continue from step2 when safety/access conditions are resolved; do not repeat
approval of the already selected transition scope. No timing/efficiency or
complete migration claim is made by these preparation records.

Later same-day read-only inventory (above) extended the candidate list and
corrected three assumptions: OpenDesign project skills are not global legacy
installs; a Claude-official plugin is not a KSI skill; shared compatibility roots
(`~/.claude/skills`, `~/.agents/skills`) belong to other tools and are not
OpenCode-owned deletion targets. Blockers unchanged: active Site Intelligence
goal, unverified listener4096, OpenChamber catalog discrepancy.

Preparation verification above `260f53f`: `git diff --check` passes, the new
product-state plan link resolves, all seven live/source backup hashes match,
private directory700/backup+candidate600 confirmed. Only this ledger and
product-state are pending tracked-record changes. No source test replay for
record-only preparation, no claimed role/skill/new-session smoke result.
