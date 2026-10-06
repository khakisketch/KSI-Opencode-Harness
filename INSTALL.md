# Native OpenCode V2 installation

KSI is distributed here as a standalone installer for OpenCode V2 native files, not as an OpenCode plugin. First inspect the source and decide which OpenCode configuration directory owns the server you use. For OpenChamber managed mode, use its managed OpenCode server's config; in external-server mode, use the external server's config. The OpenChamber orchestration tool is managed-only and is unrelated to KSI installation.

## Installation ownership

Install Node.js 20+ and OpenCode V2 separately using their upstream instructions. KSI's default `--apply`
writes only `agents/developer.md`, `agents/test-runner.md`, and `agents/reviewer.md` under the selected target.
It does not install OpenCode, OpenDesign, Superpowers, Docker, model CLIs, credentials, or MCP connections.
Your agent may help set those up after reading their documentation, but needs explicit approval for system
installation, shared/global settings, credentials, and service changes. KSI installation alone authorizes none of them.

## Public npm beta: preview and apply

With Node.js 20 or newer, use the current public beta. From the root of the project you want to change, `$PWD/.opencode` is an absolute project-local target. `npm exec` obtains the package through npm's cache; obtaining the package alone makes no OpenCode configuration changes. The first command previews; only the second command's `--apply` writes files.

```sh
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.6 -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.6 -- ksi-opencode install --target "$PWD/.opencode" --apply
```

Both commands pin the same exact beta. If the registry version is unavailable, use the source commands below.
This public beta is released through `next` and the default `latest` channel; default-channel delivery does not make it a stable release. Pin the exact version to avoid later channel movement. This beta does not imply acceptance of real-product visual output.

### Let your agent install it (copy → paste)

Paste this into the OpenCode session that should perform the installation:

> "Install the KSI harness (ksi-opencode-harness) for this project.
> 1. Verify Node.js 20+ and OpenCode V2 are ready, then ask me whether the target is the project `.opencode` or the server's global config directory.
> 2. Run the preview only first and show me the three files that would be written: `npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.6 -- ksi-opencode install --target \"<absolute path>\"`
> 3. After I confirm, apply with `--apply`; if there is a conflict, stop and ask me about `--replace`.
> 4. Verify developer, test-runner and reviewer in the effective agent list — file existence alone is not proof.
> 5. Change nothing else: tool installs, credentials, global instructions (AGENTS.md) and service restarts require separate approval."

## Preview and apply from source

From a reviewed source checkout, run:

```sh
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config --apply
```

The first command is read-only and prints the proposed file contents as JSON. The second writes three custom `agents/*.md` files only if each destination is absent or already identical. If a file differs, apply stops before writing anything. To replace after reviewing the exact preview, use `--apply --replace`; each replaced file is copied to a unique `.bak-...` sibling first. Replacement refuses an agent file with native `model`, `variant`, or `steps` frontmatter so those preferences can be migrated manually first. Replacement is recoverable through backups but is not transactional if a later filesystem write fails. The installer rejects symlinked managed destinations. A project target is usually `<project>/.opencode`; a global target is the server's OpenCode config directory. Use an absolute target to avoid writing into the wrong project.

## Design work belongs to OpenDesign

This installer distributes no design skills, craft references, or design-system package and does not install or connect OpenDesign. If your work needs it, install the separate application from its upstream documentation and explicitly configure its MCP connection. Material product, visual, and interaction design can then happen in that workspace. Backend work and small edits to approved UI patterns need no OpenDesign installation. The responsibilities, tool contract, and handoff requirements are in [the OpenDesign integration contract](docs/integrations/opendesign.md).

Version 0.5.0 removed the KSI Design primary agent and the `--with-design-kit` option. Supplying the retired flag now fails with an explicit message and writes nothing.

## Retiring the removed design role

A version before 0.5.0 may have installed `agents/design.md` and, with `--with-design-kit`, three skill directories (`skills/frontend-design`, `skills/impeccable-design-polish`, `skills/web-design-guidelines`). This installer never deletes files it wrote earlier, so those remain until you remove them deliberately. That removal is a separate change to your configuration and needs its own review:

1. Confirm the effective config directory the server actually uses.
2. Back up `agents/design.md` and the three skill directories.
3. Remove only those paths. Do not touch built-in Build/Plan/Explore, other plugins, credentials, or unrelated skills.
4. If your `opencode.jsonc` references `design` in agent routing or a restricted-agent list, remove that reference in the same reviewed change.
5. Restart or reconnect the client only if your setup requires it, and verify the fresh role catalog.

Removing a role can change what a pending plan or session assumed. Re-check any in-progress work that referenced it.

## Migrating an existing KSI plugin installation

Preview native files first. An older installation may still have KSI-provided `agents/build.md`, `agents/plan.md`, `agents/explore.md`, `agents/design.md`, `agents/research.md`, `agents/design-critic.md`, and `commands/complete.md` or `commands/review.md`; this installer deliberately does not delete them. To restore built-in prompts or retire old roles, review the exact owners and paths, back up the files, and remove only those overrides with separate approval. A shared migration also needs a reviewed diff for the old KSI plugin registration, KSI-owned JSONC agent prompts/permissions, and any blanket global deny. Preserve Superpowers, the goal plugin, other plugins, every model/variant/valid positive step value, JSONC comments, and unrelated settings. Back up the global config before an approved edit; request shared-service restart separately. Do not infer fresh-session behavior from the installed files alone.

The old `ksi-opencode-harness@0.4.0-beta.0` tarball was a V1-only plugin and has been removed from the registry; npm versions cannot be reused. Prefer the pinned beta version above for reproducible installation even after a later `latest` update. Removing a registry version does not remove any V1 plugin registration, old role files, or commands previously installed on a user's machine. Review and migrate those separately; a bare `npm install ksi-opencode-harness` only downloads the resolved package and does not apply OpenCode files.

## Full harness composition (agent-guided)

This repository's harness is a composition: OpenCode (yours) + the three KSI roles + operating guidance + optional tools. Installing OpenCode and choosing a model/provider stay with each user — the composition **does not force a model**. Paste this into a session to have the agent assemble what is missing:

> "Set up this repository's KSI harness composition in my environment. OpenCode and my model/provider choice are mine — do not change or force them.
> 1. Inspect the current state read-only: OpenCode V2 + Node 20+, installed agents, existing settings and tools.
> 2. KSI roles (developer, test-runner, reviewer): preview → my confirmation → `--apply` → verify in the effective agent list. Ask me first whether the target is project or global.
> 3. Operating guidance: read `examples/autonomous-development.md` and propose only the merge into my `AGENTS.md` → apply after approval.
> 4. Optional tools — Superpowers, a browser tool (Playwright CLI or agent-browser, pick one), OpenDesign + design MCP: check each project's official documentation, propose a plan, and get my approval for system installs, credentials and service changes. Skip what is already present and report its status.
> 5. Finish with a per-component status table and any skipped items with reasons."

| Component | Required | Installed by | Verify |
| --- | --- | --- | --- |
| OpenCode V2 · Node 20+ | yes | user (official docs) | `opencode --version` |
| KSI three roles | yes | this installer | effective agent list |
| Operating guidance (`AGENTS.md`) | recommended | user + agent (reviewed merge) | a new session loads it |
| Superpowers | recommended | user (official repo) | skill list |
| Browser tool (one of) | for UI verification | user | one real page snapshot |
| OpenDesign + design MCP | for design work | user (separate app) | one project read |

Repo-only extras (for example the OpenDesign completion-notifier plugin) are not part of the npm package; they are handled from the checkout with their own scripts.

## Runtime and verification boundaries (package scope)

### Optional autonomous local development policy

Review [the shared policy section](examples/autonomous-development.md) and merge it into the server's global `AGENTS.md` or the intended repository's `AGENTS.md` if you want to adopt it. Back up the destination and preserve its existing project rules; do not replace the whole file or assume a Markdown link imports instructions automatically. The installer never performs this merge.

Adoption delegates approved local implementation, bounded helpers, integration, verification and task-owned commits without routine progress/commit questions. Explicit user/repository restrictions still win. Push/publication/deployment require target/effect authorization, which can be granted once and reused unless the target, effects or risk materially change. Native tool/identity approvals remain enforced. Plan stays non-implementing; material design goes through OpenDesign's local execution and direction approval, while UI-reference skills remain supplementary. This guidance does not change models, permissions, upstream skills or goal settings, guarantee perpetual execution, or authorize new backlog work.

OpenCode supplies Primary `build` and `plan` and Subagent `explore` without KSI replacements. The installer adds visible Subagents `developer`, `test-runner`, and `reviewer`. Their files omit `model`, `variant`, and `steps`: existing preferences remain user-owned. The installer never edits `opencode.jsonc`, `AGENTS.md`, credentials, providers, MCPs, plugins, Codex/Claude configuration, or Superpowers, and does not restart services. A short cross-tool [project guidance template](examples/project-AGENTS.md) is optional and is not applied automatically. Inspect other config layers if a role ID already exists there; file collisions alone do not prove effective precedence.

`developerTestRunner` is OFF by default. `--developer-test-runner` produces an explicit native Developer permission/prompt variant. Unlike the former plugin, it cannot enforce one active helper or freeze writer tools. Do not enable it by default; V2's native `experimental.subagent_depth` is a separate user setting.

The installer adds no slash commands. Plugin-only automatic checkpoint/product-state injection, six `ksi_*` evidence tools, delegation/signature checks, helper tracking, and output archiving are unavailable. Normal OpenCode tools, installed skills, and project `AGENTS.md` can support the workflow without recreating those hooks. Verify the installed files and effective modes/permissions in a fresh V2 session. A no-auth HTTP 401 is not a passing shared-service check. Provider calls, OpenChamber UI login, and Human end-to-end acceptance are separate actions.
