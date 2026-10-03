# OpenDesign integration

The design workspace is a separately deployed application, not a role in this
installer and not a vendored skill kit. The installer ships no design skills, design system, or craft
references; this document defines how the harness expects OpenCode to use the OpenDesign capability.

This is an **optional, user-managed integration**. Installing KSI does not install the application,
Docker, model CLIs, credentials, or its MCP server. Follow [upstream installation instructions](https://github.com/nexu-io/open-design)
for your platform; approve any installation, shared configuration, credential sharing, and service changes separately.
The source repository's `integrations/opendesign/` assets record one Ubuntu arm64 deployment, not a portable
automatic installer. Superpowers is also separately installed, not a prerequisite bundled with KSI.

## Division of responsibility

DGX user-level operating guidance is installed separately in `~/.config/opencode/AGENTS.md`, under
`Design-to-engineering workflow`. It applies across that user's OpenCode projects; it is not installed
by the KSI package. The default is **Local Codex** (OpenDesign's name for its local execution mode;
not the standalone Codex CLI) in the connected server's execution environment,
not the browser client's PC. **OpenDesign Cloud** requires an explicit user request. Agents must verify
the actual connection, project and storage root before describing execution location or modifying files;
they must not assume a code repository is already a registered design project. Design-to-product handoff
is explicit, not automatic synchronization. Existing approved small changes remain engineering work.

The V2 global instruction file is refreshed before the next model request; policy-only changes need
no service restart. A repository name does not prove registration or folder association: resolve the
actual target before work, rather than creating a replacement project by default.

| Owner | Responsibility |
| --- | --- |
| OpenDesign | Direction, layout, information hierarchy, interaction and visual system, rendered artifacts, critique |
| OpenCode (Build) | Requirements, code architecture, existing components, production constraints, backend, tests, Git, integration |
| Human | Direction approval and final acceptance |

OpenCode still makes engineering judgments inside Build: detecting a mismatch with the design,
broken responsive behaviour, accessibility regressions, component reuse, and conflicts with production
constraints. Those judgments do not require a separate design primary agent.

## Prerequisite

An OpenDesign daemon must be reachable and its MCP server registered in the OpenCode configuration the
session uses. Verify on initial use, when the target changes, or after connection errors/restarts:

- the MCP server appears in the active tool catalog, and
- a read tool such as `list_projects` returns the expected workspace.

Reuse a valid check for the same connection and explicit target; do not repeat setup discovery for every
design edit. Active context may change or expire, so resolve it when the user's request depends on the
currently open project/file. A lost connection requires a new read, not automatic write/generation replay.

### Resolve once, verify the actual capability

- With an explicit project, read that project directly; do not first resolve an unrelated active tab.
  Resolve active context only when the user means the currently open design. Once resolved, pin the
  project/entry for subsequent calls; do not use an expiring active context as a durable task identity.
- Record the product repository/screen, design project, resolved storage, entry and brand/token source
  in the existing task ledger. A managed design folder is valid and may intentionally be separate from
  production code; mark an unverified product linkage as pending, not inferred from a matching name.
  A null registered design-system id does not negate an existing file-based brand specification.
- Discover the few needed tools by server namespace/name, then reuse their verified signatures.
  Page only when the result's next page is relevant. Re-discover after a connection/catalog change;
  a temporarily empty catalog after a workspace move is not proof the integration was removed.
- Web health, a connected MCP and an installed agent CLI prove different things; none alone proves
  the inner agent can read required sources or write task-owned output. Reuse valid same-environment
  file-access evidence, but invalidate it after image/CLI/security/mount/storage changes or access errors.
  Any new model-backed smoke run still needs its own authorization; do not silently launch one on every edit.
- After deployment/recreation, compare the actual image digest, effective Compose file list, storage
  mounts and enforced security profiles with the approved deployment. Check effective capabilities,
  no-new-privileges and seccomp as appropriate. Preserve credentials without reading/logging their values.
  Drift is a blocker for a dependent run, not permission to restart or disable a sandbox. Report the
  smallest separately authorized recovery action, active-run protection, interruption and rollback scope.

Check `opencode mcp list` from the **actual project directory**. A healthy web server or a successful
standalone MCP probe is not proof that the current OpenCode session is connected. If it says
`Connection closed`, use OpenCode's `/mcps` to disconnect and reconnect this server in that project,
then recheck tool discovery and a real project read. Container restarts can terminate a live stdio connection;
the earlier container-local transport cannot recover automatically. A new chat alone is not a proven recovery mechanism.
The DGX deployment now uses the host-side proxy described below, verified to survive container restart.

For manual V2 configuration use `mcp.servers`, `disabled`, and timeout objects as documented in
[the V2 MCP guide](https://opencode.ai/v2/docs/mcp-servers). Do not blindly copy older `mcp`/`enabled` examples.
Use the command supplied by your actual upstream installation; Docker deployment commands are not universal.

If the capability is absent, say so and continue with the engineering work that does not depend on it. Do
not invent design artifacts or silently substitute a locally-invented design system.

## When to use OpenDesign

The default design path is Local Codex. Reuse requirements and constraints already agreed in Plan/Build in the design brief instead of interviewing the user again. New artifacts still use the brief/confirmation flow; reuse does not fabricate answers or skip a missing material decision. Direction approval is distinct from a routine implementation progress check; after approval, Build continues production integration and verification without per-task permission prompts.

### Intake versus refinement

Classify the action before opening a brief card:

- **New artifact:** collect and confirm the brief unless the user explicitly waived questions. Prefill
  supported known answers from the user's actual requirements; do not invent answers or confirm for them.
- **Existing artifact refinement:** when the target and material direction are already agreed, use a
  compact change brief rather than open and discard a new-artifact card. Include the current entry,
  brand/token sources, requested delta, affected screens/states, expected output files and exclusions.
  Inspect the relevant artifact bundle when its contents are needed; metadata alone does not prove
  knowledge of the existing composition or CSS. Ask only for a missing material decision.
- **Approved-pattern engineering edit:** remain in Build; do not commission another design run.

For example, a visual-theme refinement may preserve copy, navigation and information architecture,
use the existing brand specification, and identify the actual affected screens and required responsive
states. Touch-target and overflow requirements are constraints to verify in rendered output, not a
claim established by merely including them in the prompt.

Read the current tool's locale support. The inspected brief-card implementation supports English,
Simplified/Traditional Chinese and Japanese, with English fallback; Korean product UI does not imply
a Korean brief card. Preserve the user's Korean requirements in the readable change brief and disclose
card fallback if a new-artifact card is needed. Do not alter upstream localization or fabricate a
translated native card. Recheck this limitation after a relevant upstream upgrade.

Installed ui-ux-pro-max or other UI-reference skills are supplementary guidance for focused review, accessibility, responsive risks and implementation constraints, not an independent design-generation path. They must not replace an approved artifact or existing tokens/components with a competing palette, layout or system. If Local Codex is unavailable, report that blocker and continue non-dependent engineering; do not silently substitute a skill-generated design. OpenDesign Cloud remains explicit-request only.

- A new screen, view, or page.
- A material layout or navigation change.
- A user workflow or information-priority change.
- Repeated user complaints about the look or feel of an existing screen.
- Visual hierarchy, density, or information-architecture decisions that the repository cannot answer.
- A responsive restructuring that changes what is shown, not only how wide it is.

## When not to use it

- Typos, copy edits, or spacing tweaks inside an approved pattern.
- Adding a field or a button to an existing, already-designed component.
- Reusing an existing component as-is.
- Backend-only or non-visual work.
- Anything already covered by an approved OpenDesign artifact for that screen.

## Interface contract

Read and inspect:

- `get_artifact` — the entry file plus referenced siblings in one pull. Prefer this over repeated single-file reads.
  Pass a known project/entry directly. If default-entry lookup fails or the target is unknown, retrieve metadata
  and pass the explicit project/entry; do not add a metadata lookup to every successful read.
- `get_file` / `search_files` / `list_files` — a single known file, a literal search, or metadata with change polling.
- `get_active_context` — the project and file the user currently has open, when that is the right target.

Commission or extend design work:

- `create_project` — a new project when none fits.
- `start_run` — ask OpenDesign to generate or refine a design. Generate one canonical request id per confirmed
  user action and reuse it verbatim if a response is lost.
- `get_run` — poll until terminal. OpenDesign runs can legitimately take a long time; report progress to the
  user instead of cancelling, and only cancel on an explicit instruction.
- File writes through the MCP surface are available, but they are not a substitute for a design run when the
  task is actually a design task.

### Interpret run results before reporting completion

Physical terminal status describes execution, not satisfaction of the requested task. Use terminal
status together with `deliverableValid`/`deliverableValidation`, required output evidence and the inner
agent's explanation. Do not rewrite native status or add a second continuation controller.

| Observation | User-facing interpretation and next action |
| --- | --- |
| Queued/running, including unchanged file mtimes | Still working; poll at the supported interval. Do not cancel/replay. |
| Failed/canceled, or explicit access/security/environment failure | Blocked/ended without completing the requested output. Report the concrete reason and preserve the prior artifact. Do not infer a missing user requirement or regenerate blindly. |
| Clean terminal turn asking a genuine material question | User input needed; relay the question. A tool failure is not a question merely because no artifact was produced. |
| Successful execution, valid deliverable and all required output verified | Design output produced, pending direction approval. Bind preview and required-file snapshot; not product implementation or human acceptance. |
| Explicit verification-only task, no tool failure, inspected existing output and reasoned no-change result | Review completed without changes. Identify the existing artifact; do not call it newly generated. |
| Terminal success but no valid required output, no justified question/no-change outcome | Output unverified/incomplete. Inspect the explanation and relevant diagnostic evidence; do not call it complete or attach an old project preview as this run's output. |

If output exists but the run reports a failure, treat it as partial/unapproved until verified; output
does not override an execution error. A required theme/CSS file missing from an otherwise valid HTML
deliverable is still incomplete. An artifact manifest marked complete or an old preview returned by
project metadata cannot override an invalid run-scoped deliverable verdict.

Recovery depends on the cause: clarify a real question, diagnose an environment blocker, or inspect
missing output. A lost start response uses the original request id/payload after querying the existing
run; a terminal environment failure must not be blindly replayed. After an authorized repair, determine
the supported continuation/retry action and authorization without inventing a resume mechanism.

Normal polling should retain only run state, deliverable verdict, relevant error/question and usable
links. Pull full diagnostics only for investigation and the source bundle when context, approval
snapshot or implementation needs it. Keep internal identifiers in the task record, not product copy;
do not print raw event streams, credentials or provider telemetry in progress messages.

### Completion notification (host-side notifier)

The optional `plugins/design-notifier/` component closes the loop from the other direction: when a
design run reaches a terminal state, the originating session receives one advisory notification
instead of the user having to ask again. Verification, interpretation and any implementation stay
with the receiving agent and the user; the notifier only observes and notifies.

- Binding is recorded when a session calls `start_run` (request id + session), before the response
  can be lost; the returned run id is attached afterwards and the record becomes
  `run:<runId>@<sessionID>`.
- The notifier polls the local daemon (`GET /api/runs/:id`, default 60 s) and admits exactly one
  message per run/session through the native session synthetic inbox (deterministic `msg_...` id).
- The message requires verification with `get_run` (preview URL and `agentMessage`), never claims a
  deliverable when `deliverableValid` is false, forbids blind regeneration, and asks for direction
  approval before code integration outside already-approved scope.
- Policy: idle session → `queue` + auto wake; busy session → `queue` (no interruption); notifier
  paused → admitted with `resume:false`; deleted target session → `orphaned`, never delivered
  elsewhere and never replaced by a new agent; lost start response → reconciled by
  `clientRequestId` for up to 24 h without starting a replacement run.
- State is durable under `~/.local/state/opencode-design-notifier/` (atomic JSON bindings, bounded
  `events.log`, `paused` flag); restart recovery re-reads it and did not resend delivered runs.

Activate by adding the plugin directory from your harness checkout to the global `plugins` list;
watched config directories reload automatically, otherwise restart the service. The `design_runs`
tool lists tracked runs, re-watches an existing run as a recovery path, and pauses/resumes automatic
wake deliveries. Limits: same-host daemon reachability, up to one poll interval of latency, and no
knowledge of goal/session pause state other than the explicit `paused` flag. This component is not
part of the npm package and does not install anything by itself.

### Plan-only design MCP permissions

Native Plan's file-edit restriction is not a deny rule for separately named MCP calls. The optional
`agents.plan.permissions` block in [the configuration example](../../opencode.jsonc.example) first denies
`opendesign_*`, then allows the explicitly known read tools. Future unknown tools stay denied. This
blocks generation, file/project changes, cancellation and interactive brief mutations in Plan while
retaining source/status discovery. Build's permissions and native system prompts are unchanged.

Adopt the block explicitly and merge it with existing Plan rules; do not replace unrelated settings.
Use the actual normalized MCP server prefix, and inspect effective configuration in the actual project
because later project/agent rules may override it. Code Mode checks nested tool permissions too.
Before adoption, run `opencode mcp list` from the actual project and compare the server name with
the normalized action names in its tool catalog. After a server rename, update the rule prefix and
evaluate reads/mutations/unknown actions for that **actual** prefix again. The isolated sample verifier
checks `opendesign_*` only; passing it does not prove a differently named live connection is protected.
The installer does **not** apply this policy or modify JSONC. This is a direct design-MCP boundary,
not an OS sandbox, a blanket shell/subagent restriction or a guarantee about other read-only roles.

`node scripts/verify-native-v2-isolated.mjs` evaluates native Plan read/mutation/unknown-tool decisions,
Build generation permission and native Plan edit denial in an isolated server without design tools or
provider calls. Test live adoption with native catalogs/evaluation, not by attempting a real deletion
or design run. Startup without credentials/MCP and unmonitored child egress remain disclosed limits.

## Reference research and brief transfer

OpenCode owns the existing reference-research integration; Local Codex owns design synthesis. Use focused Mobbin screen/flow/section research before a new screen, material redesign or unresolved pattern when it can inform the task. Do not repeat research for implementation of an already-approved screen, component reuse, small copy/spacing changes or backend work. Respect explicit user requests, supplied references and project constraints. Routine searches/selection inside the authorized design brief do not need a separate user approval for every query.

Select references based on actually inspected images, not app names or metadata alone. Retain canonical Mobbin links and record the specific hierarchy, interaction or state pattern to borrow; do not copy brand assets or product copy. When an image must be embedded, saved or passed into design, use the permitted high-resolution image source rather than the low-resolution inline preview. Image URLs expire; keep permitted selected files in a task-owned reference location when needed. References supplement existing tokens/components and human-approved direction, not replace them.

Send the same agreed requirements/constraints plus this compact reference input in the design brief:

- target screen/flow and the user task;
- selected canonical links and actually accessible image files (or supported attachments);
- the useful pattern in each reference and what must not be copied;
- existing product tokens/components, required empty/loading/error/mobile states and out-of-scope changes.

Verify that the design execution environment can read those files and interpret the image input. A host or client-PC path, external URL, or screenshot filename alone does not prove access or vision support. Use the target project's supported attachment/file mechanism or verified shared reference location; do not expose the home directory or copy authentication stores. An OpenCode MCP connection is not automatically inherited by the design run. Configure an additional inner connection only as a separate authorized change, not as a prerequisite to this reference-transfer workflow.

If Mobbin is absent, unauthorized or unhelpful, report the limitation and use provided references/established patterns where sufficient; do not fabricate results or block every design task by default. If essential design direction remains unresolved, return that decision to the user. Missing Local Codex capability is a separate blocker and does not authorize silent substitution with a UI-reference skill or OpenDesign Cloud.

## Handoff requirements

When asking OpenDesign for a change, state:

- the target project and entry file,
- the user task and the screen or flow it affects,
- the states that matter (empty, loading, error, stale, mobile),
- existing product tokens, components, and constraints that must be preserved,
- what is explicitly out of scope.

When bringing a design back into production code, report:

- which artifact and version was implemented,
- known differences between the artifact and the production implementation,
- what was verified (build, tests, rendered check) and what was not,
- that the artifact is not user acceptance.

### Minimal snapshot handoff

Keep a small record in the existing task ledger/design decision, not a new central orchestration service. The record below is an operating convention, **not** a native MCP response schema or an enforced API. Do not add duplicate authoritative state files for every handoff.

| Field | Record |
| --- | --- |
| Target | Product repository, intended screen/flow and verified design project/storage mapping |
| Source | Project/artifact identity, relative entry and required files; source preview as a locator |
| Snapshot | Actual SHA256 of each required file's retrieved bytes; identify any referenced file/asset not included |
| Direction approval | The user's actual approval evidence tied to that snapshot; missing approval remains pending |
| Design contract | Required states, responsive rules, existing tokens/components and allowed differences |
| Open decisions | Material questions still unanswered; absence must not be invented as approval |
| Implementation evidence | Product revision, actual checks/rendered states, differences and unverified items |

Request the source bundle once when implementation needs it; use explicit project/entry if default selection is absent or ambiguous. Check truncation/skipped files and follow up only for missing required source/assets. Preserve retrieved source bytes when hashing; if only decoded text is available, record its encoding/reconstruction and do not describe the hash as a raw binary-file hash. Binary references, CDN URLs and external dependencies may need separate retrieval/access checks. Never infer that every referenced asset is present just because a bundle request succeeded.

User direction approval may happen in the design workspace or conversation. At approval, bind the agreed artifact to the captured snapshot; if files changed or cannot be matched to what was approved, mark that uncertainty and obtain a decision rather than invent provenance. Material subsequent changes require updated direction approval; routine production adaptations within the approved contract can be documented without per-file confirmation. A manifest's schema version/status, execution success, mutable preview URL or old screenshot does not identify an immutable approved revision. Fetching source for implementation does not itself approve it.

### Product verification and feedback

The design preview is for direction, composition and prototype states. The actual product server is for authentication, API integration, saving, permissions, routing, error handling and the production component/responsive behavior. Keep both responsibilities: a working prototype button or screenshot does not prove real functionality. No API/backend change is authorized by a design artifact.

Give the user two clearly labeled, actually reachable links when applicable: **Design preview** and **Implemented product**. Preserve the product server; do not migrate or duplicate its runtime inside the design workspace merely to consolidate viewing. Resolve URLs for the actual client/network; daemon-returned localhost URLs are not automatically browser-client-PC URLs. Report inaccessible/uninspected states rather than claiming verification.

Build can return task-scoped product captures, observed differences and constraints for design feedback, excluding credentials/private data. Feedback may propose design revisions or ask for product information; Build adjudicates and implements in its authorized scope. An important redesign goes through the existing direction-approval boundary again. This loop is explicit feedback, not automatic synchronization or execution delegation back into the engineering session.

## Boundaries

- An approved OpenDesign artifact is the design source of truth for that screen. It does not authorize
  backend, data, or scope changes.
- Do not create a parallel design system inside OpenCode. If a project has tokens or a design system, those
  sources remain authoritative.
- A generated artifact is not design approval, and a passing test is not user acceptance. The Human owns both.
- Do not claim a design run, file read, or rendered inspection that did not actually occur.

- OpenCode owns the development conversation, production changes, verification and Git. Local Codex is the design specialist. An internal coding runtime used for design is not authorization to launch/resume the outer engineering session, recursively commission more design runs, or change product API/data/Git/deployment.
- Keep task-owned design/reference outputs and product writes under explicit ownership; never let concurrent design and Build writers modify the same product files. An imported writable project root may technically permit such writes: operating guidance is not a filesystem sandbox. Prefer separate design-output locations or approved isolated workspaces, with existing product sources read-only where practical. Do not silently move/copy the user's project or reconfigure mounts.

## Optional DGX remote-folder gateway (source-only)

`integrations/opendesign/remote-workspace/` is separately approved host infrastructure, not part of
the KSI installer. It browses the host home directory, connects only explicitly selected canonical
project descendants as same-path writable binds, then uses existing folder import/working-directory APIs.
Home and credential/configuration roots are not selectable projects. This is not an OS sandbox:
connected roots share the same container and account.

Deployment requires a revision-matched daemon/web overlay, a private configuration using
`config.example.json`, and the user service example. Pin the installed immutable base image when
building `Dockerfile.overlay.example`; keep the original image and all effective Compose inputs for rollback.
The overlay must run with `OD_REMOTE_WORKSPACE_GATEWAY` and the private `OD_REMOTE_DAEMON_TOKEN`;
omitting the gateway variable intentionally restores native local behavior and removes remote connected-root checks.
Keep tokens in a private mode-0600 environment file, not in JSON, logs or source control.

Validate source checks before installation:

```sh
npm test
# Explicit opt-in: isolated temporary Compose container, never the production service.
OD_REMOTE_DOCKER_SMOKE=1 node --test integrations/opendesign/remote-workspace/tests/connector-docker-smoke.test.mjs
```

CLI parity in the patched application:

```sh
od project browse-server --gateway-url https://YOUR-TAILNET-HOST:7456 --json
od project open-server /home/YOU/projects/PROJECT --gateway-url https://YOUR-TAILNET-HOST:7456 --json
```

The gateway listens on loopback; expose it only through the approved tailnet-only Serve mapping.
Tailnet membership is the remote trust boundary, not knowledge of a Host header. Only the exact
read-only Labs GET has remote-to-loopback authority translation; normal privileged routes retain their guards.

A new root can recreate the shared container. During connection, generation is blocked container-wide;
recreate/health waits can each take 120 seconds, and rollback can extend the outage. Existing active or
unverifiable runs prevent recreation. Polling remains on the stable gateway; duplicates join the operation.
Root paths are checked before and after recreation. This detects changes and rolls back, but cannot provide
an atomic filesystem/Docker bind transaction against a hostile same-user process racing path replacement.

On failure, inspect the operation's rollback result. For operator rollback, restore the backed-up image
override together with the prior project override, recreate only the fixed service, verify health, then
restore the previous gateway configuration/Serve target if needed. Preserve daemon volumes, provider config,
agent mounts and unrelated Serve/Funnel routes. Never use `down -v` or broad cleanup as recovery.
Only container-local stdio (for example, `docker exec`) terminates with container recreation. If that
connection closes, reconnect through `/mcps` and verify a real read. The gateway does not manage MCP;
the host-side proxy below survives container recreation and does not need reconnection merely because
the daemon restarts. Reconnect only if the actual client transport has closed.

### Host-side MCP continuity

Use the existing upstream `runMcpStdio` HTTP proxy **on the host**, not under `docker exec`.
`mcp-host-entry.ts.example` is a small deployment shim, not a new protocol implementation.
Build it with the exact daemon source revision and installed dependency closure, bundle for Node,
and place the generated bundle in a persistent private deployment directory (not a temporary worktree).
Pin the loopback daemon URL and keep the approved idle-exit setting at zero.

On DGX the host bundle is `~/.local/share/od-mcp-host/proxy.cjs`; the existing MCP command now uses host
Node instead of Docker. Only that command/comment changed; unrelated configuration and credentials
were preserved, with a private backup. Container restart no longer terminates its stdio connection.
Calls during downtime return an error; after health recovery the next call works on the same connection.
**No write, upload, or generation request is automatically replayed.** Interrupted actions still need a
conscious retry, using the original request ID for generation when appropriate.

A host proxy crash or host reboot still requires normal client reconnection; this is not universal
process supervision. Restart/idle test results and limits belong in the
[technical closeout ledger](../superpowers/plans/2026-10-01-remote-workspace-closeout.md).

### Attachment behavior

The chat attachment input uses `/api/projects/:id/upload`; a request to the separate `files` endpoint
alone does not exercise that UI. Verify saved bytes in the selected project, visible upload errors and
conscious retries; do not automatically replay uploads. Reference-file access is separate from model
interpretation accuracy or support for every format. Check actual outputs rather than terminal status;
technical JSON reports are not rendered design artifacts. Fixture results are in the closeout ledger.

### Local Codex nested sandbox on Docker

Newer Local Codex uses bubblewrap. Docker's default seccomp denies its user-namespace creation;
the default AppArmor mount denial also blocks its nested read-only filesystem setup. A healthy
daemon or terminal run status alone does not prove shell tools can execute or save files.

The optional `ksi-codex-userns.apparmor` and `seccomp-policy.mjs` record the separately approved
Ubuntu arm64 repair. They are **not automatically installed** and require host security review.
Start from a reviewed, pinned Moby default-deny seccomp profile; the generator preserves its rules:

```sh
node integrations/opendesign/remote-workspace/seccomp-policy.mjs reviewed-default.json new-codex.seccomp.json
```

Use only on the fixed application container, with **all outer capabilities dropped**, no-new-privileges
retained, and AppArmor enforcement enabled. The added calls permit nested namespaces and bubblewrap
mount operations; they do not grant host CAP_SYS_ADMIN. Preserve proc/sys restrictions and remaining
default-deny syscalls. Do not use privileged mode, unconfined profiles, host sysctl changes, or
`danger-full-access`/legacy sandbox fallbacks to hide failures.

Prove the policy before deployment in a disposable, network-disabled container with no credentials:
Local Codex sandbox execution succeeds; workspace-write can create a file in the selected root;
a separate writable Docker bind is read-only inside the sandbox; direct outer-container mount fails.
Then commission one real Local Codex fixture run and check the resulting bytes on the host.
These checks prove the tested boundaries, not complete sandbox security or design quality.

The reviewed DGX deployment used `/etc/apparmor.d/ksi-codex-userns`; its seccomp and Compose override
are private host runtime files. This is a deployment record, not proof the current container still
uses it. Inspect actual image/Compose/security identity after every recreation and compare it with the
approved connector configuration; health alone does not establish Local Codex readiness. Back up configuration before adding the security override to the
connector's pinned Compose file list, so subsequent project connections retain it. Verify actual
`CapEff=0`, `NoNewPrivs=1`, seccomp filtering and enforced profile after every rollout. Restore the
previous pinned Compose list and recreate only the application service for rollback; remove the
optional host profile only when no running container references it.
