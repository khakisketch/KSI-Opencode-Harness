# Execution controls

KSI adds role boundaries around OpenCode's native agent/task system. It does not
select a provider, model, variant, thinking effort, token budget, or model-specific
maximum.

## Roles and native steps

The six reserved roles and their default native `steps` are:

| Role | Primary caller | Default steps |
| --- | --- | ---: |
| `explore` | Plan, Build | 20 |
| `plan-reviewer` | Plan | 24 |
| `developer` | Build | 60 |
| `developer-complex` | Build | 80 |
| `test-runner` | Build | 16 |
| `reviewer` | Build | 32 |

Design is not one of the six reserved subagents. It is a user-selected native
Primary with a default of 60 steps, no model/variant injected by KSI, and no
native `task` calls in v1. Use `/models` to choose the current Primary's native
model/variant; that choice does not automatically bind spawned children.

For each reserved role, an existing `model`, `variant`, and valid positive
integer native `steps` value is preserved. An omitted `steps` value receives the
role default above. A supplied `steps` value must be a safe positive integer;
invalid values fail configuration rather than silently falling back.

Other reserved-agent fields are managed by the plugin, including `mode`,
`description`, `prompt`, `permission`, and other options. Plan permission is
managed while other Plan settings are preserved. Build configuration is
preserved. Review collisions before installation.

## Keep the controls distinct

- **Model/provider and variant:** native routing choices supplied by the user.
  An unsupported model or variant must be discovered in the installed OpenCode
  environment; KSI does not substitute one or encode a magic prompt tag.
- **Thinking effort:** a provider/model-specific behavior such as `high` or
  `medium`, when the selected native model supports it. It is not KSI's `steps`
  value and does not imply a universal token or quality limit.
- **Token budget:** provider or runtime accounting, if exposed by the selected
  model. KSI does not configure or infer it.
- **Agent iterations / execution steps:** the native model/tool-loop allowance
  documented above as `steps`. It is not a token budget or thinking-effort
  setting.
- **`subagent_depth`:** native nesting depth. It is separate from role steps and
  is only adjusted by the opt-in helper described below.
- **Concurrent helpers:** live helper occupancy, not a lifetime invocation
  quota. KSI permits at most one active helper per Developer session.

### Environment discovery

On OpenCode 1.18.29, discovery in this environment reported these available
variant names:

| Discovered model family | Variants observed |
| --- | --- |
| Luna, Terra, Sol | `none`, `low`, `medium`, `high`, `xhigh`, `max` |
| Spark | `none`, `low`, `medium`, `high`, `xhigh` |

Retired `openai/gpt-5.4-mini` remains listed for historical discovery context only;
new Explore recommendations use `openai/gpt-5.6-luna` at `medium`. Explore keeps
steps 20 and read-only discovery scope even when it shares the Luna family with
the general Developer.

This is local discovery evidence, not a portable provider contract, benchmark,
or recommendation. Advertised provider-specific limits are not universal.
Normal `high`/`medium` choices remain user-controlled; KSI does not force
`max` by model.

## Optional `developerTestRunner`

The plugin option is a boolean and defaults to `false`. With the default off,
Developer roles have no task delegation permission and the normal graph has no
recursive delegation.

When explicitly enabled in the plugin tuple, the sole exception is:

1. a direct child of a root Build session;
2. whose caller role is `developer` or `developer-complex`;
3. requests one foreground `test-runner` helper under the native read/test
   contract.

This logical helper graph has a maximum delegation depth of two. All other
delegation remains forbidden. One helper may be active per Developer session.
There is no lifetime call-count guarantee. Background tasks are not allowed.

If enabled and native `subagent_depth` is unset, KSI sets it to `2`. An explicit
`0`, `1`, or larger value is preserved. A lower value makes helper acquisition
fail with an actionable error before the guard is installed; it does not make
the plugin configuration fail. Missing or unavailable authoritative session
ancestry also fails closed and asks for a fresh Primary Build dispatch after a
restart.

While a helper is active, the Developer's `edit`, `write`, `apply_patch`, and
`bash` calls are paused. The matching helper task's terminal lifecycle evidence
or matching after evidence releases the guard. Deleting a child is not inferred
as successful completion. The guard is in-process state, not a cross-process or
OS sandbox.

The helper's title and result are author-requested feedback only, not independent
acceptance. A Developer may use it for a targeted TDD/test loop; the Primary
still owns independent final verification and review.

## Observed lifecycle evidence

The recorded integration evidence is intentionally small: native depth `1` was
rejected; after the corrected integration, the helper reported four passing
checks, the Developer shell resumed with four passing `npm test` checks, and a
separate root Test Runner reported four passing checks. The Primary also
verified native parent/child metadata and the author-feedback title.

This validates the narrow lifecycle, not cost, complexity, throughput, or model
quality. It is not a substitute for the independent checks in
[verification.md](verification.md).

## Browser/MCP evidence

The optional local renderer is the pinned official `@playwright/mcp@0.0.80`
invocation in [the project example](../examples/design.project.jsonc):

```text
npx --yes @playwright/mcp@0.0.80 --headless --isolated \
  --block-service-workers --browser chrome --caps vision \
  --image-responses allow \
  --allowed-origins 'http://127.0.0.1:*;http://localhost:*' \
  --output-dir design-previews/artifacts
```

It requires an already-installed supported Chrome. Browser installation is a
separate consent step; the harness does not install a browser, add
`--no-sandbox`, use a personal profile or extension, or expose a public host.
`allowed-origins` is not an egress/security boundary and does not cover every
redirect. `--output-dir` is the default output location, not a path sandbox;
the Design agent must explicitly request a workspace-relative
`design-previews/artifacts/<name>.png` and keep the agreed scope.

The actual Linux evidence used OpenCode 1.18.29 with a named Playwright MCP:
the Design root had an explicitly selected Astra `high` model, resized and
navigated a synthetic page, captured and read desktop `1280x800` and mobile
`390x844` PNGs, checked a selected state and no horizontal overflow, clicked,
snapshotted, and closed. No task call or source change occurred. This proves
the recorded pipeline and image inspection only; MCP connection, browser
launch, and model image visibility remain separate evidence, and this is not
product approval or a cost/model benchmark.
