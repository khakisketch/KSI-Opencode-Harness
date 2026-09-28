# OpenCode V2 Native KSI Agent Ownership

## Superseding distribution decision (2026-09-28)

The Human clarified that the product to distribute is an installer for a KSI-configured OpenCode environment, not a runtime OpenCode plugin. The Human then explicitly approved removing the KSI plugin. This supersedes the plugin lifecycle, plugin-owned surfaces, and plugin distribution portions below; their dated investigation remains historical evidence. KSI's default distribution is native V2 agent and command files installed by a standalone CLI, with no KSI entry in `plugins` and no runtime KSI `setup(ctx)` entrypoint. Official Superpowers and the optional goal plugin remain independently user-owned, not bundled or removed.

The installer must be non-destructive: preview by default, refuse differing existing files unless the user explicitly selects replacement, back up every replaced file, and never rewrite `opencode.jsonc` or select/replace models, variants, credentials, providers, MCPs, or unrelated settings. Native role files omit model and steps so existing native model/variant/positive step selections remain user-owned. The default Developer cannot delegate; the optional Developer-to-Test-Runner variant remains explicitly opt-in but no runtime single-helper guard is claimed. Build, Plan, Design, seven KSI roles, `/complete`, and `/review` become static native files. Static guidance cannot reproduce automatic checkpoint injection, KSI evidence tools, in-process delegation validation, or output archiving; documentation must name those losses instead of claiming parity. Existing global configuration and shared service remain unchanged until separate approval for an exact diff and restart.

## Status

The native config ownership direction and the soft-role operating model were approved in conversation on 2026-09-27. KSI is guidance and orchestration, not a punitive sandbox. This design authorizes the scoped source, test, example, and installation-guidance repair; it does not authorize automated edits to a user's global configuration, a service restart, provider use, credential access, publishing, or Git publication actions.

## Context

KSI's V2 plugin currently applies one `ctx.agent.transform` to OpenCode built-ins and KSI-defined roles. OpenCode 2.0.18 exposes built-ins to `AgentEditor` during plugin setup, but config-defined custom agents are absent at that point and appear in `/api/agent` after plugin transforms. KSI's missing-ID guard consequently throws before tools, commands, runtime hooks, and event subscriptions are registered. KSI defines seven native-config-owned roles: the six IDs in `ROLES` (including `explore`) plus `design`.

The behavior is reproduced with a minimal isolated V2 server. The V2 `AgentEditor` reference documents `list`, `get`, `update`, `remove`, and `default`; it has no `add`. Calling `update` for an ID that is absent from `get` did not throw in one probe, but this is not a documented way to create agents and must not become an implicit registration contract. OpenCode's built-in transform IDs include `build`, `plan`, and `explore`; `design` is configured by KSI and is not a built-in transform target.

## Goal

Make KSI operate using OpenCode V2's native config-owned custom agents while retaining plugin-owned runtime tools, commands, hooks, events, and built-in `build`/`plan` guidance. Roles should make the normal workflow clear without preventing recovery: Build normally delegates implementation, but can directly inspect, edit, and use shell when needed. Keep user-selected model/variant values and valid explicit step budgets when the KSI agent snippet is merged into an OpenCode configuration.

## Approved decisions

- KSI supplies its seven role definitions (`design` plus the six IDs in `ROLES`) as a copyable native V2 `agents` settings snippet. `explore` is a built-in OpenCode ID that KSI deliberately configures with its own subagent policy; `design` and the other KSI worker roles are config-defined.
- The exact native mode mapping is Primary: `plan`, `design`, `build`; Subagent: `explore`, `developer`, `test-runner`, `reviewer`, `research`, `design-critic`.
- OpenCode configuration is the runtime source for custom agent `mode`, `description`, `system`, minimal role `permissions`, `hidden`, and default `steps` fields. KSI's role prompts and policy metadata remain the source used to produce and verify the snippet.
- During `agent.transform` and plugin setup, the plugin does not query for, require, transform, create, or upsert KSI-defined native-config-owned roles. It transforms only OpenCode's built-in `build` and `plan` agents. It does not transform `design` or `explore`.
- Missing KSI role configuration is an accepted deployment failure mode: KSI plugin setup still registers its tools, commands, hooks, and events, but missing subagent IDs remain unavailable and attempts to delegate to them fail at use. At delegation time, the plugin read-only validates the final agent catalog and KSI role signature; it must not silently synthesize or upsert roles. This validation is especially required for `explore` so the built-in native Explore cannot be mistaken for the KSI-configured Subagent.
- Install guidance requires merging the KSI snippet into every OpenCode server configuration that loads the KSI plugin: shared, OpenChamber-managed, and external servers. The project example is not assumed to be discovered from the plugin package directory.
- The snippet omits all `model` values. When merging entries, retain existing model/variant, any valid positive user `steps`, and unrelated request settings; add KSI fields rather than replacing whole agent objects.
- The existing `developerTestRunner` opt-in remains opt-in and defaults to `false`. Its plugin option must be paired with the corresponding native Developer permission/prompt variant in the agent snippet.
- Design has normal workspace capability within the approved task scope. `design-previews/` is the default convention for standalone previews and visual artifacts, not a mandatory destination or a permission boundary. Do not add a `**/design-previews/**` workaround or any active-location-derived path enforcement.
- Avoid catch-all `*: deny` lockdowns for productive roles. Preserve evidence-role independence with narrow explicit read-only rules where it is needed, rather than a global deny that prevents legitimate work or recovery.
- Do not automatically edit the user's global or OpenChamber-managed config, access credentials, call providers, change the public version, publish/release the KSI package, commit, or mark milestone m03 accepted.

## Proposed design

### Native snippet and source consistency

- Add a standalone V2 JSON snippet under `examples/` containing an `agents` object for `design`, `explore`, `developer`, `test-runner`, `reviewer`, `research`, and `design-critic`.
- Include native V2 modes, role descriptions, prompts, ordered `{ action, resource, effect }` rules, hidden state for `design-critic`, and KSI default step budgets. Preserve useful role distinctions and the Developer-to-Test-Runner opt-in without turning the roles into an execution deadlock.
- Produce the checked-in snippet deterministically with a dependency-free ESM generator using KSI role metadata/permissions and the existing prompt sources. The package gate regenerates both variants in a temporary directory and compares bytes with the checked-in artifacts; do not maintain untested duplicate policy definitions.
- Update `opencode.jsonc.example`, `INSTALL.md`, and OpenChamber guidance to show a non-destructive merge: retain each pre-existing agent object's `model`, valid `steps`, request settings, and unrelated fields; merge KSI fields and permission rules according to V2 ordering semantics.
- Add a pure object-level merge helper used by the generator/tests: preserve an existing `model`, any safe positive integer `steps`, and unrelated/request fields. It must not replace whole agent objects, introduce catch-all productive-role lockdowns, or read/write user configuration files. Permission ordering must be tested against V2 semantics only where an explicit narrow rule depends on it.

### Plugin lifecycle

- Split native transforms so the KSI built-in policy transform handles only `build` and `plan`.
- Remove the requirement that KSI-defined native-config-owned role IDs (including `design`) exist in the transform editor and remove KSI-role `editor.update` calls. No custom-role checks may throw before plugin registrations; final catalog/signature validation occurs read-only when delegation is requested.
- Keep V2 plugin setup order and native tool/command/hook/event APIs. A missing snippet must not disable the whole plugin; KSI custom roles simply remain absent.
- Keep runtime policy for Build, Plan, continuity, evidence tools, helper ancestry, and cleanup, while correcting the recovery failure: Build normally delegates to Developer but may directly read, edit, and run shell commands to repair or complete approved work. Do not use the plugin to lock Design to preview paths.

### Configuration variants

- Ship two generated snippets: the default with Developer-to-Test-Runner delegation disabled, and an explicit opt-in variant enabling only the existing narrow permission and matching prompt text. The generator takes the same boolean option as the plugin; documentation requires the selected snippet and plugin option to agree. The secure default remains off.
- Do not include a plugin-time fallback that creates the roles when configuration is absent.

## Compatibility and failure behavior

- With the snippet installed, KSI plugin status is active; all seven KSI-defined native-config-owned roles appear with the intended native V2 modes, permissions, descriptions, prompts, hidden state, and default steps; user's model/variant and valid explicit step selections survive the merge; `/complete`, `/review`, evidence tools, hooks, and event handling are registered.
- Without the snippet, KSI plugin status is still active and plugin-owned surfaces register. KSI-defined native-config-owned roles are absent, so delegated use of an absent role fails rather than silently invoking another agent. Because `explore` is also an OpenCode built-in, delegation must read-only validate the final catalog and reject a missing KSI Explore signature rather than silently falling back to native Explore.
- Built-in primary policy remains enforced by KSI's plugin transform. No V1 plugin API, V1 permission maps, undocumented AgentEditor upsert behavior, or provider calls are introduced.

## Verification design

- Unit tests verify generated snippets are valid JSON, contain exactly the seven KSI-defined native-config-owned role IDs, use V2-native fields/rules, contain the exact Primary/Subagent mode mapping, include prompt text and budgets, preserve unrelated configuration fields, and keep the opt-in off by default.
- Parity tests compare generated snippet data to the policy/prompt source so edits cannot silently desynchronize runtime expectations and install artifacts.
- Plugin tests use a V2 transform editor containing built-ins only. Setup must complete without `design` or worker-role IDs and must register tools, commands, session/tool hooks, events, and cleanup. Only `build` and `plan` receive KSI transforms; the native configuration owns `explore` and `design` along with the other KSI-defined roles. Separate delegation tests read-only validate the final catalog/signature and reject an omitted KSI Explore signature.
- Merge-helper tests demonstrate preserving existing model/variant, valid positive `steps`, request settings, and unrelated agent fields; test both default and opt-in variants.
- Package/documentation tests require the native V2 snippet, all-server installation instructions, the missing-snippet behavior, and the managed/external OpenChamber ownership boundary.
- Disposable OpenCode 2.0.18 runtime checks use an isolated config with no provider/auth state. Verify both installed-snippet and omitted-snippet cases, including plugin status, exact Primary/Subagent mode mapping for all KSI-defined roles, `/complete`, tool catalog, Build's direct recovery capability, clear late failure for absent KSI roles (including built-in `explore` fallback), and Design workspace capability. Verify `design-previews/` is documented as a convention, not enforced as a path gate. Do not modify the user's global config as part of these checks.
- Run the existing offline suite, package-install gate, tarball dry run, and `git diff --check`. Live OpenChamber UI, user acceptance, provider behavior, and milestone m03 remain separate gates.

## Scope boundaries

- No edit to OpenCode itself or global OpenCode/OpenChamber configuration in this implementation slice.
- No KSI package publication/version bump, credentials access, provider invocation, OpenChamber authentication, commit, or push.
- No unapproved change to Test Runner's delegated-execution option, unrelated models, tools, or continuity semantics.
- No claim that publishing an OpenCode issue fixes the runtime; upstream issue #51598 remains independent and pending.

## Implementation constraints

- The merge helper is a pure function over parsed objects. It never parses, writes, or rewrites global/project JSONC; installation remains an explicit user action.
- Runtime tests must verify actual OpenCode 2.0.18 configuration precedence and effective permission ordering in an isolated server. OpenCode 2.0.18 resolves internal edit resources relative to the active Location, so a static `design-previews/**` rule would make nested locations authorize their own nested preview directories. This is why path enforcement was abandoned: it neither expresses a stable project-root contract nor serves the approved guidance-first model.
- A user-selected model/variant and valid positive `steps` are retained. Existing unrelated settings remain intact; only the narrowly specified native role fields are merged.

## Current implementation state

The working tree contains a partial, uncommitted V2 ownership transition. Its recorded baseline is `npm run check`: 202 passed, 8 failed stale ownership tests; this is diagnostic WIP, not a completed implementation or acceptance result. The m03 product milestone remains in progress and unaccepted. The remaining repair must add the RED coverage for the approved soft-role behavior, update implementation and installation artifacts, run isolated no-auth V2 verification, and report shared-service verification separately only after explicit approval for any global configuration change and restart.
