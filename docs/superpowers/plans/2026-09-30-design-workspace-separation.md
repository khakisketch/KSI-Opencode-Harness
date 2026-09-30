# Design workspace separation — OpenDesign adoption and OpenCode Design retirement

Date: 2026-09-30
Status: source change and global migration complete; release/documentation closure in progress; Human design acceptance remains separate

**Approved direction (2026-09-30):** OpenDesign is the design workspace for KSI work. The OpenCode harness
retires its Design primary and the vendored OpenDesign skill kit, and documents an on-demand integration
contract instead. Design is a capability, not an OpenCode stage. Reviewer is reduced to code and behaviour
review; the Human still owns direction and acceptance.

## Why

The Design primary was rarely selected in real use, and switching primaries interrupted long Build work.
The vendored kit could not reproduce OpenDesign's own craft/design-system composition, so it could not reach
OpenDesign-quality output. Keeping both meant duplicated ownership and an ambiguous decision about when to
leave Build.

## Scope of this change

Source only, in this repository. No global OpenCode configuration was edited, no installed role or skill was
deleted, no provider call was made, and nothing was published.

Removed: `templates/agents/design.md`, `vendor/open-design/`, `docs/design.md`, `docs/design-critique.md`,
`docs/design-system-template.md`, `examples/design.project.jsonc`, `examples/design-handoff.md`, and the
`--with-design-kit` code path in `src/native-bundle.mjs` and `bin/ksi-opencode.mjs`.

Changed: `src/native-roles.mjs` now exports three roles (Developer, Test Runner, Reviewer); Reviewer's
description and prompt cover code and behaviour review only. `README.md`, `INSTALL.md`, `docs/architecture.md`,
`docs/execution.md`, and `docs/verification.md` were updated, and `docs/integrations/opendesign.md` defines the
integration contract. `package.json` moved to `0.5.0-beta.1` and drops the vendored files.

Behaviour on upgrade: supplying `--with-design-kit` now exits non-zero with an explicit message and writes
nothing. A previously installed `agents/design.md` and the three skill directories are left untouched; retiring
them is a separate reviewed migration in the target configuration directory (see INSTALL.md).

## OpenDesign deployment (separate system, verified)

OpenDesign was installed from the official Docker path outside this repository and verified:

- `ghcr.io/nexu-io/od:0.24.1`, local `http://127.0.0.1:7456` and tailnet-only
  `https://dgx-spark-1.tailda9552.ts.net:7456` both return 200 for `/api/health`.
- `deploy/docker-compose.linux.yml` was arm64-adapted (aarch64 glibc paths and dynamic linker; OpenCode state
  in its own volumes; host config mounted file-by-file read-only; container OpenCode service pinned to port
  49380 to avoid the host service on 49374).
- `~/.opencode/bin/opencode-cli` translates the adapter's `--dir <path>` to the OpenCode 2.x trailing
  positional directory. OpenDesign's agent list reports OpenCode `available` with v2.0.18.
- End-to-end: project `ksi-deploy-smoke` generated `index.html` with `agent=opencode`; the run succeeded and
  the preview served over both local and tailnet URLs.
- Reverse direction: the `opendesign` MCP server is registered in the global OpenCode configuration and its
  tools (read, write, `create_project`, `start_run`, `get_run`) were exercised from an OpenCode session.

The OpenDesign Cloud sign-in path is separate and needs the `vela` binary, which is not installed. Local CLI
agents (OpenCode) need no account. Nothing here was changed to enable Cloud.

## KSI design guidance in OpenDesign (done)

KSI design intent is installed as a design-system package in the daemon's user data directory
(`/app/.od/design-systems/ksi/DESIGN.md`, host volume `open-design_open_design_data`). It is prose-only: the
manifest contract would require a compiled `tokens.css`, and KSI has no real brand token set to compile yet, so
inventing one was rejected. The daemon supports `DESIGN.md`-only folders for user-installed systems.

Verified: `GET /api/design-systems` lists it as `user:ksi` / "KSI Design System" / "Enterprise / Field
Operations" / `source: user`, and the MCP resource `od://design-systems/user%3Aksi/DESIGN.md` returns the full
7573-character text. The document covers the KSI principles (no KPI-card scatter, task-flow-first, status to
next action, maps only when spatial, explicit site/session relationships, hierarchy over density, restrained
visual language) plus layout, status, map, data-display, typography, colour, component, motion, and
anti-pattern sections.

Follow-up when real KSI brand tokens exist: add `tokens.css` and `manifest.json` to make it a full package.

## Adapter compatibility fixes (2026-09-30, after first live use)

OpenDesign's OpenCode adapter targets the older `opencode-cli` argv shape, so `~/.opencode/bin/opencode-cli`
is a Node shim that translates before delegating to the real binary:

- `run --dir <path>` → the workspace directory as a trailing positional argument (2.x syntax).
- `run --pure` → dropped. The daemon adds `--pure` only to its connection smoke test; 2.x rejects it, which
  made the Local Agent "Test" button fail with `Unrecognized flag: --pure`. Verified after the fix:
  `OpenCode replied in 5971 ms — 'ok'`.
- `models --verbose` → `--verbose` dropped. 2.x rejects it and the daemon then falls back to a hardcoded
  seven-model list; the plain list is the daemon's documented fallback and now yields the real catalog
  (18 entries after a daemon restart; the catalog is cached in-process).

Codex was listed as unavailable because `~/.local/bin/codex` is a symlink into `~/.codex`, which was not
mounted, so the link dangled inside the container. `~/.codex` is now mounted read-write at its absolute host
path (Codex keeps sessions, history, logs, and credential state there and fails against a read-only home);
`codex-cli 0.159.2` is detected.

Still unsupported by OpenCode 2.x and therefore unavailable through this adapter: `export --sanitize --pure`
(child-session evidence) and `run --variant`. The variant flag is only sent when a reasoning variant was
discovered from live models, which currently cannot happen.

### Container identity, credentials, and configuration (2026-09-30)

Root cause 1 — **host file ownership.** The container ran as uid 1001 while host files are owned by uid 1000
and mode 600, so OpenCode could read neither `auth.json` nor the host `opencode.jsonc`. Resolved by running
the container as `1000:1000` and moving the three OpenDesign volumes to the same ownership. The uid is exposed
as `OPEN_DESIGN_UID` / `OPEN_DESIGN_GID` in `docker-compose.linux.yml`; that file is deliberately the place
these changes live because upstream's `install.sh` and `update.sh` auto-detect `docker-compose.linux.yml` and
would silently drop a separate KSI-named compose file.

Root cause 2 — **HOME.** uid 1000 is named `node` in the image, so the image resolves `HOME` to `/home/node`,
which does not exist on the read-only root filesystem. Every daemon-spawned agent CLI failed with
`EROFS: read-only file system, mkdir '/home/node/.config'`, which is why OpenCode reported no version and the
model list fell back to the hardcoded seven entries. Fixed by pinning `HOME=/home/open-design`.

Root cause 3 — **credentials are not in `auth.json`.** OpenCode 2.x stores credentials in its SQLite database
(`credential` table); `auth.json` is legacy and is not imported (verified by deleting the container database
and watching the table stay at zero). The container therefore had its own empty credential store. Resolved
with `~/opendesign/sync-opencode-credentials.sh`, which copies only the `API key` rows from the host database
into the container database. OAuth rows are excluded on purpose: a rotating refresh token shared between two
stores would invalidate one of them.

Root cause 4 — **the host engineering config does not belong in the container.** Loading the host config made
the container's OpenCode start MCP servers it cannot run (`docker exec`, `npx`, host-absolute commands), which
slowed startup and polluted its catalog. The container now has its own minimal config at
`~/opendesign/opencode-config-container/opencode.jsonc` with no roles, skills, or MCP servers; OpenDesign
injects per-run context itself.

Result after the four fixes: `opencode auth list` shows OpenCode Go, DeepSeek, Google, and Nvidia; the daemon
reports `opencode v2.0.18` with 144 models; the Local Agent connection test returns `OpenCode → ok in 5.4s`;
and design runs succeed, including one explicitly pinned to `deepseek/deepseek-v4-pro`.

### Local agent connection status (2026-09-30, after all fixes)

| Agent | Result | Note |
| --- | --- | --- |
| OpenCode | ok ~4.5s | 144 models from the shared host credentials |
| BYOK OpenCode | ok ~4.1s | only the `default` model: no OpenDesign BYOK provider is configured |
| Codex CLI | ok ~8.7s | needs `CODEX_HOME` pinned to the mounted host store |
| Antigravity | ok ~9.2s | needs the host's `~/.gemini` sign-in mounted at `~/.gemini` |
| Claude Code | fails | `Your organization has disabled Claude subscription access for Claude Code` — an account-level restriction, not a configuration problem |

Codex resolves its home from `CODEX_HOME` rather than from the mount target, so the environment pins it to
`/home/ksi/.codex`. Antigravity stores an OAuth token under `~/.gemini/antigravity-cli` and refuses to start
unauthenticated, so the host's signed-in `~/.gemini` is mounted read-write at the container home.

## Verification evidence (2026-09-30, source branch)

- `npm run check` — 26/26 pass.
- `npm run check:package` — PASS: installer-only tarball, offline three-role install, and explicit rejection
  of the removed flag; the packed file list contains no `vendor/`, `docs/design*`, or `examples/design*` paths.
- `node scripts/verify-native-v2-isolated.mjs` on OpenCode 2.0.18 — PASS with `installed: true`,
  `modelAndStepsOmitted: true`, `builtinsUntouched: true`, `noSkillsInstalled: true`, `commandsNotInstalled: true`,
  agent catalog `ok`, and retired design skills absent. Zero provider requests issued by the verifier; child
  egress not monitored.
- No model/visual-quality claim, no shared-service catalog check, and no npm publication in this record.

## Global migration (done 2026-09-30)

With explicit approval, the retired Design surface was removed from the global OpenCode configuration after a
full timestamped backup:

- `~/.config/opencode/agents/design.md` removed (older `.bak-*` siblings kept).
- `~/.config/opencode/skills/{frontend-design,impeccable-design-polish,web-design-guidelines}` archived to
  `skills-removed.tar.gz` and removed. `mobbin-design` was left in place.
- `~/.config/opencode/opencode.jsonc`: `restricted_agents` is now `["plan"]`, and the dead
  `"design": { "steps": 60 }` routing entry was removed. The file was re-parsed successfully and the diff is
  exactly those two changes; the `opendesign` MCP entry is untouched.
- Verified against the running service: `/api/agent` returns
  `build, compaction, developer, explore, general, plan, reviewer, summary, test-runner, title` — no `design`.

Backups live in `~/.local/state/ksi-harness-backups/design-retire-<timestamp>/` (config tree, compose file,
deploy `.env`, systemd unit, removed skills archive, and a copy of the daemon data volume).

## Reproduction assets (2026-09-30)

The whole deployment is reproducible from the source repository: `integrations/opendesign/` carries the
upstream compose patch (verified to apply cleanly to `nexu-io/open-design` at `5b19dfa`), the `opencode-cli`
argv shim, the container OpenCode config, the credential-sync script, the KSI design-system `DESIGN.md` plus
its publishing `metadata.json`, and a README covering prerequisites, steps, operations, and known
limitations. Nothing there is part of the published npm package.

## First real design run and the memory ceiling (2026-09-30)

A realistic KSI screen was generated end to end with the `user:ksi` design system active (project
`ksi-safety-field-inspection`, entry `field-inspection.html`). The result follows the KSI principles: one
decision-driving summary line instead of a KPI wall, a single primary object (the inspection list), an
explicit status vocabulary shown with a label plus shape rather than colour alone, and a next action on every
actionable row. Screenshot: `design-previews/artifacts/ksi-safety-field-inspection.png` in this repository.

The first attempt failed with `Transport: The socket connection was closed unexpectedly`.
`docker inspect` showed `OOMKilled=true`: the upstream default container cap of 384 MB with a 192 MB Node heap
is smaller than a real design run. Raised to 2 GB / 1024 MB heap in `deploy/.env`; the retry succeeded. A
user design system also defaults to `status: "draft"`, and project creation is rejected with
`DESIGN_SYSTEM_NOT_PUBLISHED` until `metadata.json` sets `"status": "published"`. Both requirements are
recorded in the reproduction README.

This is a working design run, not Human acceptance: the screen has not been reviewed or approved by the user.

## Pending

- Human review of the source diff and of real use of OpenDesign as the design workspace.
- Optional later: a compiled `tokens.css` + `manifest.json` for the KSI design system once real KSI brand
  tokens exist. OpenDesign Cloud and `vela` are explicitly out of scope (Local AI only).

## Release and documentation closure (approved 2026-09-30)

User approved README/workflow clarification and GitHub/npm beta deployment, then clarified that OpenCode,
OpenDesign, and Superpowers must be separately installed by the user or an authorized agent reading upstream
documentation. KSI's default installation remains exactly three native agent files. No automatic dependency
installation, credential sharing, MCP registration, or system configuration is added.

- [x] Reorganize README around purpose, roles, workflow, exact install scope, separate optional tools, and agent onboarding.
- [x] Document integration reconnect and explicit artifact-entry requirements; replace deployment example with V2 MCP syntax.
- [x] Flag deployment assets as workstation-specific, including writable credential mounts and internal DB-sync risks.
- [ ] Verify source/package and independent branch review; commit release documentation.
- [ ] Publish approved GitHub source/tag/release and npm beta; verify public package installation.

Fresh live audit: standalone MCP read succeeded while the project's OpenCode connection was failed with
`Connection closed`. Disconnect/connect explicitly at the worktree Location restored 22 tools without
a whole-service restart. Native live-tool project read, explicit-entry artifact bundle (17,069 bytes),
successful prior-run status, agent discovery, and KSI resource read succeeded. Prior-run evidence records
project-selected KSI guidance and exit 0. No fresh generation/write run or automatic restart recovery was
performed in this audit. The default-entry bundle failed despite metadata having an entryFile.

Claude account restrictions are expected; Codex intermittent connection-test failures are follow-up,
not release blockers per user. `npm whoami` currently returns E401, so npm publication requires reauthentication.
Human saw the preview but has not approved its design; do not claim full production implementation acceptance.

Independent review identified a stale four-role statement in the shipped config example and failure-path
secret persistence in the source-only credential-sync aid. Corrected the example to three. Removed container
SQL files entirely: API-key SQL now streams over stdin; the private host mktemp file retains EXIT cleanup.
Two offline boundary tests (DB apply success and failure) failed first on container file creation, then
passed after the fix; full suite 28/28 and package check pass. Tests use fixture-only Docker/sqlite stand-ins,
not real credentials or database migration. Added package exclusion assertion for `integrations/`.
Human prose count does not get a brittle exact-word regression test; three-role installation is already
covered by real CLI/package tests. The running machine's older sync script was not changed automatically.

User completed npm web login; `npm whoami` now returns the expected maintainer identity. Release will use
the `next` dist-tag without silently changing `latest`. GitHub main can fast-forward from `de7f823`.
