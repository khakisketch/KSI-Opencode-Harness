# Native V2 npm Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the existing native OpenCode V2 installer as the default public npm beta under `ksi-opencode-harness`, then retire only the V1 version after independent V2 installation verification.

**Architecture:** Keep the existing standalone CLI and narrow npm `files` allowlist. Change the release manifest and public installation copy; strengthen packed-tarball tests to prove preview-first behavior without touching user configuration. Perform registry publication, tag repair, and V1-version removal as separately gated, ordered release operations rather than adding a runtime plugin or a publication automation subsystem.

**Tech Stack:** Node.js >=20, npm registry/CLI, `node:test`, OpenCode V2 native agents and skills.

**Spec:** `docs/superpowers/specs/2026-09-29-v2-npm-distribution-design.md`

## Global Constraints

- Keep the unscoped package name `ksi-opencode-harness`; use new version `0.4.0-beta.1`; never reuse V1 `0.4.0-beta.0`.
- Publish the beta explicitly under `latest`; do not leave `next` pointing to V1. Say **beta**, not stable or real-product visual acceptance.
- Installing the package by itself does not change OpenCode configuration; CLI `install --target <absolute path>` previews and `--apply` writes under existing collision, backup, and user-routing protection.
- Pack only the CLI, four custom roles, optional vetted design-kit/vendor sources, licenses, and public docs. No V1 runtime plugin, internal plans/specs, tests, secrets, live config, preview files, or session state.
- Preserve global OpenCode/Codex/Superpowers config and the separate dirty human-centered worktree. Do not publish/unpublish, edit npm tags, or request credential values before explicit release-candidate review and authorization.
- Remove only V1 *version* after V2 registry install passes; if removal is denied, deprecate only V1 and report it. Never unpublish the entire package.

## Review Focus

1. A package install with no CLI invocation must not write to OpenCode config (Task 2 disposable HOME assertion).
2. A packed CLI preview of a missing target must leave it absent (Task 2 preview assertion).
3. A packed CLI invoked with a relative target or conflicting user-owned role must fail without changes (Task 2 negative-case assertions).
4. A registry whose `latest`/`next` changed since planning must not silently serve V1 after release (Task 3 pre/post tag queries and explicit correction).
5. A partial release (publish succeeds, verification fails or V1 unpublish fails) must preserve V2 and disclose the exact state rather than broad-delete or overwrite an npm version (Task 3 failure branches).

---

### Task 1: Declare the native CLI beta and public installation path

**Files:**
- Modify: `package.json` (`version`, `private`)
- Modify: `README.md`, `INSTALL.md`, `docs/releasing.md`
- Test: `test/native-package.test.mjs`

**Interfaces:**
- Consumes: existing `bin` name `ksi-opencode`, `install --target` preview-first CLI, and package `files` allowlist.
- Produces: public `ksi-opencode-harness@0.4.0-beta.1` manifest and documented invocation `npm exec --yes --package=ksi-opencode-harness@0.4.0-beta.1 -- ksi-opencode install --target /absolute/path/to/opencode-config` (add `--apply` only after preview).

- [ ] **Step 1: Write failing tests.** In `test/native-package.test.mjs`, assert `packageJson.version === "0.4.0-beta.1"`, `packageJson.private !== true`, the three public docs name the new version and `ksi-opencode` invocation, identify it as beta/native installer (not a plugin), and do not recommend OpenCode `plugins` registration. Keep existing source-checkout command coverage as an alternate path.
- [ ] **Step 2: Run targeted test.** `node --test test/native-package.test.mjs`; expect assertion failures for old version/private manifest or missing npm invocation.
- [ ] **Step 3: Update manifest and copy.** Change only `package.json` version and `private` guard; retain the current bin/files list and Node floor. Add the exact versioned npm command to README/INSTALL, retain source-checkout usage, and update release guidance to require explicit `latest`, `next` correction, and V2 verification *before* version-only V1 removal. State that packaged installation alone is inert and the design kit remains opt-in.
- [ ] **Step 4: Verify and commit.** `node --test test/native-package.test.mjs` then `npm run check`; expect zero failures. Commit only these five files with a release-preparation message.

### Task 2: Prove the published bytes are safe and usable

**Files:**
- Modify: `scripts/check-package.mjs`
- Test: `test/native-package.test.mjs` (only if the packaged-file assertions need a focused unit-level gate)

**Interfaces:**
- Consumes: Task 1 manifest and the existing `npm pack --json` / offline `npm install --prefix` harness in `scripts/check-package.mjs`.
- Produces: executable tarball smoke gate invoked by `npm run check:package`; no active/global target write.

- [ ] **Step 1: Add packed-CLI assertions.** Extend `scripts/check-package.mjs` after the offline install to check the installed manifest version and `private !== true`, verify disposable HOME has no `.config/opencode` after package install, run the installed `.bin/ksi-opencode install --target <work>/opencode-config` *without* `--apply`, assert `applied: false` and no target directory, then perform the existing `--apply` flow. Include a rejected relative-target command, a user-routing conflict fixture that remains byte-identical, and a repeat apply with empty `changes`. Ensure the script's own temp directory cleanup still runs on assertions.
- [ ] **Step 2: Run the package gate.** `npm run check:package`; existing CLI behavior may already satisfy these new safety assertions. If it fails, capture the real failure and write a focused regression before changing CLI behavior; do not manufacture a failing test for behavior that already works.
- [ ] **Step 3: Make the minimal package/test adjustments.** Prefer existing CLI behavior and test-fixture corrections; change `bin/ksi-opencode.mjs` only if a real packed-CLI discrepancy is observed and add a focused regression in `test/installer.test.mjs` for any such bug. Do not weaken collision or symlink protection.
- [ ] **Step 4: Verify and commit.** Run `npm run check`, `npm run check:package`, `node scripts/verify-native-v2-isolated.mjs`, `npm pack --dry-run --json` and inspect the tarball allowlist, then `git diff --check`. Require zero test failures, no forbidden packaged paths, and no verifier-issued provider calls. Commit only tested changes.

### Task 3: Registry preflight, publication, and retiring V1

**Files:**
- Modify: `docs/releasing.md` only if release-time evidence reveals a documentation correction; do not add secrets or generated registry output to source.
- Record outcome in the active release ledger/checkpoint without exposing credentials or customer data.

**Interfaces:**
- Consumes: Task 2's exact tarball/source commit and approved release candidate; npm owner rights and 2FA when required.
- Produces: public V2 tarball, `latest` and `next` both resolving to V2, and either removed V1 version or explicit per-version deprecation/blocker.

- [ ] **Step 1: Read-only preflight.** Compare `git status --short`, HEAD, npm `view ksi-opencode-harness versions dist-tags --json`, and registry owner/dependency/unpublish-policy evidence. Check authentication/ownership locally without printing secrets. If V2 version already exists, tags unexpectedly changed, V1 has dependents, or publish rights are missing, stop and report before any registry write.
- [ ] **Step 2: Integrate reviewed candidate.** Fast-forward/merge release branch to `main` following repository policy, rerun `npm run check`, `npm run check:package` and isolated V2 check on that exact source, push `main`, and verify remote commit. If merge tests fail or push is rejected, stop before npm publication.
- [ ] **Step 3: Present a release-candidate gate.** Show exact remote `main` HEAD, tarball inventory/check results, chosen public command, intended `latest`/`next` changes, and refreshed registry/unpublish eligibility to the Human. Obtain explicit approval for the registry write phase; do not infer it from plan approval.
- [ ] **Step 4: Publish and verify V2.** From the verified commit, run `npm publish --tag latest` with authorized npm credentials/2FA; query `npm view ksi-opencode-harness@0.4.0-beta.1 version bin --json` and `npm view ksi-opencode-harness dist-tags --json`. In a disposable HOME and prefix, install that exact version from the public registry and exercise the installed binary's preview/apply; require roles and optional kit results and no write before explicit apply. On failure, do not remove V1 or assume a Git rollback undoes npm publish.
- [ ] **Step 5: Repair `next` and retire only V1.** Once the V2 registry smoke is green, set `next` to `ksi-opencode-harness@0.4.0-beta.1` if it still resolves to V1. Confirm V1 version-only unpublish eligibility and invoke `npm unpublish ksi-opencode-harness@0.4.0-beta.0` without `--force`; if denied, use `npm deprecate ksi-opencode-harness@0.4.0-beta.0 "V1 plugin retired; use 0.4.0-beta.1 native OpenCode V2 installer"` when permitted, disclose the failure, and never unpublish the whole name.
- [ ] **Step 6: Verify and report.** Query registry versions/tags again, verify an unqualified install resolves to V2 in a disposable environment, and report the actual new version, source commit, tags, V1 deletion/deprecation outcome, and install command. Preserve the separate human-centered dirty worktree and untracked preview/session artifacts; remove only the clean, integrated release worktree/branch after confirming there is no unique unsaved work.
