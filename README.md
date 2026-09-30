# KSI OpenCode Harness

**A lightweight engineering harness for OpenCode V2 — with clear ownership, scoped delegation, and evidence before completion.**

KSI adds three optional native subagents: **Developer**, **Test Runner**, and **Reviewer**. You keep working
with OpenCode's built-in **Build**, **Plan**, and **Explore**. It is a preview-first installer for agent
guidance and permissions, **not a runtime plugin or an all-in-one tool installer**. Current release line:
`0.5.0-beta.1` (beta).

## What it does

- Give bounded implementation, test execution, and independent code review distinct responsibilities.
- Keep requirements, engineering decisions, integration, and final reporting with Build/Plan.
- Ask for actual verification evidence; keep human approval separate from a passing test.
- Leave models, providers, reasoning variants, and step budgets under your control.

Native prompts and permissions guide execution; they do not enforce a workflow engine or provide an OS sandbox.
There is no mandatory delegation on every task.

## How work flows

```text
You: desired outcome + constraints + acceptance
                  │
             Plan / Build
                  ├── Explore: inspect the existing project when useful
                  ├── Developer: bounded implementation when useful
                  ├── Test Runner: run checks and report actual results
                  └── Reviewer: independent code / behaviour review
                  │
             Build integrates and reports evidence + remaining gaps
                  │
             You approve the result

Optional design branch:
Build or you → separately installed design workspace → human-approved artifact
             → Build implements it in the real product and verifies it
```

| Role | Owns | Does not own |
| --- | --- | --- |
| Build / Plan (built-in) | Requirements, architecture, coordination, integration, honest final claims | User approval or automatic release authority |
| Explore (built-in) | Repository discovery | Implementation ownership |
| Developer (KSI) | Assigned implementation and repairs | Unbounded scope expansion; delegation by default |
| Test Runner (KSI) | Actual check execution and results | Production implementation or acceptance |
| Reviewer (KSI) | Read-only code and behaviour review | Code edits or visual taste approval |
| Human | Direction, scope, permissions, final acceptance | — |

For example, ask Build: “Implement this approved change using existing patterns. Delegate where useful;
report checks actually run, known gaps, and what still needs my acceptance.” These are ordinary requests,
not KSI slash commands. See [execution guidance](docs/execution.md).

## Exactly what installation changes

After an explicit `--apply`, the default installer writes only these files under **your chosen target**:

```text
agents/developer.md
agents/test-runner.md
agents/reviewer.md
```

**It does not install OpenCode, OpenDesign, Superpowers, Docker, or any model CLI.** It does not configure
MCP servers, sign in to providers, edit `opencode.jsonc` or `AGENTS.md`, install plugins/skills, select models,
restart services, or delete an old installation. Downloading the npm package alone changes no OpenCode files.
An explicit replacement creates backups; see [collision and migration rules](INSTALL.md).

| Component | Who sets it up? | Required? |
| --- | --- | --- |
| Node.js 20+ and OpenCode V2 | You or your agent, using upstream instructions | Yes |
| Three KSI agent files | This installer, only after reviewed `--apply` | The package's entire default installation scope |
| Model/provider credentials | You, through your selected provider's sign-in | For model-backed work; never supplied by KSI |
| Superpowers | You or your agent, separately | Optional process skills; not bundled |
| OpenDesign and its MCP connection | You or your agent, separately | Optional, for substantial design work |
| Project guidance and continuity files | Your project's chosen process | Optional; no automatic injection |

## Quick start (project-local)

First install [OpenCode V2](https://opencode.ai/v2/docs/) and Node.js 20+. From your project's root,
preview the exact beta package, review the proposed contents, then apply:

```sh
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.1 -- ksi-opencode install --target "$PWD/.opencode"
npm exec --yes --package=ksi-opencode-harness@0.5.0-beta.1 -- ksi-opencode install --target "$PWD/.opencode" --apply
```

Both commands pin the same release. The target must be absolute. Preview writes nothing; apply is idempotent
for identical files and refuses differing files unless you explicitly request backed-up replacement.
For all projects, deliberately choose the configuration directory of the OpenCode server you actually use
(typically `~/.config/opencode`). OpenChamber managed/external servers can have different config directories.

If the registry version is unavailable, or to inspect a reviewed source checkout:

```sh
node bin/ksi-opencode.mjs install --target "$PWD/.opencode"
node bin/ksi-opencode.mjs install --target "$PWD/.opencode" --apply
```

Then inspect the effective agent catalog in OpenCode. A file existing is not proof that another configuration
layer has not overridden it. [Full installation guide](INSTALL.md) · [Architecture](docs/architecture.md).

## Optional design workspace — separate installation

[OpenDesign](https://github.com/nexu-io/open-design) is a separate application, not a dependency installed by
KSI. Install it yourself using its upstream instructions. If you want an agent to do that, explicitly approve
the installation and the configuration/credential sharing it requires.

After you separately register its MCP server, Build can read an artifact or commission design work without
switching to a Design primary. For a new screen or substantial redesign: agree the brief, generate/refine
in the design workspace, approve the direction, then implement against the real project's components and tokens.
For backend work and small changes inside approved patterns, no design workspace is needed.

Read [the integration contract](docs/integrations/opendesign.md) for setup boundaries, connection checks,
artifact handoff, and recovery. Workstation-specific reproduction assets are available in the
[source repository](https://github.com/khakisketch/KSI-Opencode-Harness/tree/main/integrations/opendesign);
they are **not included in npm or automatically applied**, and are not a universal installation recipe.

## For agents reading this repository

1. Read this README and [INSTALL.md](INSTALL.md); inspect the project's instructions and effective server/config.
2. Check whether Node.js, OpenCode, and the selected provider are already available. Use current upstream
   documentation for missing tools, not assumptions about the maintainer's machine.
3. Propose the smallest setup needed. Ask before system installation, global/shared configuration changes,
   credential access/sharing, service restarts, or destructive migration. Reading docs is not authorization.
4. Preview KSI's files. Apply only to the approved target, preserving user model and permission choices.
5. Set up Superpowers or the separate design workspace **only if requested/needed and approved**. Consult
   [Superpowers upstream](https://github.com/obra/superpowers) and the design integration guide; do not treat
   either as installed merely because this repository mentions it.
6. Verify the effective agents. For design integration, verify MCP tool discovery **and a real read** from
   the intended workspace. Report configured, connected, and verified as distinct states.

## Upgrading and limits

Version 0.5.0 removes the **Design** primary and the `--with-design-kit` option. It ships no vendored design
skills. Existing files remain until you deliberately retire them. The old V1 plugin is not this package;
remove legacy registrations only through a reviewed migration. See [upgrade guidance](INSTALL.md).

No KSI runtime hooks, automatic checkpoint injection, `ksi_*` evidence tools, output archive, or `/complete`
and `/review` shortcuts are installed. Optional project conventions and separately installed skills can
support continuity, but cannot be described as built-in enforcement. Passing package tests is not proof of
production design acceptance or every third-party integration. [Verification limits](docs/verification.md).

## Development

```sh
npm run check
npm run check:package
```

The package check exercises the packed CLI in isolation: preview, three-file apply, repeat apply, and
rejection of retired options/user-routing replacement. [Troubleshooting](docs/troubleshooting.md) ·
[MIT license](LICENSE).
