# 설치 안내

이 저장소는 개인 전역 OpenCode 환경에 자동 설치되지 않습니다. 설치 전 대상 환경과 기존 파일을 확인하고, 사용자 설정과 자격증명을 보존하면서 관련 항목만 적용하세요.

## 배포 구성과 적용 후 흐름

배포 정본은 `global/`입니다. README·이 문서는 사용법과 적용 절차를 설명하며, 실행 시 별도 워크플로 엔진을 설치하지 않습니다.

```text
Build — 제품 목표·통합·최종 인수
 ├─ Plan — 기술 자문·방향 점검 (+ Explore 조사)
 ├─ UI/UX Critic — 필요한 최종 UI 비평(별도 세션)
 └─ Design Architect — 맡은 UI 개선 단위 조율
      ├─ UX Scout — 사례 조사·실제 과업 관찰
      ├─ UI/UX Critic — 설계 전제·실제 렌더 비평
      ├─ Explore — 코드 탐색
      └─ General — 구현·검증·수정
            ↕ Architect의 실제 렌더 재평가·교정
```

이 트리는 작업별 선택 사항입니다. Build는 General 등도 직접 호출할 수 있고, 작은 수정은 직접 처리합니다. UI 중심 작업에서는 Architect를 메인으로 선택할 수도 있습니다. 메인 책임자는 한 명이며, 중첩 허용은 매 단계의 사용자 승인이나 자동 맥락 상속을 뜻하지 않습니다.

설치·업데이트는 다음을 하나의 구성으로 적용해야 합니다.

1. **공통 지침:** 제품 목표·원문/가설 구분·위임·증거·인수 원칙.
2. **커스텀 역할 3개:** Architect는 설계·작업자 조율·재평가, Scout는 조사·실제 조작 관찰·원본 인계, Critic은 독립 UI/UX 비평. General·Explore·Plan은 Native 역할을 재사용합니다.
3. **설정 병합:** `experimental.subagent_depth=2`, Build·Plan 호출 허용 목록, 역할 모델(Plan=`openai/gpt-6.1-sol#xhigh` 포함)·MCP 설정. Architect의 호출 권한은 Markdown 역할 파일에 있습니다.
4. **기존 도구 재사용:** 브라우저·선택 스킬·소스 검사 플러그인. 키·OAuth 토큰·유료 구독은 사용자별이며 복사하지 않습니다.
5. **결과 확인:** 아래 파일 일치와 등록/권한 조회를 확인하고, 미확인·인증 대기·실패를 구분합니다. 설치 확인만으로 실제 디자인 품질이나 스킬 활용 능력을 인증하지 않습니다.

배포 기본 모델은 Architect=`openai/gpt-6.1-sol#high`, Critic=`opencode-go/muse-spark-1.3-contributor#xhigh`, Scout=`opencode-go/muse-spark-1.3-contributor#high`, Plan=`openai/gpt-6.1-sol#xhigh`, General=Muse Contributor High, Explore=Muse Contributor Low입니다. Build는 세션 선택을 따르고 전역 모델을 고정하지 않습니다. 모델 미지정 하위 역할은 부모 모델을 상속하므로, 자문·비평 역할에는 배포 선호 모델을 명시합니다. Scout는 이미지·사용 흐름의 맥락 판단을 고려해 `high`를 기본으로 권고하며, Critic의 `xhigh`는 유지합니다. 이는 medium/high의 실측 비교 결과가 아닙니다. 역할·모델 분리가 더 좋은 비평을 보장하지는 않습니다. 모델을 임의 대체하지 말고 사용 가능한 제공 경로를 확인하세요. 자세한 책임·모드·호출 범위는 [README](../README.md#역할과-위임-구조)에 있습니다.

스킬 원본은 이 저장소의 배포 파일에 포함되지 않습니다. 기존 스킬을 재사용하고, 필요한 외부 스킬은 아래 공식 출처와 실제 설치 경로를 확인합니다. 특히 Mobbin MCP 연결과 `mobbin-design` 스킬, Playwright 실행 파일과 `playwright-cli` 스킬은 각각 별개입니다. Scout의 스킬 허용 목록은 설치기가 아니므로, 누락된 스킬은 미설치로 보고하고 임의로 새 스킬을 만들거나 추가 패밀리 전체를 설치하지 않습니다. Vercel React Best Practices·Motion 등 선택 스킬도 설치돼 있는 경우에 사용합니다.

## 적용 파일

| 저장소 파일 | 전역 적용 위치 | 용도 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 작업·완료 지침 |
| `global/agents/design-architect.md` | `~/.config/opencode/agents/design-architect.md` | Design Architect 역할·권한 (`openai/gpt-6.1-sol#high`, `mode: all`) |
| `global/agents/ux-scout.md` | `~/.config/opencode/agents/ux-scout.md` | UX Scout 선택형 하위 조사 (`opencode-go/muse-spark-1.3-contributor#high`, subagent) |
| `global/agents/ui-ux-critic.md` | `~/.config/opencode/agents/ui-ux-critic.md` | 선택형 UI/UX 비평 (`opencode-go/muse-spark-1.3-contributor#xhigh`, subagent) |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 에이전트 설정·MCP 연결 등 |
| `global/plugins/ksi-impeccable-detector/` | `~/.config/opencode/plugins/ksi-impeccable-detector/` | 제한된 UI 소스 검사 플러그인 |

## 에이전트 이름 변경 (design-specialist → design-architect)

`design-architect`(`openai/gpt-6.1-sol#high`, `mode: all`)가 기존 `design-specialist` 자리를 대체하고, `ux-scout`(`opencode-go/muse-spark-1.3-contributor#high`, subagent, 선택형)를 함께 적용합니다. Scout는 넓은 관찰·문제 후보·Mobbin/외부 참고와 원본 근거를 넘기며 설계 승인·제품 코드 작성·완료 인수는 하지 않습니다. 제품 편집·추가 위임·임의 Shell은 거부하고, 필요한 읽기·웹·Browser·Code Mode·명명된 Playwright 검사 명령과 Mobbin 검색 3개만 허용합니다. 브라우저·CLI는 읽기 전용 샌드박스가 아니며, 테스트 환경·계정과 지정 산출물 위치가 필요합니다. [실제 권한·실행 검증 범위](validation.md#역할-구조-변경-2026-10-17)

Scout CLI는 `ux-scout-*` 임시 세션에서 `open <url>` 또는 `open` → `goto <url>`, 입력·선택·체크·히스토리 이동을 허용합니다. 다른 세션 연결·인증 상태 가져오기·영구/사용자 프로필·임의 스크립트·전역 종료는 허용하지 않습니다. 기존 Playwright CLI를 재사용하며 `agent-browser` 추가 설치는 필요하지 않습니다. 권한과 Native Browser의 실제 세션 연결은 별개입니다.

- 같은 이름의 사용자 정의 역할이 있으면 덮어쓰지 말고 백업한 뒤 필요한 선택만 질문합니다.
- 은퇴한 같은 출처 에이전트 파일(`design-specialist.md`)은 발견되는 `agents/` 밖에 보관·이동하고, Architect·Scout 파일을 적용합니다. 현행 Critic은 아래 추가 절을 따릅니다. 발견 디렉터리에 이전 ID의 별칭·복사본을 남기지 않습니다.
- 기존 세션의 선택·저장된 모델은 자동 이전되지 않으므로, 새 작업부터 새 ID·모델을 선택합니다.

## 선택형 UI/UX Critic 추가

`ui-ux-critic`은 전역 공통 역할이며 특정 프로젝트 전용이 아닙니다. Scout는 이름·모델·실제 관찰 능력을 유지합니다. Critic은 실제 과업·원본 렌더·관련 조작을 근거로 설계 전제를 비평하고, 제품 코드·보고서 편집이나 최종 제품 인수는 하지 않습니다. 시안 비평과 실제 제품 검증은 구분합니다.

새 파일을 설치하기 전에 같은 ID의 기존 사용자 정의가 있는지 확인합니다. Build의 JSONC 호출 허용과 Architect의 Markdown 호출 허용에 `ui-ux-critic`을 함께 반영해야 합니다. `Build → Architect → Critic`은 기존 깊이 2 안에 있으며, Critic은 추가 위임하지 않고 Architect 자기 호출 금지도 유지합니다. 새 최종 UI 검토는 설계·교정에 참여하지 않은 세션에 맡깁니다. 필수 시안·점수표·고정 검수 횟수는 없습니다.

Critic의 CLI는 `ux-critic-*` 고유 세션의 지정 탐색·입력·캡처 명령만 허용합니다. 임의 Shell·설치·서버 기동·프로필/인증 상태 가져오기·업로드·전역 종료는 거부하며, 스킬은 기존 `playwright-cli`와 자체 `task-first-ux-review`만 허용합니다. Browser·Code Mode·CLI 허용은 읽기 전용 샌드박스가 아니므로 승인된 테스트 환경·계정·상태 전이를 제공해야 합니다. 기존 세션·서비스를 재시작하거나 다른 프로젝트에 파일을 주입하지 않습니다. [검증 범위](validation.md#선택형-uiux-critic-전역-추가-2026-10-24)

## 프로젝트 정본 진입 지도

각 프로젝트에는 현행 정본을 가리키는 **진입 지도 1개**(보통 프로젝트 `AGENTS.md`의 문서 지도 표)만 권고합니다. 형식·파일명·문서 수는 강제하지 않으며, 내용은 다음이면 충분합니다. 현행 정본 목록, 상태 어휘(구현/검증/인수 구분), 역사는 추가만 하고 고치지 않기.

하네스가 요구하는 것은 "지도가 있고 최신인가"뿐입니다. 세션이 새 프로젝트에 들어갈 때 이 지도부터 읽고, 지도와 어긋난 스킬 생성 맥락(`PRODUCT.md`·`DESIGN.md` 등)을 현행으로 착각하지 않습니다.

```sh
cmp global/agents/design-architect.md ~/.config/opencode/agents/design-architect.md
cmp global/agents/ux-scout.md ~/.config/opencode/agents/ux-scout.md
cmp global/agents/ui-ux-critic.md ~/.config/opencode/agents/ui-ux-critic.md
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
diff -r global/plugins/ksi-impeccable-detector ~/.config/opencode/plugins/ksi-impeccable-detector
```

## 설치 요청 프롬프트

파일을 수정하고 명령을 실행할 수 있는 에이전트에게 다음 요청을 전달할 수 있습니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.
1. OS·실제 전역 경로·기존 설치·Node.js·브라우저를 확인하고,
   기존 파일을 백업한 뒤 관련 항목만 병합해줘. 개인 설정·자격증명·다른 도구는
   보존하고, 같은 이름의 사용자 정의와 충돌하면 필요한 선택만 질문해줘.
2. global/AGENTS.md, global/agents/design-architect.md, global/agents/ux-scout.md,
   global/agents/ui-ux-critic.md, global/opencode.jsonc를
   전역에 적용하고 필요한 환경별 경로 차이를 보고해줘. 은퇴한 design-specialist.md는
   agents/ 밖에 보관·이동하고, 같은 이름의 사용자 정의와 충돌하면 덮어쓰지 말고
   백업 뒤 필요한 선택만 질문해줘. 기존 세션은 자동 이전되지 않으니 새 작업부터 새 ID·모델을 써줘.
   global/plugins/ksi-impeccable-detector/도 전역 plugins/에 적용해줘.
    OpenCode V2가 자동 발견하므로 중복 plugins 등록이나 npm 설치는 하지 마.
    프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
   experimental.subagent_depth=2와 Build/Plan의 subagent 허용 목록을 관련 설정과 함께 병합하고,
   Build/Architect가 ui-ux-critic을 직접 호출할 수 있게 JSONC/Markdown 권한도 적용해줘.
   Critic은 하위 전용·추가 위임 금지이며 Architect 자기 호출 금지를 유지해줘.
    기존 프로젝트별 제약이 충돌하면 덮어쓰거나 제한을 우회하지 말고 그 충돌을 보고해줘.
3. 기존 Impeccable 설치를 확인하고, 새 설치나 명시적 갱신이 필요할 때만
   공식 npm `latest` 태그를 사용해줘. 명령은 다음과 같아:
   npx --yes impeccable@latest install --providers=opencode --scope=global --no-hooks
   실제로 해결된 버전과 공식 출처를 기록하고 detect와 Native 연동을 검증해줘.
   기존 설치가 확인한 latest와 같으면 재사용해줘. 갱신은 새 설치·명시적 요청에만 하고,
   최신 배포본의 훅 지원은 실제로 확인해줘.
   Intent는 아래 공식 1.7.1 출처의 journey·organize·wireframe과 원본 참고 자료만
   선택 설치해줘. 기존 스킬·전역 lock·원본을 보존하고 충돌 시 덮어쓰지 말고 질문해줘.
   추가 에이전트·훅·목록 외 스킬과 프로젝트 초기화는 설치 범위가 아니야.
   제품 코드·데이터와 다른 세션·서비스는 그대로 보존해줘.
4. 연결된 데스크톱에서는 Native Browser, 연결되지 않은 자식·헤드리스 환경이나 반복 자동화에는
   Playwright CLI를 사용할 수 있게 확인해줘. 기존 CLI·Chrome·원본 playwright-cli 스킬을 재사용하고,
   CLI가 없을 때만 공식 @playwright/cli@0.1.22 설치를 검토해줘. 프로젝트 init이나 테스트 의존성
   교체는 하지 말고 Playwright MCP·agent-browser를 기본 도구로 추가하지 마.
5. OpenCode Go·OpenAI 모델 접근과 Context7 인증을 확인해줘.
   Mobbin은 유료 선택 사항이라 필수가 아니야. 사용자가 쓰길 원할 때만 인증하고,
   아니면 비활성(`"enabled": false`)으로 두거나 건너뛰어도 돼. 필요한 구독·인증만 안내하고,
   비밀값을 채팅·저장소에 기록하거나 비용이 다른 모델로 임의 대체하지 마.
   OAuth는 사용자가 /mcps에서 진행하게 해줘.
6. 실제 에이전트·모델·MCP·impeccable 및 Intent 3개 스킬 인식과 참고 자료를 확인하고 임시 fixture에서
   detect와 변경 파일 자동 검사 훅을 검증해줘. 적용 완료·인증 대기·실패를 구분하고,
   설치한 Git 커밋·외부 도구 버전·환경별 차이를 보고해줘.
```

## 외부 도구 출처

| 도구 | 공식 출처와 설치 범위 |
| --- | --- |
| Impeccable | [공식 저장소](https://github.com/pbakaus/impeccable), [npm 패키지](https://www.npmjs.com/package/impeccable). 전역 OpenCode 설치 시 공식 npm `latest`를 확인합니다. 2026-10-15 확인 당시 `latest`와 현재 설치본은 [4.5.2](https://www.npmjs.com/package/impeccable/v/4.5.2)였으며, 이 버전은 고정 요구가 아닙니다. |
| Intent | [공식 v1.7.1](https://github.com/ghaida/intent/tree/v1.7.1)에서 `journey`·`organize`·`wireframe`과 각 스킬의 원본 참고 자료만 선택 설치합니다. |
| Playwright CLI | [공식 저장소 및 원본 스킬](https://github.com/microsoft/playwright-cli). 기존 `@playwright/cli` 0.1.22를 재사용하며, Playwright MCP는 기본 구성에서 제거했습니다. |
| Context7 | [Context7](https://mcp.context7.com/mcp) 원격 서비스에 연결합니다. 사용자별 계정 인증이 필요합니다. |
| Mobbin(선택) | [Mobbin](https://api.mobbin.com/mcp)은 유료 서비스라 **선택 사항**입니다. 쓰지 않으면 비활성(`"enabled": false`)으로 두거나 항목을 지워도 하네스는 동작합니다. |

Mobbin을 쓸 때만 인증하고, 필요 없으면 건너뜁니다. 설정 입력에서는 `"enabled"` 값을 사용합니다.

Intent 선택 설치 명령(POSIX 셸):

```sh
DO_NOT_TRACK=1 npx -y skills@1.7.2 add https://github.com/ghaida/intent/tree/v1.7.1 --skill journey --skill organize --skill wireframe -g -a opencode -y --copy
```

현재 공식 CLI는 선택한 세 스킬을 `~/.agents/skills/`에 설치하며 OpenCode가 전역 호환 소스로 인식합니다. 공유 스킬 위치와 `~/.agents/.skill-lock.json`의 기존 항목을 보존하고 중복 설치하지 않습니다. 저장소는 Intent 원본을 복제하지 않으며 `wireframe`의 CSS·JS·스타일가이드도 원본과 함께 설치합니다.

하네스 자체 방법론 `task-first-ux-review`는 외부 원본이 아니라 저장소 `skills/`가 정본이며, `~/.agents/skills/`에 복사해 사용합니다. 외부 스킬과 달리 버전 핀이 없으므로 변경 시 저장소 커밋으로 추적합니다.

## 전역 파일 일치 확인

적용 후 저장소 파일과 전역 파일을 비교하려면 다음 명령을 사용합니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/design-architect.md ~/.config/opencode/agents/design-architect.md
cmp global/agents/ux-scout.md ~/.config/opencode/agents/ux-scout.md
cmp global/agents/ui-ux-critic.md ~/.config/opencode/agents/ui-ux-critic.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
diff -r global/plugins/ksi-impeccable-detector ~/.config/opencode/plugins/ksi-impeccable-detector
```

중첩 위임 허용치 `experimental.subagent_depth=2`(기본값 1)는 전역 설정이 소유합니다. 저장소 `global/opencode.jsonc`와 설치본의 일치는 위 `cmp`로 확인하고, 선언값은 `node tests/agent-routing-native.mjs`가 현재 로드된 설치 위치에서 검사합니다(콜드 위치 탐색·준비 검사가 아님). 깊이는 최대 허용치이며 매번 깊은 트리를 강제하지 않습니다. 실제 2단계 중첩 실행의 근거와 미검증 범위: [검증 안내](validation.md#역할-구조-변경-2026-10-17)

Context7 키는 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키·OAuth 토큰·개인 `cli.json`은 저장소에 기록하지 않습니다. 필요한 서비스 인증은 사용자별로 진행하고, OAuth는 사용자가 OpenCode의 `/mcps`에서 처리합니다. 구성·서비스 상태·독립적인 개인 스킬은 전역 설정 사본에 포함되지 않습니다.

등록·연결 문제가 의심되면 이 저장소에서 `node scripts/capabilities.mjs`로 [선택 진단](validation.md#능력-연결-진단)을 실행할 수 있습니다. 이 유틸리티는 전역 플러그인이 아니며 설치·자동 복구를 수행하지 않습니다.
