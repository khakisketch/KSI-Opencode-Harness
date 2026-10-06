# Source-project registration flow (deployment)

Updated: 2026-10-06
Status: technically complete; first real design loop separate

## What happened (user-directed 2026-10-06: "전역 설정 하네스를 개선")

- Goal: the writable design capability must be a **global, hands-off harness
  capability**, not a series of per-project approvals.
- Checked the deployed daemon's registration rule:
  `remoteWorkspaceRootBlockReason()` accepts a folder-backed project only for an
  **exact connected path** (`status.path === canonicalPath && connected`), and
  the 2026-09-30 deployment design excludes Desktop/home-wide mounts.
- Interim experiment: connected `~/Desktop` as a parent bind
  (operation `5dd59db4-b16e-4372-9b71-c97e1e2e2d41` → ready) to test the
  "one broad mount" idea. Verified the daemon still requires exact per-project
  connections (children were not connected) and that the parent bind violated
  the documented boundary → reverted through the standard compose-override
  path. Backups: `connections.json.before-desktop-revert`,
  `projects.compose.json.before-desktop-revert` (private backup dir).
- Registered `EVENTOUCH source` via `POST /api/import/folder`
  (`baseDir=/home/ksi/Desktop/SI-Projects/EVENTOUCH`, name `EVENTOUCH source`) —
  the missing piece behind the earlier "outside allowed write paths" failures.
- Documented the exact flow in the integration guide + global policy:
  connect → import, agent-executed, standing scope = every project under home
  except the home root and credential directories; one writer at a time.

## Evidence

- Connect op `5dd59db4` (Desktop, interim) → ready; revert verified:
  `connections.json` paths = 4 project binds, compose exit 0, daemon healthy,
  Desktop mount absent (`docker inspect open-design`).
- Import response: project `aabf3621-654f-45ba-b908-6daee94d95fa`
  (update 2026-10-06: the product session later re-created EVENTOUCH as
  `9db026a4-670d-4a16-bc9f-f79bf0942142` with the same baseDir; a stored id is
  environment state — verify with `list_projects` before use. See the binding
  review in `2026-10-06-visual-ownership.md`.)
  (`EVENTOUCH source`), conversation `bb1132f8-…`, `entryFile=index.html`;
  re-read via the design MCP confirms `baseDir`/`resolvedDir` =
  `/home/ksi/Desktop/SI-Projects/EVENTOUCH`.
- No active design runs before/after the operations.

## Limits

- This covers reachability + project registration only. Real product writes and
  design quality still need the first real design loop (agency-home) with the
  design-quality-loop guidance. A new project path still costs one container
  recreation on first connect (by design; automatic rollback).
