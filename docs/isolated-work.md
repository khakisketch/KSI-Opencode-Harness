# Optional isolated work

Git routing/configuration environment overrides (`GIT_INDEX_FILE`, `GIT_DIR`, `GIT_CONFIG_*`, etc.) are refused before discovery; invoke from a clean environment. Selected files are limited to 16 MiB each. Patch application preserves whitespace explicitly and verifies selected destination bytes, executable modes and staged entries before reporting success.

Only use this helper in a repository whose Git configuration and checkout filters you trust. It creates a full checkout of `HEAD`, not a sanitized file-only sandbox. Known sensitive-looking paths in `HEAD` are refused, but filename checks cannot detect arbitrary committed secrets. Selected deletions, symlink changes and complex rename recovery are intentionally unsupported; use a reviewed manual workflow for those cases. The new worktree directory is created with `0700`; failed/partial directories are retained.

Use Native Git worktree support when a clean `HEAD` checkout is sufficient. The helper is for the narrower case where an explicitly chosen set of dirty files must accompany a separate worktree.

```sh
node scripts/prepare-isolated-work.mjs --destination ../task-work --file src/one.ts
node scripts/prepare-isolated-work.mjs --apply --destination ../task-work --file src/one.ts
```

Preview is the default. `--apply` creates a new detached worktree at the current `HEAD`; only the listed dirty tracked files and explicitly listed safe untracked regular files are carried. An empty selection is refused. Staged and unstaged tracked changes remain represented as separate layers. Choose a destination outside the repository and ensure its already-existing parent is canonical, owned by your OS account, and private (no group/other access). The helper refuses existing destinations and does not remove incomplete worktrees. Git necessarily registers the new worktree in shared repository metadata; the source working files and source index are not intentionally edited. Inspect the resulting diff; integration is manual. It never stashes, resets, reverts, commits, pushes, merges, deploys, or copies `.git` metadata or secret-like paths.

A Git worktree is **not** full runtime isolation. It does not isolate databases, ports, `node_modules`, `.env`/credentials, browser profiles, OS state, or external services. The work owner must separately choose an approved local test database, distinct build/output directories and ports, and an isolated browser profile where applicable. Do not blanket-copy environment files or connect to production, run production migrations, or assume a separate directory prevents shared-resource effects. Before integration, recheck the source and worktree diffs, tests, and any shared-resource configuration; integrate only through the project's approved process.

The helper is an optional source utility, not a global plugin or MCP tool. Its checked-in tests use temporary Git repositories; they cover selection, literal path names, staged/unstaged preservation, and several refusal cases. This is not a guarantee against every concurrent filesystem race. It does not clone databases, infer approvals, or claim that parallel execution is safe by itself.
