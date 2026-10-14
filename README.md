# KSI OpenCode Harness

실제로 사용하는 **OpenCode Native 전역 하네스의 정본과 배포 파일**을 관리합니다.
별도 실행 프레임워크·설치기·자동 재개 플러그인은 제공하지 않습니다.

## 전역 정본과 적용 위치

| 저장소 정본 | 전역 적용 위치 | 내용 |
| --- | --- | --- |
| [global/AGENTS.md](global/AGENTS.md) | `~/.config/opencode/AGENTS.md` | 제품 완성·질문·위임·검증 기준 |
| [global/agents/design-specialist.md](global/agents/design-specialist.md) | `~/.config/opencode/agents/design-specialist.md` | 디자인 역할·모델·브라우저 권한 |
| [global/opencode.jsonc](global/opencode.jsonc) | `~/.config/opencode/opencode.jsonc` | Native 역할 라우팅·모델 요청 설정·MCP·출력·문맥 설정 |

현재 운영 환경의 위 세 파일과 저장소 정본을 동일하게 맞춰 배포합니다.
이후 변경도 **정본 수정 → 전역 반영 → 실제 설정·동작 확인 → 커밋·푸시** 순서로 관리합니다.
`global/`은 배포 원본이며, 저장소를 clone/pull하는 것만으로 전역에 설치되거나 적용되지는 않습니다.

다른 환경에서는 기존 전역 파일을 먼저 비교·백업하고 필요한 내용을 적용하세요.
개인 설정과 다른 도구의 등록을 통째로 덮어쓰지 마세요. 전역 지침을 적용했다면
동일 지침을 프로젝트 `AGENTS.md`에 중복 삽입하지 않습니다.

현재 환경과 배포 정본의 일치는 다음과 같이 확인할 수 있습니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/design-specialist.md ~/.config/opencode/agents/design-specialist.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
```

OpenCode Go·OpenAI 연결, MCP 인증과 로컬 Chrome/Node 실행 환경은 별도 준비가 필요합니다.
Context7 자격증명은 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키를 저장소에 넣지 않습니다.
계정·OAuth 토큰·서비스 상태·세션·개인 `cli.json`·도구별 독립 스킬은 배포 사본에 포함하지 않습니다.
기존에 사용 가능한 스킬을 선택적으로 활용하되 Superpowers·CE는 기본 의존성이 아닙니다.
Playwright MCP가 자동으로 이름을 붙이는 캡처·로그는 `/tmp/opencode/playwright-artifacts`에 저장합니다.

제품별 요구사항과 검증은 해당 프로젝트의 기존 문서·테스트·CI에서 관리합니다.
실행·설정·권한은 [OpenCode V2 공식 문서](https://opencode.ai/v2/docs/)를 따릅니다.

## 적용 원칙

- 구현이 승인된 범위에서는 단계 보고 후 실제 작업을 이어갑니다. 일부 구현·테스트·커밋 성공을 전체 완료로 취급하지 않습니다.
- 규모 있는 개발의 분리 가능한 구현·테스트·조사는 General에 맡깁니다. 목적·범위·수정 영역·보존할 계약·완료 검증을 전달하며, 작은 수정이나 강하게 결합된 작업은 직접 처리합니다.
- 독립 작업은 백그라운드로 위임하고 주 에이전트도 다른 승인 작업을 진행합니다. 결과에 의존하는 작업은 순차로 처리하고, 완료 통지를 받아 통합·검증합니다. 같은 파일뿐 아니라 DB·서버·브라우저 등 공유 자원 충돌도 고려하며, 반복 상태 조회나 무조건 병렬화를 하지 않습니다.
- 새 화면·주요 사용자 흐름 변경은 프레임워크 이관도 포함해 디자인 작업으로 취급합니다. 구현 전 또는 진행 중에 Design Specialist에 발견·판단·구현·렌더 검증까지 맡기며, 사용자가 지적한 뒤 스타일만 보강하는 역할로 축소하지 않습니다. 주 에이전트가 통합과 전체 완료를 책임지고, 작은 기계적 수정·비UI 변경에는 위임을 강제하지 않습니다.
- 기능 동작·시각/UX·입력 방식 검증은 구분합니다. 캡처는 검토 대상 빌드·역할·화면 상태와 일치해야 하며, Enter 제출만으로 마우스·터치 사용성까지 검증했다고 하지 않습니다.
- 기존 문서에서 확인할 수 있는 내용과 일반적인 구현·디자인 선택은 사용자에게 되묻지 않습니다. 필요한 제품·범위·비용·보안·데이터 결정은 Question으로 확인하고, 독립적으로 가능한 승인 작업과 구분합니다.
- 분석 요청과 Plan 제한은 유지합니다. 지침은 모델의 행동 기준이지 무중단 실행 보장이 아니며, 자동 재개 플러그인·별도 상태 원장·고정 작업 파이프라인을 추가하지 않습니다.

General·Explore·Plan은 Native 역할을 활용합니다. 별도 개발자·테스트 역할이나 설치기를 복원하지 않으며, 주 에이전트의 통합·최종 검증 책임은 위임해도 유지됩니다.
Design Specialist 정의에는 해당 역할의 브라우저 허용이 포함됩니다. 보이는 OpenCode 브라우저를 요청받으면 이를 사용하고, 개별 조작이 실패할 때는 원인을 확인한 뒤 필요한 대체 경로와 미검증 범위를 밝힙니다.
브라우저 권한과 데스크톱 연결은 별개입니다. 자식 세션의 Native 브라우저가 연결되지 않았으면 반복 호출하지 않고 연결 제한을 보고하며, 기존 Playwright 등으로 직접 렌더를 검토할 수 있습니다. 이를 Native/Review 창 검증 성공이라고 대신 보고하지 않습니다.

## 디자인 작업과 선택형 Impeccable

UI 중심 작업은 Design Specialist를 메인으로 사용하고, 풀스택 작업은 Build가
UI 영역을 Design Specialist에 맡깁니다. 디자인 담당자는 조사·설계·프론트엔드 구현·렌더
검증까지 책임지며, 도구를 호출했다고 판단이나 완료 책임이 도구로 넘어가지는 않습니다.

| 필요한 것 | 선택할 수단 |
| --- | --- |
| 실제 제품 패턴 비교 | 기존 제품 패턴, 필요할 때 Mobbin |
| 구현 문법·라이브러리 정보 | Context7 |
| 실제 동작·화면·관련 상태 확인 | 연결된 Native 브라우저 또는 기존 Playwright |
| 한정된 코드·렌더 결함 검사 | Impeccable standalone `detect` |
| 특정 디자인 개선·정식 비평 | 원본 Impeccable의 해당 스킬 명령 |

위 표는 필수 실행 순서가 아닙니다. 작은 수정에는 불필요한 조사·검사를 생략하고,
중요한 구조 변경은 사용자 업무·상태·제약을 기준으로 판단합니다.

[공식 Impeccable](https://github.com/pbakaus/impeccable)은 별도 외부 설치로 사용하며
원본 스킬·엔진·훅을 이 저장소에 복제하거나 수정하지 않습니다. 현재 확인한 설치는
스킬 **4.5.2**, 엔진 **0.1.14**입니다. 기존 `impeccable-design-polish`는 경량 적응판으로,
공식 `impeccable`과 별개입니다. 두 가지를 한 검토에 중복 적용할 필요는 없습니다.

설치된 OpenCode용 launcher를 제품 작업 디렉토리에서 사용할 수 있습니다.
다른 설치 경로에서는 실제 스킬 base directory를 사용하세요.

```sh
# 필요한 소스 범위 검사
"$HOME/.config/opencode/skills/impeccable/scripts/impeccable" detect --json src/
# 필요한 공개/로컬 화면 검사: 설치된 브라우저 필요, 인증 상태는 별도 확인
"$HOME/.config/opencode/skills/impeccable/scripts/impeccable" detect --json http://localhost:3000
```

`detect`는 독립 검사이며 스킬 전체를 초기화하지 않습니다. 종료 코드 `0`은 주요 검출 항목 없음,
`2`는 검출 항목 있음, `1`은 검사 실패입니다. 결과는 실제 결함·오탐·미검증을 구분해 판단하며,
깨끗한 검사나 휴리스틱 점수가 접근성 인증·사용성 검증을 대신하지 않습니다.

스킬을 선택하면 해당 명령의 원본 계약을 따릅니다. `init`은 제품 문맥 기록,
`shape`는 설계 브리프와 확인, `critique`는 독립 평가·보고서·조건부 질문을 포함하므로
일상 구현에 자동으로 끼워 넣지 않습니다. 기존 정본과의 관계를 확인하지 않고 제품 문서를
복제·대체하지 않으며, 실행 조건이 부족하면 정식 명령 완료라고 보고하지 않습니다.
하위 세션에서 추가 위임이 필요한 명령은 해당 세션의 중첩 제약도 확인해야 합니다.

OpenCode용 자동 편집 훅은 이번 설치에서 제공되지 않았습니다. 다른 클라이언트의 훅을
OpenCode 훅으로 간주하거나 KSI 훅·래퍼·자동 명령 체인을 추가하지 않습니다.
효과는 실제 제품 작업에서 업무 적합성·결함 해결·전체 시간·모델 비용·사용자 개입으로
판단하며, 이번 detector 검증은 격리된 fixture의 기능 확인이지 제품 UX 개선 실험은 아닙니다.

[MIT](LICENSE) — Copyright (c) 2026 KSI
