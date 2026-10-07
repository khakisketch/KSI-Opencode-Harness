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
- [x] Update manifest/package checks and README/INSTALL pins; release prepared as `c5ee02a`.
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

## Release execution and recovered blockers

- Test Runner same session verified clean committed `c5ee02a` via release:check (7pins,
  full/package pass) and retained exact23-file tarball453521bytes. SHA256:
  `526392348f318d31e16eaabd50385b73ece5a2b5dd5ac5790519ac4485664a39`.
  Pack SRI/SHA1/per-file SHA256 in private `pack.json` and `pack-hashes.json`.
- Authorized main push succeeded `d2020f4..c5ee02a`, remote SHA confirmed. Standard npm
  login completed; first publish failed EOTP without writing beta.8 (registry404 confirmed).
  Use the same verified tarball after CI recovery with standard interactive approval;
  never log or request an OTP/token in tracked records or bypass approval.
- Remote CI37579001582 failed all6jobs:22 common fixture failures from hardcoded
  `/tmp/opencode` absent on GitHub Ubuntu/macOS/Windows; Windows25 failures included
  two POSIX-only expected-path assertions and URL.pathname used as executable argv.
  Local host had that temp directory, masking this portability issue. Original failure
  log retained privately; no passing-CI claim and npm publication held for repair.
- Developer `ses_eeb0d6e88ffepHCYVGzhelKeY0` owned8test-fixture files sequentially in
  current checkout; Primary did not concurrently edit them. Minimal os.tmpdir/path.join
  and fileURLToPath repairs, native strict expectations retained. Disposable absent-parent
  RED reproduced ENOENT; self-check standard/fresh TMPDIR166/165/0/1 and package pass.
  Remaining two Windows assertion files were explicitly added to scope by Primary;
  no production/security/runtime/model/auth changes or installation.
- Test Runner same release session independently verified actual8-file diff, both TMPDIR
  modes166/165/0/1 and package pass; original pack paths,size,SHA1/SRI byte-identical,
  retainedtgz SHA256 unchanged.11protected sources/configs unchanged, manifest version-only.
- Reviewer `ses_eeb093b8cffeA808dAHld8uiQZ` confirmed fixture-only changes and retained
  strict XDG/home/credential/security checks. Missing remote matrix is a pending gate,
  not a code defect or satisfied by Linux. Its portable symlink-target concern was fixed
  by Developer: actual fixture-owned existing state directory outside home replaces `/tmp`,
  exact no-side-effect/rollback/refusal checks unchanged. Targeted8/8 and full165/0/1 pass.
- Deferred nonblocking review notes: mixed os import style and synthetic POSIX-looking
  inputs in composition tests do not establish UNC/real-Windows-drive coverage. No broad
  platform audit or security-check skipping added. Actual6job matrix still required.
- Post-symlink independent verification and repaired-source remote CI are next; no publish
  until observed CI success. Tests/ledgers are excluded from package, so source recovery
  may map the same verified immutable tarball to a later release commit if parity holds.
- Final post-symlink Test Runner same session:166 total/165 pass/0 fail/1 original
  Compose skip, package/diff pass, actual escape-target/security assertion diff inspected;
  dry pack remains exact23files/453521bytes/same SRI/SHA1. Logs
  `final-portability-{check,package}.log`. Commit/push this tested source for remote matrix.

### Canonical-path and Windows containment recovery

- Test-only repair committed/pushed `2889d97`; same Test Runner independently checked
  exact committed clean release:check, isolated metadata23decisions and166/165/0/1.
- CI37579994057: Ubuntu20/22 pass; macOS5fail/job, Windows6fail/job. Five failures are
  fixture expectations using temp-path aliases instead of canonical realpath (/var versus
  /private/var and RUNNER~1 versus runneradmin). The sixth Windows failure is a real
  source-only status-report leak: POSIX-only `../` check failed to reject `..\outside`.
  Never change the expected private-content refusal to bless that leak.
- Primary extended Developer ownership narrowly to `scripts/work-status.mjs` and its
  regression, plus the two existing fixture bases. Canonicalize fixture realpath before
  deriving expectations; segment-aware native-separator outside-root guard preserves
  traversal/cross-drive rejection and existing actual symlink secrecy assertion.
- Developer reproduced5alias failures on a symlinked TMPDIR and Windows relative escape
  against the old guard. New actual helper test (no source-string/mock test) covers slash
  versus backslash splitting; actual drive/UNC behavior still requires Windows CI.
- Independent reviewer same session: no blocking code/security defect; synthetic-separator
  test does not prove Windows isAbsolute semantics. Early worker test-wiring failure was
  fixed by a direct helper import, not by widening report exports. Stale early log retained,
  do not cite it as green. Optional extra empty/..foo/drive cases deferred, no broad audit.
- Independent Test Runner same session: security-check167 total/166 pass/0 fail/1 original
  Compose skip, package/diff pass; own symlink-TMPDIR targeted18/18pass,0skip. Packet dry
  inventory and original tgz/SRI remain byte-identical (scripts/tests/ledger not packaged).
  Fresh evidence: `security-{check,package,alias}.log`. Next: push tested source and verify
  actual6job matrix before npm publishing. No auth/install/runtime or design changes.
