# Troubleshooting startup and session failures

## What was investigated

A user reported the generic message:

> Unexpected server error. Check server logs for details.

The investigation used OpenCode 1.18.29 from a home-directory working context.
Fresh headless probes for server health, agent, command, skill, and session
endpoints returned HTTP 200. Short PTY probes for new and continued sessions
rendered the UI without reproducing the same message.

Version note: 1.18.29 above is the version of this specific unresolved
investigation, matching the documented compatibility baseline — not a claim
about other versions. Where other docs cite a different version (e.g. the
installed 1.18.31 binary in the evidence-tool compatibility check in
[verification.md](verification.md)), that is evidence from a distinct
check/context and does not prove same-run compatibility across versions.

The root cause was **not established**. No fix is claimed. A successful probe
does not establish provider, session, plugin, or startup correctness for a later
invocation.

## Safe reproduction and diagnostics

Run these from the same project and with the same invocation that failed:

```bash
opencode --version
opencode debug paths
opencode --print-logs --log-level DEBUG
opencode --continue
```

If the failure repeats, record the exact command, working directory, local
timestamp, and whether the process was new or continued. Do not upload full logs
or raw session transcripts. `debug agent` and provider/config inspection can
expose sensitive values; show only the minimum redacted fields needed to
diagnose the issue.

## Classify before changing anything

- **Startup/plugin/schema:** the process fails while loading configuration or a
  plugin, before a usable session exists. Check the version, debug paths,
  JSONC/plugin tuple shape, and syntax first.
- **Session:** a new or continued session fails after startup. Compare the exact
  new/continue command and session context; do not infer a plugin fault from a
  generic server message alone.
- **Provider/auth:** the session starts but a model request fails. Inspect only
  redacted provider/model/variant evidence and the provider's own error.

Do not guess by resetting authentication, deleting caches, or removing session
data. Those actions can destroy useful evidence and are not a diagnostic.

`--pure` may be used as a temporary comparison when supported by the installed
OpenCode version. It is not a new permanent configuration and does not bypass
denied access or prove that a plugin is the root cause.

After a plugin or configuration change, restart the full OpenCode process before
testing. A continued conversation may be retained, but calls made before the
restart can carry historical metadata from the previous process.

## Failure classes and minimal evidence

How the two taxonomies relate: the three categories in `Classify before
changing anything` are triage directions; the four classes below are the
evidence to collect once triaged. Mapping: Startup/plugin/schema → class 1;
Session → class 2 when a call is refused, class 3 when an accepted child
fails to start or aborts; Provider/auth → class 4. Triage first, then collect
that class's evidence — so the two lists route diagnosis without duplicating
or contradicting each other.

Never upload full logs, raw session transcripts, credentials, tokens, or unredacted provider payloads. For every class, record the exact command, working directory, local timestamp, and whether the process was new or continued — then add only the class-specific fields below with sensitive values redacted.

1. **Plugin/startup or role-load:** the process fails while loading configuration or a plugin, before a usable session exists (or a role definition fails to load). Record `opencode --version`, the failing `opencode debug paths` / `opencode debug agent <role>` outcome, the plugin tuple shape (names and pins only), and the offending config key path — never the values. Check JSONC syntax and tuple shape first.
2. **Task permission/contract rejection:** a hook or contract check refuses the call (product edit/bash attempt by a coordinator, unknown caller, stale/wrong-parent/wrong-role `task_id`, oversized output). Record the calling role, the attempted operation class (e.g. "product edit", "shell", "delegate"), and the task identity state (missing/stale/mismatched) — never file contents or output bodies.
3. **Child startup/execution failure:** the dispatch is accepted but the child role fails to start or aborts (unsupported model for that role, session-start failure, helper lifecycle rejection). Record the child role, its configured `model`/`variant`/`steps` names only, whether the parent process was new or continued, and the exact short error string. An unsupported-model refusal is a routing fact, not a license to substitute another model.
4. **Provider/model request failure:** the session starts but a model request fails (auth, quota, routing, transient provider error). Record only redacted `providerID`/`modelID`/`variant` and the provider's own trimmed error code/message with identifiers removed. Do not reset authentication, delete caches, or remove session data to "diagnose" — those destroy evidence.

**Fresh-process guidance (all classes):** after any plugin or configuration change, restart the full OpenCode process before testing; calls made before the restart can carry historical metadata from the previous process. Re-test from a new process using the same command and working directory that failed, and compare against the continued-session behavior explicitly rather than assuming they match.

## Design browser/MCP failures

Diagnose these as separate stages rather than treating one success as proof of
the next:

1. **MCP connection:** the named `playwright` server starts with the pinned
   `@playwright/mcp@0.0.80` command from
   [the example](../examples/design.project.jsonc).
2. **Browser launch:** an installed supported Chrome opens with the documented
   headless/isolated flags. Browser installation is separate consent.
3. **Image inspection:** the selected Design model actually reads the PNG and
   reports observable layout/state details. A returned screenshot path or an
   existing file is not inspection evidence.

The cached Chromium in the recorded Linux run failed its OS sandbox, so the
pipeline selected an already-installed official Chrome without disabling the
sandbox or adding `--no-sandbox`. This does not reproduce or fix the original
generic server error. Do not claim egress isolation from `--allowed-origins`;
it does not cover every redirect. Use trusted local or synthetic pages, and
keep the explicit workspace-relative screenshot path inside the agreed scope.

Credentials, auth/data access, browser permissions, and model image capability
are separate checks. If any stage is missing, report `NOT visually approved`
for material work and return the missing evidence, affected scope, and next
decision to Build rather than rendering approval from source.
