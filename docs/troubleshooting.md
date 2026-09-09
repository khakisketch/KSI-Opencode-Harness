# Troubleshooting startup and session failures

## What was investigated

A user reported the generic message:

> Unexpected server error. Check server logs for details.

The investigation used OpenCode 1.18.29 from a home-directory working context.
Fresh headless probes for server health, agent, command, skill, and session
endpoints returned HTTP 200. Short PTY probes for new and continued sessions
rendered the UI without reproducing the same message.

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
