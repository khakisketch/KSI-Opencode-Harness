# README renewal and beta.2 delivery

User approved the bounded in-chat design and delivery scope: Korean workflow-first README,
GitHub main push, npm 0.5.0-beta.2 on next; preserve latest and existing DGX services.

## Checklist
- [x] Inspect README, installer scope, release guide, registry versions and official V2 agent docs.
- [x] Present short design and obtain user approval.
- [x] Renew README: orientation, workflow, responsibilities, requests, installation, boundaries, deeper docs.
- [x] Update manifest/exact-version checks and pinned installation commands; correct stale release instructions.
- [x] Run harness, packed consumer, isolated verification, tarball inventory and README link checks.
- [x] Commit and push main without force (ab95c5e; remote exact HEAD verified).
- [ ] Publish verified tarball to next only — blocked by registry authentication.
- [ ] Verify new registry version and public consumer bytes after publication.

No new runtime functionality or permission changes. Technical publication does not establish
human acceptance of the rendered README or end-to-end product design.

## Pre-publication evidence
- Harness64 pass/0fail/1 opt-in skip; isolated V2 agent catalog/permissions and retired role/skill checks pass, no provider requests issued by verifier.
- Packed offline consumer preview/apply/repeat and user-owned model preservation pass.
- Tarball17 files; only CLI, three roles, approved public docs/example/license. No integration deployment assets or private state.
- README local links/fences and matching beta.2 installation pins pass; whitespace clean.
- English-only removal wording assertion failed after translation; now verifies the explicit Korean Design/flag removal notice without dropping the check.
- Registry before delivery: next0.5.0-beta.1, latest0.4.0-beta.2; candidate0.5.0-beta.2 unused.

## Partial delivery / blocker
- Exact tarball publish returned E404; npm whoami returned E401 Unauthorized. Public package lookup works, so no successful authenticated publication is established.
- Registry afterward still next0.5.0-beta.1/latest0.4.0-beta.2; beta.2 absent. No tag mutation or version publication confirmed.
- Public README/INSTALL commands restored to available beta.1; beta.2 manifest/tests remain prepared. Repack after restoring beta.2 pins when publication credentials are ready; do not publish the earlier staged tarball blindly.
- User must sign in to npm on this server with a package-authorized account. Never request tokens or passwords in chat.
