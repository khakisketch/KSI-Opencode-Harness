# Maintainer release procedure

이 문서는 수동 release 준비 절차입니다. 자동 publish workflow가 없으며, publish·tag·registry upload는 별도의 명시적 승인 없이는 실행하지 않습니다.

## 1. Source checkout gate

깨끗한 별도 source checkout에서 적용되는 project instruction, 현재 diff와 intended deletions를 먼저 검토합니다. 다음은 source checkout 전용 개발 검사입니다.

```bash
npm run check
npm test
npm run check:package
npm pack --dry-run
git diff --check
```

`npm test`, `npm run check`와 `check:package`는 설치된 production package에서 실행할 명령이 아닙니다. package는 tests, CI, `scripts/check-package.mjs`를 의도적으로 제외합니다. CI에 Node 20/22 및 OS matrix 설정이 있어도, 실제 해당 job을 실행하지 않았다면 지원 OS matrix 통과로 표시하지 않습니다.

## 2. Tarball gate

실제 tarball을 만들고, dry-run manifest만 믿지 말고 tarball 내용을 inspect합니다. `check:package`가 확인하는 offline local-tarball install도 통과해야 합니다. source checkout에 존재하는 파일과 package contents를 다음처럼 구분해 기록합니다.

- 포함: runtime entry/source, role prompts, instructions, audit command, README/INSTALL, 다음 여덟 public 문서(`docs/architecture.md`, `docs/design.md`, `docs/design-critique.md`, `docs/design-system-template.md`, `docs/execution.md`, `docs/releasing.md`, `docs/troubleshooting.md`, `docs/verification.md`) 및 선택 예시 mapping. Design 문서(`docs/design.md`, `docs/design-system-template.md`, `docs/design-critique.md`)와 `examples/design.project.jsonc`, `examples/design-handoff.md`는 package allowlist와 required manifest gate에 명시합니다. 새로 추가된 두 문서는 packaging 대상일 뿐 user-approved visual이 아닙니다. `package.json files`는 `docs/` 디렉터리 통째가 아니라 위 여덟 파일만 명시합니다.
- 제외: tests, CI configuration, `scripts/check-package.mjs`, `.opencode`, session logs, credentials/secrets, private scratch artifacts, 그리고 `docs/superpowers/**` 전체(product-state, plan ledger, spec 포함). source repo에는 public-facing project state가 들어 있을 수 있지만 npm tarball에는 포함하지 않습니다 — tarball 소비자는 plan ledger나 product-state를 기대하지 않습니다. 이 목록과 filename/path gate만으로 secret content 부재를 보증할 수 없으므로 source와 tarball content를 수동 검토하며, secret-free라고 단정하지 않습니다. public Git release(원격 push) 전에는 별도의 human data/classification review가 필요합니다 — 이 tarball gate 통과가 source 공개 승인은 아닙니다.
- source에 있었던 legacy deletion은 소유권을 확인한 뒤에만 기록합니다. unknown owned file이나 다른 작업자의 변경은 삭제하지 않고 escalate합니다.

검사 결과에는 package file list, package-name import, offline install, plugin hook, 여섯 role, command와 policy reference를 확인합니다. Plan permission 교체, Build coordinator-only permission 교체, 여섯 reserved subagent 정의의 교체 범위를 기록합니다. reserved role은 model/variant와 유효한 양의 정수 steps를 보존하고 나머지 fields를 관리하므로 options/disable 등의 변화와 이름 충돌을 검토합니다. Plan의 기타 설정과 Plan/Build model이 보존되는지 확인합니다. secret-bearing debug output과 raw session log를 artifact나 release note에 복사하지 않습니다.

## 3. Documentation and source pin discipline

README·INSTALL의 KSI source URL은 repository main을 discovery entry로만 설명하고, 설치에는 remote에 실제로 존재하는 confirmed immutable commit을 resolve·pin하도록 안내합니다. SHA나 tag를 확인하기 전 문서에 지어내지 않습니다. 이 작업은 npm registry나 GitHub Release를 publish하지 않으며, Primary가 checks 후 source commit을 push하고 remote를 확인한 뒤 source Git distribution을 사용할 수 있습니다. Local file URL은 mutable 개발 경로로 별도 구분합니다. Superpowers는 `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`를 그대로 pin하며 upstream skill을 수정하지 않습니다. 새 upstream revision은 source/package 검토와 호환성 확인 뒤에만 별도로 고정하며, KSI는 fork/복사를 포함하지 않습니다. 권장 model mapping은 예시일 뿐이며 source distribution이 model default나 자동 fallback을 도입했다는 표현을 쓰지 않습니다.

이번 local source version은 `0.4.0-beta.0`이며 2026-09-25 첫 npm publish로 게시 검증됐습니다(GitHub Release 없음). 2026-09-24까지의 "잠정, 게시 주장 없음" candidate 서술은 history이며 현재 상태가 아닙니다. Design browser example은 configuration/documentation only이며 harness package에 Playwright runtime dependency를 추가하지 않습니다. `npx --yes`의 pinned MCP package와 already-installed Chrome, browser install consent는 별도 운영 경계입니다. 실제 PNG inspection evidence가 없는 sample이나 handoff를 auto-approved artifact로 publish하지 않습니다. 불변 `0.4.0-beta.0` tarball 안의 README는 publish 전 문구를 그대로 담고 있어 같은 version 재게시 없이는 고칠 수 없습니다 — 현황 truth는 이 source 문서이며 tarball 문서는 publish-time snapshot입니다.

## 3b. Public npm prerelease gate (2026-09-25 `0.4.0-beta.0` 게시 검증됨)

npm publish는 소유권·인증·registry 확인, 실제 tarball inspect, 독립 최종 게이트를 모두 통과한 뒤에만 별도 명시적 승인으로 실행합니다. `0.4.0-beta.0` 첫 publish는 이 게이트를 거쳐 2026-09-25 검증됐습니다 — 본 준비 작업 자체가 publish·tag·upload를 실행한다는 주장이 아니라, 검증된 게시 상태를 기록합니다.

```bash
npm publish --tag next --access public
```

발행 시에는 `latest`/`stable` 태그를 사용하지 않으며, `next`만 사용합니다. 순서는 verified commit을 main에 push한 뒤, npm install/import smoke를 실행합니다. npm version은 immutable이며 silent republish를 하지 않습니다. Git immutable-commit 설치는 계속 지원되고, file URL은 mutable 개발 경로로 유지됩니다.

> First-package tag observation (2026-09-25, tags left untouched): registry 관측상 `next`와 `latest`가 모두 이 beta를 가리킵니다. 이는 첫 게시 버전의 자동 `latest` 지정(관측 상태 + 공식 first-version `latest` invariant)으로 설명되며, silent tag-mutation fix 대상이 아닙니다 — registry tag 변경·재게시·새 version 발행을 하지 않습니다. 이 beta를 stable이라 부르지 않으며, bare `npm install ksi-opencode-harness`/unversioned plugin spec은 현재 beta를 해석하므로 항상 `ksi-opencode-harness@0.4.0-beta.0` exact pin을 사용합니다. 실제 승인된 stable release가 나올 때 `latest`를 이동합니다(발명된 stable version/tag 없음).

## 4. Manual publication and rollback

publish/tag/release는 maintainer가 변경 범위, tarball manifest, 실제 검사 결과와 remote target을 확인한 뒤 사용자의 명시적 승인을 받아 수동 실행합니다. 이 repository에는 자동 publishing workflow를 추가하지 않습니다.

rollback이 필요하면 이번 release가 소유한 KSI plugin/config 항목만 사용자 승인으로 되돌립니다. 사용자의 Primary model/permission, credential, shared Codex/Claude installation, unrelated MCP/provider, upstream Superpowers 설치와 다른 project work는 되돌리지 않습니다. 실패한 publish나 설치를 숨기기 위해 broad cleanup을 하지 않습니다.

## Release report

report에는 exact version/revision, source와 package의 차이, tarball/offline gate 결과, 실제 실행한 Node/OS, 미실행 matrix, inspected legacy deletion, upstream pin, restart requirement와 unverified boundaries를 적습니다. 통과하지 않은 OS·live smoke·quality/cost 비교·Human acceptance·remote publication은 통과로 표현하지 않습니다.
