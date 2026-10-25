# Tasks

## 1. OpenSpec baseline

- [x] 1.1 Install `@fission-ai/openspec@latest` globally after authenticity
  checks (repo `Fission-AI/OpenSpec`, MIT, no install hooks) — actual 1.15.0
- [x] 1.2 Discovery-test `init --tools opencode` in probe dir; confirm
  generated shape (openspec/ + 6 commands + 6 skills)
- [x] 1.3 Run official `openspec init --tools opencode` in-repo (new files only)
- [x] 1.4 Author proposal/specs/design/tasks for this change per official schema

## 2. External-skills review and staging

- [x] 2.1 Shallow-clone candidates to private `/tmp` review dir (no install
  scripts executed)
- [x] 2.2 Review licenses/scripts/network/shell/autowrite/overlap; record
  findings in `docs/openspec-and-skills.md`
- [x] 2.3 Stage 6 gap skills byte-identical with provenance (SHAs, hashes)
- [x] 2.4 Global installation completed 2026-10-24 after all six legacy
  sessions were idle: new 8-role runtime applied, old roles retired to
  backup, and the 6 external skills installed under `~/.agents/skills/`.
  No fixed approval phase was added.

## 3. Verification

- [x] 3.1 `openspec validate engineer-unit-openspec-skills` passes
  (verified 2026-10-24: "Change 'engineer-unit-openspec-skills' is valid")
- [x] 3.2 OpenSpec CLI `init` itself preserved existing docs/source (new
  paths only: `openspec/`, generated `.opencode/` entries,
  `docs/openspec-and-skills.md`); main integration separately updates
  approved contracts via the source workstream, not this change

## 4. Role-contract audit (2026-10-24)

- [x] 4A.1 Audit Engineer vs General, Design ownership, Explore vs
  Research and cross-role loop boundaries; bind the resulting criteria in
  AGENTS and this capability's spec.
- [x] 4A.2 Retire the repo-bundled `task-first-ux-review` skill and
  `ksi-impeccable-detector` plugin; use the official Impeccable
  `detect --json` path and update role prompts, tests and docs.
- [x] 4A.3 Set Engineer/Design=high, Critic/Plan=xhigh, General=high,
  Research=medium trial, Explore=low; record the unverified-model caveat.
- [x] 4A.4 Reduce prompt duplication: remove four shared depth/handoff
  footers, consolidate overlapping role/AGENTS prose and strip non-actionable
  meta-disclaimers (7,600→3,712 words across the 5 files, -51.2%, all
  AGENTS.md lines <2,000 chars), and align Critic's prose allowlist with its
  12 permissions.
- [x] 4A.5 Re-run regression (102/102), OpenSpec (2/2), Native routing
  (327/327) and Native scripted verification (312/312); record evidence in
  `docs/validation.md`.
- [x] 4A.6 Trial-install `diagnosing-bugs` (Engineer) and `ux-copy`
  (Design/Critic); record provenance, role permissions and usage flows.
  Effect measurement remains pending.

## 5. Honest pending (change stays OPEN, no forced archive)

- [ ] 5.1 Model quality verification for role candidates (Engineer/Design/
  Plan/Research/Critic strings) — advisory only until evidence exists
- [ ] 5.2 Native render evidence for any adopted UI-affecting skill use
- [x] 5.3 Six external skills installed project-locally and globally with
  original bytes + per-skill MIT licenses and evidence artifacts (completed
  outside this change; this change records the compatibility rules).
- [ ] 5.4 Technical validation remainder (actual Muse single-model Engineer/
  Design/Plan and render evidence) — global runtime is applied and
  `agent-routing-native` passes 327/327; the current single-Muse
  configuration still lacks live Engineer/Design/Plan quality evidence.
  See `docs/engineer-routing-validation.md` (owned outside this change).
- [ ] 5.5 Measure the `diagnosing-bugs` and `ux-copy` trial over 2-3 real
  tasks; remove either if it adds calls without reducing rework or copy
  corrections.

## 6. User-approved minimal correction (2026-10-25)

- [x] 6.1 Replace harmful prompt constraints and distinguish binding contracts
  from revisable UI choices; align main/delta specs and concise guidance without
  new roles, stages, model/permission changes or third-party skill edits.
- [x] 6.2 Make session-audit completed-call and coverage reporting conservative;
  test synthetic failure/incomplete/output/file-identity cases without claiming
  product quality or reading/mutating actual product sessions.
- [x] 6.3 Run regression/spec/isolated Native checks, obtain scoped independent
  review, apply backed-up global prompts without restarting services/sessions,
  and correct validation provenance while leaving tasks §5 unchecked.
