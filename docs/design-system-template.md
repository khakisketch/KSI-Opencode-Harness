# Project Design System Entrypoint (template)

Copy this template to `DESIGN.md` at the project root (or link it from the
project's existing design docs) and fill in real paths. This file is an
entrypoint, never a token store: never copy token values here and never
create a second token source of truth. If the repository already has design
docs or a token source, reference them below and drop any duplicated section.
First check whether `DESIGN.md` or equivalent design docs already exist:
extend them by reference and never overwrite an existing file.

Scope: one optional project-level `DESIGN.md`. No new agent, no framework
install, no new palette — reuse what the project already ships.

## Token/component sources (real paths only)

- Tokens: `<path/to/tokens, e.g. src/tokens.css>`
- Components: `<path/to/components, e.g. src/components/>`
- Existing patterns/stories: `<path/to/stories or previews>`
- A missing token or component is an unresolved constraint: record it under
  `Unresolved constraints`, ask the user, and never invent a hex value.

## Brand/product invariants

- `<invariant 1, e.g. product name and logo usage>`
- `<invariant 2, e.g. density and tone>`

## Content, localization, financial trust

- Voice and reading level: `<...>`
- Locales and number/date/currency formats: `<...>`
- Financial trust: synthetic data only; never assert a payment is `settled`
  when it was only submitted (`accepted`/`processing`); never use real
  customer data, credentials, or production hosts.

## States

- Required: loading, empty, error, permission; add success/pending/failure
  where money or a user action is at stake.
- Every state listed here must render in the prototype before handoff.

## Preview (authorized, local only)

- Command: `<exact localhost preview/story command>`
- Loopback address: `<e.g. http://127.0.0.1:<port>/>` — loopback only, never
  public; one scoped authorization per command/path/origin/session.
- Safe test data: `<synthetic fixtures; no PII, no credentials>`

## Viewport and accessibility checks

- Viewports: desktop `1280x800`, mobile `390x844` (plus a `640/768/1024/1280`
  overflow self-review).
- Checks: keyboard/focus path, readable contrast, semantic accessibility
  snapshot for interaction; use an a11y tool where available and document
  manual limits.

## Approved artifacts

- `<artifact name>@<version> — scope — date — approver — PNG/state evidence>`
- Material work starts `NOT visually approved` until the user inspects the
  actual render; never infer approval from source alone.
