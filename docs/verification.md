# Verification reference

The [product-completion principles](../examples/project-AGENTS.md) define completion; this page is
a tool reference, not another approval gate. Review opinions are not execution results.

Use existing project checks according to the actual risk:

| Change | Useful evidence |
| --- | --- |
| Simple edit | Relevant behavior and a minimum applicable check |
| Feature | Related tests and the integrated user flow |
| API/data | Contracts, compatibility and regression checks |
| Auth/permissions/payment | Failure, denial and security scenarios |
| UI/interaction | Real renders and relevant viewports/states, functional wiring and persistence where needed |

Lint/typecheck, unit/integration tests, build, E2E/browser and CI are available means, not a list
to run after every edit. Reuse valid same-state results and rerun affected checks after repairs.
Report commands, tested state, actual results and gaps; do not infer a pass from unavailable evidence.
V2 does not provide LSP tools/diagnostics; use project lint/typecheck/compiler commands
([upstream limitation](https://opencode.ai/v2/docs/migrate-v1#supported-fields-without-direct-native-equivalents)).

## This repository

- `npm run check`: native Node tests for documentation links, the complete minimal configuration example and the private/no-runtime package boundary.
- `git diff --check`: patch whitespace only.

No installer, provider-backed pilot, old integration fixture or review agent is needed for these checks.
They verify this guidance repository, not product functionality, visual quality, human acceptance or delivery.

## Installed runtime

When checking setup, use `opencode --version`, `opencode debug config` and `opencode debug agents`
in the actual project against the active server. Keep private configuration output local.
Plan `all` enables primary/child use, subject to the parent's native permissions; it does not guarantee routing.
An actual child call establishes execution, and an observed render establishes visual evidence—not catalog entries.
Plan's edit denial is not a shell/MCP sandbox. Do not add permission overrides or mandatory setup pilots.
