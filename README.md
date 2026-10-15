# KSI OpenCode Harness

실제로 사용하는 **OpenCode Native 전역 하네스의 정본과 배포 파일**을 관리합니다.
별도 실행 프레임워크·설치기·자동 재개 플러그인은 제공하지 않습니다.

## 에이전트에게 설치 요청하기

아래 프롬프트를 **파일 수정·명령 실행이 가능한 에이전트**에게 전달하세요.
KSI 파일은 이 저장소에서 적용하고, 외부 스킬은 공식 출처에서 설치합니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.
1. OS·실제 전역 경로·기존 설치·Node.js·브라우저를 확인하고,
   기존 파일을 백업한 뒤 관련 항목만 병합해줘. 개인 설정·자격증명·다른 도구는
   보존하고, 같은 이름의 사용자 정의와 충돌하면 필요한 선택만 질문해줘.
2. global/AGENTS.md, global/agents/design-specialist.md, global/opencode.jsonc를
    전역에 적용하고 필요한 환경별 경로 차이를 보고해줘.
    global/plugins/ksi-impeccable-detector/도 전역 plugins/에 적용해줘.
    OpenCode V2가 자동 발견하므로 중복 plugins 등록이나 npm 설치는 하지 마.
   프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
3. 기존 설치를 확인하고 필요하면 공식 Impeccable 4.5.2를 설치해줘:
   npx --yes impeccable@4.5.2 install --providers=opencode --scope=global --no-hooks
   Intent는 아래 공식 1.7.1 출처에서 journey·organize·wireframe만 전역 설치하고,
   각 스킬의 원본 참고 자료도 보존해줘. --all·6개 에이전트·추가 훅은 설치하지 마.
   기존 스킬·전역 lock을 확인하고 충돌이 없을 때 아래 선택 설치 명령을 적용해줘.
   원본 수정·강제 덮어쓰기·init·프로젝트 문서 생성·타 클라이언트 훅·목록 외 스킬
   추가는 하지 마. 제품 코드·데이터와 다른 세션·서비스도 변경하지 마.
4. OpenCode Go·OpenAI 모델 접근과 Mobbin·Context7 인증을 확인해줘.
   필요한 구독·인증만 안내하고, 비밀값을 채팅·저장소에 기록하거나
   비용이 다른 모델로 임의 대체하지 마. OAuth는 사용자가 /mcps에서 진행하게 해줘.
5. 실제 에이전트·모델·MCP·impeccable 및 Intent 3개 스킬 인식과 참고 자료를 확인하고 임시 fixture에서
    detect와 변경 파일 자동 검사 훅을 검증해줘. 적용 완료·인증 대기·실패를 구분하고,
   설치한 Git 커밋·외부 도구 버전·환경별 차이를 보고해줘.
```

이 안내는 전역 핵심 구성·공식 Impeccable·선택한 Intent 3개 스킬을 재현하는 범위입니다.
현재 운영자의 모든 스킬을 동일하게 복제하는 설치는 아닙니다.
OpenCode Go·OpenAI·Mobbin 이용 권한과 Context7 자격증명은 사용자별로 준비해야 합니다.

| 외부 구성 | 설치 출처·기준 |
| --- | --- |
| Impeccable | [공식 저장소](https://github.com/pbakaus/impeccable), [npm 4.5.2](https://www.npmjs.com/package/impeccable/v/4.5.2) |
| Intent 선택 설치 | [공식 1.7.1](https://github.com/ghaida/intent/tree/v1.7.1), `journey`·`organize`·`wireframe`과 각 원본 참고 자료만 설치 |
| Playwright MCP | [공식 저장소](https://github.com/microsoft/playwright-mcp), `global/opencode.jsonc`의 `0.0.83` 명령으로 OpenCode가 시작 |
| Mobbin·Context7 | `global/opencode.jsonc`의 공식 서비스에 연결, 사용자별 인증 필요 |

Intent 선택 설치 명령(POSIX 셸 기준):

```sh
DO_NOT_TRACK=1 npx -y skills@1.7.2 add https://github.com/ghaida/intent/tree/v1.7.1 --skill journey --skill organize --skill wireframe -g -a opencode -y --copy
```

현재 공식 CLI는 이 3개를 `~/.agents/skills/`에 설치하며, OpenCode가 전역 호환 소스로 인식합니다.
공유 스킬 위치와 `~/.agents/.skill-lock.json`의 기존 항목을 보존하고 중복 설치하지 않습니다.
Intent 원본은 이 저장소에 복제하지 않습니다. `wireframe`의 CSS·JS·스타일가이드도 원본과 함께 설치합니다.

## 전역 정본과 적용 위치

| 저장소 정본 | 전역 적용 위치 | 내용 |
| --- | --- | --- |
| [global/AGENTS.md](global/AGENTS.md) | `~/.config/opencode/AGENTS.md` | 제품 완성·질문·위임·검증 기준 |
| [global/agents/design-specialist.md](global/agents/design-specialist.md) | `~/.config/opencode/agents/design-specialist.md` | 디자인 역할·모델·브라우저 권한 |
| [global/opencode.jsonc](global/opencode.jsonc) | `~/.config/opencode/opencode.jsonc` | Native 역할 라우팅·모델 요청 설정·MCP·출력·문맥 설정 |
| [global/plugins/ksi-impeccable-detector/](global/plugins/ksi-impeccable-detector/) | `~/.config/opencode/plugins/ksi-impeccable-detector/` | 허용된 UI 편집 뒤 원본 엔진의 제한된 소스 검사 |

**정본 수정 → 전역 반영 → 검증 → 커밋·푸시**로 관리합니다.
Clone/pull만으로 전역에 자동 적용되지는 않습니다. 기존 설정이 있는 환경에서는
관련 항목만 병합하고 프로젝트에 공통 지침을 중복 삽입하지 않습니다.

현재 환경과 배포 정본의 일치는 다음과 같이 확인할 수 있습니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/design-specialist.md ~/.config/opencode/agents/design-specialist.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
diff -r global/plugins/ksi-impeccable-detector ~/.config/opencode/plugins/ksi-impeccable-detector
```

Context7 자격증명은 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키를 저장소에 넣지 않습니다.
계정·OAuth 토큰·서비스 상태·세션·개인 `cli.json`·도구별 독립 스킬은 배포 사본에 포함하지 않습니다.
Playwright MCP가 자동으로 이름을 붙이는 캡처·로그는 `/tmp/opencode/playwright-artifacts`에 저장합니다.

제품별 요구사항과 검증은 해당 프로젝트의 기존 문서·테스트·CI에서 관리합니다.
실행·설정·권한은 [OpenCode V2 공식 문서](https://opencode.ai/v2/docs/)를 따릅니다.

## 작업 구조

기본은 OpenCode Native 세션·계획·대화 이력·compaction입니다. 계획·체크포인트의 고정 경로나
새 관리 파일을 의무화하지 않고 기존 프로젝트 관례를 따릅니다. 하네스 절차는 실제 세션 기록에서
문제가 반복됨을 확인한 경우에만 최소한으로 개선하며, 추측만으로 별도 관리 체계를 추가하지 않습니다.

Build가 전체 개발·통합을 맡고, General·Explore로 독립 작업을 분리합니다.
Plan은 미결정 설계 대안이나 큰 호환성 위험에 대한 선택형 자문입니다.
필수 선행 단계나 승인 게이트가 아니며, 결과를 받은 같은 Build 세션이 판단·구현을 계속합니다.
주요 UI/UX는 Design Specialist가 조사·판단·구현·렌더 검증까지 담당하며,
Build에서 위임하거나 사용자가 메인으로 직접 선택할 수 있습니다.
승인 범위의 전체 완료와 유효한 검증 결과 재사용 기준은 [전역 지침](global/AGENTS.md)이 정본입니다.
마일스톤·커밋·검사 통과는 중간 보고입니다. 승인된 실행 가능한 잔여 작업이 있으면
"계속/다음 진행"을 다시 요구하지 않고 다음 도구 실행으로 이어갑니다. 최종 보고 전에는 실제 결과와
완료·실제 blocker·미승인 범위를 대조하며 기존 원장이 있으면 참고합니다. 새 범위·비용·보안 결정의 승인은 그대로 유지합니다.
이 기준은 모델의 종료 판단 지침이지 자동 재개 장치가 아닙니다. 종료된 턴에 프롬프트를 자동 투입하거나,
이미 승인된 작업을 다시 승인받는 절차·새 원장·모델 강제 교체는 추가하지 않습니다.

종료 판단 회귀 검사는 `node --test tests/completion-guidance.test.mjs`로 확인합니다.
`node tests/completion-guidance-live.mjs --phase after --case all`은 **선택형 실모델 검사**입니다:
현재 연결된 OpenCode Go의 `deepseek-v4.1-flash#max`를 사용하고 계정 사용량을 소비합니다.
고유한 `/tmp/opencode` 작업 공간에서 중간 완료 후 계속 실행·외부 blocker와 독립 작업·범위 경계를 확인하며,
케이스당 사용자 프롬프트는 한 번만 보냅니다. `--phase`는 증빙 구분용이며 적용된 지침 버전을 바꾸지 않습니다.
작은 fixture의 통과는 긴 프로젝트에서 같은 문제가 재발하지 않는다는 증거가 아닙니다.
2026-10-15 확인에서는 기존·수정 지침 모두 3/3 완주했습니다. 수정 후 검사는 시험용 권한도 좁혔으므로
기능 회귀 확인으로만 해석하며, 지침 변경의 개선 효과나 긴 세션 문제 해결을 입증한 A/B 결과로 보지 않습니다.

자식 세션의 Native 브라우저는 데스크톱 연결이 필요하며, 연결되지 않으면 기존 Playwright를 사용할 수 있습니다.

## 선택형 디자인 도구

| 필요한 것 | 선택할 수단 |
| --- | --- |
| 실제 제품 패턴 비교 | 기존 제품 패턴, 필요할 때 Mobbin |
| 구현 문법·라이브러리 정보 | Context7 |
| 실제 동작·화면·관련 상태 확인 | 연결된 Native 브라우저 또는 기존 Playwright |
| 한정된 코드·렌더 결함 검사 | Impeccable standalone `detect` |
| 특정 디자인 개선·정식 비평 | 원본 Impeccable의 해당 스킬 명령 |
| 핵심 업무 흐름·중단·복귀 설계 | 필요할 때 Intent `journey` |
| 메뉴·분류·검색·정보 탐색 구조 | 필요할 때 Intent `organize` |
| 별도 화면 구조 대안·클릭 프로토타입 비교 | 필요할 때 Intent `wireframe` |

위 표는 필수 실행 순서가 아닙니다. 작은 수정에는 불필요한 조사·검사를 생략하고,
중요한 구조 변경은 사용자 업무·상태·제약을 기준으로 판단합니다.

Impeccable은 [원본 명령과 설치 안내](https://github.com/pbakaus/impeccable)를 따르며,
스킬·엔진을 이 저장소에 복제하거나 수정하지 않습니다. 명령별 질문·기록·위임 조건은 원본에서 확인하세요.
검사 통과나 참고 사례만으로 전체 사용성이 검증됐다고 판단하지 않습니다.

Intent는 기존 Design Specialist가 사용하는 선택형 방법론입니다. 전체 스킬·에이전트 체인이나
필수 선행 단계는 추가하지 않습니다. 기존 제품 문맥·기획·검증 결과를 재사용하며,
작은 UI 수정에는 생략합니다. 와이어프레임의 회색 키트·다이어그램 스타일을 제품 디자인으로 옮기지 않습니다.
색상·타이포·시각적 구현은 Impeccable과 제품의 디자인 체계를 따르고 실제 렌더로 확인합니다.
React/Next.js 구현에는 사용자가 설치한 Vercel React Best Practices를 참고할 수 있습니다.
Build 전용으로 제한하지 않으며, 해당 코드를 작성하는 Design Specialist도 활용합니다.

사용 예: “주문 취소 흐름을 `@journey`로 점검해줘”, “관리자 메뉴를 `@organize`로 재구성해줘”,
“구조 대안 두 가지를 `@wireframe`으로 HTML 비교해줘”. 각 원본 스킬의 질문·산출물 조건을 따릅니다.
설치·인식 확인은 실제 사용성·시각 품질 개선의 입증이 아니며, 우선 실제 흐름 하나에서 효과와 작업 부담을 비교합니다.

## 변경 파일 자동 검사

공식 Impeccable 4.5.2는 OpenCode 자동 훅을 배포하지 않습니다. 이 저장소의 작은
Native V2 플러그인(`ksi.impeccable-detector`)이 성공한 `write`·`edit`·`patch` 뒤
변경된 UI 소스를 검사하고 기존 도구 결과에 검사 요약을 덧붙입니다.
원본 스킬·엔진은 수정하지 않으며 자동 수정·모델 재호출·검사 결과에 따른 작업 차단은 없습니다.

- 세션 디렉터리 안의 UI 파일만 대상으로 하고, 삭제·비 UI·숨김·의존성·생성 파일은 제외합니다.
  대상 확장자는 CSS·SCSS·SASS·LESS·HTML·HTM·JSX·TSX·Vue·Svelte·Astro이며, 일반 JS·TS는 제외합니다.
- 읽기와 엔진 실행은 Native 권한을 확인합니다. 별도 허용 규칙을 추가하거나 거부를 우회하지 않습니다.
- 이미 설치된 플랫폼 엔진만 사용합니다. 누락·실패·시간 초과는 검사 불가로 표시하며 다운로드하지 않습니다.
- 허용된 파일의 복사본만 격리 검사합니다. HTML도 연결된 CSS를 따라가지 않는 정규식 검사입니다.
  프로젝트 설정·디자인 시스템은 읽지 않으며 URL·렌더·전체 프로젝트 검사는 자동 실행하지 않습니다.
  `--no-config` 검사이므로 프로젝트의 무시 설정도 적용되지 않습니다. 경고는 맥락을 보고 판단합니다.
- 세션·에이전트·내용·엔진이 같은 경우 유효한 검사 결과를 재사용합니다.
  파일당 512 KiB·엔진 실행 1.5초(종료 정리 별도), 편집당 최대 8파일·6초 검사 예산으로 제한하며 대기열을 쌓지 않습니다.
  한도 초과·동시 검사 중 생략은 결과에 표시합니다. 쉘 명령·외부 편집기는 이 훅의 범위 밖입니다.

검증 환경은 OpenCode **2.0.29 / Linux arm64**입니다. 다른 OS는 별도 확인이 필요합니다.
플러그인 의존성은 OpenCode 런타임이 제공하므로
이 폴더에서 `npm install`하지 않습니다. 비활성화는 프로젝트 또는 전역 설정의
`plugins` 목록에 `"-ksi.impeccable-detector"`를 추가하면 됩니다.
전역 자동 재로딩을 확인하고, 다른 세션이 실행 중이면 서비스를 임의 재시작하지 않습니다.

검증 명령:

```sh
node --test tests/core.test.mjs tests/adapter.test.mjs
node tests/native-hook-integration.mjs
```

Native 통합 검사는 고유한 임시 HOME·별도 포트·로컬 모의 모델을 사용하며 실제 모델 비용이 들지 않습니다.
임시 증빙은 `/tmp/opencode/ksi-native-*`에 남기고, 기존 폴더를 지우거나 공유 서비스를 재시작하지 않습니다.

[MIT](LICENSE) — Copyright (c) 2026 KSI
