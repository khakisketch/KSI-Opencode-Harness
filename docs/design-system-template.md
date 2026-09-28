# Optional project design entrypoint

Use a project-root `DESIGN.md` only if it would help people find existing design sources. First inspect the project's current documentation. Extend or link to an existing entrypoint; do not overwrite it or duplicate token values. This is a pointer, not a second design system.

- Product/brand principles: `<existing document or concise verified rules>`
- Core user task and important failure or stale-data cases: `<verified product context>`
- Tokens: `<real path or URL>`
- Components and composed screen patterns: `<real path or URL>`
- Chosen/rejected visual examples: `<artifact paths and the Human's stated reasons, if approved for reuse>`
- Relevant accessibility/content rules: `<real path or URL>`
- Local preview or story command: `<verified command, if useful>`
- Current approved artifact or decision: `<path/version and Human approval status, if any>`

Omit fields that do not apply. Link to actual screenshots or components instead of copying them into a new KSI library. Date preference evidence and distinguish a direct Human choice from an agent inference. Record a genuinely missing design decision as unresolved in the task handoff; do not invent a palette, component, viewport requirement, or approval. A project's existing design entrypoint, if any, takes precedence over this example.

KSI's vendored OpenDesign Neutral Modern package is a possible reference only. It is neither copied into this file nor installed into a project by `--with-design-kit`. If a project without an established system deliberately adopts any part of it, record the approved source paths, scope, and owner decision here; do not label the reference package as existing product truth. Projects with real tokens, components, or brand rules keep those sources authoritative.
