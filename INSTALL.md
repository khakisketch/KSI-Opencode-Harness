# Native OpenCode V2 installation

KSI is distributed here as a standalone installer for OpenCode V2 native files, not as an OpenCode plugin. First inspect the source and decide which OpenCode configuration directory owns the server you use. For OpenChamber managed mode, use its managed OpenCode server's config; in external-server mode, use the external server's config. The OpenChamber orchestration tool is managed-only and is unrelated to KSI installation.

## Installation ownership

Install Node.js 20+ and OpenCode V2 separately using their upstream instructions. KSI's default `--apply`
writes only `agents/developer.md` and `agents/reviewer.md` under the selected target.
It does not install OpenCode, native roles, Node.js, providers, models, credentials, the Design Specialist,
OpenDesign, Superpowers, Docker, model CLIs, or MCP connections.
Your agent may help set those up after reading their documentation, but needs explicit approval for system
installation, shared/global settings, credentials, and service changes. KSI installation alone authorizes none of them.

### Current operation is not an installer migration

The KSI host's approved operating configuration uses native Plan/Build/General/Explore with the
default Design Specialist plus optional CE skills. Developer, Test Runner and Reviewer are
absent from that global environment, and Superpowers and the Goal plugin were removed.
The installer below still offers the optional Developer + Reviewer bundle; previous public
release 0.5.0-beta.8 was the historical three-role bundle. Neither reproduces that host
migration or authorizes restoring removed components. In an already-migrated environment,
inspect effective settings and do not apply role installation merely to satisfy these
examples. Preserve other tools' independent installations; another server's configuration
must be verified separately.

## Public npm beta: preview and apply

**Published `0.5.0-beta.9` is the current two-role release (Developer, Reviewer).**
Previous public release 0.5.0-beta.8 was the legacy three-role bundle (Developer, Test Runner,
Reviewer), not the current configuration. Removed-option behavior does not apply
retroactively to that historical release.

With Node.js 20+, run from the root of the target project. `$PWD/.opencode` is an absolute
project-local target. `npm exec` obtains the package through npm's cache; obtaining it alone
makes no OpenCode configuration changes, and public installation needs no npm login
(registry publication authentication is a separate maintainer procedure).
The first command previews; only `--apply` writes files.

Linux/macOS:

```sh
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.9 -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.9 -- ksi-opencode install --target "$PWD/.opencode" --apply
```

Windows PowerShell (absolute `Join-Path` target):

```powershell
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.9 -- ksi-opencode install --target (Join-Path (Get-Location) ".opencode")
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.9 -- ksi-opencode install --target (Join-Path (Get-Location) ".opencode") --apply
```

Both commands pin the same exact beta. If the registry version is unavailable, use the source commands below.
This public beta is released through `next` and the default `latest` channel; default-channel delivery does not make it a stable release. Pin the exact version to avoid later channel movement. This beta does not imply acceptance of real-product visual output.

### Another machine: project target versus server-global config

On another PC, prepare Node.js 20+, OpenCode V2, and the model provider connection first using
each tool's official instructions — the installer provides none of them. Then decide the target:

- One project only: the project's `.opencode` directory (Linux/macOS `$PWD/.opencode`,
  Windows `(Join-Path (Get-Location) ".opencode")`).
- Every project on that machine's server: the OpenCode server's actual global config directory
  (usually `~/.config/opencode`; managed or external servers differ — verify on that machine).

Preview and apply use the same beta.9 commands with the chosen absolute target. No actual
Windows/macOS execution is promised — paths, browsers, and tools differ per machine, so verify
locally. The installer's two role files never reinstall removed global roles, plugins, or model
choices; an already-migrated environment must not re-apply them.

### Let your agent install it (copy → paste)

Paste this into the OpenCode session that should perform the installation:

> "Install the KSI harness (ksi-opencode-harness) for this project.
> 1. Verify Node.js 20+ and OpenCode V2 are ready, then ask me whether the target is the project `.opencode` or the server's global config directory.
> 2. Use public npm 0.5.0-beta.9. Run the preview only first and show me the two files that would be written: `npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.9 -- ksi-opencode install --target "<absolute path>"` (Windows: `(Join-Path (Get-Location) ".opencode")`). Do not substitute previous public release 0.5.0-beta.8: it was the historical three-role bundle. No npm login is needed for installation.
> 3. After I confirm, apply with `--apply`; if there is a conflict, stop and ask me about `--replace`.
> 4. Verify developer and reviewer in the effective agent list — file existence alone is not proof.
> 5. Change nothing else: native roles, OpenCode, Node, providers, models, credentials, the Design Specialist, CE, browser tooling, global instructions (AGENTS.md), MCP connections and service restarts require separate approval."

## Preview and apply from source (fallback)

When the registry version is unavailable, or when installing from a reviewed source checkout
instead of the public package, run from that checkout. Use the
same reviewed source revision for preview and apply:

```sh
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config --apply
```

The first command is read-only and prints the proposed file contents as JSON. The second writes two custom `agents/*.md` files only if each destination is absent or already identical. If a file differs, apply stops before writing anything. To replace after reviewing the exact preview, use `--apply --replace`; each replaced file is copied to a unique `.bak-...` sibling first. Replacement refuses an agent file with native `model`, `variant`, or `steps` frontmatter so those preferences can be migrated manually first. Replacement is recoverable through backups but is not transactional if a later filesystem write fails. The installer rejects symlinked managed destinations. A project target is usually `<project>/.opencode`; a global target is the server's OpenCode config directory. Use an absolute target to avoid writing into the wrong project.

## Design work: default Specialist, optional OpenDesign

Visual frontend work belongs by default to the Design Specialist (design/frontend/render
ownership under the global operating policy); Build owns overall integration and may apply
simple mechanical UI transfers directly, while API/data/auth contracts stay unchanged.
This installer distributes no design skills, craft references, or design-system package
and does not install or connect the Design Specialist or OpenDesign. OpenDesign is an
optional, separately and explicitly selected external-workspace integration — never the
sole, default, or mandatory design path, and its absence never blocks visual work that the
default Specialist path covers. If your work explicitly selects it, install the separate
application from its upstream documentation and explicitly configure its MCP connection.
Backend-only work needs no design installation. The responsibilities, tool contract, and
handoff requirements are in [the OpenDesign integration contract](docs/integrations/opendesign.md).

Version 0.5.0 removed the KSI Design primary agent and the `--with-design-kit` option. Supplying the retired flag now fails with an explicit message and writes nothing.

## Retiring the removed design role

A version before 0.5.0 may have installed `agents/design.md` and, with `--with-design-kit`, three skill directories (`skills/frontend-design`, `skills/impeccable-design-polish`, `skills/web-design-guidelines`). This installer never deletes files it wrote earlier, so those remain until you remove them deliberately. That removal is a separate change to your configuration and needs its own review:

1. Confirm the effective config directory the server actually uses.
2. Back up `agents/design.md` and the three skill directories.
3. Remove only those paths. Do not touch built-in Build/Plan/Explore, other plugins, credentials, or unrelated skills.
4. If your `opencode.jsonc` references `design` in agent routing or a restricted-agent list, remove that reference in the same reviewed change.
5. Restart or reconnect the client only if your setup requires it, and verify the fresh role catalog.

Removing a role can change what a pending plan or session assumed. Re-check any in-progress work that referenced it.

## Retiring the Test Runner role

The current source bundle no longer ships `agents/test-runner.md`, and the `--developer-test-runner` option is removed with an explicit error message. Previous public release 0.5.0-beta.8 still has the old role and option. Developer now owns the tests for its own implementation; Reviewer reviews code and test adequacy (safe read-only checks only); Build verifies the integrated revision and unverified areas without repeating already-valid checks. Where a project requires independent execution verification, use an explicitly configured verification role or authorized CI.

The installer never deletes a previously installed Test Runner file. An environment that already has `agents/test-runner.md` keeps it as a user-owned, explicitly configured verification role; any `opencode.jsonc` routing for it also stays untouched. If you want to retire it, back up the file and treat the removal — plus any matching routing entries — as a separate reviewed change to your configuration.

An old installed Developer prompt can also mention the removed delegation option.
Compare it with the current template and review a backed-up prompt-only merge;
do not discard model/variant/steps, permissions, or customized instructions just
to make the role file identical. Re-check active work before retiring a shared
verification role. Removed-flag errors and retirement/preservation tests remain
intentional compatibility safeguards, not legacy functionality to delete.

## Migrating an existing KSI plugin installation

Preview native files first. An older installation may still have KSI-provided `agents/build.md`, `agents/plan.md`, `agents/explore.md`, `agents/design.md`, `agents/research.md`, `agents/design-critic.md`, and `commands/complete.md` or `commands/review.md`; this installer deliberately does not delete them. To restore built-in prompts or retire old roles, review the exact owners and paths, back up the files, and remove only those overrides with separate approval. A shared migration also needs a reviewed diff for the old KSI plugin registration, KSI-owned JSONC agent prompts/permissions, and any blanket global deny. Preserve unrelated plugins if present, other tools' independent installations, every model/variant/valid positive step value, JSONC comments, and unrelated settings. Preservation is not a request to reinstall Superpowers or Goal after an explicitly approved removal. Back up the global config before an approved edit; request shared-service restart separately. Do not infer fresh-session behavior from the installed files alone.

The old `ksi-opencode-harness@0.4.0-beta.0` tarball was a V1-only plugin and has been removed from the registry; npm versions cannot be reused. Prefer the pinned beta version above for reproducible installation even after a later `latest` update. Removing a registry version does not remove any V1 plugin registration, old role files, or commands previously installed on a user's machine. Review and migrate those separately; a bare `npm install ksi-opencode-harness` only downloads the resolved package and does not apply OpenCode files.

## Full harness composition (agent-guided)

Current operation is a composition: OpenCode's native roles + the default Design Specialist + operating guidance + optional tools and the separate installer bundle. The two-role installer is an optional package, not a required replacement for General or a migration of global settings. Installing OpenCode and choosing a model/provider stay with each user — the composition **does not force a model**. (On the KSI host only, the user explicitly requested OpenAI gpt-6-luna-fast for the Design Specialist with the max variant preserved; never force this on other machines.) Paste this into a session to have the agent inspect what the approved environment actually needs:

> "Set up this repository's KSI harness composition in my environment. OpenCode and my model/provider choice are mine — do not change or force them.
> 1. Inspect the current state read-only: OpenCode V2 + Node 20+, installed agents, existing settings and tools.
> 2. Verify effective native Plan/Build/General/Explore and the default Design Specialist. Do not restore Developer/Test Runner/Reviewer/Superpowers/Goal in an already-migrated environment. Only if I request the separate role bundle, use public npm 0.5.0-beta.9, preview → my confirmation → `--apply`, with the target confirmed first. Previous public release 0.5.0-beta.8 was the historical three-role release, not the current operating configuration.
> 3. Operating guidance: read `examples/autonomous-development.md` and propose only the merge into my `AGENTS.md` → apply after approval.
> 4. Optional tools — relevant CE skills, a browser tool (Playwright CLI or agent-browser, pick one), OpenDesign + design MCP (only where I explicitly select that external workspace): reuse prepared capabilities first. Propose a missing capability from official documentation only when needed; get my approval for new installs, credentials and service changes. No per-project ce-setup or duplicate planning documents by default.
> 5. Finish with a per-component status table and any skipped items with reasons."

| Component | Required | Installed by | Verify |
| --- | --- | --- | --- |
| OpenCode V2 · Node 20+ | yes | user (official docs) | `opencode --version` |
| Native roles + default Design Specialist | native base | OpenCode | effective agent list; KSI two-role bundle is a separate option |
| Operating guidance (`AGENTS.md`) | recommended | user + agent (reviewed merge) | a new session loads it |
| CE | optional | user (official repo) | actual loading of relevant skills; no mandatory full workflow |
| Browser tool (one of) | for UI verification | user | one real page snapshot |
| OpenDesign + design MCP | for design work | user (separate app) | one project read |

Repo-only extras (for example the OpenDesign completion-notifier plugin) are not part of the npm package; they are handled from the checkout with their own scripts.

## Runtime and verification boundaries (package scope)

### Optional autonomous local development policy

Review [the shared policy section](examples/autonomous-development.md) and merge it into the server's global `AGENTS.md` or the intended repository's `AGENTS.md` if you want to adopt it. Back up the destination and preserve its existing project rules; do not replace the whole file or assume a Markdown link imports instructions automatically. The installer never performs this merge.

Adoption delegates approved local implementation, bounded helpers, integration, verification and task-owned commits without routine progress/commit questions. Explicit user/repository restrictions still win. Push/publication/deployment require target/effect authorization, which can be granted once and reused unless the target, effects or risk materially change. Native tool/identity approvals remain enforced. Plan stays non-implementing; material design goes through the default Design Specialist (or OpenDesign's local execution where explicitly selected) and direction approval, while UI-reference skills remain supplementary. This guidance does not change models, permissions, upstream skills or goal settings, guarantee perpetual execution, or authorize new backlog work.

OpenCode supplies Primary `build` and `plan` and Subagents `general` and `explore` without KSI replacements. The optional installer adds visible Subagents `developer` and `reviewer`. Their files omit `model`, `variant`, and `steps`: existing preferences remain user-owned. The installer never edits `opencode.jsonc`, `AGENTS.md`, credentials, providers, MCPs, plugins, Codex/Claude configuration, or separately installed skills, and does not restart services. A short cross-tool [project guidance template](examples/project-AGENTS.md) is optional and is not applied automatically. Inspect other config layers if a role ID already exists there; file collisions alone do not prove effective precedence.

Test Runner is no longer part of the default bundle, and `--developer-test-runner` is removed. Developer owns the tests for its own implementation; Reviewer independently reviews code and test adequacy (safe read-only checks only), and Build verifies the integrated revision and unverified areas without repeating already-valid checks. Where a project requires independent execution verification beyond that, an explicitly configured verification role or authorized CI provides it. A previously installed `agents/test-runner.md` is never deleted and keeps working as such a configured role.

The installer adds no slash commands. Plugin-only automatic checkpoint/product-state injection, six `ksi_*` evidence tools, delegation/signature checks, helper tracking, and output archiving are unavailable. Normal OpenCode tools, installed skills, and project `AGENTS.md` can support the workflow without recreating those hooks. Verify the installed files and effective modes/permissions in a fresh V2 session. A no-auth HTTP 401 is not a passing shared-service check. Provider calls, OpenChamber UI login, and Human end-to-end acceptance are separate actions.
