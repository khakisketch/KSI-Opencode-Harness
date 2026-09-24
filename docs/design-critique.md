# Design Critique Rubric (read-only)

Use this rubric for Design Primary self-review (gate 5) and for the
user-authorized hidden `design-critic` (default 20 steps) foreground read-only
independent critique. It inspects evidence; it never fixes or approves.
Only the human user approves, and only after inspecting the actual render. The
Critic never replaces Human approval or the Design render loop. An omitted
Critic model/variant inherits the native model (which could be costly or
non-vision); if actual images cannot be read it returns `BLOCKED-no-render`.
No new DESIGN.md SSOT and no extra agent beyond this existing Critic.

## How to score

- Read-only: compare the candidate artifact/version plus brief version plus captures.
  No edits and no prototype changes during critique. The Critic evaluates the
  candidate before Human visual approval; after Design approval, Build
  reviewer separately checks integrated fidelity vs the approved artifact with `Mode: visual-fidelity` plus `Allowed write paths: none`.
- Every finding must be falsifiable: path, viewport, state, and image (or
  `BLOCKED-no-render` when no render exists).
- The verdict is one of VISUAL PASS/FAIL/BLOCKED-no-render (`VISUAL PASS`, `VISUAL FAIL`, or `BLOCKED-no-render`).
  A verdict is never Human approval.

## Checks

1. Brief fidelity — the prototype matches brief vN (user, purpose, density,
   exclusions); unknowns were asked, never guessed.
2. Token fidelity — reused tokens/components are cited from the design-system
   source; no invented hex, palette, or visual value outside the candidate
   artifact/version and its cited token source.
3. Hierarchy — one explicit direction and a settled hierarchy; the layout
   intent is legible at both viewports.
4. Real interaction — the keyboard/focus path works; loading/empty/error/
   permission plus relevant success/pending/failure states render; the
   semantic accessibility snapshot was inspected for interaction.
5. Responsive — desktop `1280x800` plus mobile `390x844` PNGs were both READ
   via vision; no unintended overflow (`640/768/1024/1280` self-review).
6. Accessibility and its limits — contrast is readable; an a11y tool was used
   where available; manual-only limits are documented (automated checks do
   not prove accessibility).
7. Content, trust, PII — synthetic fintech data only; no `settled` claim for
   a submitted-only payment; no real customer data, credentials, or PII.

## Defect format

- `[severity: blocker|major|minor] <path> <viewport> <state> <image>: <observed vs expected>`

## Critic dispatch contract (Design only, foreground)

Design dispatches `design-critic` with one single-line `Evidence:` carrying the
candidate artifact/version plus TWO workspace-relative `.png` paths marked
desktop/mobile (desktop `1280x800`, mobile `390x844`). The dispatch checks
claims only — file existence is not proven at dispatch; the Critic READs each
PNG via vision and compares viewports/states, and no screenshot means no claim.
A PNG path string is a claim and may be spoofed: if a path is missing,
unreadable, outside the authorized scope, or the model cannot READ vision, the
Critic returns `BLOCKED-no-render` and cannot claim visual PASS. If source
paths resolve outside the worktree or involve symlink escape, report a blocker
instead of accessing. This permission is not an OS/symlink sandbox.
Native read-only permissions are the enforceable default; the hook backstop
applies when the critic caller identity is observed via `chat.params`, and is
not guaranteed before the first child tool call. Critic defaults deny `edit`/`write`/`apply_patch`/`bash`/`task`/`lsp`/`skill`/
`external_directory`/`webfetch`/`websearch`/`mobbin_*`/`gpt_imagegen`/
`playwright_*`/`context7_*`; Design's own ask-gated preview/server permissions
are unchanged. The Critic is not obligatory for tiny token-identical
established-pattern reuse of a cited approved artifact; use it for material
ambiguities and include its result without replacing the own render loop or
human acceptance. Never infer approval from source alone.

## Verdict

- `VISUAL PASS` — no blockers or majors; minors listed.
- `VISUAL FAIL` — at least one blocker or major, each in the defect format.
- `BLOCKED-no-render` — no inspectable render exists; block dependent visual
  handoff; never infer approval from source alone.
