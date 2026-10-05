# Source-direct frontend flow — simplified operating path

Updated: 2026-10-05
Status: in progress
Owner: OpenCode Build

## Approved outcome

User approved ("그래 그렇다면 그렇게 개선해줘 나는 편한게 좋아") simplifying the
verified source-direct frontend flow: Local Codex edits the actual product
repository directly — dedicated branch or the user's normal checkout; a worktree
is optional convenience, not a requirement — with one writer at a time. Build owns
requirements/contracts, real verification, integration and Git. Real boundaries
stay: home/credential roots and unrelated projects out of agent reach; new mounts
and security changes keep their own scoped approval; push/deploy and API/data/auth/
dependency changes are never delegated implicitly.

Foundation: docs/superpowers/plans/2026-10-05-source-direct-feasibility.md
(independently verified synthetic source-edit/build/browser probe).

## Scope and workspace

- Global AGENTS.md operating rules, plus the shipped integration/execution/
  architecture docs and examples. One new ledger, a product-state entry and a
  forward link from the spike ledger.
- No product/mount/container/security change; no design generation; no push or
  npm publication.
- Owned workspace `.worktrees/source-direct-flow`, branch
  `fix/source-direct-flow-20261005`; base and local integration target main `0b159c9`.
- Global policy backup `source-direct-flow-20261005.km3540i7`; six config/custom-role
  SHA256 baselines.

## Checklist

- [x] Confirm scope; create owned workspace; baseline check (112 tests / 111 pass /
  0 fail / 1 opt-in skip).
- [x] Update global AGENTS.md source-direct rules (real repo preferred, worktree
  optional, boundaries, completion evidence) — three surgical edits.
- [x] Rewrite the integration guide's direct-source section; align boundaries,
  execution, architecture and examples.
- [x] Record product-state entry and spike-ledger forward link.
- [x] Independent review and source/package/preservation checks.
- [x] Local commit/integration, integrated check, owned-workspace cleanup and
  checkpoint.

## Verification

- Reviewer `ses_ef4f85384ffezpE0AD1xVBDRcG` (read-only interpretation): six scenario
  checks passed; one Medium (record base/rollback before substantive writes —
  applied without re-imposing a main prohibition the user rejected) and four Low
  findings (gateway enforcement wording, `entry_not_touched` provenance, example
  boundary list, concurrent-writer phrasing). All five repaired and re-verified as
  resolved; no new contradictions.
- Test-runner `ses_ef4f6a153ffePJIO2ciymIangg`: `npm run check` exit 0 (112 tests /
  111 pass / 0 fail / 1 opt-in skip), `npm run check:package` exit 0, `git diff
  --check` exit 0; six preserved config/role hashes match; global AGENTS.md has
  exactly the three intentional bullets and no other drift; all repo changes
  confined to docs/examples. Logs:
  `/tmp/opencode/ksi-source-direct-flow-{check,package,diff}.log`.
- Implementation `4c702399bf00bd4e071f6d1f90b8237c10d1c7b1` fast-forwarded into
  canonical main; the same test-runner (rebound to main) re-ran fresh checks:
  check 112/111/0/1, package pass, diff exit 0, six hashes match, committed change
  set docs/examples only, global bullets present. Logs:
  `/tmp/opencode/ksi-source-direct-flow-merged-{check,package,diff}.log`.
- Session returned to canonical main; owned workspace inspected including ignored
  files, only the unique checkpoint copied to the private backup, then non-forced
  worktree removal and merged-branch deletion succeeded. Four unrelated pre-existing
  worktrees retained.
- This completes operating-policy and documentation alignment. It does not connect
  a real product repository, run a generation, or change mounts/container/security;
  real-product source-direct use remains a separate scoped step.

## Applied changes

- Global AGENTS.md: product-context bullet prefers the real repository over a source
  copy; the integration bullet now states the verified preferred path (one writer,
  worktree optional, retained boundaries, source-diff + build/render completion
  evidence, `entry_not_touched` clarification); the Korean handoff bullet points at
  the real repository/branch with a single writer.
- Integration guide: the direct-source section becomes "verified, simplified preferred
  path"; the product-aware flow intro prefers direct access; the boundaries bullet
  prefers direct edits with verified access (single writer) and keeps fallback/limits.
- Execution, architecture and both examples carry the same simplified rule.
- No product/mount/container/security/config/model/permission change; no generation.

## Verification limits

Prose-only guidance receives interpretation review, not exact-wording tests. This
task does not connect a real product or run another generation. The completion
rule ("an intentionally untouched canonical entry may report `entry_not_touched`;
that verdict alone does not invalidate the source-direct result") is inferred from
the entry-centric validator design: the spike's probe run touched its canonical
entry, so the `entry_not_touched` outcome was not itself exercised and must be
re-confirmed per target. Connecting
a real product repository remains a separate scoped step; a new root connection can
recreate the shared container and needs its own approval, active-run protection and
rollback scope.
