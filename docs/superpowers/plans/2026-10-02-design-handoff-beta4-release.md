# Design-handoff beta.4 delivery

## Authorization and scope
User requested the previously deferred remote update/release on2026-10-02 ("해줘"). Deliver the already-applied/reviewed guidance through this repository's main push and unused npm0.5.0-beta.4 on next. Preserve latest0.4.0-beta.2 and all previous versions. No new design generation, runtime/config/permission change, service restart or product acceptance is included.

## Checklist
- [x] Reconcile clean local mainc195ff4, two unpushed guidance commits and remotebbfeae4. Registry nextbeta.3/latest0.4.0-beta.2; beta.4 unused.
- [x] Run baseline source check; log /tmp/opencode/ksi-beta4-baseline.log, exit0.
- [x] Update exact release guards first and observe mismatch before preparing beta.4.
- [x] Bump manifest and paired README/INSTALL pins; run source/packed-consumer/isolated native metadata, inventory and whitespace checks.
- [ ] Commit release candidate, push main without force and verify remote exact HEAD.
- [ ] Publish exact reviewed tarball to next; complete normal browser identity approval if required.
- [ ] Verify public metadata/tags/integrity/source bytes and fresh consumer preview/apply/repeat/no automatic policy merge.
- [ ] Record/push evidence and retain idle checkpoint; do not republish immutable versions.

## Verification boundaries
Guidance was independently reviewed in the prior slice with no Critical/Important findings and eight textual scenarios. This release changes only version/pins and delivery records, not the policy, native prompts, runtime or role templates. Source/package/native metadata checks do not prove live Mobbin usefulness, vision support, design quality, product-server behavior or human end-to-end acceptance.

## Evidence
- Preflight remote mainbbfeae44382aa7776c3e0d3f5a2c0bf23544e59e. Current local68a0b07/c195ff4 guidance commits remain scoped and task-owned.
- Exact version guards failed against beta.3 as intended, then full check64/0fail/1opt-in skip and packed consumer passed for beta.4. Logs /tmp/opencode/ksi-beta4-{version-red,package-red,check,package}.log.
- Isolated native V2 catalog/permissions/models/steps and retired skill checks passed; verifier issued no provider requests, child egress not monitored. /tmp/opencode/ksi-beta4-isolated.log.
- Reviewed tarball /tmp/opencode/ksi-opencode-harness-0.5.0-beta.4.tgz:18 allowed files match source exactly; paired README/INSTALL beta.4 pins and whitespace pass. Policy/role/runtime source is unchanged from its prior independent review; only release version/pins changed.
