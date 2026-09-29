# KSI OpenCode Harness

KSI is a standalone installer for four optional OpenCode V2 agents: Design, Developer, Test Runner, and Reviewer. OpenCode's own Build, Plan, and Explore remain available with their built-in prompts. This is **not** an OpenCode runtime plugin. The installer does not choose a provider, model, or variant or add slash commands.

For material product, visual, or interaction design, start with Design and the project's existing design sources. Design is a selectable Primary, not a required stage for every UI change; Build can handle small changes within approved patterns and owns production integration. Reviewer can independently assess code changes or supplied rendered designs when explicitly asked; visual inspection requires actual image input. Build may work directly or delegate. Design may work in normal authorized workspace paths; `design-previews/` is a convention, not a path gate. Roles are guidance and native permissions, not an OS sandbox or a substitute for Human authority.

For substantial design, the Design role now uses a product-grounded quality loop: study the real UI and user task, compare genuinely different rendered directions if the choice is open, inspect the selected implementation, optionally seek image-backed Reviewer feedback, and retain only Human-confirmed preference evidence. This is a method, not a guarantee of high-quality output or an automatic approval gate. See [Design guidance](docs/design.md).

## Install the public beta

`ksi-opencode-harness@0.4.0-beta.1` is the native V2 installer beta, not an OpenCode plugin. Node.js 20 or newer is required. Installing the npm package alone does not change OpenCode configuration. Run the CLI against an absolute target to preview first, then explicitly apply after reviewing the output:

```sh
npm exec --yes --package=ksi-opencode-harness@0.4.0-beta.1 -- ksi-opencode install --target /absolute/path/to/opencode-config
npm exec --yes --package=ksi-opencode-harness@0.4.0-beta.1 -- ksi-opencode install --target /absolute/path/to/opencode-config --apply
```

The design kit is opt-in with `--with-design-kit`. Publishing this beta does not mean real-product visual quality has been accepted. See [INSTALL.md](INSTALL.md) for collisions and migration.

## Try the installer from this checkout

Use an absolute OpenCode configuration directory. A project-local target is typically `<project>/.opencode`; a global target is the OpenCode configuration directory. The first command only previews exact new/replaced file contents; the second applies. Do not apply to a shared or global target without reviewing the diff and obtaining its owner's approval.

```sh
node bin/ksi-opencode.mjs install --target /absolute/path/to/project/.opencode
node bin/ksi-opencode.mjs install --target /absolute/path/to/project/.opencode --apply
```

The default installer writes only four `agents/*.md` files under the selected target. Add `--with-design-kit` to preview or install three OpenCode skill directories: `frontend-design`, `impeccable-design-polish`, and `web-design-guidelines`. The first two include task-relevant OpenDesign craft references and a small OpenCode reading guide; the kit remains opt-in. Existing differing managed files stop an apply; after reviewing the preview, `--apply --replace` makes a backup of each replaced file before writing. It refuses replacement of an agent file when existing native frontmatter has `model`, `variant`, or `steps`, pending manual migration of those preferences. A repeat installation with identical files makes no changes. It does not remove older Build/Plan/Explore, Research, Design Critic, or command files automatically. JSONC, provider credentials, MCPs, other plugins, and unrelated files are never rewritten by this CLI. New role files deliberately omit model/variant/steps. See [INSTALL.md](INSTALL.md).

The package also carries OpenDesign's pinned Neutral Modern design-system package as a reference. It is not installed by either command, is not a KSI brand, and never replaces a project's tokens or component library. Its provenance, included files, and licenses are recorded in [`vendor/open-design/UPSTREAM.md`](vendor/open-design/UPSTREAM.md).

The default Developer cannot delegate. `--developer-test-runner` is an explicit native-file variant and remains off by default. Without the old runtime hook it does **not** guarantee a single helper or pause the writer; use it only after accepting that difference.

## What changed from the plugin design

The current source package exposes the installer CLI, not `setup(ctx)`. It ships the four custom agent prompts and, only when requested, three vetted OpenDesign-derived skills with selected craft references. Build/Plan/Explore retain OpenCode's defaults. `/complete` and `/review` are not installed: they were prompt shortcuts, not agent orchestration tools. Automatic checkpoint/product-state injection, six `ksi_*` evidence tools, in-process delegation/signature guards, helper lifecycle tracking, and output archiving were plugin-only features and are unavailable here. Agents can use normal authorized tools and an optional [shared project guidance template](examples/project-AGENTS.md); no equivalent runtime automation is claimed. [Design guidance](docs/design.md), [architecture](docs/architecture.md), and [verification limits](docs/verification.md) give the boundaries.

Official Superpowers and any goal plugin are independent user-owned components. KSI does not install, modify, or remove them. OpenChamber managed mode must use the config directory of the server it starts; external-server mode must use that external OpenCode server's config. OpenChamber's orchestration tool remains managed-only.

The older npm `ksi-opencode-harness@0.4.0-beta.0` is an immutable V1 plugin, **not** this installer. The commands above describe the V2 release candidate; until publication and registry verification, use the reviewed checkout commands instead. These instructions do not authorize a global-config edit or shared-service restart.
