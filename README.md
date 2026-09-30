# KSI OpenCode Harness

An optional, preview-first installer for three native OpenCode V2 agents: **Developer**, **Test Runner**, and **Reviewer**. This is a **beta**, not an OpenCode runtime plugin. Built-in Build, Plan, and Explore remain available. KSI does not select your model/provider, install Superpowers, or guarantee visual quality.

Design work is not an OpenCode agent here. Material product and visual design belongs to the separate [OpenDesign](docs/integrations/opendesign.md) workspace, which OpenCode can read from and commission through its MCP capability.

## Quick start (project-local)

Requires Node.js 20+ and OpenCode V2. From your project's root directory, run the first command to inspect the proposed files. Run the second **only after reviewing the preview**:

```sh
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode" --apply
```

`@latest` selects the current public beta. To keep both commands on the same exact release, replace `@latest` in **both** with the same verified exact version. `npm exec` obtains the CLI via npm's cache; obtaining the package alone does not modify OpenCode. The installer requires an absolute target; `$PWD/.opencode` targets only this project. To affect all projects instead, deliberately choose the config directory of the OpenCode server you use (typically `~/.config/opencode`) and review the preview before applying. OpenChamber managed and external servers may use different config directories.

The default apply creates three files in `agents/` under the chosen target. Preview prints the intended contents as JSON and writes nothing. Reapplying identical files makes no changes. A differing managed file blocks apply; after inspection, `--apply --replace` backs it up before replacement, but user-owned `model`, `variant`, or `steps` in agent frontmatter must be migrated manually. KSI does **not** edit `opencode.jsonc`, provider credentials, MCPs, other plugins, Superpowers, or service configuration, and it does not restart OpenCode. See [full installation and migration guidance](INSTALL.md).

## What to expect in OpenCode

Developer, Test Runner, and Reviewer are subagents on top of the built-in Build, Plan, and Explore. These are native guidance and permissions, **not** a substitute for project approval or an OS sandbox. Reviewer reads code and behaviour and does not edit. [Verification limits](docs/verification.md) and the [OpenDesign integration contract](docs/integrations/opendesign.md) explain the boundaries.

Version 0.5.0 removes the previously installed **Design** primary agent and the optional `--with-design-kit` skill kit. The vendored OpenDesign skills, craft references, and reference design system are no longer distributed. The installer never deletes files it previously wrote, so an earlier install keeps its `agents/design.md` and skills until you retire them deliberately; see the [migration guidance](INSTALL.md#retiring-the-removed-design-role).

## Migrating an existing installation

The retired V1 plugin version `0.4.0-beta.0` was removed from npm, but deleting a registry version does not clean up any earlier user's installed plugin registration or files. The native installer does not automatically remove legacy role overrides or commands. Follow [migration guidance](INSTALL.md#migrating-an-existing-ksi-plugin-installation) if you previously applied V1. Former plugin-only checkpoint injection, `ksi_*` tools, delegation guards, and `/complete`/`/review` shortcuts are **not** part of V2.

For a reviewed source checkout, run `node bin/ksi-opencode.mjs install --target "$PWD/.opencode"` (preview) and add `--apply` only after review. See [architecture](docs/architecture.md) and the [OpenDesign integration contract](docs/integrations/opendesign.md).
