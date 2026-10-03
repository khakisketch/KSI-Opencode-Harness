# Design-flow hardening

## Approved intent
The user requested implementation of the preceding read-only review's improvements on 2026-10-03. Preserve Local Codex design ownership, OpenCode engineering ownership and human direction approval. This is a bounded hardening of the existing integration, not a new orchestration architecture.

## Scope
- Separate new-artifact intake from existing-artifact refinement; reuse agreed requirements and ask only for missing material decisions. Disclose unsupported brief-card locales rather than pretending Korean is supported.
- Interpret physical run status alongside deliverable validation, agent explanation and actual required output. Distinguish produced output, questions, environment blockers, verified no-change and unknown outcomes. Never treat an old project preview as the latest run's result or automatically retry a failed design run.
- Keep a compact product/design/storage/brand binding and approval snapshot in the existing task ledger; an OD-owned design folder is legitimate but is not proof of product-repository linkage.
- Add optional V2 Plan-only permissions: deny the design MCP namespace, then allow its explicitly known read tools. Preserve native prompts, Build permissions, models, unrelated configuration and installer behavior.
- Apply the approved guidance and Plan rules to the current user's global configuration after private backup and verify effective native permission decisions without invoking design mutations or providers.
- Document deployment-readiness checks that compare the effective image, Compose files and security profiles with the approved deployment and prove file-access capability when needed. Preserve security restrictions; infrastructure changes and design retries require separate authorization.
- Avoid repeat context discovery and large diagnostic/bundle pulls during status polling. Do not claim measured latency or cost improvements.

## Evidence and constraints
The reviewed EVENTOUCH refinement physically succeeded but returned no artifact and explicit file-access failure. Its current container uses default AppArmor and only base/Linux Compose files, unlike the previously recorded restricted deployment. The remote connector still records the approved image/security Compose files; this proves drift, not who changed it or the exact namespace-denial mechanism.

No upstream application edits, new dependencies, native prompt replacements, cloud fallback, credential reading/sharing, container restart, security-profile change, product implementation, push, npm publication or automatic generation are authorized by this slice. Existing upstream dirty files and unrelated worktrees remain untouched.

Later scoped authorization: the user approved restoring the existing reviewed deployment after compatibility/active-work checks, with volumes/credentials/security preserved and one task-owned Local Codex file-access/output fixture. This permits the necessary fixed-service recreation with the existing approved profiles; it does not authorize EVENTOUCH regeneration, unreviewed profiles or general infrastructure changes. Stop if compatibility or active work cannot be established.

## Acceptance
Guidance is consistent across the integration guide and live operating instructions. Native isolated permission evaluation denies Plan design mutations and unknown future tools while allowing required reads; Build behavior remains unchanged. Existing harness and packed-consumer checks pass. Report infrastructure recovery and real end-to-end design acceptance separately rather than claiming they were completed by documentation tests.
