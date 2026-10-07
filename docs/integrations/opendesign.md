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
by the KSI package. The default is **OpenDesign's local execution** (the execution agent/model is
chosen per run — not the standalone Codex CLI) in the connected server's execution environment,
not the browser client's PC. **User-facing copy: call it "OpenDesign (local execution)".**
"Local Codex" is the vendor's mode label (the OpenDesign MCP instructions list it as a product name);
do not present it as a separate product, agent or CLI — if the label must be quoted, state immediately
that it is the same local OpenDesign execution. This environment's explicit user naming preference
overrides the vendor default. **OpenDesign Cloud** requires an explicit user request. Agents must verify
the actual connection, project and storage root before describing execution location or modifying files;
they must not assume a code repository is already a registered design project. Design-to-product handoff
is explicit, not automatic synchronization. Small visual fixes stay design-owned;
purely nonvisual repairs and mechanical transfers stay engineering-owned.

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

The default design path is OpenDesign's local execution. Reuse requirements and constraints already agreed in Plan/Build in the design brief instead of interviewing the user again. New artifacts still use the brief/confirmation flow; reuse does not fabricate answers or skip a missing material decision. Default to finish-and-report within the existing approved design language and authorized scope. Preview-and-wait only for a new visual direction, client-facing deliverable, out-of-scope change or explicit review-first request; direction approval at those gates is distinct from routine progress confirmation. Continue non-dependent engineering while waiting and, after resolving a gate, continue integration and verification without per-task permission prompts.

### Ownership: design work and engineering work

OpenCode coordinates the task; the design workspace owns **all visual frontend
work**: UI/UX analysis, composition, component presentation, responsive and
interaction states, actual UI source/style edits, rendered design review and
refinement. This includes small CSS/spacing/overflow repairs. Do not route by
file count or call a visual fix an engineering exception because a pattern exists.
This is a connected specialist workflow through MCP, not a new native OpenCode
agent, automatic synchronization or another development Primary.

OpenCode owns purpose/scope, source and reference access, business/API/data/auth
contracts, functional wiring/verification, integration, Git and reporting. It can
detect visual defects and provide screenshots/reproduction steps, but sends the
visual repair back instead of inventing a competing fix. Pure nonvisual logic,
permissions and persistence defects remain engineering work. For shared files,
handoff sequentially; one writer at a time. Mechanical integration of a verified
artifact is allowed without redesign; any visual adaptation returns to design.

For a redesign, separate **invariants** (functionality, data, permissions, route/API
contracts and agreed brand) from **redesign freedom** (layout, hierarchy, density,
component composition and responsive presentation within the authorized outcome).
Preserving behavior does not mean preserving a rejected layout. A request to
improve substantially requires a diagnosis of the user's task friction and the
structural change that addresses it, not merely a larger KPI or stronger color.
Unapproved new brand/direction, client delivery, scope changes and review-first
requests keep their decision gates; authorized structural improvement alone does
not require repeated approval of routine iterations.

### Intake versus refinement

Classify the action before opening a brief card:

- **New artifact:** collect and confirm the brief unless the user explicitly waived questions. Prefill
  supported known answers from the user's actual requirements; do not invent answers or confirm for them.
- **Existing artifact refinement:** when the target and material direction are already agreed, use a
  compact change brief rather than open and discard a new-artifact card. Include the current entry,
  brand/token sources, requested delta, affected screens/states, expected output files and exclusions.
  Inspect the relevant artifact bundle when its contents are needed; metadata alone does not prove
  knowledge of the existing composition or CSS. Ask only for a missing material decision.
- **Small visual repair:** use a compact design refinement with the exact source,
  defect, reproduction viewport/state and expected fix; no fresh intake interview,
  mandatory Plan stage, full-site audit or per-fix approval. Scale review to the change.
- **Nonvisual engineering:** remain in Build; no design run for a pure backend,
  API/permission/persistence repair or an exact artifact transfer with no visual changes.

For example, a visual-theme refinement may preserve copy, navigation and information architecture,
use the existing brand specification, and identify the actual affected screens and required responsive
states. Touch-target and overflow requirements are constraints to verify in rendered output, not a
claim established by merely including them in the prompt.

Read the current tool's locale support. The inspected brief-card implementation supports English,
Simplified/Traditional Chinese and Japanese, with English fallback; Korean product UI does not imply
a Korean brief card. Preserve the user's Korean requirements in the readable change brief and disclose
card fallback if a new-artifact card is needed. Do not alter upstream localization or fabricate a
translated native card. Recheck this limitation after a relevant upstream upgrade.

Installed ui-ux-pro-max or other UI-reference skills are supplementary guidance for focused review, accessibility, responsive risks and implementation constraints, not an independent design-generation path. They must not replace an approved artifact or existing tokens/components with a competing palette, layout or system. If OpenDesign's local execution is unavailable, report that blocker and continue non-dependent engineering; do not silently substitute a skill-generated design. OpenDesign Cloud remains explicit-request only.

- Any visual UI source/style change, from an existing-component repair to a new screen.
- Layout, hierarchy, navigation presentation, responsive and interaction-state work.
- Rendered design analysis, critique, polish and concrete refinement of those outputs.

## When not to use it

- Backend/API/data/auth and other purely nonvisual business-logic work.
- Functional verification, Git and mechanical integration that changes no visual design.
- A literal typo correction changing no layout or UI composition; if it changes the
  presentation, use the compact visual-refinement path instead.

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
| Successful execution, valid deliverable and all required output verified | Design output produced. Bind the preview and required-file snapshot now, then run the design-quality loop (below): evaluate the rendered result against the agreed references, brand and quality bar and commission concrete refinements until it is met — no fixed round cap. On the default path (existing approved design language, authorized scope) continue to implementation only after the bar is met and report the result, and preview-and-wait only for a new visual direction, a client deliverable, out-of-scope changes or an explicit review-first request. Implementation and human acceptance stay separate from the design verdict. |
| Explicit verification-only task, no tool failure, inspected existing output and reasoned no-change result | Review completed without changes. Identify the existing artifact; do not call it newly generated. |
| Terminal success but no valid required output, no justified question/no-change outcome | Output unverified/incomplete. Inspect the explanation and relevant diagnostic evidence; do not call it complete or attach an old project preview as this run's output. |

If output exists but the run reports a failure, treat it as partial/unapproved until verified; output
does not override an execution error. A required theme/CSS file missing from an otherwise valid HTML
deliverable is still incomplete. An artifact manifest marked complete or an old preview returned by
project metadata cannot override an invalid run-scoped deliverable verdict.

Project hygiene before commissioning: confirm the project has a meaningful declared entry
(`get_project` → `entryFile`). Without one, validation falls back to file inference, and a project
with ambiguous root HTML (for example two root HTML files) reports `entry_missing` for every run
regardless of the produced output — a project-config gap, not an output verdict. Declare the
canonical entry (`PATCH /api/projects/:id` metadata `entryFile`, preserving existing metadata keys)
or create the artifact entry through the design workspace.

Recovery depends on the cause: clarify a real question, diagnose an environment blocker, or inspect
missing output. A lost start response uses the original request id/payload after querying the existing
run; a terminal environment failure must not be blindly replayed. After an authorized repair, determine
the supported continuation/retry action and authorization without inventing a resume mechanism. Concrete quality refinement — a new run carrying the prior artifact and a specific defect list — is the normal design loop, distinct from replaying a failed run.

Normal polling should retain only run state, deliverable verdict, relevant error/question and usable
links. Pull full diagnostics only for investigation and the source bundle when context, approval
snapshot or implementation needs it. Keep internal identifiers in the task record, not product copy;
do not print raw event streams, credentials or provider telemetry in progress messages.

### Design-quality loop (design-owned analysis, review and refinement)

The simple flow is **orientation (diagnose/options when needed) → OpenCode task
contract → design analysis/implementation → design-rendered review/refinement →
OpenCode functional verification → report**.
Design review is a design responsibility, not an optional OpenCode aesthetic
judgment or a user defect-finding exercise. Scale it to the task; no fixed round cap.

1. **Diagnose and orient before commissioning.** For an existing screen or a vague
   dissatisfaction report, commission a read-only design audit first — a review
   skill on the actual current screens at the relevant viewports/states — and use
   its concrete defect list as the redesign's problem statement; the user should
   not have to enumerate the problems. When the direction is new or ambiguous,
   commission a lightweight direction options run (2-3 distinct direction boards,
   each with a rendered sample of the critical screen area) and let the user pick
   before full implementation; skip options when the approved direction already
   exists, and continue non-dependent work while the choice is pending.
2. **Compact task contract.** Reuse the agreed purpose and current problem;
   supply invariants versus redesign freedom, actual source/components/tokens,
   inspected references and accessible images, sanitized states/viewports, expected
   files and criteria. Write **observable** acceptance criteria — what must be
   visible on the first screen, the primary action, the mobile scroll depth, and
   what counts as failure — instead of vague adjectives; do not invent a universal
   above-the-fold rule or arbitrary score. **Verify input access before
   commissioning**: the execution environment must be able to read the references,
   assets and actual source; if an input is unreadable, do not commission — block
   and report the gap instead of running blind.
   Verify the **render-review path** too: host browser tools are not automatically
   available inside the design execution environment. Use either a verified inner
   renderer or actual product captures handed to the design reviewer, with a
   confirmed file-read receipt and source revision/viewports/states. A source-only
   audit does not satisfy rendered review. If neither path is available, block the
   dependent visual stage and continue independent nonvisual work; do not install
   browsers, restart containers, or substitute Build-side visual fixes implicitly.
3. **Design execution.** Select the agent and task-appropriate skill from the live
   `list_agents`/`list_skills`; record the selection per stage. The design execution
   analyzes the product problem and edits actual UI source where access is verified.
   Suitable installed choices may include `frontend-design`, `impeccable-design-polish`,
   `design-review`, `plan-design-review` or `web-design-guidelines`; select by actual
   content and task, not name alone. A small repair can render/review/refine in one
   compact run; a substantive change needs the separate review stage below.
4. **Required design review run with actual rendered inputs.** After the chain's
   output is verified, commission a design review execution as a required stage —
   a review skill distinct from the generator, not the generator's own approval and
   not an optional self-check. Feed it the real source snapshot, the **actual
   rendered states** at the target viewports plus empty/error/loading states,
   keyboard/focus, accessibility (axe where available) and motion/interaction
   states, references and criteria; confirm the review actually read those inputs. This
   applies equally to HTML artifacts and successful source-direct edits with an
   invalid canonical-entry verdict. A report-only/plan-only stage is not UI output.
   Missing files or render access remain unverified; do not claim a pass from a
   manifest, run success, screenshot existence or a generic review score. OpenCode
   checks the evidence and actual integration, not substitutes its own visual fix
   or taste verdict.
5. **Concrete refinement and evidence.** Require the review output as a concrete
   **defect list** — what is wrong, which screen/state, the user impact and the
   desired result — tracked fixed/open across rounds, not a good/bad verdict.
   Return findings with the prior source/render to design, then have design recheck
   the changed states. In the existing ledger, keep a small table:

   | Criterion / defect | Design finding and requested change | Revision + viewport/state render evidence | Fixed / open | Functional check |
   | --- | --- | --- | --- | --- |

   Measurable improvement means a criteria-linked defect demonstrably closed,
   not lines changed, larger type or stronger color. Continue until the bar is met;
   a full round with no measurable improvement stops as **quality unmet**, with
   remaining defects and next options, not “complete, only user acceptance left”.
   A genuine access/execution blocker or material decision is also a truthful stop.
6. **Engineering verification and report.** Direct UI source edits can occur
   before quality pass but remain provisional. OpenCode verifies functional
   integration/build/routing/permissions/persistence on the actual product and
   returns presentation issues to design; nonvisual bugs stay engineering-owned.
   Match the review evidence to the actual files/revision after later changes.
   Distinguish generated, design-reviewed with evidence, functionally verified
   and human-accepted; none implies the next. Keep existing direction/client/
   scope/review-first and representative rollout gates, and reachable preview links.

This is an execution contract, not runtime enforcement. Notifier/unit/package
checks prove their own behavior, not aesthetic quality or agent obedience. Real-use
acceptance requires a product session's review/refinement and changed-flow evidence.
The notification's `renderInputAccess` and `renderReview` stay `unverified`: they
are reminders to inspect task evidence, not a detector that certifies a rendered
review from a daemon status or the inner agent's prose.

**Resident product context (per project).** Keep one `product-context.md` at the
OD project root: brand tokens from the actual token files, component inventory,
screen↔file map, invariants (API/data/auth/permission contracts, one writer, no
unapproved brand change) and the review criteria pointers. Write it once when
registering the source project and refresh it when tokens/components/screens
change. Briefs and review runs read it first instead of re-explaining the product
each session; it supplements actual source inspection and never replaces it or
becomes an approval. Include a short recurring-defects/forbidden-patterns list
fed from review findings (for example, "decoration must not push the primary task
below the fold"), so later briefs do not repeat known failures.

**First-cycle evidence (real-use validation).** When a product runs its first
design cycle under this flow, record in the task ledger: the review run id and
skill used; the defect list with closed/open counts; how a `blocked` outcome was
handled (deliberate continuation vs explicit scenario); rounds and elapsed time;
the delivered review bundle; and the functional checks. This is the flow's
real-use evidence — it does not replace human acceptance or prove design quality
by itself.

**Run mechanics (observed).** A single request may expand into a plan→execute
run chain: stage 0 produces the direction and working material but no product
files; the strategy maps the next run (a plan stage with no files is not a task
result). The notifier follows mapped successor stages for the same session;
verify the chain mapping after a lost binding and judge the final output by the
actual source diff plus a real render check, not the intermediate completion.
Strategy outcomes may read `blocked` (`od_next_canonical_deliverable_invalid`)
for entry-untouched source-direct work; that verdict alone does not mean the
task failed.

**Project bindings and the blocked outcome (observed 2026-10-06).** A folder
import is auto-bound to the `example-web-prototype` scenario and the od-next
strategy profile `prototype` (`strategyBinding.taskProfile`). The od-next
strategy supports only `prototype`, `ppt`, `marketing` and `hyperframes` —
there is no code profile, so do not plan to "rebind od-next to code". Under the
prototype profile, source-only edits with an untouched canonical entry are
flagged `od_next_canonical_deliverable_invalid` and the strategy outcome becomes
`blocked`; that outcome can stop automatic continuation, so continue the next
stage deliberately from the actual source diff/render evidence instead of
reading `blocked` as task failure or completion. Supported alternatives: start
the run with an explicit scenario plugin — `od-code-migration` (patch-edit ↔
build-test devloop, diff-review handoff; inputs `repoPath`, `targetStack`,
optional build/test commands) or `od-design-refine` (direction picker →
patch-edit → critique loop → handoff) — which stamps an `explicit_user`
scenario binding for the project; `POST /api/projects/:id/scenario/restore-automatic`
reverts to the automatic scenario. Whether the strategy evaluation changes under
an explicit scenario is not yet verified in this environment — verify it in the
actual run and record the result.

**Writeback degradation (check every source-direct run).** A source-direct run's
workspace should be the product checkout (`storage.kind` not `od-owned`). If a run
reports `od-owned` storage, or the task record says runs cannot write outside the OD
storage, treat it as a **capability regression**: re-verify with a small write probe,
record the deviation (run id + observed workspace) in the task record, report it, and
resolve it or get a user decision — do not silently switch to transcribe-and-copy.
Transcribing stays a legitimate fallback only when direct access is confirmed
unavailable, and the adopted changes must map to their OD source.

**Skill selection (observed).** The catalogue advertises more skills than have
full bodies — some entries are stubs pointing at upstream bundles. For real
product UI prefer full-body skills (e.g. `frontend-design` covers dashboards
and application screens); `design-taste-frontend` / `gpt-taste` are explicitly
landing-page/portfolio skills ("not dashboards, not data tables"). Many design
skills declare `designSystemRequired`; without an attached design system,
proceed with the repository's own tokens as the brand contract and record the
choice. Verify the skill exists in the installed list before passing it.

Observed working selections (verify against the live list before use): product
dashboard/app UI → `frontend-design`; polish pass → `impeccable-design-polish`;
design review/critique → `design-review` / `plan-design-review`; motion after the
interface exists → `emilkowalski-motion`; compliance/guidelines →
`web-design-guidelines`; landing/portfolio taste → `design-taste-frontend` /
`gpt-taste` (unsuitable for dashboards). Record the per-stage selection in the
task ledger so working choices accumulate across sessions.

**Design system attachment (candidate, verify first).** The daemon supports a
project design system id; attaching one built from the product's tokens may
improve `designSystemRequired` skill coverage and cross-screen consistency.
Treat it as an experiment: verify with a real run, record the outcome, and only
then standardize.

**Pipeline artifacts.** Strategy runs may leave working material in the
project (e.g. `.od-frames/`). Treat it as untracked pipeline output: keep it
out of product commits and clean it up after the pass unless the design tool
still references it.

### Completion notification (host-side notifier)

The optional `plugins/design-notifier/` component closes the loop from the other direction: when a
design run reaches a terminal state, the originating session receives one advisory notification
instead of the user having to ask again. Verification, interpretation and any implementation stay
with the receiving agent and the user; the notifier only observes and notifies.

- Binding is recorded when a session calls `start_run` (request id + session), before the response
  can be lost; the returned run id is attached afterwards and the record becomes
  `run:<runId>@<sessionID>`. The tool-name prefix is configurable (`toolNamePrefix`, default
  `opendesign`); `design_runs list` exposes `observedTools` for diagnosis.
- The notifier polls the local daemon (`GET /api/runs/:id`, default 60 s) through an **elected
  poller**: every location instance captures its own sessions' bindings, but one instance holds
  the state-lock leader lease and does the polling/delivery, so the daemon is not queried per
  location. Overlapping ticks during a slow-tick lease handover are possible and are fenced by the
  delivery claim. Delivery admits one message per run/session through the native session synthetic
  inbox (deterministic `msg_...` id); a state-lock claim serializes concurrent instances and a
  re-send of the same id is idempotent at the session.
- **Wake permission is per session.** An unpaused session receives the completion with auto wake
  (`resume:true`, `delivery:queue`). A paused session is not contacted at all: the terminal result is
  stored as `held` in notifier state, and `resume` delivers it with auto wake on the next poll tick.
- The message requires verification with `get_run` (preview URL and `agentMessage`), never claims a
  deliverable when `deliverableValid` is false, forbids blind regeneration, and defaults to finishing
  the job (implementation plus a result report with its preview) when the change follows the existing
   approved design language and authorized scope; it previews-and-waits only for an unapproved new
   direction, client delivery, scope change or review-first request. Any verified UI output,
   including canonical-entry-invalid source edits, requires design-owned rendered review/refinement;
   `designQuality: "not_assessed"` never declares a quality pass. Intermediate stages are non-final
   and mapped successors stay watched; report-only stages do not authorize new design work.
  Source notifications distinguish the daemon's artifact verdict from **required product verification**:
  `entry_not_touched` on a succeeded source-direct run is not automatically product failure or success;
  inspect the actual diff/build/changed-flow checks. Read-only reports are not design deliverables.
  A representative visual-system result requires the single user review before wider rollout, even when
  separate plan pre-approval was unnecessary. Failed/canceled executions are never upgraded by this rule.
  Existing pinned runtimes must be explicitly updated after verification to receive these source changes.
- Policy: idle session → `queue` + auto wake; busy session → `queue` (no interruption); paused
  session → `held` (no session contact until resume); deleted target session → `orphaned`, never
  delivered elsewhere and never replaced by a new agent; daemon-missing run → `missing` (kept for
  diagnosis, no delivery); lost start response → reconciled by `clientRequestId` for up to 24 h
  without starting a replacement run.
- State is durable under `~/.local/state/opencode-design-notifier/` (atomic JSON bindings,
  `paused.json` per-session/global switches, `leader.json` lease, bounded `events.log`); restart
  recovery re-reads it and does not resend delivered runs.

Install the pinned runtime copy with `node scripts/install-design-notifier.mjs` (writes
`~/.config/opencode/plugins/design-notifier/` with a SHA256 manifest; `--verify` detects drift) and
remove any `plugins` config entry that points at the development tree so only the pinned copy loads.
The `design_runs` tool lists tracked/held runs (with leadership and pause state), re-watches an
existing run as a recovery path, and pauses/resumes wake permission for the calling session
(`scope:"all"` for every session). Limits: same-host daemon reachability, up to one poll interval of
latency (including after resume), leader takeover within the lease TTL after a crash, overlapping
ticks during handover are fenced by the delivery claim, a pause racing an in-flight delivery takes
effect on the next tick, and no knowledge of goal pause state other than the explicit switch. This
component is not part of the npm package and does not install anything by itself.

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

OpenCode owns the existing reference-research integration; OpenDesign's local execution owns design synthesis. Use focused Mobbin screen/flow/section research before a new screen, material redesign or unresolved pattern when it can inform the task. Do not repeat research for implementation of an already-approved screen, component reuse, small copy/spacing changes or backend work. Respect explicit user requests, supplied references and project constraints. Routine searches/selection inside the authorized design brief do not need a separate user approval for every query.

Select references based on actually inspected images, not app names or metadata alone. Retain canonical Mobbin links and record the specific hierarchy, interaction or state pattern to borrow; do not copy brand assets or product copy. When an image must be embedded, saved or passed into design, use the permitted high-resolution image source rather than the low-resolution inline preview. Image URLs expire; keep permitted selected files in a task-owned reference location when needed. References supplement existing tokens/components and human-approved direction, not replace them.

Send the same agreed requirements/constraints plus this compact reference input in the design brief:

- target screen/flow and the user task;
- selected canonical links and actually accessible image files (or supported attachments);
- the useful pattern in each reference and what must not be copied;
- existing product tokens/components, required empty/loading/error/mobile states and out-of-scope changes.

Verify that the design execution environment can read those files and interpret the image input. A host or client-PC path, external URL, or screenshot filename alone does not prove access or vision support. Use the target project's supported attachment/file mechanism or verified shared reference location; do not expose the home directory or copy authentication stores. An OpenCode MCP connection is not automatically inherited by the design run. Configure an additional inner connection only as a separate authorized change, not as a prerequisite to this reference-transfer workflow.

If Mobbin is absent, unauthorized or unhelpful, report the limitation and use provided references/established patterns where sufficient; do not fabricate results or block every design task by default. If essential design direction remains unresolved, return that decision to the user. Missing local design-execution capability is a separate blocker and does not authorize silent substitution with a UI-reference skill or OpenDesign Cloud.

## Handoff requirements

### Product-aware frontend improvement

OpenDesign's local execution can improve an existing product's UI; a separate design folder is not
proof of product-source access, and a design artifact is not an automatic product
integration. Build supplies the actual implementation context so design work does
not become an unrelated mockup that engineering has to redesign. When verified write
access to the actual product working directory exists, prefer the direct
product-source path below over copying sources.

Use this existing-task flow:

1. Identify the user task, observed problem, affected screen/states and approved
   scope. Inspect the relevant product source and current rendered evidence;
   distinguish observed defects from assumptions. Reuse existing requirements.
2. Assemble the minimum necessary product context below. Use already authorized
   file/attachment mechanisms; verify the design environment can actually read
   the inputs. Do not infer accessibility from host paths or project metadata.
3. Confirm the output format supported for this target. Request product-compatible
   UI components/styles where supported, preserving existing interfaces and tokens.
   A prompt asking for React/TSX or any framework is not evidence of that capability.
   If only a standalone HTML/JSX/CSS artifact is supported, state the adaptation
   needed before the run and constrain it with the same product contracts. No
   promised ready-to-merge component without actual file/execution evidence.
4. Commission the existing refinement or new-artifact path, preserve canonical
   entry/output requirements, validate the real files and rendered states, and
   retrieve the complete required bundle for integration. A prototype fixture
   is not a functioning product API/auth/save flow.
5. Build integrates the output faithfully without visual redesign, connects real data/routes/events and
   verifies the actual changed product flow. Compare design and product at relevant
   viewports/states; return visual deviations to design for review/refinement, including small repairs.
   Keep the default finish-and-report path and existing direction/review-first gates.

#### Minimum product context

| Input | What Build supplies |
| --- | --- |
| Identity and revision | Actual product repository/worktree/revision, target route/component paths, design project/storage/entry; pending changes that affect the input |
| Product purpose | User task, observed problem, accepted outcome and exclusions; do not invent objectives from screenshots |
| Relevant source | Screen/components and necessary imports/styles; for multi-screen work, a screen/file map; existing reusable patterns, tokens, fonts and permitted assets |
| Framework constraints | Actual framework/conventions, component boundaries and available trusted render/check commands; preserve dependencies unless separately approved |
| Integration contracts | Props/types, data shape, route destinations, event/callback semantics, permission/disabled behavior; credentials and live private data excluded |
| State evidence | Relevant wide/narrow captures and sanitized empty/loading/error/stale/permission fixtures; distinguish observed and proposed states |
| Output ownership | Required files/format, canonical renderable entry and permitted output paths; product integration owner and immutable input/output snapshot |

Use selective verified read-only access or minimal task-owned source copies under
existing authorization, not a full-repository/home-directory export. Remove secrets
and private customer data before transfer. If required sources cannot be accessed,
report the specific gap and continue unrelated work; do not silently claim the design
run used the product or reconfigure mounts/credentials/security to make it work.

#### Compact refinement brief

Populate this in the existing task record/run request from observed facts; it is a
prompt convention, not a new MCP schema or automatically enforced manifest. Reuse
known values instead of interviewing the user again. New-artifact intake still follows
the existing brief/confirmation rules.

```text
Target: product worktree/revision + route/component; design project/storage/entry.
Purpose: user task, observed problem and agreed acceptance criteria.
Input: relevant source/tokens/assets/captures/fixtures with verified accessible paths.
Preserve: functionality, component contracts, data/event/route/permission semantics and agreed brand.
Redesign freedom: scoped hierarchy/layout/component/interaction presentation and states/viewports;
                  do not freeze a rejected layout or change business rules.
Produce: supported UI files/styles, renderable canonical entry, required siblings/assets,
         component-to-product mapping, integration instructions and known limitations.
Ownership: design owns delegated UI source/styles, rendered review and visual refinement;
           Build owns nonvisual integration/contracts, functional verification and Git.
           One writer per file, sequential handoff if UI and domain changes share a file.
Verify: identify inputs actually read, changed output paths, rendered states/checks performed,
        criterion/defect -> revision/render -> fixed/open evidence and access/output gaps.
        A success status alone is insufficient; report an unmet bar honestly.
Exclude: product API/data/auth/Git/deployment changes, new dependencies or unrelated screens.
```

Output must describe reuse/adaptation of existing product components, required
imports/assets and synthetic fixtures, and what remains for real data/event wiring.
For an artifact task, preserve the canonical entry expected by the output contract;
component siblings alone do not prove a valid artifact. For source-direct work,
verify actual UI source and product renders; do not fabricate entry edits merely
to change an entry-centric verdict. If the supported output cannot
satisfy a required state or implementation contract, surface that gap rather than
silently lowering the contract or launching another generation blindly.

#### Faithful integration and feedback

Build may make nonvisual/mechanical production adaptations within the agreed design contract,
but does not invent a different layout, action hierarchy or visual system to make
integration easier. Preserve accessible semantics, tokens, responsive ordering and
empty/loading/error/permission behavior. Record artifact-to-component mapping,
actual required-file hashes and necessary differences in the existing handoff.

Compare the design preview and the real product at corresponding relevant states
and viewports. Verify actual navigation, callbacks, keyboard/focus and persistence
where changed. Visual deviations and repairs return to design with the exact
source snapshot, product capture and constraint; nonvisual/mechanical adapters
do not require another design run. Recheck after integration fixes. This is a scoped feedback loop,
not automatic synchronization, recursive generation or mandatory pixel-perfect scoring.

#### Direct product-source work: verified, simplified preferred path

Source-direct frontend work is verified in this deployment: a probe run imported an
existing host folder (`metadata.baseDir`), edited the actual React TSX/CSS in the real
working directory, built it and produced a renderable canonical entry; Build then
independently verified the diff, build output and rendered interaction
(`docs/superpowers/plans/2026-10-05-source-direct-feasibility.md`). Prefer this path
for real product frontend work over mockup-then-reimplement.

- Point the run at the actual product repository — the real working directory, a
  dedicated branch, or the user's normal checkout. A dedicated branch keeps a
  review/rollback point and is the default suggestion; the user's checkout is
  acceptable when they prefer it (record the base revision before substantive
  writes). A separate worktree is optional convenience, not a requirement: use one
  when the user's working tree must stay untouched or concurrent writers would
  otherwise collide.
- Keep one writer at a time on the delegated UI paths. OpenDesign's local execution owns the UI source
  edits; Build owns requirements/contracts, actual verification, integration and Git.
  Sequential handoff is the default; concurrent writers need disjoint files and
  separate workspaces (a worktree keeps the checkouts separate).
- Real boundaries remain: home/credential roots and unrelated projects stay out of
  agent access (the gateway refuses them as selectable new projects; connected-root
  scope is still prompt-scoped, not an OS allowlist — see the last bullet); new root
  connections keep their own scoped approval, active-run protection and rollback
  scope; API/data/auth, dependencies, Git history and push/deploy changes are not
  delegated implicitly.
- For source-direct runs, completion evidence is the actual source diff plus a real
  build/render check of the changed flow. The deliverable validator is entry-centric:
  when the canonical HTML entry is intentionally untouched, `entry_not_touched`/
  invalid can be the correct physical outcome — do not fabricate an entry regeneration,
  and do not treat that verdict alone as task failure. Strategy pipelines may additionally
  mark the task `blocked` (`od_next_canonical_deliverable_invalid`) for the same reason;
  the same source-diff + render evidence governs. Build's verification of the real
  product remains the authority for "done".
- Run scope is prompt-scoped, not an OS sandbox: the inner agent's tools span its
  connected root. Keep sensitive non-product material out of connected roots.

#### Registering a source project (this deployment)

Folder-backed projects are registered through the remote-workspace flow, and
the deployed daemon accepts only an **exact connected path**:

1. **Connect** the project folder — a new path recreates the design container
   once, with automatic rollback: `POST /api/remote-workspace/connections`
   with `{ "path": "<absolute path>", "requestId": "<uuid>" }` through the
   local gateway (or the in-container CLI `od project open-server <path>
   --gateway-url <origin> --json`), then poll the operation until `ready`.
   The connector refuses while any design run is non-terminal. Any existing
   directory under home is selectable except the home root and the credential
   directories (`.ssh`, `.gnupg`, `.codex`, `.claude`, `.gemini`, `.config`,
   `.local`).
2. **Import** it as a project: `POST /api/import/folder` with
   `{ "baseDir": "<canonical path>", "name": "<name>" }` (or
   `od project import-folder`). The daemon verifies the connected path
   server-side — a browser-reported "connected" flag is never trusted — and
   sets `metadata.baseDir` plus the detected `entryFile`.

Agents perform both steps on demand for the task's project; this is a standing
capability for every project under home, not a per-project user decision.
Never mount a broader parent directory as a shortcut: the daemon still requires
the exact per-project connection, and this deployment deliberately avoids
Desktop/home-wide mounts. Keep one writer at a time. After import, check the
project's `metadata.scenarioBinding` / `strategyBinding` and record them in the
task record; a folder import normally carries the automatic prototype binding
(see Run mechanics for the source-direct blocked outcome and the explicit
scenario alternatives). For source-direct work, record the chosen scenario path
(automatic prototype + deliberate continuation, or an explicit scenario plugin)
and create or refresh the resident `product-context.md`.

#### External OD export intake (archive from another machine)

When the user hands over an OpenDesign export (a project/artifact zip produced on
another PC):

1. Extract it to a task-owned location **outside the product repository**; keep the
   original archive out of commits and never leave it in the repo root.
2. Inventory what it contains (artifacts, version history, plans, references) and
   record an **adoption map** in the task record: which version/artifact will be
   implemented, what is reference-only, and what is rejected.
3. If OD runs must reference the export, place a copy **inside the connected project
   root** or import it as a project — runs cannot read paths outside their connected root.
4. Confirm the intended direction with the user only when the adoption choice is
   materially ambiguous; otherwise proceed and report the map with the result.

#### Multi-screen visual-system pass

When several screens show accumulated drift (patch-built layouts, an
exception-heavy theme, missing shared components), fix the system before the
screens instead of continuing per-screen patches:

1. Have the design workspace audit the screens and map each to its files; inventory existing tokens and
   components.
2. Have design define tokens plus shared components (card, panel, button, stats, empty
   state) with spacing and type scales.
3. Have design implement and render-review one representative screen in the real
   source, refining criteria-linked defects; OpenCode verifies evidence, build,
   tests and actual changed-flow behavior. Direct edits remain provisional until verified.
4. Present the definition, the scope and the representative screen's real
   result as one review. For internal tools that keep the existing brand, this
   single review replaces a separate plan approval; obtain pre-approval before
   step 3 only for a new visual direction, a client-facing deliverable, an
   out-of-scope change or an explicit review-first request. Where a gated
   approval is used, its snapshot binds the system definition, not a full mockup
   set.
5. After the user approves the reviewed representative result, roll out screen by screen with per-stage checks, without
   per-screen user approvals, and report once at completion; finish with a full
   build/test/render pass on the whole app.

Do not big-bang rewrite every screen at once. Keep functionality, routing and
data unchanged, and keep one writer at a time on the UI files. This is the
preferred recovery when prior work left the product without a unified visual
language.

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
| Direction approval, when gated | The user's actual approval evidence tied to that snapshot; missing required approval remains pending. On the default path, record the verified snapshot with the result report instead of adding a gate |
| Design contract | Required states, responsive rules, existing tokens/components and allowed differences |
| Open decisions | Material questions still unanswered; absence must not be invented as approval |
| Implementation evidence | Product revision, actual checks/rendered states, differences and unverified items |

Request the source bundle once when implementation needs it; use explicit project/entry if default selection is absent or ambiguous. Check truncation/skipped files and follow up only for missing required source/assets. Preserve retrieved source bytes when hashing; if only decoded text is available, record its encoding/reconstruction and do not describe the hash as a raw binary-file hash. Binary references, CDN URLs and external dependencies may need separate retrieval/access checks. Never infer that every referenced asset is present just because a bundle request succeeded.

User direction approval may happen in the design workspace or conversation. On the default path (existing approved design language, authorized scope) no separate pre-implementation approval is required: record the verification snapshot with the result report. When the change was gated (new visual direction, client deliverable, out-of-scope or explicit review-first request), bind the agreed artifact to the captured snapshot at approval; if files changed or cannot be matched to what was approved, mark that uncertainty and obtain a decision rather than invent provenance. Material subsequent changes require updated direction approval; routine production adaptations within the approved contract can be documented without per-file confirmation. A manifest's schema version/status, execution success, mutable preview URL or old screenshot does not identify an immutable approved revision. Fetching source for implementation does not itself approve it.

### Product verification and feedback

Before reporting overall technical completion, reconcile required design work,
validated output/snapshot, product integration, changed-flow verification and
unresolved differences with the agreed acceptance criteria. Missing required design
or checks remain engineering work/blockers, not “only user confirmation remains.”
Tests/review findings cover their inspected scope, not design quality. A design-run
failure or unsupported entry requires cause-specific recovery, not substituting
Build's own design to save time. Never regenerate solely to tick a process box;
a verified no-change result can preserve the implementation with its evidence.

The design preview is for direction, composition and prototype states. The actual product server is for authentication, API integration, saving, permissions, routing, error handling and the production component/responsive behavior. Keep both responsibilities: a working prototype button or screenshot does not prove real functionality. No API/backend change is authorized by a design artifact.

Give the user two clearly labeled, actually reachable links when applicable: **Design preview** and **Implemented product**. Preserve the product server; do not migrate or duplicate its runtime inside the design workspace merely to consolidate viewing. Resolve URLs for the actual client/network; daemon-returned localhost URLs are not automatically browser-client-PC URLs. Report inaccessible/uninspected states rather than claiming verification. Standard review bundle: the reachable implemented-product link (a temporary tailnet-bound static server is acceptable for a static product — label it tailnet-only and temporary), before/after screenshots of the changed screens at the target viewports, and the design preview link. Screenshots inform the review; the product link remains the functional-verification surface.

Build can return task-scoped product captures, observed differences and constraints for design feedback, excluding credentials/private data. Feedback may propose design revisions or ask for product information; Build adjudicates and implements in its authorized scope. An important redesign goes through the existing direction-approval boundary again. This loop is explicit feedback, not automatic synchronization or execution delegation back into the engineering session.

## Boundaries

- An approved OpenDesign artifact is the design source of truth for that screen. It does not authorize
  backend, data, or scope changes.
- Do not create a parallel design system inside OpenCode. If a project has tokens or a design system, those
  sources remain authoritative.
- A generated artifact is not design approval, and a passing test is not user acceptance. The Human owns both.
- Do not claim a design run, file read, or rendered inspection that did not actually occur.

- OpenCode owns the development conversation, production changes, verification and Git. OpenDesign's local execution is the design specialist. An internal coding runtime used for design is not authorization to launch/resume the outer engineering session, recursively commission more design runs, or change product API/data/Git/deployment.
- Keep task-owned design/reference outputs and product writes under explicit ownership; never let concurrent design and Build writers modify the same product files. With verified source access, prefer direct edits in the actual product repository (one writer at a time); without it, keep separate design-output locations with existing product sources read-only where practical. An imported writable project root may technically permit such writes: operating guidance is not a filesystem sandbox. Do not silently move/copy the user's project or reconfigure mounts.

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

### Local execution nested sandbox on Docker

The local design execution agent uses bubblewrap. Docker's default seccomp denies its user-namespace creation;
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
The local execution sandbox succeeds; workspace-write can create a file in the selected root;
a separate writable Docker bind is read-only inside the sandbox; direct outer-container mount fails.
Then commission one real local-execution fixture run and check the resulting bytes on the host.
These checks prove the tested boundaries, not complete sandbox security or design quality.

The reviewed DGX deployment used `/etc/apparmor.d/ksi-codex-userns`; its seccomp and Compose override
are private host runtime files. This is a deployment record, not proof the current container still
uses it. Inspect actual image/Compose/security identity after every recreation and compare it with the
approved connector configuration; health alone does not establish local-execution readiness. Back up configuration before adding the security override to the
connector's pinned Compose file list, so subsequent project connections retain it. Verify actual
`CapEff=0`, `NoNewPrivs=1`, seccomp filtering and enforced profile after every rollout. Restore the
previous pinned Compose list and recreate only the application service for rollback; remove the
optional host profile only when no running container references it.
