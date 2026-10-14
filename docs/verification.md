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

- `npm run check`: native Node tests for documentation links and the minimal configuration example.
- `git diff --check`: patch whitespace only.

No installer, provider-backed pilot, old integration fixture or review agent is needed for these checks.
They verify this guidance repository, not product functionality, visual quality, human acceptance or delivery.
