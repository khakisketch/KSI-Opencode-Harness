# Releasing the native installer (maintainers)

This repository publishes the standalone `ksi-opencode-harness` native OpenCode V2 installer as a public **beta**, not a runtime plugin or a claim of accepted real-product visual quality. This guide is repository-only and is not included in the user-facing npm tarball. The V1 plugin version `0.4.0-beta.0` was removed after public V2 install verification; npm versions remain immutable. Do not reuse any published or unpublished version.

## Prepare a new version

Choose an unused version and update the manifest and exact-version checks in `test/native-package.test.mjs` and `scripts/check-package.mjs`. Pin the same version in README/INSTALL preview and apply commands. Compare registry versions/tags with the candidate, review the source commit and tarball inventory, then run `npm run check`, `npm run check:package`, `node scripts/verify-native-v2-isolated.mjs`, `npm pack --dry-run --json`, and `git diff --check`. Run `npm run release:check` for the pinned preflight — it verifies the README/INSTALL version pins against `package.json`, a clean working tree, and both source checks; it never publishes, tags or changes a channel. The tarball contains the CLI, two role sources, public docs and licenses, but no retired design kit, V1 plugin entrypoint, tests, internal plans/state, credentials, or this release guide. Test the packed binary in a disposable target, including a read-only preview and two-role apply. File creation alone is not live OpenCode acceptance.

## Publish only with explicit authorization

After the reviewed commit is integrated and pushed, confirm that explicit authorization covers npm registry writes and the target channel. Authorization granted at task start is valid; do not request it again unless target/effects/risk change. For the approved beta channel, use `npm publish --tag next --registry=https://registry.npmjs.org/` with the exact verified tarball (npm may require an interactive browser/OTP flow). Preserve `latest` unless changing it is separately authorized. A successful CLI message may precede registry availability; verify `npm view <name>@<version> version bin --json`, then install that exact version from the public registry into a disposable HOME/prefix and run preview/apply/repeat smoke checks. Verify both dist-tags and installed bytes against the reviewed tarball. A failure after publication does not roll back npm when Git is reverted; preserve the published version and report the partial state.

Never unpublish an entire package name. Retiring an older version is a **separate, explicitly approved, version-qualified** action only after replacement verification, subject to registry policy; if denied, deprecate only that version and report the result. Do not modify user-owned OpenCode, Superpowers, or goal configuration, restart shared services, or infer visual/product acceptance from registry checks.

## Tag the verified release

After registry verification, tag the release commit so the published version maps to a revision:

```sh
git tag v<version> <release-commit>
git push origin v<version>
```

Tags are markers only — they do not authorize or trigger npm writes. The repository keeps a tag for every published version (`v0.5.0-beta.1` … `v0.5.0-beta.8`). If a tag is missing for an already published version, add it at the commit whose `package.json` carries that version (verify with `git show <commit>:package.json`), not at a later commit.

## Release checklist

- [ ] `npm run release:check` passes on the release commit (pins, clean tree, source checks)
- [ ] `node scripts/verify-native-v2-isolated.mjs` passes
- [ ] `npm pack --dry-run --json` inventory reviewed (no tests, plans, state or credentials)
- [ ] explicit authorization covers the npm write and the target channel
- [ ] publish the exact verified tarball; verify `npm view <name>@<version> version bin --json` and both dist-tags
- [ ] public install smoke test (preview → apply → repeat) from the registry
- [ ] tag `v<version>` at the release commit and push the tag
