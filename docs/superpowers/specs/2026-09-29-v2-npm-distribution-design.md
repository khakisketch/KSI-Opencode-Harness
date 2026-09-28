# KSI OpenCode Harness V2 npm distribution

Date: 2026-09-29
Status: Design for Human review; no registry action authorized by this document alone

## Intent and boundaries

Make the current native OpenCode V2 installer publicly installable from the existing `ksi-opencode-harness` npm package name. The old `0.4.0-beta.0` tarball is a V1 runtime plugin; the Human reports no existing installers. Remove that *version* after the new V2 version is published and independently install-tested. Keep the source implementation a standalone, preview-first CLI with four optional Markdown agents and an opt-in design kit. Do not reintroduce the runtime plugin or change the user's global OpenCode configuration, Codex, Superpowers, or the separate dirty human-centered-workflow worktree.

This release is a public **beta**, not a claim that real-product design output has Human acceptance. Human acceptance of product-screen quality remains a separate deferred decision. No npm release, registry deletion, service restart, or global installer apply is part of writing this design.

## Distribution contract

- Retain the unscoped public name `ksi-opencode-harness`; publish new version `0.4.0-beta.1`, never republish `0.4.0-beta.0` (npm versions are immutable even after unpublish).
- Remove the manifest's `private: true` guard only in the reviewed release candidate. Explicitly publish the pre-release under `latest` so an unqualified installation selects V2; label it beta in package documentation. The existing `next` tag also points to V1 and must be moved to V2 or removed after V2 installation succeeds, so no documented/default tag silently installs the retired plugin.
- The npm artifact exposes the `ksi-opencode` executable via `bin` and includes only the CLI, four role sources, approved optional design-kit/vendor files, licenses, and public documentation. It excludes old plugin entrypoints, internal plans/specs, tests, credentials, live configuration, and preview/session artifacts. Installing the npm package alone must not write OpenCode configuration or start a plugin. Explicit `install --target ...` still previews by default; `--apply` writes only after review under the current collision/back-up rules.
- Update `README.md`, `INSTALL.md`, and `docs/releasing.md` for an npm-package consumer, with an explicit versioned or otherwise reproducible CLI invocation. Explain the V1-to-V2 change of interface, how to preview before apply, optional design-kit behavior, Node requirement, and that provider/model choices remain user-owned. Do not suggest adding this package to OpenCode's `plugins` list.

## Safe release sequence

1. Read-only preflight: confirm source branch and exact commit; check the registry's existing versions/tags, package ownership/publish authentication without exposing credentials, and the npm unpublish policy for the V1 version. Verify that no other package depends on it and that the registry permits removal; a report of no known *users* is not proof that registry-policy conditions are satisfied.
2. Prepare `0.4.0-beta.1` in the isolated release worktree. Review the exact diff and the generated tarball file list. Run full source checks, package checks, a disposable offline tarball install, and an isolated OpenCode V2 effective role/skill catalog check without using provider credentials. Run a command-path smoke check using the *packed* package (not the source checkout) to show read-only preview and repeatable application in a disposable config target. Confirm that installing the package by itself has no global side effects.
3. Commit and integrate the reviewed release source through the normal branch process; record the exact commit to be published. Present the final release candidate and verification to the Human. Only after written spec review, implementation-plan approval, and reviewed candidate should the externally visible registry actions run. Publish V2 under `latest`, verify the registry tarball metadata and versioned install/CLI behavior, and ensure `latest` resolves to V2. Fix `next` so it does not point to V1.
4. Only after V2 passes independent install checks, unpublish **only** `ksi-opencode-harness@0.4.0-beta.0` if the registry allows it. Never unpublish the whole package: doing so may impose a 24-hour name cooldown. If version removal is denied, keep V2 published and its tags correct; deprecate the V1 *version only* with an explanatory message, record the blocker, and stop rather than force-removing the package.
5. Verify registry versions/tags and the V2 CLI again, then report the exact source commit, version, tag, deletion/deprecation outcome, and installation command. Keep any registry action and its result in release evidence without pretending a Git commit reverses npm publication.

## Failure and recovery

- Preflight, packaging, or disposable-install failure: do not publish or remove V1; correct the candidate and rerun checks. Do not modify the active user environment to make a test pass.
- Missing npm owner permission, authentication, or 2FA: stop before publishing. Do not request secrets in chat or store them in repository files.
- Publish succeeds but registry install/smoke check fails: do not remove V1. Freeze tag changes, diagnose using a new version (never overwrite a published tarball), and report the partial release state. Preserve evidence; do not assume unpublishing V2 is an automatic rollback.
- V1 unpublish denied: retain the functioning V2 version, change only V1's deprecation metadata when permitted, and disclose that physical removal was not possible. A successful V2 release is not evidence that registry deletion succeeded.

## Acceptance and non-goals

Acceptance requires a new V2 version obtainable from the public npm registry, an unqualified install resolving to V2, a functioning packed CLI that previews and applies only to an explicit disposable target, the expected four native agents and optional kit in the package, and no default tag resolving to the V1 plugin. Record whether V1 was removed or merely deprecated. Do not claim a live product-design quality improvement from package or catalog checks.

Non-goals: npm organization/name migration, background updater, OpenCode plugin registration, automatic migration/deletion of legacy global files, modification of other tools' configuration, npm stable-version claim, or removing the separate worktree with unsaved work.

## Sources and current evidence

- Current source manifest and packaging contract: `package.json`, `README.md`, `INSTALL.md`, `docs/releasing.md`, `scripts/check-package.mjs` at `a163da7` (V2 installer; source `0.4.0-beta.0`, `private: true`).
- Read-only npm lookup before this design: `ksi-opencode-harness@0.4.0-beta.0` is published and both `latest` and `next` point to it. This must be rechecked at release time.
- npm registry policy: <https://docs.npmjs.com/policies/unpublish/> (published name/version cannot be reused; total package removal causes a 24-hour republish wait; older versions have additional eligibility conditions).
- OpenCode V2 agents and skills are native files, not KSI runtime-plugin registration: <https://opencode.ai/v2/docs/agents/> and <https://opencode.ai/v2/docs/skills/>.
