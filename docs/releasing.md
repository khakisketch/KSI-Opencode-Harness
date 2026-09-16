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

- 포함: runtime entry/source, role prompts, instructions, audit command, README/INSTALL, `docs/` 및 선택 예시 mapping. Design 문서와 `examples/design.project.jsonc`, `examples/design-handoff.md`는 package allowlist와 required manifest gate에 명시합니다.
- 제외: tests, CI configuration, `scripts/check-package.mjs`, `.opencode`, session logs, credentials/secrets, private scratch artifacts. 이 목록과 filename/path gate만으로 secret content 부재를 보증할 수 없으므로 source와 tarball content를 수동 검토하며, secret-free라고 단정하지 않습니다.
- source에 있었던 legacy deletion은 소유권을 확인한 뒤에만 기록합니다. unknown owned file이나 다른 작업자의 변경은 삭제하지 않고 escalate합니다.

검사 결과에는 package file list, package-name import, offline install, plugin hook, 여섯 role, command와 policy reference를 확인합니다. Plan permission 교체, Build coordinator-only permission 교체, 여섯 reserved subagent 정의의 교체 범위를 기록합니다. reserved role은 model/variant와 유효한 양의 정수 steps를 보존하고 나머지 fields를 관리하므로 options/disable 등의 변화와 이름 충돌을 검토합니다. Plan의 기타 설정과 Plan/Build model이 보존되는지 확인합니다. secret-bearing debug output과 raw session log를 artifact나 release note에 복사하지 않습니다.

## 3. Documentation and source pin discipline

README·INSTALL의 KSI source URL은 repository main을 discovery entry로만 설명하고, 설치에는 remote에 실제로 존재하는 confirmed immutable commit을 resolve·pin하도록 안내합니다. SHA나 tag를 확인하기 전 문서에 지어내지 않습니다. 이 작업은 npm registry나 GitHub Release를 publish하지 않으며, Primary가 checks 후 source commit을 push하고 remote를 확인한 뒤 source Git distribution을 사용할 수 있습니다. Local file URL은 mutable 개발 경로로 별도 구분합니다. Superpowers는 `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`를 그대로 pin하며 upstream skill을 수정하지 않습니다. 권장 model mapping은 예시일 뿐이며 source distribution이 model default나 자동 fallback을 도입했다는 표현을 쓰지 않습니다.

이번 local source version은 `0.3.0`입니다. Design browser example은 configuration/documentation only이며 harness package에 Playwright runtime dependency를 추가하지 않습니다. `npx --yes`의 pinned MCP package와 already-installed Chrome, browser install consent는 별도 운영 경계입니다. 실제 PNG inspection evidence가 없는 sample이나 handoff를 auto-approved artifact로 publish하지 않습니다.

## 4. Manual publication and rollback

publish/tag/release는 maintainer가 변경 범위, tarball manifest, 실제 검사 결과와 remote target을 확인한 뒤 사용자의 명시적 승인을 받아 수동 실행합니다. 이 repository에는 자동 publishing workflow를 추가하지 않습니다.

rollback이 필요하면 이번 release가 소유한 KSI plugin/config 항목만 사용자 승인으로 되돌립니다. 사용자의 Primary model/permission, credential, shared Codex/Claude installation, unrelated MCP/provider, upstream Superpowers 설치와 다른 project work는 되돌리지 않습니다. 실패한 publish나 설치를 숨기기 위해 broad cleanup을 하지 않습니다.

## Release report

report에는 exact version/revision, source와 package의 차이, tarball/offline gate 결과, 실제 실행한 Node/OS, 미실행 matrix, inspected legacy deletion, upstream pin, restart requirement와 unverified boundaries를 적습니다. 통과하지 않은 OS·live smoke·quality/cost 비교·Human acceptance·remote publication은 통과로 표현하지 않습니다.
