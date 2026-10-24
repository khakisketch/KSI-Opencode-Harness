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

## 4. Honest pending (change stays OPEN, no forced archive)

- [ ] 4.1 Model quality verification for role candidates (Engineer/Design/
  Plan/Research/Critic strings) — advisory only until evidence exists
- [ ] 4.2 Native render evidence for any adopted UI-affecting skill use
- [x] 4.3 Project-local 6 installed with original bytes + per-skill MIT
  licenses and evidence artifacts (completed outside this change; this
  change records the compatibility rules, not the install)
- [ ] 4.4 Technical validation remainder (global runtime Muse single-model/
  render gaps) — live chain already evidenced on earlier model configs, not
  untested: 31 tests, Build→Engineer→General→Critic repairs, Design worker;
  the current single-Muse configuration still lacks live Engineer/Design/
  Plan evidence. See `docs/engineer-routing-validation.md` (owned outside
  this change)
