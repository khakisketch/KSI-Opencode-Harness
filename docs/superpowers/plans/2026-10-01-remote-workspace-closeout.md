# Remote Workspace Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not delegate without explicit authorization.

**Goal:** Resolve remaining reproducible daemon failures without weakening security or assertions, verify supported remote attachment/recovery flows, and accurately close the technical work.

**Architecture:** Retain the approved remote workspace and host MCP architecture. Repair test fixture isolation where tests select real host executables or create unsafe archive permissions; investigate any remaining failures before changing production code.

**Tech Stack:** Existing Node/TypeScript, Vitest, Playwright, host MCP HTTP proxy and restricted container deployment.

**Spec:** `docs/superpowers/specs/2026-09-30-dgx-remote-project-workspace-design.md`; user request to finish remaining work on 2026-10-01.

## Global Constraints
- Preserve all existing uncommitted work, products, credentials and connected fixture roots.
- No sandbox disabling, privileged/unconfined mode, host sysctl changes, weaker assertions or security checks.
- Local Codex only; no OpenDesign Cloud tooling, subscription or fabricated brand assets.
- Do not reboot the host, commit, push or publish without explicit authorization.
- Technical acceptance does not substitute for human design satisfaction or README acceptance.

## Review Focus
- Real primary executable installed beside fake fallback: test must run only its fixture (Task 1).
- Inherited executable override: preserve/restore it and prevent real agent launches (Task 1).
- Group-writable default umask: fixtures must remain private without relaxing production checks (Task 2).
- Outage/idle/relaunch: reads recover, mutations and generation never replay (Task 3).
- Supported attachments: exact saved bytes, clear unsupported/oversize errors, no product overwrite (Task 3).

## Investigation evidence
- Baseline 76 failures in 12 daemon test files; full changed suite 80 in same files.
- Runtime `opencodeAgentDef.bin` is `opencode-cli`, fallback `opencode`. Many failed tests create only fallback; host has `/home/ksi/.opencode/bin/opencode-cli`. Baseline logs show actual host AI sessions instead of fixture output. Do not rerun those tests until isolated.
- Archive tests reproduce 4 failures/25 passes: `/tmp/opencode/od-remaining-archive-red.log`.
- Host umask is 0002; archive readers reject group-writable directories/files by design. Same 29 tests with process umask 0077 pass: `/tmp/opencode/od-remaining-archive-private.log`. This is fixture-permission evidence, not a production defect.

### Task 1: Isolate fake-agent execution
**Files:** upstream `apps/daemon/tests/{chat-route,connection-test,chat-artifacts-run-cover,chat-artifacts-video-cover,late-media-produced-file-association,media-failure-reaches-run-terminal,opend-2765-next-step-locale-carriage,plugins-headless-run,run-terminal-produced-files-association}.test.ts` and `tests/media/policy-routes.test.ts`; existing runtime resolution test utilities as needed.
**Interfaces:** Keep current `withFakeAgent(..., run)` interfaces; fixture execution must select the prepared binary, not the host primary/fallback or inherited override.
- [x] Add a deterministic fixture-isolation regression with a competing executable that only writes a sentinel; assert fixture output and absence of competing sentinel. No real AI invocation.
- [x] Run regression RED, confirming the primary/fallback mismatch rather than provider failure.
- [x] Repair fixture binary names/explicit scoped overrides with proper environment restoration and child-process propagation; preserve all original product assertions.
- [x] Run all ten affected files together; record named residual failures and investigate them rather than retrying blindly. Stable12-file run290/290 pass, /tmp/opencode/od-closeout-fixture-final.log.

### Task 2: Make archive fixtures private
**Files:** upstream `apps/daemon/tests/codex-rollout-usage.test.ts` and `tests/runtimes/codex-child-evidence.test.ts`; existing archive-index tests if available.
**Interfaces:** Existing archive readers and safety checks remain unchanged; test archive roots/index/files must be owner-private.
- [x] Preserve the reproduced RED log; inspect each failing fixture's modes to confirm the exact rejected object.
- [x] Set explicit private fixture permissions at creation, without changing global production umask or read safety logic.
- [x] Run both files under the original 0002 umask: expected 29/29 pass. Retain rejection tests for unsafe paths, ambiguous copies and unrelated threads.

### Task 3: Verify remaining technical acceptance
**Files:** existing upstream E2E and MCP smoke tests, `docs/integrations/opendesign.md`, this ledger and rolling checkpoint.
**Interfaces:** Existing upload APIs, selected fixture project, Local Codex run request identity, host MCP stdio; no new recovery subsystem.
- [x] Verify supported attachment formats through actual existing UI selection/upload and saved bytes; test actionable rejection/retry where supported. Verify one attachment-aware Local Codex result without overwriting product files; do not claim every format is interpretable. Text+PNG UI bytes,503/manual retry/no-replay and final local report independently checked; first incorrect model report preserved.
- [x] Run same-client MCP idle read after more than 30 minutes; controlled host-proxy termination/relaunch verifies normal client reconnection, not automatic process supervision. Host reboot remains a separately authorized operation, not simulated as a real reboot. PASS after1860110ms, /tmp/opencode/od-closeout-idle.log.
- [x] Run complete daemon suite using repaired fixtures and normal security; investigate any remaining named failures before reporting completion. Run harness suite, affected web tests, typechecks/builds and `git diff --check`. Full daemon12134 pass/0fail/16 skipped; affected290/290, archive29/29, web44/44, harness64 pass/1 opt-in skip; builds/typechecks and whitespace checks pass.
- [x] Record exact results, deployment needs and unresolved human acceptance. Review changed diff locally; request independent review only if explicitly authorized. Keep all changes uncommitted unless separately approved. Test-only repairs require no production redeployment; human design/README acceptance remains separate.

## Execution status
- User approved inline execution. Test-only fixture isolation/private permissions implemented;29 archive tests pass. Actual UI text/PNG storage+visible error+manual retry and final Local Codex reference report independently verified.
- Technical closeout verified: full daemon12134 pass/0fail/16 skipped, affected290/290, archive29/29,31min idle/relaunch, UI attachment and final local reference report pass. Human acceptance and unrelated integrations are separate; no commit/push/publication/reboot. See ignored ledger for detailed evidence.

## Deployment verification notes (2026-10-01)

- Host MCP: same client read, outage error, actual container restart/health recovery and read success; a browser-uploaded file was read afterward without reconnecting. A separate31min idle test then controlled proxy termination/new-client relaunch passed. No automatic host supervision or real host reboot was verified.
- Actual attachment UI: unique text/PNG fixtures saved byte-for-byte into the selected DGX folder. A controlled503 was visible; exactly one request occurred before conscious re-selection and successful retry.
- Local Codex: first report read text correctly but misread PNG dimensions; evidence was preserved. A Python follow-up failed because Python was absent; no dependency was installed. Existing Node readUInt32BE produced a new exclusive report independently verified for cwd, text first line and PNG1x1. This demonstrates file access and tested computation, not guaranteed model interpretation or design acceptance.
- Global policy check: live instruction update observed; EVENTOUCH directory design MCP connected. No same-name design project was found, so repository name alone cannot identify the target. No replacement project was created. Separate code MCP connection failure remains outside this closeout.

## Commit and delivery authorization (2026-10-01)

The user subsequently authorized commit/deployment closeout; the original no-commit constraints above
describe the earlier execution phase, not this later permission. KSI source/docs commit:e72e78f;
daemon/web/contracts source commit:1bd12b5eb on the isolated ksi/remote-workspace branch. The latter
was not pushed to the original upstream repository; unrelated untracked work was preserved.
Fresh KSI check and packed consumer verification pass; deployed health/Labs and runtime source parity
rechecked. Global policy/runtime deployment is already active. Existing npm beta/tag/dist-tags unchanged;
The user selected local main merge: main pulled fast-forward-only and then fast-forwarded to f3e4c18.
Merged-tree npm check:64 pass/0fail/1 opt-in skip; packed offline consumer verification passed.
No push or new npm publication; separate upstream worktree and connected fixtures preserved.
