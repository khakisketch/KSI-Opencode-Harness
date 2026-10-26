# Proposal

## Why

The deployed five-role harness repeats responsibilities across common instructions,
agent descriptions and the Lead body. Literal-prose assertions in two test files
preserve past wording rather than the approved behavior, making safe shortening
unnecessarily difficult.

## What Changes

- Consolidate `global/AGENTS.md` into concise operating principles. Remove repeated
  role descriptions, past-design prohibitions and audit-specific explanations;
  retain approved-goal ownership, task autonomy, actual verification, honest
  disclosure, protected state and analysis-only boundaries.
- Shorten the Lead body and Build/Plan/General descriptions; use Explore's Native
  description. Retain clear task-selection descriptions without repeating the
  common instructions in every role.
- Omit `default_agent: build` and `update: notify` only with verified equivalent
  Native selection/update behavior. Remove General/Explore duplicate leaf-deny
  rules only if effective permissions and execution remain identical.
- Replace prose-locking tests with structural/configuration assertions and retain
  Native registration, permission, delegation, depth, resumption, repair and
  restricted-session tests. No source match proves model understanding.
- After separately starting apply: back up, verify, install the same three active
  files globally, update current evidence, commit and push `main`, and verify the
  remote commit and installed bytes. No extra confirmation gate is proposed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This is a behavior-preserving prompt/configuration/test refactor of
`engineer-workflow`; its 16 requirements and existing scenarios remain binding.
`skip_specs: true` avoids inventing a new requirement for shorter wording.

## Impact

- Runtime sources: `global/AGENTS.md`, `global/agents/lead.md`,
  `global/opencode.jsonc`.
- Tests: `tests/prompt-boundaries.test.mjs`,
  `tests/delegation-native-integration.mjs`, and installed checks where source
  assertions assume explicit defaults. Fix unawaited asynchronous file-absence
  checks in `tests/agent-routing-native.mjs` so success is reported after checks.
- Documentation: current status/evidence in README, installation and validation
  records only; do not compress historical documents or rewrite prior changes.
- Preserve five roles, model preferences, Plan `all`, depth 3, Build/Lead child
  allowlists, `share: disabled`, Muse `tool_choice: auto`, MCP/authentication,
  Native context defaults, installed skills, user preferences and existing sessions.
- This proposal creates planning artifacts only; runtime source, installed files,
  test implementations, commit and push remain unchanged until apply.
