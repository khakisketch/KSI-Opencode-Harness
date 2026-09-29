# KSI OpenCode Harness

An optional, preview-first installer for four native OpenCode V2 agents: **Design**, **Developer**, **Test Runner**, and **Reviewer**. This is a **beta**, not an OpenCode runtime plugin. Built-in Build, Plan, and Explore remain available. KSI does not select your model/provider, install Superpowers, or guarantee visual quality.

## Quick start (project-local)

Requires Node.js 20+ and OpenCode V2. From your project's root directory, run the first command to inspect the proposed files. Run the second **only after reviewing the preview**:

```sh
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@latest -- ksi-opencode install --target "$PWD/.opencode" --apply
```

`@latest` selects the current public beta. To keep both commands on the same exact release, replace `@latest` in **both** with the same verified exact version. `npm exec` obtains the CLI via npm's cache; obtaining the package alone does not modify OpenCode. The installer requires an absolute target; `$PWD/.opencode` targets only this project. To affect all projects instead, deliberately choose the config directory of the OpenCode server you use (typically `~/.config/opencode`) and review the preview before applying. OpenChamber managed and external servers may use different config directories.

The default apply creates four files in `agents/` under the chosen target. Preview prints the intended contents as JSON and writes nothing. Reapplying identical files makes no changes. A differing managed file blocks apply; after inspection, `--apply --replace` backs it up before replacement, but user-owned `model`, `variant`, or `steps` in agent frontmatter must be migrated manually. KSI does **not** edit `opencode.jsonc`, provider credentials, MCPs, other plugins, Superpowers, or service configuration, and it does not restart OpenCode.

To add the optional design kit, append `--with-design-kit` to **both** commands. It installs three skills (`frontend-design`, `impeccable-design-polish`, `web-design-guidelines`) under `skills/`. The bundled Neutral Modern design system is only a reference and is not applied to your project. See [full installation and migration guidance](INSTALL.md).

## What to expect in OpenCode

Design is a selectable primary agent for substantial product/interface design. Developer, Test Runner, and Reviewer are subagents. These are native guidance and permissions, **not** a substitute for project approval or an OS sandbox. Small UI edits within approved patterns can stay with Build; Reviewer needs an image-capable model and actual image input for visual feedback. [Design guidance](docs/design.md) and [verification limits](docs/verification.md) explain the boundaries.

The retired V1 plugin version `0.4.0-beta.0` was removed from npm, but deleting a registry version does not clean up any earlier user's installed plugin registration or files. The native installer does not automatically remove legacy role overrides or commands. Follow [migration guidance](INSTALL.md#migrating-an-existing-ksi-plugin-installation) if you previously applied V1. Former plugin-only checkpoint injection, `ksi_*` tools, delegation guards, and `/complete`/`/review` shortcuts are **not** part of V2.

For a reviewed source checkout, run `node bin/ksi-opencode.mjs install --target "$PWD/.opencode"` (preview) and add `--apply` only after review. See [architecture](docs/architecture.md) and [OpenDesign provenance](vendor/open-design/UPSTREAM.md).
