# Contributing

Thanks for considering a contribution. This repository is a small, opinionated harness; changes are judged by whether they improve real development and verification, not by the amount of new machinery they add.

## Before you start

- Read the [README](README.md) and the [documentation index](docs/README.md).
- Search existing issues and pull requests.
- For a behavior change, open an issue that describes the task, the constraints, and the evidence you expect. Small documentation fixes can go straight to a pull request.

## Scope

The harness intentionally has:

- four roles — Build, Plan, General, Explore;
- delegation depth 2 with Plan → Explore as the only second-level edge;
- no separate workflow engine, mandatory review gates, or global skill installs.

Pull requests that add agents, workflow engines, required approval gates, or global skill installation are out of scope unless the project owner has explicitly approved a change to those constraints.

Keep documentation aligned with actual configuration and tests. If a document and the implementation disagree, fix the document — do not change verified behavior just to match prose.

## Local checks

The repository has no npm dependencies. Use Node.js 26, matching CI.

```sh
node scripts/verify-harness.mjs --offline
```

`--offline` is the CI-safe check. The full suite is optional locally:

```sh
node scripts/verify-harness.mjs --all
```

`--all` needs the `opencode` binary and an installed configuration. Do not run `--live` (real model calls) unless the change genuinely requires it; it may cost money.

## Pull requests

- Create a focused branch; avoid unrelated refactors.
- Describe what changed, why, and how you verified it.
- Report what you did not verify and any remaining limitations.
- Do not include credentials, machine-local model pins, personal configuration, or generated secrets.
- Preserve other people's uncommitted work and existing project contracts.
- Make sure `git diff --check` is clean and the offline suite passes.

CI runs the offline verification only. Passing CI is necessary but not sufficient: state the runtime or product evidence you gathered, and distinguish tested, simulated, and unverified behavior.

## Review

Review is welcome but not a gate. A maintainer may ask for evidence, a narrower scope, or a change in direction. Decisions are recorded in [docs/architecture/decisions.md](docs/architecture/decisions.md).

## License

By contributing, you agree that your contribution is licensed under the repository's [MIT License](LICENSE). Vendored third-party assets keep their own licenses; do not relicense them.
