# System-pass guidance — multi-screen visual-system recovery

Updated: 2026-10-05
Status: in progress
Owner: OpenCode Build

## Approved outcome

User approved ("진행해줘 그렇게 반영해줘") three targeted guidance improvements
following the EVENTOUCH root-cause review (patch-built screens, exception-heavy
theme, mockup/product divergence):

1. A system-pass priority rule: accumulated visual drift prefers audit →
   token/component scales → direction approval → one representative screen in the
   real source → staged rollout, not more per-screen patches or a big-bang rewrite.
2. A screen/file map requirement in the minimum product context for multi-screen work.
3. The same one-line principle in both project-guidance examples.

Deliberately not added now: further rules before the first real large-scale source
pass is observed; the beta.6 npm docs terminology lag stays for a possible future
release.

## Scope and workspace

- Global AGENTS.md + docs/integrations/opendesign.md + both examples.
- No product/mount/container/security change; no design generation; no push/publication.
- Owned workspace `.worktrees/system-pass-guidance`, branch
  `fix/system-pass-guidance-20261005`; base/target main `65d9e74`.
- Global policy backup `system-pass-guidance-20261005.qiq3tohc`; six config/role
  SHA256 baselines.

## Checklist

- [x] Confirm scope; create owned workspace; baseline check (112/111/0/1).
- [x] Apply the three approved edits.
- [x] Independent review and source/package/preservation checks.
- [x] Commit/integration, integrated check, cleanup and checkpoint.

## Verification

- Reviewer `ses_ef3b834f5ffebmaJeSl2OwSUaA` (read-only interpretation): six checks
  passed — drift routes to the system pass; no big-bang and staged per-stage
  checks; direction approval binds the system definition without weakening
  existing gates; functionality/routing/data freeze and one-writer preserved;
  screen/file map consistent with minimum-context privacy; global/guide/examples
  agree. One Low wording finding (per-stage checks missing in one example) fixed.
- Test-runner `ses_ef3b722efffeGHRWHtJQShmCJv`: `npm run check` exit 0 (112 tests /
  111 pass / 0 fail / 1 opt-in skip), `npm run check:package` exit 0, `git diff
  --check` exit 0; six preserved config/role hashes match; global AGENTS.md differs
  by exactly the one inserted bullet; repo changes confined to docs/examples plus
  the ledger. Logs: `/tmp/opencode/ksi-system-pass-{check,package,diff}.log`.
- Implementation `d4b084fa8f45c4fada74dd13c7154e9fa0e92f56` fast-forwarded into
  canonical main; the same test-runner (rebound to main) re-ran fresh checks:
  check 112/111/0/1, package pass, diff exit 0, six hashes match, committed change
  set docs/examples only, global diff exactly the one bullet. Logs:
  `/tmp/opencode/ksi-system-pass-merged-{check,package,diff}.log`.
- Owned workspace inspected including ignored files; the unique checkpoint was
  copied to the private backup before non-forced removal; merged branch deleted.
  Four unrelated worktrees retained. Change is local only — not pushed to GitHub,
  no npm release; the global rule is live immediately.

## Verification limits

Prose guidance: interpretation review, not runtime enforcement. The rule's
effectiveness depends on the first real multi-screen pass in EVENTOUCH; that
observation remains pending. No product design quality or acceptance claim.
