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
- [x] Independent full/package/preflight, isolated native metadata and inventory verification.
- [x] Push authorized main; verify remote/CI separately from publication.
- [x] Publish exact verified tarball, public preview/apply/repeat and byte/integrity verification.
- [x] Tag release commit and publish GitHub release after registry verification.
- [ ] Promote latest and verify default beta.8 consumer — BLOCKED: standard auth never
  completed successfully; latest remains beta.7. No further automatic approval retries.
- [x] Record actual achieved/blocked delivery evidence; reconcile product state and report.

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

### Windows package-verifier execution recovery

- Canonical/security repair committed/pushed `f711e20`; exact clean release preflight
  passes and all23packaged source bytes match retainedtarball hashes.
- CI37580579130: all6sourcechecks pass, including real Windows external-ledger refusal
  and macOS canonical-path tests. Ubuntu/macOS packagechecks pass; Windows2packagejobs
  fail only `spawn npm ENOENT`. This is a separate source-only verifier execution defect.
- Developer same session changed only check-package.mjs/new check-package.test.mjs:
  invoke absolute validated npm_execpath through Node without shell/PATH lookup; Windows
  check .cmd-shim and actualbinJS presence then run JS through Node, not claim .cmd execution.
  POSIX standalone/executable check retained. Four real argv helper tests, no mocks/skips.
- Primary diff inspection caught a dropped package-install-no-global-config assertion in
  the initial body move; Developer restored it and retracted the earlier byte-identical
  flow claim. Whole-body audit/reviewer/Test Runner confirm all34assert statements retained.
  No script was published or a user's configuration touched by the provisional verifier.
- Independent reviewer same session: no code/security blocker, full strict offline/minimal
  env/no-config/preview/three-role/idempotence/conflict checks intact; remote Windows package
  execution remains a real pending gate, not a Linux inference.
- Test Runner same session:171 total/170pass/0fail/1 originalCompose skip, package/diff pass,
  safe23file drypack/SRI and retainedtgz byte-identical. Logs `npm-portability-{check,package}.log`.
- Source scripts/tests excluded from published installer. Direct verifier execution without
  npm_execpath now fails descriptively before fixture creation; documented npmrun entry
  supplies it. Do not install tools/use shell:true or weaken platform gates to recover.

## Final source gate and publication state

- Final verified source/release target `178b2e9f6c91250bab43f2d3a23da1a50c76ae9c`
  pushed and clean. Same independent Test Runner: clean release:check pass,7pins,
  exact suite171/170/0/1, package pass, all23packaged source bytes equal retainedTGZ.
  Receipts `publish-{preflight,check}.log`. No tarball regeneration.
- Actual CI37581287013 completed success: Ubuntu/macOS/Windows × Node20/22,
  all6jobs including source and packed-package verification success. Earlier failed CI
  receipts preserved above; final real Windows security/package evidence is now available.
- The original noninteractive publish returned EOTP and beta.8 registry404. A subsequent
  standard interactive publish of the exact original tarball is awaiting user approval;
  do not replay it while pending. Separate login success does not mean publish success.
  No publication/channel/tag/consumer-success claim before registry receipts.

## Public delivery receipts

- Standard interactive publish succeeded for immutable `0.5.0-beta.8` after user browser
  approval. Immediate registry404 was processing latency, not a reason to republish.
  Read-only bounded readiness check observed version on attempt3 (~60seconds) at06:30:08Z.
- Test Runner same session independently executed reviewed public-consumer verification:
  18/18checks pass, registry/SRI and downloadedtarball match original, all23installedfiles
  byte-identical, Linux standalone preview no-write → own3-roleapply → repeatchanges[].
  Minimal credential-free disposable HOME/cache/prefix; target contains only agents,
  no operating policy/model/runtime config. Only owned disposable consumer removed.
  Receipts `readiness.log`, `readiness-metadata.json`, `public-consumer.log`;
  no Windows .cmd or productquality claim.
- At public check, next=beta.8/latest=beta.7. Authorized latest promotion is currently
  waiting for a separate standard browser approval; do not replay while pending.
- Tag `v0.5.0-beta.8` created/pushed at source `178b2e9`; GitHub prerelease created:
  https://github.com/khakisketch/KSI-Opencode-Harness/releases/tag/v0.5.0-beta.8.
  Final channel/defaultconsumer verification and evidence-only closeout push remain.
- First latest-promotion approval failed404 at npm's authentication-completion endpoint,
  not the package endpoint. Fresh public queries still return beta.8/version and
  next=beta.8/latest=beta.7. No package disappearance, unpublish or republish inferred.
  Original command is terminal; a cause-specific new standard dist-tag approval attempt
  was launched (not a replay of an in-flight command). Private receipts
  `promote-latest.log` and `promote-latest-retry.log`; final channel state still pending.
- Second standard latest attempt failed identically; stopped issuing identical retries.
  Source diagnosis on installed npm11.17 confirms `dist-tag.add` passes PUT/body opts
  into `otplease`, then `npm-profile.webAuthOpener` forwards them unchanged to the done
  fetch. Authentication completion should use GET; inherited PUT is a request-method
  correctness defect. Source inspection alone does not prove it caused the terminal404;
  later HTTP-state evidence below corrects the causal attribution. Public version exists.
- User explicitly approved a single-command in-memory compatibility shim, no installation/
  config/2FA change. It guards the existing HTTPS npm-registry done endpoint, removes
  only method/body from cloned poll opts and forces GET. Original browser opener and
  standard OTP return/retry/write remain native; original dist-tag PUT/body unchanged.
- Actual installed npm-profile loopback HTTP reproduction RED: PUT+versionbody observed
  instead of GET/no-body. Independent Test Runner same session GREEN2/2, original write
  object unchanged and endpoint guard enforced; installed npm4/4source hashes unchanged,
  retainedtgz unchanged. Independent reviewer same session: no blocking scoped security
  finding. Full wrapper composition was inspected, not a mocked end-to-end auth claim.
- Test Runner disclosed a supplementary mock attempt that did not intercept registry-fetch
  and issued one unauthenticated read-only GET to the standard registry done endpoint404.
  No token, challenge, registry write or credential/config change; stray owned scratch
  removed, not repeated. Preserve this limitation rather than claim a fully isolated
  supplementary test. Actual live standard approval is still required.
- At that stage, the authorized corrected latest command ran with a private preload in one
  Node process; no NODE_OPTIONS/global hook/vendor writes. Its completion and registry
  channel state were pending (subsequent terminal results below). Private artifacts auth-get-{preload,test}.cjs, red/green logs,
  npm-unchanged-hashes.json and promote-latest-corrected.log remain outside the package.
- Corrected command terminated with GET404 too. Targeted debug-log analysis emitted ONLY
  HTTP method/status/path/count (no queries, auth identifiers, headers/bodies/tokens):
  prior standard attempt PUT20295times→PUT404; corrected attempt GET20295times→GET404.
  Thus both were accepted as pending polls and ended without a successful approval200.
  Do not call method correction a proven complete fix for404 or blame package absence.
- User-facing causal explanation corrected. New single-process corrected request started
  only after prior was terminal; fresh link immediately supplied with instructions to
  finish browser approval, not merely open the link. Do not issue another request while
  this one is pending. Installednpm/config/2FA still unchanged; latest verification pending.

## Final partial-delivery closeout

- Fresh corrected approval also terminated GET404. All launched promotion commands are
  terminal; stop creating approval links. No successful tag write and no downgrade/
  unpublish/republish to disguise the blocked latest stage.
- Independent final Test Runner `ses_eeb122a3fffeCA2YiTJzrk4BTw`: registry version/bin/
  originalSRI confirmed, next=beta.8/latest=beta.7, exact publicconsumer18/18pass with
  all23installedbytes/preview-no-write/own3rolesapply/idempotence/no-policy writes.
  Full171total/170pass/0fail/1originalCompose skip, package/diff pass;11protected hashes
  unchanged and manifestversiononly, installednpm4/4sources unchanged, tgz unchanged.
  Logs `closeout-{registry.json,public.log,check.log,package.log}` in private evidence root.
- Read-only remote confirmation: source/tag178b2e9, publicGitHubprerelease exists,
  CI37581287013 all6jobs pass. Windows CI checks .cmd shim presence and Node-driven
  binJS behavior, not actual native .cmd execution; do not overstate the runner's wording.
- Achieved: source push, immutable npm beta.8 to next, exact public install/bytes, tag and
  GitHub release. NOT achieved: latest promotion/default-beta.8 install. Plain latest
  still resolves beta.7; use `@next` or `@0.5.0-beta.8` for the delivered version.
- Blocker owner: a working standard npm account/browser second-factor completion is
  required for the authorized tag change. Manual completion in a working authenticated
  user terminal or npm-side resolution can unblock it; never request credentials/OTP in
  chat, disable2FA, install another CLI, infer a successful approval or keep retrying.
- Current source/records technically verified, but authorized external delivery remains
  partial. No live notifier/global role installation or shared restart. Human workflow/
  real-development/design quality acceptance remains separate. Receipt-only closeout
  commit/push and checkpoint reconciliation do not alter the published immutable payload.
- Final receipt-only records independently checked by the same Test Runner:
  `final-records-{check,package}.log`,171/170/0/1, package/diff pass; actual registry
  channels/tag/release match partial-status wording, published tag range1–8 verified.
  No new auth requests or defaultbeta8claim. Optional tag-annotation uniformity is
  nonblocking; beta.8's lightweight tag names the verified revision and was not rewritten.
