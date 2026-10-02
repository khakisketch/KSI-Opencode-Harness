# Design-handoff beta.4 delivery

## Authorization and scope
User requested the previously deferred remote update/release on2026-10-02 ("해줘"). Deliver the already-applied/reviewed guidance through this repository's main push and unused npm0.5.0-beta.4 on next. Preserve latest0.4.0-beta.2 and all previous versions. No new design generation, runtime/config/permission change, service restart or product acceptance is included.

### Expanded channel authorization
The user subsequently requested public delivery of the current version as the main/default release ("배포도 해주고 현재 최신을 메인으로 배포해줘 공개"). This explicitly authorizes changing npm latest to0.5.0-beta.4 after exact public consumer verification, in addition to next. Keep the beta version designation; no invented stable release or removal of older versions. GitHub main already contains sourcee2263b5. The earlier latest-preservation boundary describes the previous authorization stage, now superseded for this tag only.

## Checklist
- [x] Reconcile clean local mainc195ff4, two unpushed guidance commits and remotebbfeae4. Registry nextbeta.3/latest0.4.0-beta.2; beta.4 unused.
- [x] Run baseline source check; log /tmp/opencode/ksi-beta4-baseline.log, exit0.
- [x] Update exact release guards first and observe mismatch before preparing beta.4.
- [x] Bump manifest and paired README/INSTALL pins; run source/packed-consumer/isolated native metadata, inventory and whitespace checks.
- [x] Commit release candidate, push main without force and verify remote exact HEAD.
- [ ] Publish exact reviewed tarball to next; complete normal browser identity approval if required.
- [ ] Verify public metadata/tags/integrity/source bytes and fresh consumer preview/apply/repeat/no automatic policy merge.
- [ ] Promote verified beta.4 to latest under expanded authorization; verify next/latest and fresh unversioned default installation.
- [ ] Record/push evidence and retain idle checkpoint; do not republish immutable versions.

## Verification boundaries
Guidance was independently reviewed in the prior slice with no Critical/Important findings and eight textual scenarios. This release changes only version/pins and delivery records, not the policy, native prompts, runtime or role templates. Source/package/native metadata checks do not prove live Mobbin usefulness, vision support, design quality, product-server behavior or human end-to-end acceptance.

## Evidence
- Preflight remote mainbbfeae44382aa7776c3e0d3f5a2c0bf23544e59e. Current local68a0b07/c195ff4 guidance commits remain scoped and task-owned.
- Exact version guards failed against beta.3 as intended, then full check64/0fail/1opt-in skip and packed consumer passed for beta.4. Logs /tmp/opencode/ksi-beta4-{version-red,package-red,check,package}.log.
- Isolated native V2 catalog/permissions/models/steps and retired skill checks passed; verifier issued no provider requests, child egress not monitored. /tmp/opencode/ksi-beta4-isolated.log.
- Reviewed tarball /tmp/opencode/ksi-opencode-harness-0.5.0-beta.4.tgz:18 allowed files match source exactly; paired README/INSTALL beta.4 pins and whitespace pass. Policy/role/runtime source is unchanged from its prior independent review; only release version/pins changed.
- Release sourcee2263b5 plus previously local68a0b07/c195ff4 pushed to main without force; remote exact HEAD verified.
- First reviewed-tarball publication exited1 with PUT E404; independent whoami returned E401. Public registry still has no beta.4 and unchanged nextbeta.3/latest0.4.0-beta.2. Authentication is invalid, not a tarball/version defect; no blind publication retry. Logs /tmp/opencode/ksi-beta4-{publish-tty,auth-check}.log and /tmp/opencode/ksi-beta4-after-failed-publish.json.
- Standard npm web login started once; requires user browser approval. Resume exact reviewed-tarball publication only after successful login and confirming beta.4 remains unused. Do not record credentials or authentication URLs in durable records.
- Expanded-authorization preflight: source remote still exacte2263b5, beta.4 absent, nextbeta.3/latest0.4.0-beta.2. Fresh whoami stillE401; existing web-login process remains active awaiting browser approval, not duplicated. Prepared public verifier now checks next/latestbeta.4 and both exact-version and unversioned default installs after promotion.
- Fresh expanded-scope local checks:64pass/0fail/1opt-in skip, packed consumer pass, unchanged reviewed-tarball SHA512 and all18 source bytes match, verifier syntax and git whitespace valid. Logs /tmp/opencode/ksi-beta4-latest-{check,package}.log. These do not establish public publication/default-channel delivery, which remain blocked on browser authentication.
