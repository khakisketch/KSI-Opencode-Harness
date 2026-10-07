# Native installer troubleshooting

- `conflict`: A target custom `agents/*.md` file differs. Review the preview output. `--apply --replace` backs each replaced file up before writing; do not use it until the owner approves the change.
- `symlink`: The installer refuses a symlinked managed directory or file. Choose the real intended config directory and inspect where the link points; do not bypass the check blindly.
- A role still appears Primary: confirm its effective V2 `mode: subagent` from a fresh OpenCode session and inspect other global/project config layers. The installer does not rewrite existing JSONC or prove which layer wins. New custom roles otherwise default to Primary.
- `Agent developer cannot run as a subagent`: the effective Developer definition is absent, disabled, or still Primary. Check the server's actual config directory and native agent catalog; a file in a different OpenCode server's config is not enough.
- `/complete` or `/review` missing: expected for a fresh installation. Ask Build or Reviewer directly. Older command files or the old plugin can still provide these shortcuts until separately removed.
- Built-in Build, Plan, or Explore still uses a KSI prompt: inspect other JSONC layers and older `agents/build.md`, `agents/plan.md`, or `agents/explore.md` files. The new installer does not remove an older override automatically.
- `ksi_*` tool missing or no automatic checkpoint injection: expected in the native-only edition. Use normal authorized tools and explicit state reading; do not claim plugin-only behavior remains.
- HTTP 401 from a local API catalog is an authentication boundary, not evidence that agents or commands loaded successfully. Do not use provider calls or credentials as a shortcut to package verification.
- Design run says success but no output: execution termination is not design completion. Check required-output validation and the inner explanation; distinguish a genuine question, verified no-change and environment failure. Never present the project's old preview as the latest run's output or retry blindly. See [result interpretation](integrations/opendesign.md#interpret-run-results-before-reporting-completion).
- A session stopped mid-work with `Failed to drain Session` / `AI.Error: ...`: preserve uncommitted work and record the active checkout/diff before recovery; a delivered notification may still be unprocessed. Inspect bounded actual ERROR records in `~/.local/share/opencode/log/opencode.log`, not command echoes or entire request bodies. `invalid parameters`/reasoning-item/tool-choice errors identify a request boundary, not which component caused it. Compare effective agent/model/steps, the failing step and the actual service version (`opencode api get /api/info`, which can differ from `opencode --version`). Do not call it a provider-only failure, disable Code Mode, or repeatedly compact/retry without a cause-specific hypothesis. Never delete the worktree or replay design runs.
- The local design execution agent cannot start its sandbox/file tools while the web server is healthy: compare actual image, Compose files and enforced security profiles with the approved connector deployment. Preserve prior artifacts and inspect the concrete error. Do not disable isolation or recreate a shared container without scoped authorization/active-run checks; see [capability verification](integrations/opendesign.md#resolve-once-verify-the-actual-capability).
- Plan can invoke a design mutation despite its edit denial: MCP calls use separate normalized permission actions. Explicitly adopt the Plan-only deny/read-allow block in `opencode.jsonc.example`, preserving existing rules and checking actual project precedence. The three-role installer does not apply it.

The removed `0.4.0-beta.0` was an old V1 plugin, not the native V2 installer. Its removal from npm does not uninstall any local V1 files or registration. Do not register this source as an OpenCode plugin. Keep any separately installed Superpowers or goal plugin untouched when migrating.

## Auto-only endpoint rejects the final summary

Observed in V2 2.0.22/2.0.24: a finite agent `steps` allowance makes the final
request use `tool_choice: none`. An auto-only endpoint rejects that request before
the agent can summarize. This is not evidence of MCP failure or product failure.

In a source checkout, run the credential-isolated local characterization:

```sh
node scripts/verify-tool-choice-isolated.mjs
```

It reproduces rejection, tests a **model-scoped** `body.tool_choice: "auto"`
overlay, and checks that an unsolicited final-step tool call is still rejected by
the native step-limit guard. It starts only owned loopback fixtures, never calls a
real provider or shared session, and does not install the CLI. Other child egress
is not monitored. The opt-in test uses `KSI_TOOL_CHOICE_INTEGRATION=1`.

For a confirmed auto-only model, the V2 [model request body overlay](https://opencode.ai/v2/docs/models#options)
can be a narrow compatibility workaround. Preserve the selected model/variant,
agent steps, permissions and native modes. Do not force this provider-wide or
drop step limits; providers and future versions may have different behavior.
Verify the actual serving version and resolved configuration before applying it,
and observe real use afterward. The KSI installer applies no such model policy.
