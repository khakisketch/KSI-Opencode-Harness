# Playwright Agents — proposed improvement and historical pilot

## Authority and current status

Status: proposed, not approved for implementation or product/global adoption.

User requested a harness improvement plan after one approved throwaway Agents
trial. The later "그렇게 개선해줘봐" approves recording/handoff hygiene, not
all items below. Saving this proposal does not approve configuration, dependency
installation, a product trial, CI changes or release.

## Proposed outcome and boundaries

Keep native Build/Plan and three optional KSI roles. Add project-local optional
E2E assistance only where durable tests are useful. Ordinary browser checks keep
the current CLI/agent-browser/MCP path; no mandatory planner → generator → healer
chain, delegation quota or second orchestrator.

Build owns task judgment, integration/Git; helpers plan/write/repair tests;
Test Runner independently verifies integrated results. Product defects return
to Build/Developer or design by ownership. Healer cannot redefine approved
behavior or substitute visual UI repairs.

## Proposed sequence (requires scope/design approval before implementation)

1. **Usage/ownership guidance:** distinguish routine interaction from durable E2E
   planning/generation/repair. Skip unnecessary stages, not assertions.
2. **Project-local adapters:** vendor source/version recorded, official originals
   preserved; existing fixtures/config reused, model/variant/steps/Code Mode kept.
   Avoid blanket generic Playwright MCP denial; forbid automatic skip/fixme,
   weaker expectations and product/config/credential edits by test helpers.
   Default installer still writes only Developer/Test Runner/Reviewer.
3. **Readiness/access:** actual root, stable CLI resolution, seed, safe test state,
   URL, launch/sandbox, native permissions and MCP capabilities verified. No
   automatic installs, customer data or sandbox bypass. Internal native read/edit
   paths are Location-relative; consider diagnostic reads explicitly. MCP writes
   and code execution need separate capability verification: read-only labels and
   native edit rules do not prove isolation/safe execution.
4. **Regressions:** wrong locators heal narrowly; real save/API defects stay failing
   and are reported; access/auth/server issues classified without bypass; scope
   violations checked against actual boundaries. Original assertions, independent
   final checks and default-install/package preservation verified.
5. **Separately authorized product trial:** evaluate maintainability, rework,
   end-to-end time and available usage evidence. No cost-saving claims when usage
   is unavailable, implicit EVENTOUCH work or every-project rollout.

Suggested first implementation slice: items 1–4 after approval. Product selection,
trial, current-user global adoption and GitHub/npm/external delivery are separate
decisions. This is a scope proposal, not an approved written implementation plan
or replacement for applicable design/plan gates.

## Historical capability trial — 2026-10-07

User approved one synthetic trial with "한 번 해볼래?". Product/global Agents
settings remained untouched. Throwaway workspace used Playwright Test 1.63.0,
system Chrome, headless isolated contexts, `chromiumSandbox:true`, one worker,
zero retries and a real local HTTP form with disk-backed persistence. Vendor
prompts had stage/project scope and no-skip/no-assertion-weakening supplements;
this was not an unmodified stock trial.

Required value: `agents-pilot-20261007`. Fill "Probe value", click "Save", see
`Saved: agents-pilot-20261007`, reload and retain exact status/input value.

| Stage | Actual observation | Child session |
| --- | --- | --- |
| First planner | Live seed loaded, required reads denied; stopped before plan | `ses_ee9b747e3ffeZUbg79GhWurcIs` |
| Corrected planner | Live save/reload inspected; one plan saved | `ses_ee9b63cfaffeiD8Vthu6k8vot0` |
| Generator | Live steps, generator log and one fixture-based test | `ses_ee9b4ee4dffeQQQ3i63xkpJAS7` |
| Baseline/fault/final verification | Independent stable CLI execution | `ses_ee9b2a11dffexnnl10EVBuO21A` |
| Healer | test_run reproduced; test_debug/live snapshot/locator; one-line repair | `ses_ee9b0ab98ffeBfqBScEpTzenw6` |

Initial read failure: absolute allow patterns did not match internal relative
resources. Exact local reads and stage-relative edits fixed it without global
permission changes. Healer's optional `test-results/.last-run.json` read remained
denied; MCP debugging and independent final checks still worked.

### Independent commands and revision-bound results

Workspace: `/tmp/opencode/ksi-pw-agents-pilot-20261007-R57NPy` (not Git).
Stable CLI: `/tmp/opencode/ksi-browser-latest-20261007/probe/node_modules/@playwright/test/cli.js`.
These are historical evidence locations, not portable product setup or authority
to execute again. Owned fixture server stopped, session returned to harness,
no test page remained active and unrelated browsers were untouched.

```text
node <stable-cli> test -c playwright.config.ts tests/persistence.spec.ts --reporter=list
  baseline: exit 0, 1 passed, 0 failed/skipped
  controlled wrong locator: exit 1, 1 failed, 0 skipped
  repaired revision: exit 0, 1 passed, 0 failed/skipped
node <stable-cli> test -c playwright.config.ts --reporter=list
  final seed + persistence suite: exit 0, 2 passed, 0 failed/skipped
```

Fault: exact button name `Save` → `Save pilot value` at test line 13. Failure:
missing button at `expect(save).toBeVisible()` line 17, 5-second assertion timeout;
actual page still showed "Save". Healer restored only that locator. Final file was
byte-identical to green baseline, SHA256:
`bf4a766e1021cf7d07b0e29260c98c76904d46fabe542a0f60af0949060f554f`.
Faulty SHA256: `5240de5f550e1645006e4034dc78130cc62178bccded02c0b8ae156f18e00e07`.
Exact save/value/reload assertions remained; skip/fixme/only/test.fail absent.
Disk state and `GET /state` retained the required value after persistence.
Eight protected fixture/seed/config/prompt files matched their recorded hashes.

Optional temporary raw evidence: `PILOT.md`,
`evidence/{baseline,fault,final,final-suite}.log`,
`evidence/{generated-baseline.spec.txt,faulty.spec.txt,final-summary.json}` under
that workspace. No sensitive logs/config backups are copied into Git.

### Evidence limits

This proves one real planner/generator/healer workflow on synthetic persistence
with selected native model/budgets. Four specialist launches (one blocked, three
successful) plus one Test Runner child continued across checks. Total tokens,
cost and elapsed time were not measured; test durations do not prove efficiency.

Not proven: complex auth/API/data flows, security isolation, visual quality,
every-host portability, real-development savings, human acceptance or adoption.
Native edit allowlists/task prompts do not constrain every MCP filesystem/code
execution effect and are not an OS sandbox.

Earlier browser-tools update was separate: configured generic MCP 0.0.80 → 0.0.83;
CLI 0.1.22 and agent-browser 0.38.2 already latest at that check. These are dated
observations, not a standing guarantee or automatic-update policy.
