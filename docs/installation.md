# 설치 안내

이 저장소는 개인 전역 OpenCode 환경에 자동 설치되지 않습니다. 설치 전 대상 환경과 기존 파일을 확인하고, 사용자 설정과 자격증명을 보존하면서 관련 항목만 적용하세요.

## 배포 구성과 적용 후 흐름

배포 정본은 `global/`입니다. README·이 문서는 사용법과 적용 절차를 설명하며, 실행 시 별도 워크플로 엔진을 설치하지 않습니다.

```text
Build — depth 0 · 제품 실행 총괄·통합·인수
 ├─ Engineer — depth 1 · 기술 개발 단위 완결
 │    ├─ General — depth 2 · 구현·테스트·수정
 │    └─ Plan — depth 2 · 중요한 방향·기술 계약 자문
 │         └─ Explore — depth 3 · 코드 탐색
 ├─ Design — depth 1 · UX 단위 구현·렌더 교정
 │    └─ General — depth 2 · UI 구현
 └─ Critic — depth 1 · 필요한 독립 비평
```

위 트리는 가능한 경로의 예시이지 관계·순서가 고정된 파이프라인이 아닙니다. 보통 깊이 1~2를 사용하고 유용한 필요가 있을 때만 3을 사용합니다. Build는 General·Design·Research 등을 직접 호출할 수도 있고 작은 수정은 직접 처리합니다. Design이 메인이면 Engineer·Research·Critic 등을 직접 사용합니다. 각 부모가 자식의 결과를 해석·통합하고, 메인은 승인된 결과를 책임집니다. 깊이·폭을 채우기 위한 위임은 하지 않습니다.

설치·업데이트는 다음을 하나의 구성으로 적용해야 합니다.

1. **공통 지침:** 제품 목표·원문/가설 구분·위임·증거·인수 원칙.
2. **기본 커스텀 역할 4개:** Engineer는 기술 단위 구현·검증·개선, Design은 UI/UX 설계·구현 조율·렌더 교정, Research는 심층 근거·대안 조사, Critic은 제품·UX·코드·기술 설계의 독립 비평. Native Build·Plan·General·Explore 프롬프트와 이름은 유지합니다. Architect 파일은 원본 바이트 그대로 발견 경로 밖 `docs/archive/agents/architect.md`에 보존하며 최종 폐기를 유보합니다.
3. **설정 병합:** `experimental.subagent_depth=3`, Build·Plan의 호출 허용 목록, 모델·MCP 설정. 커스텀 역할의 호출 권한은 Markdown 파일에 있습니다. Plan의 Native 프롬프트와 일반 파일 편집 제한은 유지합니다.
4. **기존 도구 재사용:** 브라우저·선택 스킬·소스 검사 플러그인. 키·OAuth 토큰·유료 구독은 사용자별이며 복사하지 않습니다.
5. **결과 확인:** 아래 파일 일치와 등록/권한 조회를 확인하고, 미확인·인증 대기·실패를 구분합니다. 설치 확인만으로 실제 디자인 품질이나 스킬 활용 능력을 인증하지 않습니다.

배포 정본의 모델은 [README 표](../README.md#역할과-위임-구조)를 따르며 [실제 가용성·정책·검증 상태](engineer-routing-validation.md)를 별도로 확인합니다. Build는 세션 선택을 따르고 전역 모델을 고정하지 않습니다. Plan·Design은 `all`, Build는 `primary`, 나머지는 `subagent`입니다. 기존 세션의 역할·모델은 강제로 바꾸지 않습니다. 운영 역할은 `opencode-go/muse-spark-1.3-contributor`를 공통 사용하고 역할별 Variant만 조정합니다. Contributor 모델은 학습 사용 조건이 있으므로 비공개 코드·고객 데이터는 승인된 제공자 경로에만 전달합니다.

### 동적 호출과 승인 범위

Build·Plan·Engineer·Design은 각자의 허용 목록에서 필요한 전문가를 선택합니다. Engineer↔Design은 허용하되 동일 과업을 조상에게 되돌리지 않습니다. Research는 Explore를 호출할 수 있고 General·Explore·Critic은 말단입니다. 자기 호출·미등록 대상·Architect·하위 Build 호출은 허용하지 않습니다. 재위임은 남은 깊이 안에서만 가능하며 깊이 3에서는 허용 작업을 직접 수행하거나 부족한 전문 작업을 부모에게 반환합니다. 역할은 특정 깊이에 고정되지 않습니다.

**계획·분석만 승인됐다면 하위도 계획·분석만 수행해야 합니다.** Plan의 역할별 편집 거부는 하위 Design/General에 자동 상속되지 않습니다. 별개로 Native의 **세션별 제한 규칙**은 자식 생성 시 상속되므로 엄격한 분석 범위는 소유한 작업의 제한 세션이나 제한 실행환경에서 준비할 수 있습니다. Native session update는 규칙 배열을 교체하므로 기존 제한을 읽어 보존하고, 필요한 거부만 추가한 뒤 실제 도구·정책으로 효과를 확인합니다. 기존 자식에 소급 적용된다고 가정하거나 다른 작업의 세션 규칙을 바꾸지 않습니다. Plan 선택만으로 이 세션 제한을 자동 설치하는 플러그인은 추가하지 않습니다. 쉘·Browser·HTTP의 모든 효과를 막는 OS 샌드박스는 아니며 필요한 자원에는 별도 제한 환경·계정을 제공하고 위임으로 승인을 우회하지 않습니다. [Native 세션 규칙](https://opencode.ai/v2/docs/build/plugins#permissions)

병렬 단위는 파일·공유 상태·브라우저의 소유자를 분리하고 조사·원본 증거를 재사용합니다. 하위에 원요구·확정 계약·가설·대상 버전/환경·허용 자원·결과를 전달하며 각 부모가 자식 결과를 검토·통합합니다. 독립 비평은 해당 설계/구현에 참여하지 않은 세션에 맡깁니다. UI 교정용 Critic과 중요한 최종 Critic은 같은 역할의 다른 세션일 수 있으며 둘을 매번 호출하지 않습니다.

스킬 원본은 이 저장소의 배포 파일에 포함되지 않습니다. 기존 스킬을 재사용하고, 필요한 외부 스킬은 아래 공식 출처와 실제 설치 경로를 확인합니다. 특히 Mobbin MCP 연결과 `mobbin-design` 스킬, Playwright 실행 파일과 `playwright-cli` 스킬은 각각 별개입니다. Scout의 스킬 허용 목록은 설치기가 아니므로, 누락된 스킬은 미설치로 보고하고 임의로 새 스킬을 만들거나 추가 패밀리 전체를 설치하지 않습니다. Vercel React Best Practices·Motion 등 선택 스킬도 설치돼 있는 경우에 사용합니다.

## 적용 파일

| 저장소 파일 | 전역 적용 위치 | 용도 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 작업·완료 지침 |
| `global/agents/engineer.md` | `~/.config/opencode/agents/engineer.md` | 기술 단위 구현·검증 (`Muse Contributor High`, subagent) |
| `global/agents/research.md` | `~/.config/opencode/agents/research.md` | 심층 조사·비교·원본 근거 (`Muse Contributor High`, subagent) |
| `global/agents/design.md` | `~/.config/opencode/agents/design.md` | UI/UX 설계·구현 조율·렌더 교정 (`Muse Contributor High`, all) |
| `docs/archive/agents/architect.md` | 설치하지 않음 | 원본 보존, 이전 설치가 있으면 종료 확인 후 발견 경로 밖 보관 |
| `global/agents/critic.md` | `~/.config/opencode/agents/critic.md` | 범용 독립 비평 (`Muse Contributor XHigh`, subagent) |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 에이전트 설정·MCP 연결 등 |
| `global/plugins/ksi-impeccable-detector/` | `~/.config/opencode/plugins/ksi-impeccable-detector/` | 제한된 UI 소스 검사 플러그인 |

## 기존 역할에서 이전

| 이전 ID | 현재 ID와 변화 |
| --- | --- |
| `design-specialist` / `design-architect` | `design` — UI 단위 완결 책임·all 유지, 모델은 현행 표 참조 |
| `ux-scout` | `research` — UX 관찰을 보존하고 기술·제품 조사로 확대, Explore 추출 위임 허용 |
| `ui-ux-critic` / `product-reviewer` | `critic` — UI·제품 과업 검토를 통합하고 코드·아키텍처 비평까지 확대 |
| `architect` | 원본을 `docs/archive/agents/architect.md`에 보존·등록 제외. 일상적 설계는 Engineer, 중요한 독립 자문은 Plan. 최종 폐기 미결정 |
| 신규 | `engineer` — 독립 기술 개발 단위의 설계·구현·검증·재개선 소유자 |

같은 ID의 사용자 정의가 있거나 설치 파일이 배포 정본과 다르면 덮어쓰지 말고 충돌을 확인합니다. 같은 출처의 이전 파일은 백업 후 발견되는 `agents/` 밖에 보관하고, 새 네 파일·JSONC·공통 지침을 함께 적용합니다. 이전 ID를 새 작업용 별칭으로 계속 등록하지 않습니다. 진행 중인 이전 역할 세션을 강제 종료·전환하지 말고 은퇴 적용 시점을 조율합니다. 기존 세션의 선택·저장된 모델은 자동 이전되지 않으며 새 작업에서는 새 ID를 사용합니다. 다른 프로젝트의 설정·작업·서비스는 변경하지 않습니다.

### 전문 역할의 실행 경계

Research·Critic은 기본 거부 후 읽기·웹·Browser·Code Mode·Context7 문서 조회와 필요한 설치 스킬만 허용합니다. 제품/보고서 편집·임의 Shell·설치·서버·배포·자격증명 접근은 허용하지 않습니다. CLI는 각각 `research-*` / `critic-*` 고유 임시 세션에서 지정된 탐색·입력·캡처 명령만 허용합니다. `run-code/eval`, 사용자 config/profile, 영구 프로필, 다른 세션 연결, 인증 상태 가져오기, 업로드, 전역 종료는 거부합니다. Engineer·Design은 승인된 단위의 구현·테스트 권한을 갖습니다. Browser·execute·CLI는 읽기 전용 샌드박스가 아니므로 승인된 환경·계정·상태 전이를 제공합니다. 실제 도구의 실패나 없는 원본을 미검증으로 구분하고 권한을 우회하지 않습니다.

Critic은 직접 구현·설계 확정·로드맵·최종 인수를 소유하지 않습니다. 원요구·확정 계약·실제 빌드와 종단 과업을 검토하며, 자료/실행이 없으면 해당 범위를 미검증으로 반환합니다. 역할 이름이나 스킬 수가 전문성의 증거는 아니며, 대규모 외부 스킬 설치·평가 프레임워크·고정 승인 단계는 추가하지 않습니다. [현재 역할·검증 범위](validation.md#동적-8개-역할과-최대-깊이-3-2026-10-24)

## 프로젝트 정본 진입 지도

각 프로젝트에는 현행 정본을 가리키는 **진입 지도 1개**(보통 프로젝트 `AGENTS.md`의 문서 지도 표)만 권고합니다. 형식·파일명·문서 수는 강제하지 않으며, 내용은 다음이면 충분합니다. 현행 정본 목록, 상태 어휘(구현/검증/인수 구분), 역사는 추가만 하고 고치지 않기.

이 지도는 탐색 진입점이지 현재 상태나 올바른 판단의 증명은 아닙니다. 세션은 여기서 현행 요구·결정의 권위를 찾고, 작업 재개·통합·중요 결정에서는 관련 코드/미커밋 변경·실행 빌드·검증 근거를 필요한 범위에서 대조합니다. 스킬 생성 맥락(`PRODUCT.md`·`DESIGN.md` 등)이나 오래된 요약을 현행으로 착각하지 않으며, 코드가 다르다는 이유만으로 사용자 계약을 바꾸지도 않습니다. 별도 지도 양식·문서 수·매 작업 전체 재조사는 요구하지 않습니다.

```sh
cmp global/agents/research.md ~/.config/opencode/agents/research.md
cmp global/agents/engineer.md ~/.config/opencode/agents/engineer.md
cmp global/agents/design.md ~/.config/opencode/agents/design.md
cmp global/agents/critic.md ~/.config/opencode/agents/critic.md
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
2. global/AGENTS.md, global/agents/research.md, global/agents/design.md,
   global/agents/engineer.md, global/agents/critic.md, global/opencode.jsonc를
   전역에 적용하고 환경별 차이를 보고해줘. Native Build/Plan/General/Explore 이름과
   Plan의 Native 프롬프트·일반 파일 편집 제한은 보존해줘. 이전 같은 출처의
   design-specialist/design-architect/ux-scout/ui-ux-critic/product-reviewer는
   발견 디렉터리 밖에 백업하고 새 ID로 이전해줘. 이전 architect.md도 원본을 보존하고 등록에서 제외해줘.
   진행 세션은 강제 종료·전환하지 마. 저장소의 docs/archive/agents/architect.md는 전역 agents에 복사하지 마.
   같은 이름의 사용자 정의가 있거나 정본과 다르면 덮어쓰지 말고 충돌을 확인해줘.
   기존 세션 모델은 강제 이전하지 말고 새 작업부터 새 ID를 사용해줘.
   global/plugins/ksi-impeccable-detector/도 전역 plugins/에 적용해줘.
    OpenCode V2가 자동 발견하므로 중복 plugins 등록이나 npm 설치는 하지 마.
    프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
   experimental.subagent_depth=3(루트0,기본1~2,유용할때만3)과 Build/Plan의 호출 허용 목록,
   커스텀 역할의 재위임 권한을 함께 적용해줘. 고정 파이프라인이나 별도 라우터는 만들지 마.
   자기 호출·미등록 대상 거부와 깊이 상한을 유지하고, 각 부모가 자식 결과를 해석·통합하게 해줘.
   계획/분석만 승인됐으면 하위도 그 범위를 지키고, 자식의 권한을 부모 제한의 자동 상속으로 보지 마.
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
6. 실제 8개 역할·모델·MCP·기존 스킬 인식과 정본/설치본 일치를 확인해줘.
   agent-routing-native.mjs로 권한을, delegation-native-integration.mjs의 격리 로컬 모의 모델로
   Plan의 재위임·깊이3·상한 차단·실제 도구 거부·소유 세션 재개·새 근거로의 복구와
   명시 세션 제한의 상속/비소급을 확인해줘. 사용자 기존 세션의 규칙은 수정하지 마.
   임시 fixture에서 기존 UI 소스 검사 훅도 검증해줘.
   실제 모델 품질·브라우저 연결·장기 완주와 설정/모의 검사를 구분하고,
   적용 완료·인증 대기·실패·설치 커밋·도구 버전·환경별 차이를 보고해줘.
```

## 외부 도구 출처

| 도구 | 공식 출처와 설치 범위 |
| --- | --- |
| Impeccable | [공식 저장소](https://github.com/pbakaus/impeccable), [npm 패키지](https://www.npmjs.com/package/impeccable). 전역 OpenCode 설치 시 공식 npm `latest`를 확인합니다. 2026-10-15 확인 당시 `latest`와 현재 설치본은 [4.5.2](https://www.npmjs.com/package/impeccable/v/4.5.2)였으며, 이 버전은 고정 요구가 아닙니다. |
| Intent | [공식 v1.7.1](https://github.com/ghaida/intent/tree/v1.7.1)에서 `journey`·`organize`·`wireframe`과 각 스킬의 원본 참고 자료만 선택 설치합니다. |
| Playwright CLI | [공식 저장소 및 원본 스킬](https://github.com/microsoft/playwright-cli). 기존 `@playwright/cli` 0.1.22를 재사용하며, Playwright MCP는 기본 구성에서 제거했습니다. |
| Context7 | [Context7](https://mcp.context7.com/mcp) 원격 서비스에 연결합니다. 사용자별 계정 인증이 필요합니다. |
| Mobbin(선택) | [Mobbin](https://api.mobbin.com/mcp)은 유료 서비스라 **선택 사항**입니다. 쓰지 않으면 비활성(`"enabled": false`)으로 두거나 항목을 지워도 하네스는 동작합니다. |
| OpenSpec | [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec), 공식 `@fission-ai/openspec`. 기존 설치·Node·제품 루트를 먼저 확인하고 해당 프로젝트에만 `openspec init --tools opencode`를 적용합니다. [실제 버전·이관 범위](openspec-and-skills.md) |
| 선별 외부 스킬 | [osmontero](https://github.com/osmontero/opencode-skills)·[Uxcel](https://github.com/Uxcel-Lab/product-skills). [ID·라이선스·해시·중복 판단](openspec-and-skills.md). 전체 설치 스크립트는 실행하지 않습니다. |

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
cmp global/agents/research.md ~/.config/opencode/agents/research.md
cmp global/agents/engineer.md ~/.config/opencode/agents/engineer.md
cmp global/agents/design.md ~/.config/opencode/agents/design.md
cmp global/agents/critic.md ~/.config/opencode/agents/critic.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
diff -r global/plugins/ksi-impeccable-detector ~/.config/opencode/plugins/ksi-impeccable-detector
```

중첩 허용치 `experimental.subagent_depth=3`(기본값 1)는 전역 설정이 소유합니다. 위 `cmp`로 정본/설치본을 대조하고, 선언·호출 정책은 `node tests/agent-routing-native.mjs`, 격리된 실제 Native 중첩·상한 동작은 `node tests/delegation-native-integration.mjs`로 확인합니다. 전자는 콜드 위치 준비·실제 모델/브라우저 실행의 증거가 아니며 후자도 로컬 모의 모델로서 전문 판단력을 평가하지 않습니다. [현재 실행 근거와 한계](validation.md#동적-8개-역할과-최대-깊이-3-2026-10-24)

Context7 키는 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키·OAuth 토큰·개인 `cli.json`은 저장소에 기록하지 않습니다. 필요한 서비스 인증은 사용자별로 진행하고, OAuth는 사용자가 OpenCode의 `/mcps`에서 처리합니다. 구성·서비스 상태·독립적인 개인 스킬은 전역 설정 사본에 포함되지 않습니다.

등록·연결 문제가 의심되면 이 저장소에서 `node scripts/capabilities.mjs`로 [선택 진단](validation.md#능력-연결-진단)을 실행할 수 있습니다. 이 유틸리티는 전역 플러그인이 아니며 설치·자동 복구를 수행하지 않습니다.
