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
- [ ] 2.4 Later global installation stays pending under active-config
  protection (project-local 6 decided and installed; workers write no
  global state; no fixed approval phase)

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
  footers and align Critic's prose allowlist with its 9 permissions.
- [x] 4A.5 Re-run regression, OpenSpec and Native scripted verification;
  record evidence in `docs/validation.md`.

## 5. Honest pending (change stays OPEN, no forced archive)

- [ ] 5.1 Model quality verification for role candidates (Engineer/Design/
  Plan/Research/Critic strings) — advisory only until evidence exists
- [ ] 5.2 Native render evidence for any adopted UI-affecting skill use
- [x] 5.3 Project-local 6 installed with original bytes + per-skill MIT
  licenses and evidence artifacts (completed outside this change; this
  change records the compatibility rules, not the install)
- [ ] 5.4 Technical validation remainder (global runtime Muse single-model/
  render gaps) — live chain already evidenced on earlier model configs, not
  untested: 31 tests, Build→Engineer→General→Critic repairs, Design worker;
  the current single-Muse configuration still lacks live Engineer/Design/
  Plan evidence. See `docs/engineer-routing-validation.md` (owned outside
  this change)
