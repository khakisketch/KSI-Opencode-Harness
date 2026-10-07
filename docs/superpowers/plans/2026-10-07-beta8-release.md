# beta.8 release — authorized delivery record

## Authority, binding and boundaries

- User requested "푸시배포해봅시다" and explicitly chose `next + latest` after disclosure
  that GitHub main includes all five previously local commits, not only Developer guidance.
- Target: existing checkout/main, baseline `4ecebb0`, clean/ahead5; origin is
  `https://github.com/khakisketch/KSI-Opencode-Harness.git`. Fetch confirmed0 behind/5 ahead.
- Registry: public `ksi-opencode-harness`, new immutable `0.5.0-beta.8`; registry lists
  versions through beta.7 and both channels beta.7. Never reuse or unpublish a version.
- Follow `docs/releasing.md`: exact-version pins, independent checks/isolated metadata,
  reviewed tarball, main push, publish exact tarball to next, public install verification,
  promote latest, verify both channels, release tag/GitHub release.
- One writer/current checkout; retain four unrelated worktrees. Build handles mechanical
  release pins/delivery rather than inventing an implementation helper task. No new product
  logic/visual work, model/permissions/native prompts, global roles, notifier installation,
  shared service/container restart, goal or new orchestration.
- npm whoami returned401 (expired login); standard web approval required, not an auth bypass.
  Activation details/auth output stay out of tracked records. Private evidence root:
  `/tmp/opencode/ksi-beta8-release-20261007`.

## Release steps

- [x] Confirm source target, unused version and explicit next/latest authority.
- [x] Update manifest/package checks and README/INSTALL pins; verified release ready to commit.
- [ ] Independent full/package/preflight, isolated native metadata and inventory verification.
- [ ] Push authorized main; verify remote/CI separately from publication.
- [ ] Publish exact verified tarball, public preview/apply/repeat and byte/integrity verification.
- [ ] Promote latest, verify both tags, tag release commit and publish GitHub release.
- [ ] Record actual delivery evidence; reconcile product state/checkpoint and report.

## Evidence boundary

beta.8 distributes the updated installer/public guidance and walkthrough/assets. Manual
notifier scripts/plugin and private global operating policy remain outside the npm package;
source push does not install notifier advice or update other users' policies automatically.
No claim of human acceptance, improved real-development quality or live-provider reliability.
Verification receipts will be added after observed execution; npm/browser identity approvals
must remain standard user approvals. Publication failures are partial delivery, not rollback.

## Preparation evidence

- Independent Test Runner `ses_eeb122a3fffeCA2YiTJzrk4BTw` checked baseline4ecebb0
  plus exactly five mechanical version-pin files and this ledger. Full check exit0:
  166 total/165 pass/0 fail/1 pre-existing opt-in Compose skip; package check exit0.
- Existing isolated native V2 fixture exit0 on2.0.24: effective agents/model/steps/native
  builtins preserved, no retired skills or commands installed,23 permission decisions pass,
  zero provider requests issued by verifier. Child egress was not monitored.
- Dry inventory:23 files,453521 packed bytes/612112 unpacked bytes; public walkthrough
  and four assets included. No private plans/state/tests/root deployment assets/notifier/
  credentials. Public docs/integrations/opendesign.md intentionally included.
- Seven README/INSTALL pins match manifest beta.8. `git diff --check` passes;
  11 protected config/role/source hashes preserved, package.json differs only by version.
- Logs under private evidence root: `pre-{check,package,isolated}.log`, `inventory.json`.
  Clean-tree preflight and exact tarball/public-consumer checks remain subsequent gates.
