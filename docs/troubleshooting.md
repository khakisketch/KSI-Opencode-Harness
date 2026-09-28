# Native installer troubleshooting

- `conflict`: A target custom `agents/*.md` file differs. Review the preview output. `--apply --replace` backs each replaced file up before writing; do not use it until the owner approves the change.
- `symlink`: The installer refuses a symlinked managed directory or file. Choose the real intended config directory and inspect where the link points; do not bypass the check blindly.
- A role still appears Primary: confirm its effective V2 `mode: subagent` from a fresh OpenCode session and inspect other global/project config layers. The installer does not rewrite existing JSONC or prove which layer wins. New custom roles otherwise default to Primary.
- `Agent developer cannot run as a subagent`: the effective Developer definition is absent, disabled, or still Primary. Check the server's actual config directory and native agent catalog; a file in a different OpenCode server's config is not enough.
- `/complete` or `/review` missing: expected for a fresh installation. Ask Build or Reviewer directly. Older command files or the old plugin can still provide these shortcuts until separately removed.
- Built-in Build, Plan, or Explore still uses a KSI prompt: inspect other JSONC layers and older `agents/build.md`, `agents/plan.md`, or `agents/explore.md` files. The new installer does not remove an older override automatically.
- `ksi_*` tool missing or no automatic checkpoint injection: expected in the native-only edition. Use normal authorized tools and explicit state reading; do not claim plugin-only behavior remains.
- HTTP 401 from a local API catalog is an authentication boundary, not evidence that agents or commands loaded successfully. Do not use provider calls or credentials as a shortcut to package verification.

The published `0.4.0-beta.0` is an old V1 plugin, not the new installer. Do not register this source as an OpenCode plugin. Keep any separately installed Superpowers or goal plugin untouched when migrating.
