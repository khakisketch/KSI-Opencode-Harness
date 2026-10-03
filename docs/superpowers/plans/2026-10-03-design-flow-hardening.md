# Design-flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Track steps here; do not create a second authoritative ledger.

**Goal:** Harden the existing design-to-engineering workflow and enforce read-only design access in Plan without adding an orchestrator.

**Architecture:** Retain the existing MCP/host-proxy/design-run boundaries. Improve operating guidance and an explicitly adopted Plan-only native permission allowlist; verify it with the existing isolated V2 verifier, not live design mutations.

**Tech Stack:** Existing Markdown/JSONC, Node test runner and OpenCode V2 native permission API.

**Spec:** `docs/superpowers/specs/2026-10-03-design-flow-hardening.md`

## Global Constraints
- No upstream application edits, new dependencies, native prompt replacements, cloud fallback, credential reading/sharing, container restart, security-profile change, product implementation, push, npm publication or automatic generation.
- Keep installer behavior at exactly three optional roles; policy/config adoption remains separate.
- Preserve unrelated global configuration, models, native prompts, upstream dirty files and unfamiliar worktrees.
- Use existing ledger/checkpoints; guidance is not runtime enforcement or end-to-end acceptance.

## Review Focus
- Physical success with zero output and sandbox errors must not become a design-completion claim.
- Questions and verified no-change must not be mislabeled generation failures or trigger blind retries.
- A future unknown MCP mutation must remain denied in Plan; required reads must work.
- Build's design permissions and native Plan file-edit restrictions must remain unchanged.
- Effective deployment/storage identity must not be inferred from health, project name or historical deployment notes.

## Workspace
- Primary: this session, inline execution per adopted local autonomy; no implementer team.
- Workspace: `.worktrees/design-flow-hardening`, branch `improve/design-flow-hardening-20261003`.
- Base/local integration target: canonical `main` at `c35a57a`; only non-destructive fast-forward integration after verification.
- User approval: "그렇다면, 개선해줘" following the six-item review. Security-sensitive deployment/restart is a separate decision.
- Baseline: `npm run check` — 64 pass, 0 fail, 1 opt-in Docker smoke skipped.

### Task 1: Native Plan design-permission boundary
**Files:** `scripts/verify-native-v2-isolated.mjs`, `test/verify-native-v2-isolated.test.mjs`, `opencode.jsonc.example`.
**Interfaces:** The verifier consumes the sample's optional `agents.plan.permissions` in an isolated config, calls the native permission-evaluation API with explicit Plan/Build agents, and produces `designPermissions` evidence. No MCP tool or provider is invoked.
- [x] Add native evaluation checks and unit coverage for returned permission decisions.
- [x] Run the isolated verifier before adding the rules; observe Plan mutation/unknown-tool checks fail because the native decisions are allow.
- [x] Add deny-by-default Plan design-namespace rules with explicit known read exceptions; preserve all other sample content.
- [x] Rerun isolated verification, full harness and packed consumer checks.

### Task 2: Workflow guidance and current-user adoption
**Files:** `docs/integrations/opendesign.md`, `docs/execution.md`, `docs/troubleshooting.md`, `examples/autonomous-development.md`; separately managed live `~/.config/opencode/AGENTS.md` and `opencode.jsonc`.
**Interfaces:** Use Task 1's tested rule list exactly; do not copy native prompts or install a plugin. Guidance covers intake, storage/brand binding, result classification, deliberate recovery and narrow discovery.
- [x] Update the existing guide, shared policy and pointers; self-review blocker/question/no-change/new/refinement/deployment-drift scenarios.
- [x] Back up only the two user configuration files privately; apply the approved policy additions and tested Plan-only rules with unrelated bytes/settings preserved.
- [x] Query live native Plan/Build catalogs and evaluate safe permission requests; no design mutation, provider call or shared-service restart.
- [x] Verify policy consistency and configuration preservation; record results.

### Task 3: Infrastructure diagnosis and verified local integration
**Files:** this ledger, `docs/superpowers/product-state.md`, private checkpoints.
**Interfaces:** Read-only comparison of connector configuration and current container; no automatic deployment repair or generation retry.
- [x] Verify current approved-vs-effective deployment drift and describe a separately authorized recovery action, including interruption/rollback scope.
- [x] Run fresh full checks, packed consumer and whitespace checks; independently review the whole task diff.
- [ ] Commit only task-owned changes, fast-forward canonical main after rechecking its status/HEAD, and rerun affected checks.
- [ ] Update durable evidence and checkpoints; report applied improvements, remaining deployment blocker and human acceptance separately.

## Decisions and evidence
- Pre-flight: Task 2 consumes Task 1's Plan-only rules; both use native normalized `opendesign_<tool>` actions with resource `*`. No new runtime interface.
- Ruling: native inline execution and local integration follow the already-adopted operating policy; no additional execution-method menu or approval ceremony. Cost if wrong: workflow preferences require correction, not product-data recovery.
- Ruling: strengthen Plan's design-MCP permissions only, not blanket shell/subagent restrictions or all custom read-only roles. This fixes the reviewed boundary without inventing a general host sandbox. Other-agent/direct-shell bypass prevention remains outside this slice.
- Task 1 evidence: native V2.0.21 evaluator RED denied expectations failed for ten Plan mutations/unknown actions; GREEN passed all23 decisions (11 reads,10 mutations/unknown,Build generation,Plan edit). No design tool/provider invocation. Logs `/tmp/opencode/ksi-design-flow-permissions-{red,green}.{json,err}`. Full suite66pass/0fail/1opt-in skip; packed consumer passes.

## Additional recovery authorization
The user explicitly approved "복구·검증 승인 (권장)": inspect image/data compatibility and active work first; restore the existing reviewed deployment only if safe, preserving volumes/credentials/security; one small Local Codex file-access/output check is authorized. EVENTOUCH regeneration is not authorized. This overrides the earlier no-recreation constraint only for that bounded recovery, not general deployment/security changes.

### Task 4: Restore existing reviewed deployment, if safe
- [x] Confirm the reviewed image shares the installed image's exact base layers/version/revision, approved profile exists, retained project roots are valid and no run/connection is active.
- [x] Preserve private rollback configuration and task-owned integrity evidence; recreate only the fixed design service using the existing approved Compose/image/security/project inputs. Never remove volumes, expose credentials or grant Docker to an inner agent.
- [x] Verify health, actual image/security/mount identity and same-session MCP read recovery without manual reconnect; run the single authorized task-owned file-access/output fixture and inspect bytes, not terminal status alone.
- [x] Record actual evidence and rollback/blocker outcome. No EVENTOUCH retry, new cloud service, package publication or host reboot.

## Verified implementation / review evidence (before local integration)
- Task 2: live native permission evaluation23/23 passed, Build catalog byte-equivalent before/after, direct design tools0/provider requests issued0. Only a task-owned transient evaluation session was created/deleted. `/tmp/opencode/ksi-design-flow-live-permissions.json`.
- Exact global-config unrelated bytes preserved; shared operating bullets match; only approved global guidance edits applied. Private original config/policy backups retained owner-private. `/tmp/opencode/ksi-design-flow-preservation.json`. No shared OpenCode service restart.
- Task 4 compatibility: reviewed image retained all17 installed base layers plus two reviewed overlay layers, same version0.24.1 and base revision89e64d813bb1c7a11519b3f668f011f7017637d7. Approved image digest `sha256:a9b79052fe2e6e839a8fb854cc2f0af2804c88496f066ae536f70d26124a5005`; prior base image digest `sha256:70624117e8ac09892a2b3d3baef9125d0a5027d0dc591b25b249c6e3715beadb`.
- Initial preflight:12 terminal runs/no active runs, zero active connector operations and three retained canonical roots valid. Attempt1 applied the reviewed deployment, then a nested verification-command escaping error caused safe rollback to the original image. `/tmp/opencode/ksi-design-flow-recovery-attempt1.err` retained. Corrected command syntax checked before attempt2; no new profile/security workaround.
- Final attempt2: restored reviewed image with all five approved Compose inputs, enforced `ksi-codex-userns`, CapEff0, NoNewPrivs1 and Seccomp2; managed volume, three selected-root mounts, original EVENTOUCH file hashes and deployment input bytes preserved. Existing deployment/config backups owner-private. `/tmp/opencode/ksi-design-flow-recovery.json`. Runtime run-list count reset across daemon recreation; this was not used to claim historical run-record deletion or perpetual supervision. Project/conversation metadata and original files remain accessible.
- Same session's design MCP read recovered after recreation without `/mcps` reconnect. Actual EVENTOUCH project/storage read and existing technical fixture project read verified; no EVENTOUCH generation requested by this task.
- Single authorized fixture: existing `ksi-deploy-smoke`, request `8e49bbfd-6830-4c04-8122-71ac4d62cc3f`, run `78da352e-587d-4119-9686-fdf3cf02e885`. New exclusive input/output only; one successful Bash tool/no tool errors. Source bundle retrieval untruncated/no skipped files and independent filesystem evidence verified input text, cwd and SHA256 against actual bytes. Output `flow-hardening-20261003-b7d8.html`,318bytes, raw SHA256 `6da54a3f3e9681d936f0957891a78e656ea5d46e5f6a09172b4f2110ee6ead55`; input SHA256 `165b58be698f85526cb7eeb29712175056bf6ec2999fec3c37df0c01e226d133`. `/tmp/opencode/ksi-design-flow-fixture-evidence.json`.
- Fixture physical success had `deliverableValid:false`, `entry_not_touched`: it intentionally preserved the existing canonical entry. This proves file-read/hash/exclusive-output capability, **not** canonical design delivery, visual quality, production integration or human approval. The fixture is retained as technical evidence; no claim of browser-rendered inspection.
- Independent whole-task reviewer found no Critical issue and two Important improvements: ensure full decision coverage and check actual renamed MCP prefix. Coverage/drop/duplicate/tampered-expectation tests reproduced the gap RED2fail then GREEN4pass; checker now requires all23 unique contract cases with independent expected verdicts. Prefix-adoption/rename procedure clarified. Final source suite68pass/0fail/1opt-in skip, packed consumer passes, native isolated23/23 pass, whitespace clean. Logs `/tmp/opencode/ksi-design-flow-review-{red,green}.log` and `/tmp/opencode/ksi-design-flow-final-{check,package,isolated}.{log,json,err}` as applicable.
- Final minor (deferred): verifier parses the maintained example's documented full-line-comment subset, not arbitrary JSONC. An unsupported inline comment fails closed; no parser dependency was added.
- Final review scope ruling: independent reviewer did not verify live fixture bytes, deployment identity, private backup contents, visual acceptance or final integration. Primary verified allowed fixture/deployment/packed-consumer evidence; backups remain private, other-project precedence and human visual acceptance remain unclaimed. Cost if wrong: overstated coverage; therefore each boundary is explicitly reported.
