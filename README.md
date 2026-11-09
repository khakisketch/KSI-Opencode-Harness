# KSI OpenCode Harness

**A lightweight, native-first harness for building and verifying software with OpenCode.**

[![verify](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/verify.yml/badge.svg)](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/verify.yml)

AI agents can generate code quickly. The harder problem is carrying a task through implementation, integration, verification, and correction.

KSI OpenCode Harness is a practical development setup built around clear agent ownership, evidence-grounded planning, selective delegation, and verification against real running software. It extends OpenCode's native capabilities without a separate workflow engine or mandatory review gates.

`OpenCode Native` · `Four roles` · `Depth 2 with one second-level edge` · `No mandatory review gates`

**한국어 문서:** [문서 안내](docs/README.md)에서 시작하세요.

---

## Why this exists

Most agent setups optimize for the first draft. Real development is the part after it: preserving existing behavior, integrating parallel changes, running the product, looking at the rendered screen, and fixing what the evidence reveals.

This harness keeps one development owner responsible for the whole result. Specialized agents and tools are used only when their value exceeds the cost of handing work off. Verification is based on actual tests, runtime behavior, logs, and rendered UI — not on an agent's completion message.

## How it works

```text
User
  └─ Build ── investigate → design → implement → integrate → verify → correct → report
       ├─ Plan     advisory analysis; may call Explore for missing evidence
       ├─ General  bounded, self-contained execution
       └─ Explore  read-only investigation
```

| Role | Responsibility | Boundary |
| --- | --- | --- |
| **Build** | Owns the approved goal end to end: context, design, implementation, integration, verification, correction | Sole development owner; does not delegate final ownership |
| **Plan** | Advises on consequential or uncertain work from actual code and project evidence: alternatives, causes, risks, a work plan | Cannot implement, approve, or own the task; may call Explore, not General or another Plan |
| **General** | Executes a bounded, independent task and returns changed behavior, checks, and risks | Leaf; calls no subagents |
| **Explore** | Investigates code, docs, and external material | Read-only leaf; calls no subagents |

Delegation depth is 2, but the only second-level edge is **Plan → Explore**. General and Explore are leaves, and Build is the only root. None of this is a fixed sequence: Build implements directly when that is cheaper and delegates only when separation pays.

## Key principles

- **One owner.** Build owns the user goal through implementation, integration, verification, and correction.
- **Evidence before advice.** Plan works from files, diffs, failures, contracts, and open questions — not from a summary alone. It cites what it inspected, separates facts from assumptions, and names missing evidence.
- **Delegation is optional.** Work is handed off when the benefit exceeds handoff and integration cost, not because a task is large or touches many files.
- **Verify the product, not the report.** Tests, runtime interaction, logs, and rendered screens are evidence. A passing check or a screenshot does not by itself prove user acceptance.
- **Disposable plans, durable canon.** Task plans stay short. Only decisions that outlive the task are promoted to the project's canonical docs.
- **Explicit boundaries.** Approved scope, existing work, analysis-only requests, credentials, and shared services are preserved. A user stop ends the work until re-authorized.

## Quick start

### Requirements

- **OpenCode V2** with Native agents.
- **Git** to clone the repository.
- **Node.js 26** for the verification scripts. The repository has no npm dependencies; nothing needs to be installed.
- Optional: the `opencode` binary on `PATH` for Native checks, and your own provider credentials for real sessions.

### 1. Clone and back up your configuration

```sh
git clone https://github.com/khakisketch/KSI-Opencode-Harness.git
cd KSI-Opencode-Harness

mkdir -p "$HOME/.local/share/ksi-harness-backup"
cp "$HOME/.config/opencode/AGENTS.md" "$HOME/.local/share/ksi-harness-backup/AGENTS.md" 2>/dev/null || true
cp "$HOME/.config/opencode/opencode.json" "$HOME/.local/share/ksi-harness-backup/opencode.json" 2>/dev/null || true
cp "$HOME/.config/opencode/opencode.jsonc" "$HOME/.local/share/ksi-harness-backup/opencode.jsonc" 2>/dev/null || true
```

### 2. Merge the operating instructions

Review [`global/AGENTS.md`](global/AGENTS.md) and merge its principles into `~/.config/opencode/AGENTS.md`. Keep your own project rules. The file is a short operating contract, not a replacement for your existing instructions.

### 3. Merge the role and permission configuration

Merge the parts of [`global/opencode.jsonc`](global/opencode.jsonc) you need into `~/.config/opencode/opencode.json(c)`:

- the `build`, `plan`, `general`, and `explore` agent definitions,
- `experimental.subagent_depth: 2`,
- the optional MCP entries you actually use.

Keep your providers, models, credentials, and permission settings. **Do not replace the whole file.** The portable source intentionally pins no models; the configuration is model-agnostic.

> The repository provides no automated installer for the global configuration. This is deliberate: `opencode.json(c)` often contains personal providers, local models, MCP credentials, and permissions that a script should not overwrite.

### 4. Optionally install project-local skills

```sh
node scripts/install-external-skills.mjs --list
node scripts/install-external-skills.mjs --project /absolute/path/to/your-project --set all
```

This installs the vendored Anthropic engineering and design skills into that project's `.opencode/skills`. Nothing is installed globally.

### 5. Verify the setup

```sh
node scripts/verify-harness.mjs --offline   # source, installer, and packaging checks
node scripts/verify-harness.mjs --all       # offline + isolated Native + installed checks
```

`--all` needs the `opencode` binary and an installed configuration. `--live` runs real model calls and is never implicit.

### 6. Revert

Restore the files from `~/.local/share/ksi-harness-backup/` and remove any merged keys. Nothing else is written outside the project directories you chose.

## Typical usage

Describe the goal and the constraints; role names and commands are not required.

**Feature work**

```text
Implement two-epoch comparison for the site dashboard. Preserve existing
project data and permissions. Verify the actual flow, empty, loading,
and error states, then fix what the checks reveal.
```

**UI work**

```text
Rework this screen for field staff so the next action is obvious.
Keep existing functionality. Check desktop and mobile, and correct the
issues you find in the rendered result.
```

**Analysis only**

```text
Review the current screen and propose improvements. Do not modify files.
```

Build chooses whether to consult Plan, delegate to General or Explore, or do the work directly. A critique alone is not completion when the request is to implement: Build implements, re-renders, and corrects.

## Tooling and integrations

| Layer | What it provides | Required? |
| --- | --- | --- |
| **OpenCode Native** | Agents, permissions, skills, MCP, sessions | Yes — the harness runs on OpenCode |
| **Git and worktrees** | Isolation for parallel file-touching work | Optional |
| **agent-browser / Playwright** | Runtime UI interaction, regression, and E2E checks | Optional |
| **Beads (`bd`)** | Durable task state, dependencies, and resume for multi-step work | Optional |
| **Sleev** | Local context gateway between OpenCode and a provider | Optional |
| **MCP servers** | Context7 for library docs, Mobbin for design references | Optional |
| **Vendored skills** | 17 Anthropic engineering and design skills, installed per project | Optional |

None of these is a workflow engine, and none is a gate. A tool being configured does not prove it works: verification uses actual command output, runtime behavior, and rendered results.

## Verification and limitations

The repository ships with an explicit verification entry point:

```sh
node scripts/verify-harness.mjs --offline   # CI-safe; no model calls
node scripts/verify-harness.mjs --native    # isolated Native delegation and permissions
node scripts/verify-harness.mjs --installed # installed files and roles vs. portable source
node scripts/verify-harness.mjs --all       # all of the above
```

Recorded results and their dates live in [`docs/validation.md`](docs/validation.md). The checks prove role configuration, delegation mechanics, permission effects, source/installed parity, and installer behavior.

They do **not** prove real-model planning or design quality, product acceptance, long-running recovery in every environment, or superiority over other harnesses. Those require actual product tasks and observed outcomes, and the harness documents that boundary instead of claiming more.

Model routing and model pins are machine-local. The portable source in `global/` does not pin any model. Real-model probes may cost money and are opt-in.

## Documentation

| Start here | Contents |
| --- | --- |
| [문서 안내 (Korean index)](docs/README.md) | Full documentation map and historical archive |
| [Installation](docs/installation.md) | Backup, manual merge, verification, and rollback |
| [Development loop](docs/development.md) | Delegation, verification modes, models, and environment constraints |
| [Planning contract](docs/planning.md) | Plan evidence pack and output requirements |
| [Design work](docs/design-work.md) | UI delivery: direction, implementation, rendered verification, correction |
| [Verification](docs/validation.md) | Current evidence and known limitations |
| [Architecture decisions](docs/architecture/decisions.md) | Durable decisions behind the harness |
| [External reviews](docs/reviews/) | Review briefs and responses, including what changed and why |
| [Harness evaluation](docs/harness-evaluation.md) | Preservation-aware comparison of harness changes |

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — Copyright (c) 2026 KSI.

The vendored Anthropic Knowledge Work skills under [`external/anthropic-knowledge-work-plugins/`](external/anthropic-knowledge-work-plugins/) are licensed under Apache-2.0; see their [LICENSE](external/anthropic-knowledge-work-plugins/LICENSE) and [SOURCE.md](external/anthropic-knowledge-work-plugins/SOURCE.md). Optional tools, MCP services, model providers, and project-local skills keep their own licenses and terms. The MIT license of this repository does not relicense third-party assets.
