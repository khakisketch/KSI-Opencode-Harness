# Global browser toolkit implementation plan

> **For agentic workers:** Use executing-plans for inline execution of this approved environment setup; no parallel writers needed.

**Goal:** Make maintained browser CLI workflows available globally and prove they can actually drive a browser without adding another harness.

**Architecture:** Preserve native Plan/Build/Explore, Superpowers, Context7, existing Playwright MCP and design-workspace ownership. Add pinned vendor CLI installations and complete version-matched official skill bundles in OpenCode's global discovery path. No KSI runtime plugin, automatic continuation gate, new product dependency or CI change.

**Tech Stack:** Node24.19.0/npm11.17.0, ARM64 Linux, @playwright/cli0.1.22, agent-browser0.38.2, existing browser binaries/cache, official vendor skills, native global AGENTS.md.

**Spec:** Approved in-chat recommendation and user's "그렇다면 개선해줘 그렇게 적합한 방향으로~"; tools first, runtime evidence helper only after demonstrated gaps and separate design.

## Constraints and workspace
- Global means this host/user's execution environment across projects, not automatic installation on the connecting PC or other servers.
- Only browser CLI/official-skill preparation and bounded operating guidance are adopted here. No Oh My OpenCode, retired V1 worktree/review plugins, pretend V2 LSP enablement, Sentry, memory, standalone audit suite or real screen-reader setup.
- No personal browser profile/credential copying, broad debug-port exposure, sandbox weakening, system package installation, service restart, remote push or publication.
- Work in the clean canonical checkout main atf79fce2: small documentation-only Git changes, one writer. Global installations are outside Git; a separate product worktree would not isolate them. Preserve four existing unrelated worktrees.
- Base/local integration target: mainf79fce2, canonical /home/ksi/Desktop/KSI-Projects/KSI-Opencode-Harness. No native goal.

## Review focus
1. Existing CLI/skill name collision: detect before installation; never overwrite user-owned definitions.
2. ARM64/runtime/browser compatibility: inspect installed help, actual launch, and architecture rather than trusting discovery.
3. Session/profile isolation: fresh named sessions, loopback smoke target, only task-owned browser/server cleanup.
4. Partial/stale evidence: capture real actions/reload, console/network and viewport/keyboard checks; don't call a fixture authenticated product verification.
5. Cross-project/global discovery: verify source/skill bundle and effective discovery, preserve unrelated config/roles/upstream skills; no automatic audits or endless loops.

## Tasks
- [x] Inspect clean main, current checkpoint/product state, PATH/global npm prefix, official current docs and registry versions; baseline source check.
- [x] Back up global instructions and preservation hashes; install the two pinned global CLIs without product dependency changes.
- [x] Inspect version-matched skill bundles and collision-check standard global discovery roots; install/link complete official bundles into global OpenCode discovery and load them.
- [x] Run independent fresh CLI sessions on a disposable loopback HTTP fixture: snapshot, keyboard interaction, saved value/reload, mobile viewport, screenshot, console/network inspection. Inspect actual images; close only owned sessions/server.
- [x] Update docs/execution.md and canonical/global policy routing with actual capability/limitations, not guaranteed automation or popularity claims. Preserve native prompts/config/permissions/roles/upstream skills.
- [x] Verify source/packed consumer, live policy equality/preservation, tool versions and effective skill discovery; independent read-only review.
- [x] Commit only task-owned documentation on canonical main; no remote delivery or user end-to-end acceptance claim. Idle checkpoint records the final local closeout.

## Evidence
- Baseline source check: /tmp/opencode/ksi-browser-baseline-check.log.
- Registry metadata pins @playwright/cli0.1.22 (Node>=18; Playwright1.64 alpha dependency) and agent-browser0.38.2 (Node>=24). Host satisfies Node requirement; native/browser ARM64 launch remains to be checked.
- No browser CLIs or colliding vendor skills found in current PATH/standard global skill roots before setup. Existing Chrome/Chromium/Firefox binaries and Playwright browser cache detected; not proof of working launch.
- Context7 currently connected and used for vendor docs; no duplicate MCP registration needed.
- Private backup: /home/ksi/.local/state/ksi-harness-backups/browser-toolkit-20261002.q2i295f1;368 preserved configuration/role/skill files hashed. No secrets output. npm installation log /tmp/opencode/ksi-browser-install.log:4packages added; npm11 left agent-browser postinstall unapproved/unrun. Packaged native ARM64 binary already works; no lifecycle-policy bypass or npm config change needed.
- Both pinned versions verified by commands/npm list; official complete11-file Playwright skill bundle linked and agent-browser official discovery stub linked to installed package; native skill tool successfully loaded both and harness advertised them. Core/reference content stays in vendor package, not copied into a competing KSI skill.
- Ruling: use existing system Chrome rather than cached developer Chromium. Reproduction showed AppArmor userns restriction1 and cached executable lacking applicable profile; system Chrome already has root-owned userns profile/helper. Changing only the executable fixed sandboxed launch. Both actual chrome://sandbox pages confirmed Namespace/PID/network/Seccomp-BPF active. No security-policy modification or disabling sandbox. Added new collision-free host browser configs only.
- Ruling: agent-browser startup flags must stay stable across commands. Omitting first-call executable/dialog flags caused relaunched blank browser; stable user-global config restored consistent session. Existing unrelated config files weren't rewritten; this is browser CLI setup, not an OpenCode orchestrator.
- Actual fixture checks: two independently named sessions, snapshots/keyboard Tab focus/Enter save, real POST/GET200 plus disk-state/reload value matches,390px viewport/no horizontal overflow, four inspected screenshots, no console/page errors; Playwright reduced-motion true. agent-browser bundled axe4.12.1 ran locally:0violations/0incomplete/25passes/64inapplicable. Scratch /tmp/opencode/ksi-browser-toolkit-20261002 includes fixture/state/server logs/images/audit result. Not product auth/API acceptance, WCAG conformance, real-device or screen-reader listening.
- Prepared global Playwright config also launched successfully from an independent non-project cwd and read the previously persisted server value. Task-owned three browser sessions closed individually; no close-all/kill-all, personal profile, cloud provider or debug-port exposure. /tmp/opencode/ksi-browser-toolkit-20261002/smoke-summary.json and sandbox evidence files.
- Final source64pass/0fail/1opt-in skip and packed consumer pass: /tmp/opencode/ksi-browser-final-{check,package}.log. Exact live policy edits verified against private backup;368 prior config/role/skill hashes and all previously installed global npm top-level versions preserved. /tmp/opencode/ksi-browser-preservation.log. Only the two vendor skill symlinks and new browser configs added outside Git; core OpenCode config/permissions/models/native agents/upstream files untouched.
- Fixture server stopped with SIGTERM only after matching recorded PID, exact cwd and fixture command; expected shell143 notification is task cleanup, not a failed capability test. Scratch evidence retained, no broad deletion. No actual customer-product interaction/authentication, screen-reader audio or human comfort acceptance claimed.
- Independent read-only final review found no Critical implementation defect. Its Important items were pending commit/process and limits of its own review, not contrary evidence: Primary already directly loaded skills, recomputed368hashes/compared actual npm baseline, inspected all four images and closed the three named sessions; reviewer inspected files/raw reports/logs and confirmed no fixture listener/process remained. Keep those evidence roles distinct; do not call review itself live browser testing or human acceptance. Pending commit/closeout completed under the adopted local policy, not extra authorization.
- Review minor spacing corrected in execution guide. Host path portability is explicitly scoped/revalidation required; `-s=<task-session>` syntax directly exercised by Primary with actual names in all Playwright tests. No missing-code fix, additional plugin or new installation scope.
- Source974d97f committed locally on main with exactly four task-owned documentation files; installation/config/skill artifacts remain host-managed outside Git. Final pre-commit source64pass/0fail/1opt-in skip and packed consumer pass: /tmp/opencode/ksi-browser-closeout-{check,package}.log. Main was clean immediately after source commit; no checkpoint, secret, temporary fixture or product dependency in the commit.
- Technical toolkit setup is complete; no required engineering task remains in the approved scope. Human real-development comfort/actual product acceptance is pending. No remote push/npm publication/service restart, standalone audit installation, real screen-reader setup or KSI plugin generation; four unrelated worktrees retained.
