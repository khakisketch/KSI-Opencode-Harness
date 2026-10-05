# Review-once flow — less ceremony for internal design passes

Updated: 2026-10-06
Status: technically complete locally; human real-use acceptance separate
Owner: OpenCode Build

## Approved outcome

User approved ("그렇게 해보자") three relaxations of the design flow, aimed at
less round-trip ceremony without weakening real boundaries:

1. Review-once rule: for internal tools that keep the existing brand, a
   visual-system pass no longer waits for a separate plan approval — it goes to
   one representative screen (verified build/tests/render) and presents the
   definition, scope and real result as a single review; pre-approval remains for
   a new visual direction, a client-facing deliverable, an out-of-scope change or
   an explicit review-first request.
2. Decision batching: unavoidable decision batches come once with a recommended
   default per item, so a single approval settles the batch.
3. Rollout autonomy: after the single review, screens roll out with per-stage
   checks and without per-screen user approvals, reported once at completion.

Deferred by agreement: a wider "guidance diet" (④) waits until after the first
real pass shows which rules actually chafe.

## Scope and workspace

- Global AGENTS.md + docs/integrations/opendesign.md + both examples.
- No product/mount/container/security change; no design generation; no push/publication.
- Owned workspace `.worktrees/review-once-flow`, branch
  `fix/review-once-flow-20261005`; base/target main `056b29c`.
- Global policy backup `review-once-flow-20261005.hrsvt822`; six config/role
  SHA256 baselines.

## Checklist

- [x] Confirm scope; create owned workspace.
- [x] Apply the three approved edits (global ×2, guide ×1, examples ×2).
- [x] Baseline/final checks + independent review.
- [x] Commit/integration, integrated check, cleanup and checkpoint.

## Verification

- Reviewer `ses_ef385cc9cffeD4ZuUSaXx6IniU` (read-only interpretation): all six
  checks passed — the three relaxations are implemented; the four gates,
  one-writer, functionality/routing/data freeze and staged per-stage checks stay
  intact; three Low/Info wording findings (example qualifier, rollout
  explicitness, batching sentence in the autonomy example) fixed by aligning both
  examples with the guide.
- Test-runner `ses_ef3841fe8ffe1Wn822liQtn2bI`: `npm run check` exit 0
  (112/111/0/1), `npm run check:package` exit 0, `git diff --check` exit 0; six
  preserved config/role hashes match; global AGENTS.md changed by exactly the two
  intended bullet edits; repo paths confined to docs/examples plus the new
  ledger. Logs: `/tmp/opencode/ksi-review-once-{check,package,diff}.log`.
- Closeout reconciled 2026-10-06: Git contains `ea8b514` on main (implementation
  commit). The previous independent test-runner session above also ran fresh
  integrated checks at that revision: 112 tests/111 pass/0 fail/1 optional skip,
  package/diff exit 0 and six config/role hashes matched; reported logs
  `/tmp/opencode/ksi-review-once-merged-{check,package,diff}.log`. Owned worktree
  and merged branch were removed; four unrelated worktrees remain. This fixes a
  stale in-progress/checklist record, not a new verification or human acceptance.

## Verification limits

Prose guidance: interpretation review, not runtime enforcement. The relaxed flow
still requires the representative screen's real verification evidence; the first
real pass (EVENTOUCH) is the live test. No product quality or acceptance claim.
