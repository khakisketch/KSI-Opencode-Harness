# Design handoff

> Copy this template for a task; this sample is not an approval. It is
> intentionally short. A material visual task starts as `NOT visually
> approved` until the named rendered artifact is actually inspected.

## Status

- Status: `NOT visually approved`
- Artifact/version: `<name>@<version>`
- Approved scope: `<specific screen/component/story and allowed paths>`
- Brief version: `<brief v1: user, purpose, density, exclusions>`
- Token block: `<reused tokens/components; no invented hex>`
- Approver and date: `<human / YYYY-MM-DD>`
- Inspection evidence: `<PNG path(s), viewport(s), state(s)>`

## Reproduction

- Source or prototype: `<reviewed path, story, or reproduction command>`
- Live URL (optional, authorized localhost only): `<http://127.0.0.1:<port>/...>`
- Baseline vs revision: `<what changed between baseline and this revision>`
- Viewports: `<for example 1280x800, 390x844>`
- Interaction: `<short path through the approved state>`
- Synthetic state evidence: `<fixtures and states shown; synthetic data only, no PII>`
- Outstanding risk: `<none or list>`
- Approval waits until the user inspects the actual render: no approval until user inspected; never infer approval from source alone.

## Decisions

- Hierarchy/layout: `<decision>`
- Aesthetic direction: `<one locked direction>`
- Visual tokens/components: `<decision>`
- Relevant props/events: `<prop/event and expected behavior>`
- Loading/empty/error/permission states: `<state behavior>`
- Unresolved constraints: `<none or list>`

## Self-review

- States: `<loading/empty/error/permission verified>`
- Contrast: `<readable>`
- Viewports: `<640/768/1024/1280, no unintended overflow>`
- Anti-AI-patterns: `<no indigo defaults, no purple-blue gradients, no emoji-as-icons>`

## Build integration acceptance

- Reuse this artifact/source; do not invent a replacement direction.
- Verify the integrated desktop and mobile viewport/state relevant to this task.
- Record any integration mismatch and return it to Build for a Design decision.
