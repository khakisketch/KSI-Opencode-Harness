# 기능 목록·오프라인 진단

기능 목록은 **필요할 때만** 호출합니다. 등록 여부는 실제 호출 성공이나 제품 인수가 아닙니다. 전역 세션 증거 요약 도구는 제거했으며 실제 테스트 결과·동작·화면으로 검증합니다. [설치](installation.md) · [검증](validation.md)

## 현재 위치의 기능 목록

이 Mac에서는 **이 하네스 프로젝트에만** 설치합니다. 전역 플러그인이 아니며 다른 제품 프로젝트에 자동 노출하지 않습니다. 소스는 기존 `global/plugins/ksi-capabilities-inventory/`에 있지만 설치 대상은 이 하네스의 `.opencode/plugins/`입니다.

`ksi_capabilities_inventory`는 호출 세션과 플러그인 위치가 일치하는지 확인한 뒤 선택한 영역의 목록을 반환합니다. 기본 영역은 `agent`, `skill`, `tool`, `plugin`이며, `mcp`는 상태 조회가 재연결에 미치는 영향을 확인하지 못했으므로 **명시 요청할 때만** 조회합니다.

위치 확인은 호출 시점의 검사이지 동시 세션 이동과 목록 조회 전체를 원자적으로 묶는 보장은 아닙니다. 이동 중에는 다시 호출해 확인합니다.

예를 들어 Native 도구에 `{ "domains": ["skill", "tool"], "locateSkills": ["impeccable"] }`를 전달할 수 있습니다. 반환하는 ID 수·길이는 제한하며 잘림과 미확인을 표시합니다. 지원하지 않는 항목이 섞여도 정상 항목은 보존하되 목록을 불완전으로 표시합니다. 스킬 위치는 등록된 경로 문자열의 `project-hint`/`external-hint`일 뿐, 심볼릭 링크·존재·읽기 권한을 확인한 결과가 아닙니다. 실제 스킬과 파일 접근은 기존 Native 스킬·읽기 도구의 권한을 따릅니다.

- 선택하지 않았거나 조회에 실패한 영역은 `unknown`이며, 목록에 등록됐다고 호출 권한이나 작동 성공이 보장되지는 않습니다.
- 선택형 목록마다 독립적인 2초 deadline을 적용합니다. 한 영역의 지연이 정상 영역을 무기한 막지 않으며 불완전 목록에서 없는 항목을 `false`로 단정하지 않습니다. `queries`, `complete`, `countKind`, `observedCount`는 조회 상태·관측 개수이지 전체 총수·작동 성공이 아닙니다.
- 호출자 취소는 호출을 실패시키며, 지원되는 Native 목록에는 두 번째 `RequestOptions.signal`로 전달합니다. `tool.list()`는 문서화된 signal 인자가 없어 대기만 중단합니다. 내부 작업의 실제 종료는 best-effort이며 deadline 뒤 자동 재시도하지 않습니다. 필수 세션·위치 확인을 선택형 timeout 성공으로 바꾸지 않습니다.
- `plugin` 목록은 Native가 반환한 ID 그대로의 제한된 목록입니다. 격리 환경에서는 도구형 `opencode.*` ID도 포함됐으므로, 개수를 설치 패키지 수나 활성 판정으로 해석하지 않습니다.
- 출력에는 현재 프로젝트 디렉터리와 기능 ID가 포함됩니다. ID 문법 제한은 범용 비밀 탐지기가 아니며, 이름 자체에 민감한 정보가 들어갈 수 있으므로 공유 전 확인합니다. 전체 설정·설명·자격증명 값은 반환하도록 의도하지 않았습니다.
- 별도 CLI `node scripts/capabilities.mjs [directory] [--only agent,skill,mcp]`는 기존 관리용입니다. `--only`를 생략하면 MCP까지 조회하며, 이 CLI의 `opencode api`는 공유 서비스가 없으면 자동 기동할 수 있으므로 의도와 권한을 먼저 확인합니다. Native 도구의 사용을 위해 CLI를 실행할 필요는 없습니다.

## 선택형 오프라인 세션 감사

`node scripts/session-audit.mjs <session-json-file-or-directory> [--newest-first]`는 사용자가 지정한 로컬 스냅샷만 읽습니다. Native 도구 등록·실시간 컨텍스트 수집·자동 실행은 없습니다. core는 `scripts/lib/session-audit-core.mjs`에 있습니다.

배열은 기본 oldest-first이며 최신순이면 `--newest-first`를 명시합니다. 순서·입력 범위를 확인하지 못하면 결과는 미확인입니다. 민감한 원문을 불필요하게 입력하거나 출력 기록을 공개하지 않습니다.

선언 순서와 timestamp가 충돌하거나 관련 도구의 동률로 순서를 확정할 수 없으면 `order-unknown`입니다. 일부 timestamp 누락이 뒤에 관측되는 역순을 가리지 않으며, 단순 누락만 있는 경우도 `freshnessOrderConfirmed: false`로 입력 배열 기준 관측과 구분합니다. 가능한 모든 순열을 실제 실행해 입증했다는 뜻은 아닙니다. 실행 중·부분 실패한 변경 가능 도구나 자식은 snapshot 전체의 이전 검증 후보 신선도도 폐기합니다. 검사 명령 흔적만으로 `passedProof`를 만들지 않습니다.

변경·검증 후보와 실패 단서를 정리할 뿐 실제 검사 성공, 자식 세션 전체, 압축 전 이력이나 제품 수용을 증명하지 않습니다. 기능 사용에 이 CLI 실행을 요구하지 않습니다.
