# Tasks

## 1. Source contract migration

- [x] 1.1 Rewrite `global/AGENTS.md` around five principles (goal/evidence/autonomy/responsibility/boundaries): Build product-goal/planning/decomposition/integration/acceptance ownership with direct-or-General execution (NOT ONLY tiny/single-file/UI-free, no mandatory Lead routing by complexity/file-count/domain); Lead full-task ownership (research/UX/design through implementation/test/recovery/completion, direct implementation plus zero/one/several Generals, accountable for the actual result) vs General task-execution ownership with self-verification; Plan mode `all` as a deliberate consultation exception (user-selectable OR optional Build/Lead advisory call, no forced stage/gate, no verification mandating/veto); result verification with OPTIONAL fresh-General checks (never a default stage/pass-gate/mandatory question) plus enforced-boundary limits and evidence honesty; remove 8-role edges, forced skill stages, mandatory lenses, CSS-authorship and single-file-only rules without weakening runtime/render/persistence/failure evidence.
- [x] 1.2 Rebuild `global/opencode.jsonc` agents block: keep Build primary with child edges for Lead/General/Explore+Plan (Lead child edges Plan/General/Explore); Plan mode `all` as a deliberate consultation exception (user-selectable OR optional Build/Lead advisory call — never a forced Plan stage or approval gate) with Native prompt/edit limits intact (no custom system/allowlist, no implementation, no requirement/product approval, never a verification approver/mandater/vetoer or review dispatcher; ANALYSIS-ONLY delegation within approval scope and depth); add `lead` (short responsibility prompt for full-task ownership from research/UX/design through implementation/test/recovery/completion — direct implementation plus zero/one/several Generals sequentially/parallel as useful — inheriting current Engineer `#xhigh`); restore General Native breadth (remove KSI skill-whitelist narrows; no child/question capabilities added as Native baseline and no mandated independent review; General self-verifies inside objective+scope and reports material uncertainty upward while explicit task-local review/analysis restrictions and higher-priority security policies remain valid); Explore Native code+web search with read-only analysis and searched-scope reporting (remove local-only confine); keep `subagent_depth: 3` as ceiling that the optional Build→Lead→Plan→General advisory chain MAY reach when consultation is chosen (a Plan at the cap analyzes directly and returns the gap); `system` untouched, compaction/`tool_output` omitted, `mcp.servers`/provider body byte-preserved.
- [x] 1.3 Add `global/agents/lead.md` (short responsibility prompt only: full-task ownership from research/UX/design through implementation/test/recovery/completion, direct implementation plus zero/one/several General workers sequentially/parallel as useful with objective+scope delegation and same-task session reuse, accountability for the actual result, evidence-backed return); DELETE `engineer.md`/`design.md`/`research.md`/`critic.md` outright with user approval after verifying their bytes against both private backup sets (removal ends their routing; underlying research/UX/verification abilities continue via Lead/General/Explore Native breadth). No `disabled` tombstone stands in for removal.
- [x] 1.4 Update `README.md` + `docs/installation.md` role tables and skill wording to five roles with Native behavior (skills on demand, detector optional); preserve unrelated history byte-for-byte.

## 2. Tests and scripts migration

- [x] 2.1 Migrate `scripts/capabilities.mjs` `TRACKED_AGENTS` (8→5) and role inventories; migrate `tests/capabilities.test.mjs` expectations without weakening secret-redaction or registration-absence guards.
- [x] 2.2 Migrate `tests/agent-routing-native.mjs` to five roles: Plan `all`, optional
  Build/Lead consultation, Build child edges Lead/General/Explore/Plan and Lead
  child edges Plan/General/Explore; no forced Plan stage or approval gate. Migrate
  the isolated Native integration fixture to direct General work, Lead execution,
  optional depth-3 analysis consultation, and question-driven optional independent
  checks. Include a positive completion path without independent LLM review, while
  preserving required evidence, unresolved-risk reporting and Build acceptance.
  A discovered material risk may receive a proportionate recheck, never a mandatory
  critique pipeline. Cover self-verification, failures and shared-file ownership;
  no new operating role, widened production permissions or model-quality claim.
- [x] 2.3 Migrate `tests/prompt-boundaries.test.mjs` sources to Lead + common AGENTS + Native edges (retire 3-specialist reads); assert the merged new contract plus preserved untouched requirements — never equality with this partial delta or the old change; keep old empirical tasks 5.1/5.2/5.4/5.5 open against the old change's frozen baseline.
- [x] 2.4 Remove normative optional-skill gap inference in `scripts/session-audit.mjs` (Design skill-mandate, visual-capture mandate, Critic lens mandate) while preserving completed/failed/incomplete separation, file/identity/coverage honesty, historical trace parsing and its tests; other existing suites change only with proven semantic migration (no pinned pass-count target for rewritten suites).

## 3. Spec reconciliation and validation

- [x] 3.1 At apply, merge this delta into `openspec/specs/engineer-workflow/spec.md` via the official delta merge/sync mechanism: seven modified requirements take the delta's content, three added requirements land (Five operating profiles and Native autonomy; Result verification with OPTIONAL independent checks and enforced boundaries; Retired operating profile removal and backup), six unchanged requirements (Native context, MCP, architect-retention, staged-skills, model-caveat, canonical workflow) stay preserved; leave `openspec/changes/engineer-unit-openspec-skills/*` files unchanged and its tasks 5.1/5.2/5.4/5.5 unchecked — no historical rewrite, no empirical done-marking.
- [x] 3.2 Record the merge output, which assertions changed and why (two open changes, one main spec), and both validation outputs; validation may check both artifacts without claiming old roles are current; never force-archive the old change to pass validation.
- [x] 3.3 Run `openspec validate task-completion-native-lead`, `openspec validate --all`,
  and a scoped `git diff` check; run the existing unit-regression suites and the
  updated isolated Native fixture (`node tests/delegation-native-integration.mjs`)
  with actual command/log/exit provenance (no pinned counts, no paid models).
  Prove General multi-file task execution, Build-direct General, Lead full-task
  execution (direct plus zero/one/several Generals), optional Plan consultation
  when chosen, a positive NO-independent-review completion path, and an OPTIONAL
  fresh restricted General check failing a write with bytes unchanged. These are
  mechanism proofs for the OPTIONAL restricted-verification capability only —
  not product-quality evidence and not a production gate. At apply,
  preserve unrelated prior hunks with backups and verify the approved delta
  relative to the working baseline; the proposal's 17-file byte identity is not
  a blanket freeze on files approved for implementation. No paid-model, remote
  MCP or browser calls are required for this configuration migration.

## 4. Deployment and retirement

- [x] 4.1 Backup-first deploy of config/roles; check for active legacy (Engineer/Design/Research/Critic) sessions and never force-end/switch them; stage retirement only after idle; no shared-service restart. After the user authorized removal, installed the 3 active files and removed the 4 retired operating files; private original backups retained. No active retired-role session existed before deployment.
- [x] 4.2 After deployment, run `node tests/agent-routing-native.mjs` and prove
  removal with merged discovery/permission output: only five operating profiles
  are offered, retired source/installed files are absent and fresh retired calls
  fail closed. Verify the original bytes in private backups, not active files.
  Record commands, logs and exit status. If these are not proved,
  deployment is blocked/partial and verification is not marked done; report the
  exact gap, with no hidden-equals-security claim or custom fallback framework.
  Installed check exited 0 (143 checks; `/tmp/opencode/ksi-agent-routing-CNrNfY`);
  all 3 active source/install files match and 4 retired originals match private
  backups. The source-identical isolated fixture exited 0 (355 checks;
  `/tmp/opencode/ksi-deleg-F4QPE1`), including an actual fresh Plan→Engineer
  `Unknown agent` failure with no child session. Deployment receipt and command
  logs: `/tmp/opencode/ksi-native-lead-deploy-wpt16al1/`.
- [x] 4.3 Report other projects' duplicated role instructions as conflicts only; auto-edit nothing outside this harness. Scoped root-instruction findings and unchanged project-specific procedures are recorded in `docs/engineer-routing-validation.md`; no other project was edited.
