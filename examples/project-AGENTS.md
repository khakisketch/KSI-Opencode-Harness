# Shared project guidance (optional template)

Use this file as a short repository-level `AGENTS.md` only when these paths and conventions fit the project. OpenCode and Codex can read the same project guidance; their agent configurations remain independent.

- Treat the current code, tests, and Git state as evidence. A checkpoint is a resume pointer, not proof that work is complete.
- If present, `docs/superpowers/product-state.md` records the current product milestone and user-visible acceptance. Use `docs/superpowers/plans/` for the relevant task decision and verification record, and `.opencode/working-state.md` for a compact worktree handoff.
- Use installed skills, including Superpowers, when they help the task. Do not copy or modify upstream skills to restate local policy. Skills and roles do not grant authority beyond the user's request.
- Scale planning, delegation, review, and visual evidence to the work. Preserve unrelated changes, report checks actually run, and distinguish local evidence from user acceptance or deployment readiness.
- Parallelize only separable work. Read-only discovery or review can overlap; concurrent writers need disjoint paths, stable interfaces, and separate worktrees. The coordinating Primary integrates and verifies the result.
- Ask before commits, pushes, releases, deployments, credential changes, destructive cleanup, or material changes outside the approved scope.
