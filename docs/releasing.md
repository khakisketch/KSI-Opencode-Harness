# Releasing the native installer

The public `ksi-opencode-harness@0.4.0-beta.0` tarball is an immutable V1 plugin. The current source is an unpublished V2 native installer and remains `private: true` at that same source version to prevent accidental publication. A future release needs a separately approved new version, exact reviewed source, registry action, and distribution validation. Do not silently mutate npm dist-tags or republish the old version.

Before requesting release approval, run `npm run check`, `npm run check:package`, `npm pack --dry-run`, and `git diff --check`. Confirm that the tarball contains the standalone CLI and four native prompt sources but no OpenCode plugin entrypoint, built-in role overrides, slash commands, internal `docs/superpowers` state, credentials, or tests. Exercise an offline local-tarball install in a disposable config directory. Verify actual OpenCode V2 effective modes separately; file creation alone is not runtime acceptance. Keep shared service, provider, and OpenChamber UI checks distinct.

Official Superpowers remains an independent upstream plugin; KSI does not bundle, alter, or uninstall it. Releasing KSI does not authorize changes to shared user configuration or service restarts. `design-previews/` remains a convention, not a package or permission gate.
