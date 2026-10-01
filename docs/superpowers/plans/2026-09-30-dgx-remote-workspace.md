# DGX Remote Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browse DGX home directories from the remote browser, connect selected writable projects without manual approval lists, and make the Labs status readable remotely.

**Architecture:** A stable host-side loopback gateway handles directory listing and project connection while forwarding normal traffic to the existing daemon. Only the exact read-only Labs status request gets validated remote-to-local header translation; upstream local-daemon guards remain intact. A restricted host connector manages selected-project compose overrides, container recreation and rollback; existing folder import remains the project registration authority.

**Tech Stack:** Node.js built-in HTTP/filesystem/test modules, TypeScript/React, existing Express daemon, Vitest, Docker Compose, Tailscale Serve.

**Spec:** `docs/superpowers/specs/2026-09-30-dgx-remote-project-workspace-design.md` (revised version approved by user).

## Global Constraints

- Browse `/home/ksi`; project work uses selected canonical descendants, not a home-wide writable mount.
- No fixed project allowlist; opening a folder authorizes connecting that project.
- Home itself and credential-store roots are not project workspaces; preserve existing credential mounts and config.
- No Docker socket in the agent container; host connector accepts no client command, image, container or compose path.
- Preserve existing workspace permissions, canonical baseDir, native desktop picker and reference-only linkedDirs semantics.
- KSI-CCTV is the first smoke target; only new files in `design-previews/remote-workspace-smoke/` may be written there.
- Do not publish npm, change existing tags, install Cloud tooling, alter unrelated services, or commit without separate permission.
- User approved this plan and native execution/deployment with "진행"; preserve backups and reversible rollout.

## Review Focus

- A second click during container recreation must join the existing operation, not create another restart.
- A symlink changing between validation and connection must not mount an unchecked outside-home target.
- A failing compose update must preserve prior mounts, image, config and existing project accessibility.
- A browser disconnect during connection must leave a queryable result and permit idempotent retry.
- The Labs exception must not translate arbitrary URLs, methods, hosts or cross-site requests into local authority.

## Evidence and deployment routing

- Harness branch `refactor/retire-design-opendesign`, HEAD `cc77f29`; ledger/spec edits are existing session work.
- Upstream checkout `/home/ksi/opendesign/open-design` has user-modified `deploy/docker-compose.linux.yml`; preserve it.
- Container image `ghcr.io/nexu-io/od:0.24.1` reports daemon `0.23.1`; prove runtime/source parity before a custom build.
- Tailscale Serve on HTTPS port 7456 is tailnet-only and forwards to loopback port 7456. Other Serve/Funnel routes are unrelated.
- `od-https-proxy` is not the proxy serving this URL; do not modify that container or its stale host mount.
- Local Labs status is 200/active; remote status is 403 due to Host validation, not missing activation.
- Host gateway uses a free loopback port selected and persisted during deployment (preferred 17456; fail rather than steal a port).
- Only the existing HTTPS 7456 Serve target changes to the gateway. The daemon remains loopback-bound at 7456.
- Gateway process is managed by a user systemd service. Host connector runs under the existing trusted user with Docker access.

## Task 1: Stable gateway and exact Labs read exception

**Files (harness):**
- Create `integrations/opendesign/remote-workspace/gateway.mjs`
- Create `integrations/opendesign/remote-workspace/request-policy.mjs`
- Test `integrations/opendesign/remote-workspace/tests/gateway.test.mjs`
- Test `integrations/opendesign/remote-workspace/tests/request-policy.test.mjs`

**Interfaces:** `validateRemoteRequest({peer,host,origin,fetchSite}, config) -> {ok:boolean,reason?:string}`; `createGateway({config,workspaceService,upstream}) -> http.Server`. Configuration pins the exact HTTPS origin supplied by the user, loopback upstream and home root. Transport trust is the tailnet-only Serve listener plus loopback peer; Host alone is not authentication.

- [ ] Write tests: approved remote GET status returns upstream JSON; wrong Host/Origin, non-loopback peer and `Sec-Fetch-Site: cross-site` return 403 before forwarding. Absent Origin remains valid for same-origin GET/navigation.
- [ ] Run `node --test integrations/opendesign/remote-workspace/tests/request-policy.test.mjs integrations/opendesign/remote-workspace/tests/gateway.test.mjs`; confirm RED because modules do not exist.
- [ ] Implement request validation and streaming proxy including SSE/websocket forwarding and abort cleanup. Only exact GET `/api/strategies/od-next/rollout` without query receives `Host: 127.0.0.1:7456` and removal of the already-validated remote Origin; all other routes preserve existing behavior. Never rewrite authentication or disable daemon guards globally.
- [ ] Add tests that POST, alternate paths, query variants and config mutations receive no local-authority translation; unavailable upstream returns a useful 502. Normal streaming traffic stays streamed, not buffered. Incoming forwarding headers are not an authority source.
- [ ] Run the same command and confirm GREEN. Record evidence in this plan; do not change rollout mode (already active).

## Task 2: Home directory browsing and restricted connection manager

**Files (harness):**
- Create `integrations/opendesign/remote-workspace/path-policy.mjs`
- Create `integrations/opendesign/remote-workspace/connector.mjs`
- Create `integrations/opendesign/remote-workspace/workspace-service.mjs`
- Test `integrations/opendesign/remote-workspace/tests/workspace-service.test.mjs`
- Test `integrations/opendesign/remote-workspace/tests/connector.test.mjs`

**Interfaces:** `resolveWorkspacePath(input, {home,forSelection}) -> Promise<string>`; `listDirectories({path,showHidden}) -> Promise<{path,entries}>`; `connectProject({path,requestId}) -> Promise<{operationId,status,path}>`; `getOperation(operationId) -> operation`. Request IDs are UUIDs, operation status is `pending|connecting|ready|failed|busy`.

- [ ] Write fixture tests for home browsing, Desktop shortcut, absolute/relative inputs, hidden folders, internal symlinks, missing directories and outside-home links. Home itself may be listed but not selected; exact credential roots `.ssh`, `.gnupg`, `.codex`, `.claude`, `.gemini`, `.config` and `.local` and their descendants are not selectable projects. Do not read their file contents.
- [ ] Run `node --test integrations/opendesign/remote-workspace/tests/workspace-service.test.mjs integrations/opendesign/remote-workspace/tests/connector.test.mjs`; confirm RED.
- [ ] Implement GET `/api/remote-workspace/directories`, POST `/api/remote-workspace/connections` and GET `/api/remote-workspace/operations/:id` in gateway-owned routing. Use Task 1 policy, JSON limits and canonical validation; do not send directory file contents to the model. Unknown input fields return 400.
- [ ] Implement connector with fixed server-side compose files/service and `spawn` argv (no shell interpolation). Serialize operations, deduplicate request IDs, recheck canonical targets before updating mounts, preserve preexisting settings, and create an atomic JSON-as-YAML compose override containing only same-path selected bind mounts. Never accept Docker arguments from the browser.
- [ ] Before restart, inspect `/api/runs` using its existing response contract; only positively verified idle permits connection. Unknown/unreachable run state fails closed. Track existing connections in private state, wait for health up to 120 seconds, then mark ready; failure restores prior override and container configuration and records whether rollback health recovered.
- [ ] Add tests for duplicate/concurrent requests, changed symlink, active-run refusal, disconnect/retry persistence, simulated health timeout/rollback, and injected container/image/command fields. Use fake Docker/upstream in all unit tests.
- [ ] Run the same test command and confirm GREEN. Show clear errors for host permissions and reconnect failure; do not grant chmod broadly.

## Task 3: Browser folder picker and existing import integration

**Files (isolated upstream worktree):**
- Create `apps/web/src/components/RemoteProjectFolderPicker.tsx`
- Create `apps/web/src/state/remote-workspace.ts`
- Modify `apps/web/src/components/useOpenFolderImport.ts`
- Modify `apps/web/src/components/NewProjectPanel.tsx`
- Test `apps/web/tests/components/RemoteProjectFolderPicker.test.tsx`
- Test `apps/web/tests/components/useOpenFolderImport.test.tsx`
- Modify `apps/daemon/src/import-export-routes.ts`
- Test `apps/daemon/tests/remote-workspace-import.test.ts`

**Interfaces:** `listRemoteDirectories(path,showHidden)`, `connectRemoteProject(path,requestId)`, `readRemoteOperation(id)` use Task 2 contracts; picker returns a ready canonical path to the existing `onImportFolder` callback. A read-only gateway capability response advertises remote mode; absent capability retains native behavior.

- [ ] Create an isolated upstream worktree using using-git-worktrees; read applicable upstream root/apps/daemon/packages rules. Preserve existing compose edits and prove installed runtime revision parity; stop/revise plan if the custom build cannot be matched safely.
- [ ] Write failing component tests: home navigation, breadcrumbs, Desktop shortcut, direct input, hidden toggle, unavailable entries with reason, cancellation, single-click open, connecting/failed/busy states and return of canonical selected path after ready. Native host import remains unchanged.
- [ ] Run `pnpm --filter @open-design/web test tests/components/RemoteProjectFolderPicker.test.tsx tests/components/useOpenFolderImport.test.tsx`; confirm RED.
- [ ] Implement picker using existing modal/list/input styles, not a redesign. Host capability takes precedence for native desktop; remote browser uses gateway picker and awaits readiness before existing folder import. Keep reference-only picker semantics unchanged.
- [ ] Add daemon tests proving remote-connected canonical paths are accepted through existing folder import with existing workspace permission checks; disconnected/home/outside/credential roots cannot be imported or assigned as external baseDir in remote mode. Managed internal projects remain supported.
- [ ] Implement the remote-mode connection-status check using a server-pinned gateway endpoint and existing privileged import/replace-baseDir paths; never trust a browser `connected` flag. Do not allow generic project create/patch to set baseDir.
- [ ] Run web tests above and `pnpm --filter @open-design/daemon test tests/remote-workspace-import.test.ts`; confirm GREEN. Run web/daemon typecheck and builds. Preserve already-existing failure evidence separately from regressions.

## Task 4: Deployment, recovery and server configuration

**Files (harness):**
- Create `integrations/opendesign/remote-workspace/service.mjs`
- Create `integrations/opendesign/remote-workspace/od-remote-workspace.service.example`
- Create `integrations/opendesign/remote-workspace/config.example.json`
- Modify `docs/integrations/opendesign.md`
- Private runtime files under `/home/ksi/.local/state/od-remote-workspace/`; install service under user systemd directory.

**Interfaces:** `service.mjs --config <private-path>` starts Task 1 gateway with Task 2 service; config contains only pinned paths/origin/service/ports, not arbitrary client-controlled commands. Tokens, if needed by the existing upstream auth, come from private environment files and never source/JSON examples.

- [ ] Write a service smoke test using fixture upstream/connector, proving startup health, bad config rejection and recoverable operation state; run it RED then implement startup and shutdown handling and run GREEN.
- [ ] Back up the effective compose inputs, selected image digest, user service state and only the 7456 Serve mapping privately. Check active runs and existing target port. Do not print credentials or full effective compose environment.
- [ ] Build a revision-pinned local image from the isolated upstream source; preserve uid/gid, agent mounts, daemon data, provider config, loopback binding and MCP idle setting. Do not replace upstream user's source changes.
- [ ] Install gateway/service, validate health and local tests before replacing the 7456 Serve proxy target. Keep its tailnet-only scope; do not change other routes or enable Funnel.
- [ ] Deploy custom image during verified idle; verify container health and MCP read/reconnect, then exercise new project connection. Failures restore previous image/override/Serve target; do not delete Docker volumes or unrelated files.
- [ ] Update source-only integration docs with exact commands, trust boundaries, disconnection/restart behavior and rollback. No public package or release changes.

## Task 5: End-to-end evidence and acceptance

**Files:** Create upstream `e2e/ui/remote-project-workspace.test.ts`; update this ledger and ignored harness checkpoint only.

- [ ] Write E2E fixture tests: home navigation, two independently chosen fixture projects, automatic connection without allowlist, file bytes visible on host, host edits visible in UI, reconnect persistence, canonical cwd and retained native picker behavior.
- [ ] Run `pnpm --filter @open-design/e2e exec playwright test -c playwright.config.ts ui/remote-project-workspace.test.ts`; record RED before implementation and GREEN after deployment-compatible fixtures are ready.
- [ ] Compare local and remote Labs GET status: both 200 and active; wrong origin/host/cross-site variants remain 403. Confirm no changes to rollout mode and no exception for other privileged routes.
- [ ] Recheck KSI-CCTV Git baseline; create a unique smoke artifact only in the specified preview subdirectory, record matching host/UI bytes, read back a host edit, and verify no preexisting product/config files changed. Do not use a model generation run as a substitute for checking actual file paths.
- [ ] Verify Local Codex execution cwd in a separate fixture without touching existing products. Record whether newer design strategy actually applies independently from the enabled setting.
- [ ] Request user remote-browser acceptance of folder selection/save/reopen and Labs display. Automated passing does not close m04/m05 human acceptance. Record remaining gaps and rollback evidence, then collapse checkpoint to the verified baseline.

## Self-review and handoff

- Spec requirements map to Tasks 1–5; all five Review Focus cases have explicit test steps.
- Stable gateway is necessary because the daemon disappears briefly when new project mounts are connected; polling it alone cannot report reconnect state.
- The new host connector is privileged infrastructure, not a cosmetic picker; no deployment is justified by unit tests alone.
- Recommendation: native execution in this session, with independent final review, to keep deployment integration under one owner. User must review this plan and select native or delegated execution before implementation.

## Execution evidence

- User approved native execution with "진행"; no commits/publication authorized.
- Task 1 RED absent modules → 19/19 GREEN; full harness now 61/61 including connector/service tests.
- Task 2 focused canonical path/listing/connector tests GREEN; upstream/private status integration pending.
- Ruling: stage Labs-only gateway before custom image rollout (workspaceEnabled=false) — resolves independent 403 without exposing unfinished connector — cost if wrong: restore only 7456 Serve target; no daemon restart.
- Labs-only gateway deployed as user systemd service on loopback 17456. Remote status/health/settings 200;
  active mode unchanged; cross-site status request 403. Parsed unrelated Serve/Funnel configuration unchanged.
- Private backup: ~/.local/state/ksi-harness-backups/remote-workspace-20260930-194510/.
- Exact installed-image source SHA fetched: 89e64d813bb1c7a11519b3f668f011f7017637d7; isolated
  worktree /tmp/opencode/od-remote-workspace on ksi/remote-workspace. Original upstream compose untouched.
- Pristine web/daemon full suite attempts timed out at 120s (not passed); rerun with longer budgets required.
- Longer daemon baseline completed BEFORE any daemon source changes: 12048 passed, 76 failed, 16 skipped.
  Raw names/details: `/tmp/opencode/od-daemon-baseline-long.log`. Failure inventory:
  - `tests/chat-artifacts-run-cover.test.ts`: 7
  - `tests/chat-artifacts-video-cover.test.ts`: 4
  - `tests/chat-route.test.ts`: 33
  - `tests/codex-rollout-usage.test.ts`: 1
  - `tests/connection-test.test.ts`: 7
  - `tests/late-media-produced-file-association.test.ts`: 4
  - `tests/media-failure-reaches-run-terminal.test.ts`: 5
  - `tests/opend-2765-next-step-locale-carriage.test.ts`: 2
  - `tests/plugins-headless-run.test.ts`: 1
  - `tests/run-terminal-produced-files-association.test.ts`: 2
  - `tests/media/policy-routes.test.ts`: 7
  - `tests/runtimes/codex-child-evidence.test.ts`: 3
- Full web background run picked up two new RED hook tests while running: 12762 passed, 2 failed,
  1 expected fail, 11 skipped. Those new tests are now GREEN; this is not a pristine/full post-change verdict.
- Current focused picker/hook/i18n tests 28/28 GREEN; web typecheck GREEN. Shared DTO, existing-modal picker,
  native precedence, cancellation and ready-path import hook implemented in exact-revision isolated worktree.
  Daemon connection checks, CLI parity, custom image, connector activation and E2E are still pending.
- User chose the recommended first option: preserve original 76 failures as baseline and proceed with feature-scoped checks/deployment; no need to fix unrelated failures in this work.
- Independent deployed Labs-only review (not final whole-branch): no Critical; 22 reviewed tests GREEN.
  Ruling: preserve forwarding headers in this scoped fix — current local-daemon guard uses socket/Host/Origin,
  not X-Forwarded authority; grep found no enabled trust-proxy setting. Blind stripping could break normal
  proxy behavior — cost if wrong: future daemon header trust needs review. Labs handler verified read-only
  in exact-image source `routes/strategy-rollout.ts`; response contains status, no credentials.
  Ruling: tailnet membership is the remote authentication boundary, loopback/Host checks are not user identity
  — consistent with approved transport; cost if wrong: wider tailnet membership broadens status readership.
  Internal status remains disabled/token-gated; add stronger provenance checks before connector activation.
  Deferred review minors: body-bearing GET, token-length timing, hop-by-hop normalization, exact-origin
  formatting, example Node path portability and defensive req.url checks. No sandbox claim.
- Latest deployment 2026-09-30 23:25 KST: workspaceEnabled=true; reviewed local overlay image
  `ksi-open-design:remote-workspace-20260930-reviewed`; original Compose edits/data/agent mounts preserved.
  HomeView primary picker included (NewProjectPanel alone was insufficient); browser response/draft race
  reproduced and fixed RED→GREEN. Real remote browser E2E 1/1 pass (21.3s): two arbitrary new host folders,
  browser save→host bytes, host edit→browser read, reload/reconnect. Evidence `/tmp/opencode/od-remote-e2e-reviewed.log`.
- KSI-CCTV unique preview smoke bytes match host and remote API/MCP read; tracked Git status remains clean.
  Actual Local Codex generation cwd/new strategy not yet verified (container cwd alone is not that witness).
- Fresh harness tests pass; latest focused web 11/11 and daemon 7/7 pass; builds pass. Real isolated Compose
  rollback/merge smoke 9/9: prior sentinel mount retained, controlled health failure rolls back added root.
  Full web before final draft fix: 12771 pass/1 expected fail/11 skipped; final rerun in progress.
  Full post-change daemon background in progress; baseline failures not silently declared fixed.
- Independent whole-change reviewer completed; private upstream-token leakage fixed and late root swaps
  detected with rollback. Atomic protection against a hostile same-user Docker/path race is not claimed.
  Generation outage affects whole container; absent gateway env restores native mode by design, now documented.
- Automatic MCP recovery does not occur after container recreation. Explicit project reconnect restored catalog
  and smoke file read; user-visible browser acceptance remains pending. No commit/push/publication performed.
