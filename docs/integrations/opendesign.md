# OpenDesign integration

OpenDesign is the design workspace for KSI work. It is a separate local application, not a role in this
installer and not a vendored skill kit. The installer ships no design skills, design system, or craft
references; this document defines how the harness expects OpenCode to use the OpenDesign capability.

This is an **optional, user-managed integration**. Installing KSI does not install the application,
Docker, model CLIs, credentials, or its MCP server. Follow [upstream installation instructions](https://github.com/nexu-io/open-design)
for your platform; approve any installation, shared configuration, credential sharing, and service changes separately.
The source repository's `integrations/opendesign/` assets record one Ubuntu arm64 deployment, not a portable
automatic installer. Superpowers is also separately installed, not a prerequisite bundled with KSI.

## Division of responsibility

| Owner | Responsibility |
| --- | --- |
| OpenDesign | Direction, layout, information hierarchy, interaction and visual system, rendered artifacts, critique |
| OpenCode (Build) | Requirements, code architecture, existing components, production constraints, backend, tests, Git, integration |
| Human | Direction approval and final acceptance |

OpenCode still makes engineering-particle judgments inside Build: detecting a mismatch with the design,
broken responsive behaviour, accessibility regressions, component reuse, and conflicts with production
constraints. Those judgments do not require a separate design primary agent.

## Prerequisite

An OpenDesign daemon must be reachable and its MCP server registered in the OpenCode configuration the
session uses. Verify the capability is present before relying on it:

- the MCP server appears in the active tool catalog, and
- a read tool such as `list_projects` returns the expected workspace.

Check `opencode mcp list` from the **actual project directory**. A healthy web server or a successful
standalone MCP probe is not proof that the current OpenCode session is connected. If it says
`Connection closed`, use OpenCode's `/mcps` to disconnect and reconnect this server in that project,
then recheck tool discovery and a real project read. Container restarts can terminate a live stdio connection;
automatic recovery has not been verified. A new chat alone is not a proven recovery mechanism.

For manual V2 configuration use `mcp.servers`, `disabled`, and timeout objects as documented in
[the V2 MCP guide](https://opencode.ai/v2/docs/mcp-servers). Do not blindly copy older `mcp`/`enabled` examples.
Use the command supplied by your actual upstream installation; Docker deployment commands are not universal.

If the capability is absent, say so and continue with the engineering work that does not depend on it. Do
not invent design artifacts or silently substitute a locally-invented design system.

## When to use OpenDesign

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
  In the tested deployment, specify both `project` and `entry`: the default-entry lookup failed despite
  metadata showing an entry file. Retrieve project metadata first if the file is unknown.
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

## Boundaries

- An approved OpenDesign artifact is the design source of truth for that screen. It does not authorize
  backend, data, or scope changes.
- Do not create a parallel design system inside OpenCode. If a project has tokens or a design system, those
  sources remain authoritative.
- A generated artifact is not design approval, and a passing test is not user acceptance. The Human owns both.
- Do not claim a design run, file read, or rendered inspection that did not actually occur.
