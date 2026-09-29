# Native OpenCode V2 installation

KSI is distributed here as a standalone installer for OpenCode V2 native files, not as an OpenCode plugin. First inspect the source and decide which OpenCode configuration directory owns the server you use. For OpenChamber managed mode, use its managed OpenCode server's config; in external-server mode, use the external server's config. The OpenChamber orchestration tool is managed-only and is unrelated to KSI installation.

## Public npm beta: preview and apply

With Node.js 20 or newer, use the current public beta. From the root of the project you want to change, `$PWD/.opencode` is an absolute project-local target. `npm exec` obtains the package through npm's cache; obtaining the package alone makes no OpenCode configuration changes. The first command previews; only the second command's `--apply` writes files.

```sh
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode" --apply
```

For reproducibility, pin **both** commands to the same verified exact version instead of `@latest`. The optional design kit requires `--with-design-kit` on both preview and apply. This beta does not imply acceptance of real-product visual output.

## Preview and apply from source

From a reviewed source checkout, run:

```sh
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config --apply
```

The first command is read-only and prints the proposed file contents as JSON. The second writes four custom `agents/*.md` files only if each destination is absent or already identical. If a file differs, apply stops before writing anything. To replace after reviewing the exact preview, use `--apply --replace`; each replaced file is copied to a unique `.bak-...` sibling first. Replacement refuses an agent file with native `model`, `variant`, or `steps` frontmatter so those preferences can be migrated manually first. Replacement is recoverable through backups but is not transactional if a later filesystem write fails. The installer rejects symlinked managed destinations. A project target is usually `<project>/.opencode`; a global target is the server's OpenCode config directory. Use an absolute target to avoid writing into the wrong project.

## Optional OpenDesign skill kit

To include the three pinned, native OpenCode skills selected from OpenDesign, add `--with-design-kit` to both preview and apply:

```sh
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config --with-design-kit
node bin/ksi-opencode.mjs install --target /absolute/path/to/opencode-config --with-design-kit --apply
```

This adds `skills/frontend-design/`, `skills/impeccable-design-polish/`, and `skills/web-design-guidelines/` alongside the four role files. The first creates or reshapes UI, the second polishes an existing artifact, and the third provides a web-interface review lens. The two production skills include relevant `references/craft/` files and OpenCode-specific reading notes, because OpenCode does not interpret OpenDesign's `od.craft.requires` metadata or inject its design system. Installed craft copies are prefaced: the original text's daemon rules and fixed numerical demands are advisory, not KSI restrictions. The review skill uses its pinned local guide; a live-upstream comparison needs an explicit Human request and does not expand authority. Existing product sources and approved choices win. OpenCode discovers installed skills when relevant; the flag does not force any role to use one or grant extra permissions. Differing skill files follow the same preview, conflict, symlink, and explicit-backup rules as agent files.

For image-backed Reviewer feedback, select a model that actually accepts image input for Reviewer and confirm a fresh session can inspect a supplied screenshot. The installer intentionally does not choose or overwrite a model. Native `read` permission makes a PNG/JPEG/WebP accessible, but it cannot give vision to a text-only model; catalog checks alone do not prove a visual critique. [OpenCode V2 image attachment behavior](https://opencode.ai/v2/docs/attachments) describes this boundary. The [Design quality loop](docs/design.md) is proportional, not a mandatory set of variants or captures.

The source package additionally vendors OpenDesign's complete Neutral Modern design-system package under `vendor/open-design/design-systems/default/`. It is a deliberately separate reference: this installer never writes it to the target, enables it, or treats it as a project's token/component source of truth. A project may deliberately evaluate it as a starting point only when it has no established system and its owner accepts the visual direction. Consult the pinned provenance and licenses in [`vendor/open-design/UPSTREAM.md`](vendor/open-design/UPSTREAM.md); no OpenDesign desktop app, daemon, MCP server, agent, template, or unreviewed catalog item is installed.

OpenCode supplies Primary `build` and `plan` and Subagent `explore` without KSI replacements. The installer adds optional Primary `design` and visible Subagents `developer`, `test-runner`, and `reviewer`. Design may ask Explore for bounded local facts or authorized external examples and Reviewer for independent code or design review. Its files omit `model`, `variant`, and `steps`: existing preferences remain user-owned. It never edits `opencode.jsonc`, `AGENTS.md`, credentials, providers, MCPs, plugins, Codex/Claude configuration, or Superpowers, and does not restart services. A short cross-tool [project guidance template](examples/project-AGENTS.md) is optional and is not applied automatically. Inspect other config layers if a role ID already exists there; file collisions alone do not prove effective precedence.

`developerTestRunner` is OFF by default. `--developer-test-runner` produces an explicit native Developer permission/prompt variant. Unlike the former plugin, it cannot enforce one active helper or freeze writer tools. Do not enable it by default; V2's native `experimental.subagent_depth` is a separate user setting.

## Migrating an existing KSI plugin installation

Preview native files first. An older installation may still have KSI-provided `agents/build.md`, `agents/plan.md`, `agents/explore.md`, `agents/research.md`, `agents/design-critic.md`, and `commands/complete.md` or `commands/review.md`; this installer deliberately does not delete them. To restore built-in prompts or retire old roles, review the exact owners and paths, back up the files, and remove only those overrides with separate approval. A shared migration also needs a reviewed diff for the old KSI plugin registration, KSI-owned JSONC agent prompts/permissions, and any blanket global deny. Preserve Superpowers, the goal plugin, other plugins, every model/variant/valid positive step value, JSONC comments, and unrelated settings. Back up the global config before an approved edit; request shared-service restart separately. Do not infer fresh-session behavior from the installed files alone.

The old `ksi-opencode-harness@0.4.0-beta.0` tarball was a V1-only plugin and has been removed from the registry; npm versions cannot be reused. The current `latest` tag selects the native V2 beta. Removing a registry version does not remove any V1 plugin registration, old role files, or commands previously installed on a user's machine. Review and migrate those separately; a bare `npm install ksi-opencode-harness` only downloads the current package and does not apply OpenCode files.

## Runtime and verification boundaries

The installer adds no slash commands. Plugin-only automatic checkpoint/product-state injection, six `ksi_*` evidence tools, delegation/signature checks, helper tracking, and output archiving are unavailable. Normal OpenCode tools, installed skills, and project `AGENTS.md` can support the workflow without recreating those hooks. Verify the installed files, skills, and effective modes/permissions in a fresh V2 session. A no-auth HTTP 401 is not a passing shared-service check. Provider calls, OpenChamber UI login, and Human end-to-end acceptance are separate actions.
