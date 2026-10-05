# Source-direct frontend feasibility — technical spike

Updated: 2026-10-05
Status: feasibility spike complete locally; product activation not performed

## Approved question and boundaries

User: research existing cases before proceeding, and try if feasible. Determine
whether Local Codex can edit actual frontend files rather than requiring a separate
mockup and reimplementation. This is a research/throwaway capability spike, not
authorization to change another product, mounts/security, dependencies, deployment
or the global default workflow. No main-product writer is enabled by this record.

## Checklist

- [x] Explore current integration and deployment without changing it.
- [x] State question/probe; user authorized research and feasible trial.
- [x] Research primary sources and comparable workflows.
- [x] Run a minimal synthetic source-edit/build probe within an already connected fixture root.
- [x] Verify actual host bytes, rendered React interaction and preserved prior files independently.
- [x] Record source-edit capability separately from product runtime/visual acceptance and recommended next scope.

## Observed sources

- Upstream folder-import PR #624, merged 2026-05-07:
  https://github.com/nexu-io/open-design/pull/624 — explicitly no copy/shadow tree,
  metadata.baseDir determines file APIs and agent working directory; security
  fixes are documented in review. This is implementation evidence, not a guarantee
  for every product framework or installed version.
- https://github.com/nexu-io/open-design/blob/main/README.md — existing-repo refresh
  advertised, but migration plugins also appear in roadmap as alpha/planned.
- https://github.com/nexu-io/open-design/blob/main/plugins/_official/scenarios/od-code-migration/open-design.json
  and atoms/patch-edit/SKILL.md — pipeline/patch/build-test definitions exist;
  not treated as an already exercised end-to-end migration.
- https://github.com/nexu-io/open-design/blob/main/docs/rfc-drafts/dev-server-auto-detect.md
  remains Draft: native automatic framework dev-server preview is not proven.
- https://kombai.com/features/code/ — vendor documents repo/component reuse,
  direct coding, browser verification and agent delegation; not personally tested.
- https://github.com/onlook-dev/onlook — code container + source indexing + visual
  editing/agent writes, Next.js/Tailwind-focused; not installed/tested here.
- Context7 /nexu-io/open-design corroborated folder import and migration definitions;
  installed runtime evidence takes precedence over unversioned documentation.

## Current environment and probe design

- Harness main/base 9086e72, clean before evidence notes; unrelated worktrees preserved.
- Current design runtime version0.24.1/base89e64d8; reviewed image SHA256a9b79052…;
  actual five approved Compose inputs, capDropALL/CapEff0/NoNewPrivs1/Seccomp2,
  enforced ksi-codex-userns; no recreation/security change.
- EVENTOUCH remains managed artifact storage, not a source-linked product workspace.
- Two old fixture roots and KSI-CCTV already mounted; no new root connection needed.
- Synthetic React component under a uniquely task-owned subfolder in fixture `two`;
  original witness preserved. Reuse already-installed React19.2.4/react-dom19.2.4/
  scheduler0.27.0 read-only and runtime esbuild0.25.12, no installs or product edits.
- Exact frozen small copy/target-size change, not a new visual direction. Local Codex
  writes only the synthetic component/styles and fixture build outputs; no API/auth/
  route/private-data/Git/deployment changes. Verify working directory, source hashes,
  actual bundle/render/button behavior. No mockup reconstruction by Build.
- Existing root bindings are broader than the task-owned child directory; prompt
  scope is not an OS allowlist. Preserve prior-file hashes and disclose that limit.

## Results

- Task-owned synthetic repo baseline9f69495 under fixture two/source-direct-20261005-a7c2;
  build from outer container passed, no installations. Baseline browser exercised
  the actual React state0→1, button label Increase count, CSS min-height32px (actual
  rendered height44px due padding), no wide viewport overflow. This is a functionality
  probe, not a visual-quality comparison.
- New task-owned project baacbc86-0f65-4568-9654-94e810ab3ae3 imports the existing
  exact connected root. MCP get_project confirmed resolvedDir matches host root;
  prior projects untouched. Canonical entry set only on the new probe project.
- Requeste5850fe5-05d3-4d9c-a217-d2b82071ac96/runf61361e0-6e06-40a0-8a2b-2521f43d7f07:
  Local Codex requested exactly two source edits plus existing build and receipts,
  single writer in task child. No skill/plugin explicitly requested, but daemon
  automatically applied example-web-prototype snapshot8e38ba99…; this is a possible
  source-direct routing mismatch, not evidence of a code-edit workflow being enabled.
- Run physically succeeded, exit0, declared deliverable valid, syntax check passed.
  Actual workspace reports folder-backed/user-local/writeback=in-place. Local Codex
  changed the two existing host source files, ran the trusted build and wrote a
  technical receipt; Build did not reproduce/transfer the UI. About89s for this
  tiny test is one observation, not a latency/cost estimate for real design work.
- Primary inspected exact Git diff, receipt, preserved originals, actual browser
  label/count behavior, 390px computed CSS and screenshot. Not a visual-quality
  evaluation: the frozen label/min-height change needs no new design direction.
- Independent test-runner `ses_ef50782acffekyjjxI5qXfr4v0` verified fixture baseline
  remains9f69495 with exactly App.tsx/style tracked changes; witness, build and
  package preserved. Fresh trusted build exit0, deterministic public outputs;
  all three HTTP responses200 and byte-identical to host. Browser mouse count0→1,
  keyboard Enter1→2, min-height44px, no390px overflow; source change survives reload
  while local count intentionally resets0. Page errors/console empty; relevant
  document/JS/CSS requests200 (reload cache304). Same browser session handed over,
  no duplicate driver; Primary closed only the owned session afterward.
- Independent preservation: six config/role hashes match, global policy unchanged,
  same reviewed image/security retained. Harness diff check exit0; no source/runtime/
  package/config changes, so unchanged harness suite/package checks were not rerun.
- Receipt caveat: agent-reported input CSS hash is NOT the actual baseline-file
  hash. Read-only diagnosis matched it exactly to baseline bytes with final newline
  removed; raw baseline snapshot and Git baseline match. Output hashes and final
  diff are correct. The receipt is retained as produced, not silently fixed or
  trusted as raw-byte provenance. Independent raw-byte evidence is authoritative.
  This limits receipt reliability, not demonstrated source-edit/build behavior.
- Runtime staged `.od-skills/web-prototype-0bfaa88545/` at the imported root.
  Original witness preserved; the broader cwd sandbox includes the parent fixture
  root, not a file-extension/child-directory hard allowlist. Do not generalize this
  probe's prompt-scoped ownership into a security guarantee.
- Evidence: `/tmp/opencode/ksi-source-direct-final-evidence.json` and matching
  `-390.png`/`-http-*` files; baseline `/tmp/opencode/ksi-source-direct-baseline.json`,
  compact run summary `/tmp/opencode/ksi-source-direct-run.json`. Required public
  hashes: index.html c41498bb6afe237952ee8bb8475792e612dffeac7a5b1a9d7e7d4619b201d9d4;
  main.js 5336e6091d195c4ddded4edb0aa12eb8f9253daefff210a55c08558e7036f2f3;
  main.css a42df5d82833f5ac3c302b45793759e0d36a61877df1a15a465d3f1cd111f414.
- Probe project and uniquely owned synthetic child retained, clearly named as a
  capability fixture. No active browser/server created by this task remains.
  Do not delete the imported project/root as generic cleanup: it shares an old
  fixture root with a witness and other registrations. Four unrelated worktrees
  and all prior projects preserved; no installs/restart/mount/security/config/
  real-product changes, external publication/deployment or goal operations.
- Same independent test-runner checked the final two-record staged delta: cached
  diff exit0, no packaged/runtime/config changes, source/preview/security limits
  not overstated, and newline-stripped input-CSS hash comparison reproduced exactly.
  `/tmp/opencode/ksi-source-direct-closeout-evidence.log`. Browser not reopened.

## Recommendation and unverified scope

Direct source editing is feasible in the inspected environment; a separate mockup
and manual reimplementation are not intrinsic requirements. Prefer per-target
isolated source-direct UI ownership when real source access, trusted build/runtime,
privacy and delivery verification are established. Build need not redesign UI; it
coordinates functional contracts and verifies/integrates the resulting product diff.

The tested fixture is a static esbuild bundle from actual React TSX, not a Next/Vite
development server, SSR/HMR, product auth/API or native visual collaboration. The
runtime selected a prototype plugin and used a touched canonical HTML entry;
source-only edits with unchanged entry still need correct run-output verification.
Latest docs/RFC are not proof those missing capabilities shipped in this installed
runtime. EVENTOUCH remains a separate managed artifact with no source linkage.

Next candidate (requires its own product/infrastructure scope): one authorized
product-screen pilot in an isolated task workspace. Verify actual files, existing
dependencies/commands, runtime accessibility and source-compatible output before
any new root binding; a new connection may recreate the shared container and needs
active-run protection and scoped approval. Do not switch global routing or connect
main/home/credentials based solely on this synthetic result. A new frontend-preview
adapter or file-level policy would be implementation work, not part of this spike.
