# 설치 안내

> **상태: OpenSpec 퇴역·OpenAI Sol High Plan·전역 5개 역할 적용·검증 완료 (2026-10-26).** 활성 파일 3개가 정본과 일치하고 설치본 검사 146개가 통과했습니다. OpenSpec이나 이전 전문 역할 4개를 재설치하지 않습니다. 제품 문서 자동 생성·이전·상세 안내 자동 주입은 하지 않습니다. [실행 근거와 검증 한계](engineer-routing-validation.md). 다른 컴퓨터에는 별도 적용이 필요합니다.

이 저장소는 개인 전역 OpenCode 환경에 자동 설치되지 않습니다. 설치 전 대상 환경과 기존 파일을 확인하고, 사용자 설정과 자격증명을 보존하면서 관련 항목만 적용하세요.

## 배포 구성과 적용 후 흐름

배포 정본은 `global/`입니다. README·이 문서는 사용법과 적용 절차를 설명하며, 실행 시 별도 워크플로 엔진을 설치하지 않습니다.

```text
Build — depth 0 · 제품 실행 총괄·통합·인수
 ├─ Lead — depth 1 · 배정 과업 완결 (직접 또는 General 활용)
 │    ├─ General — depth 2 · 배정 과업 실행·자체 검증
 │    └─ Plan — depth 2 · 선택된 방향 자문 (분석 한정)
 │         └─ General/Explore — depth 3 · 분석·탐색 (선택 자문 체인, 필수 아님)
 ├─ General — depth 1 · 배정 과업 직접 실행 (여러 파일도 가능)
 └─ Plan — depth 1 · 사용자 선택 자문 (승인·게이트 없음)
```

위 트리는 가능한 경로의 예시이지 관계·순서가 고정된 파이프라인이 아닙니다. 보통 깊이 1~2를 사용하고 유용한 필요가 있을 때만 3을 사용합니다. Build는 Lead·General·Explore·Plan을 직접 호출할 수도 있고 작은 수정은 직접 처리합니다. Lead는 배정 범위 안에서 Plan·General·Explore를 씁니다. 각 부모가 자식의 결과를 해석·통합하고, 메인은 승인된 결과를 책임집니다. 깊이·폭을 채우기 위한 위임은 하지 않습니다. 독립 검토는 기본 단계가 아니며, 유용한 특정 확인 질문이 있을 때만 새로운 General 세션을 선택해 요청합니다.

설치·업데이트는 다음을 하나의 구성으로 적용해야 합니다.

1. **공통 지침:** 제품 목표·원문/가설 구분·위임·증거·인수 원칙.
2. **커스텀 역할 1개:** Lead는 배정 과업의 조사·UX/디자인·구현·검증·개선 완결 책임자입니다(짧은 책임 프롬프트, 강제 스킬 단계 없음). Engineer·Design·Research·Critic 운영 파일은 사용자 승인으로 저장소·이 컴퓨터의 전역에서 삭제됐습니다. 최종 승인 내용은 비공개 백업에만 보존하며 자동 복원하지 않습니다. 전역 JSONC의 `disabled`만으로는 뒤에 발견되는 Markdown 역할을 제외하지 못했던 실험 결과에 따라 파일 자체를 제거했습니다. Native Build·Plan·General·Explore 프롬프트와 이름은 유지합니다. Architect 파일은 원본 바이트 그대로 발견 경로 밖 `docs/archive/agents/architect.md`에 보존하며 최종 폐기를 유보합니다.
3. **설정 병합:** `experimental.subagent_depth=3`, Build(Lead·General·Explore·Plan)·Lead(Plan·General·Explore)의 호출 허용 목록, 모델·MCP 설정. Lead의 호출 권한은 Markdown 파일에 있습니다. Plan은 `all` 모드·모델·설명만 지정하며, 별도 `system`이나 권한 허용 목록 없이 Native 프롬프트·일반 파일 편집 제한을 유지합니다. Plan의 General·Explore 위임은 호출 시 분석 한정 경계를 전달하는 운영 계약이지 설정 허용 목록이 아닙니다. General·Explore의 KSI 스킬 화이트리스트는 제거하고 Native 폭을 그대로 둡니다.
   기본 Build 선택·업데이트 알림 `notify`와 General·Explore의 하위 호출 거부는 Native 기본값을 사용합니다. 중복 선언을 제거한 전후의 실제 권한·도구 노출은 격리 비교로 확인했습니다.
4. **기존 도구 재사용:** 브라우저·선택 스킬·공식 Impeccable 수동 소스 검사. 키·OAuth 토큰·유료 구독은 사용자별이며 복사하지 않습니다.
5. **결과 확인:** 아래 파일 일치와 등록/권한 조회를 확인하고, 미확인·인증 대기·실패를 구분합니다. 설치 확인만으로 실제 디자인 품질이나 스킬 활용 능력을 인증하지 않습니다.

배포 정본의 모델은 [README 표](../README.md#역할과-위임-구조)를 따르며 [실제 가용성·정책·검증 상태](engineer-routing-validation.md)를 별도로 확인합니다. Build는 세션 선택을 따르고 전역 모델을 고정하지 않습니다. Plan은 `all`(협의 예외)·`openai/gpt-6.1-sol#high`, Lead·General·Explore는 `subagent`·기존 Muse Contributor 선호를 유지합니다. 기존 세션의 역할·모델은 강제로 바꾸지 않습니다. Native는 세션에 저장된 모델을 우선하므로 기존 주 에이전트 Plan 세션은 사용자가 모델을 따로 선택해야 합니다. Contributor 모델의 학습 사용 조건을 포함해 비공개 코드·고객 데이터는 승인된 제공자 경로에만 전달합니다.

### 동적 호출과 승인 범위

Build·Lead는 설정된 허용 목록에서 필요한 역할을 선택합니다. Plan은 Native 권한을 유지하지만, 운영 계약상 General·Explore에 분석만 맡기며 구현 우회는 하지 않습니다. Plan의 정책 프로브가 다른 역할을 `allow`로 반환해도 그 호출을 승인한 것은 아닙니다. General·Explore는 말단입니다(자식·질문 도구 없음). 동일 과업의 조상 반환·자기 호출·retired 역할·하위 Build 호출은 운영 계약상 금지하며, 미등록 대상은 실제 호출에서 실패해야 합니다. 재위임은 남은 깊이 안에서만 가능하며 깊이 3에서는 허용 작업을 직접 수행하거나 부족한 작업을 부모에게 반환합니다. 역할은 특정 깊이에 고정되지 않습니다.

**계획·분석만 승인됐다면 하위도 계획·분석만 수행해야 합니다.** General의 넓은 실행 권한은 Plan의 분석 범위를 넓히지 않습니다. 별개로 Native의 **세션별 제한 규칙**은 자식 생성 시 상속되므로 엄격한 분석 범위는 소유한 작업의 제한 세션이나 제한 실행환경에서 준비할 수 있습니다. Native session update는 규칙 배열을 교체하므로 기존 제한을 읽어 보존하고, 필요한 거부만 추가한 뒤 실제 도구·정책으로 효과를 확인합니다. 기존 자식에 소급 적용된다고 가정하거나 다른 작업의 세션 규칙을 바꾸지 않습니다. Plan 선택만으로 이 세션 제한을 자동 설치하는 플러그인은 추가하지 않습니다. 쉘·Browser·HTTP의 모든 효과를 막는 OS 샌드박스는 아니며 필요한 자원에는 별도 제한 환경·계정을 제공하고 위임으로 승인을 우회하지 않습니다. [Native 세션 규칙](https://opencode.ai/v2/docs/build/plugins#permissions)

병렬 단위는 파일·공유 상태·브라우저의 소유자를 분리하고 조사·원본 증거를 재사용합니다. 하위에 필요한 원요구·확정 계약·가설·대상 버전/환경·허용 자원·완료 맥락을 전달하며 각 부모가 자식 결과를 검토·통합합니다. 독립 확인을 선택했다면 해당 설계·구현에 참여하지 않은 새로운 General 세션에 특정 질문을 맡깁니다. 필수 검토 단계나 고정 보고 양식은 없습니다.

스킬 원본은 이 저장소의 배포 파일에 포함되지 않습니다. 기존 스킬을 재사용하고, 필요한 외부 스킬은 아래 공식 출처와 실제 설치 경로를 확인합니다. 특히 Mobbin MCP 연결과 `mobbin-design` 스킬, Playwright 실행 파일과 `playwright-cli` 스킬은 각각 별개입니다. 역할별 스킬 허용 목록은 설치기가 아니므로, 누락된 스킬은 미설치로 보고하고 임의로 새 스킬을 만들거나 추가 패밀리 전체를 설치하지 않습니다. Vercel React Best Practices·Motion 등 선택 스킬도 설치돼 있는 경우에 사용합니다.

## 적용 파일

| 저장소 파일 | 전역 적용 위치 | 용도 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 작업·완료 지침 |
| `global/agents/lead.md` | `~/.config/opencode/agents/lead.md` | 전체 과업 소유·완결 (`Muse Contributor XHigh`, subagent) |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 에이전트 설정·MCP 연결 등 |
| `global/agents/engineer.md` 등 4개 (삭제됨) | 전역에서도 idle 확인 후 제거 | 원본은 비공개 백업에만 보존, 재설치하지 않음 |
| `docs/archive/agents/architect.md` | 설치하지 않음 | 원본 보존, 이전 설치가 있으면 종료 확인 후 발견 경로 밖 보관 |

> 활성 배포 파일은 위 3개입니다. 이전 General 8-스킬 화이트리스트는 제거했으며, 새 검증은 설치본 권한 프로브와 격리 fixture의 실제 동작을 확인합니다. 스킬 허용은 실제 사용·품질과 다릅니다.

## 기존 역할에서 이전

| 이전 ID | 현재 ID와 변화 |
| --- | --- |
| `design-specialist` / `design-architect` | 재등록하지 않음 — UX 과업은 배정에 따라 Build·Lead·General이 수행 |
| `ux-scout` | 재등록하지 않음 — 범위가 정해진 검색은 Explore, 과업 내 조사는 Lead·General이 수행 |
| `ui-ux-critic` / `product-reviewer` | 재등록하지 않음 — 유용한 특정 질문이 있을 때 새로운 General로 선택적 독립 확인 |
| `architect` | 원본을 `docs/archive/agents/architect.md`에 보존·등록 제외. 일상적 설계·구현은 Lead(배정 시), 중요한 방향 자문은 Plan. 최종 폐기 미결정 |
| 신규 | `lead` — 배정 과업 전체의 조사·UX/디자인·구현·검증·재개선 소유자 |
| `engineer` / `design` / `research` / `critic` | 저장소·이 컴퓨터 전역에서 삭제 완료 (사용자 승인) + 비공개 백업. 다른 설치도 idle 확인 후 제거하며 재등록하지 않음 |

같은 ID의 사용자 정의가 있거나 설치 파일이 배포 정본과 다르면 덮어쓰지 말고 충돌을 확인합니다. 같은 출처의 이전 파일은 백업 후 발견되는 `agents/` 밖에 보관하고, 새 `lead.md`·JSONC·공통 지침을 함께 적용합니다. 이전 ID를 새 작업용 별칭으로 계속 등록하지 않습니다. 진행 중인 이전 역할 세션을 강제 종료·전환하지 말고 은퇴 적용 시점을 조율합니다. 기존 세션의 선택·저장된 모델은 자동 이전되지 않으며 새 작업에서는 새 ID를 사용합니다. 다른 프로젝트의 설정·작업·서비스는 변경하지 않습니다.

### 전문 역할의 실행 경계

Lead는 배정 과업의 구현·테스트 권한을 갖고, General은 배정 범위 안에서 실행·검증합니다. 승인 없는 쓰기·설치·서버·배포·자격증명 접근은 허용하지 않습니다. Browser·execute·CLI는 읽기 전용 샌드박스가 아니므로 승인된 환경·계정·상태 전이를 제공합니다. 실제 도구의 실패나 없는 원본을 미검증으로 구분하고 권한을 우회하지 않습니다. 엄격한 비변경 확인이 필요하면 Native 세션 거부나 격리 실행환경을 명시합니다.

선택된 독립 확인(새로운 General 세션)은 직접 구현·설계 확정·로드맵·최종 인수를 소유하지 않습니다. 원요구·확정 계약·실제 빌드와 종단 과업을 대조하며, 자료/실행이 없으면 해당 범위를 미검증으로 반환합니다. 역할 이름이나 스킬 수가 전문성의 증거는 아니며, 대규모 외부 스킬 설치·평가 프레임워크·고정 승인 단계는 추가하지 않습니다.

## 프로젝트 정본 진입 지도

전역 `AGENTS.md`에는 관련 지식 선택·실제 상태 대조·지속 사실 갱신 원칙을 둡니다.
개별 제품 내용은 각 프로젝트의 기존 정본이 소유하고, 프로젝트 `AGENTS.md`는 짧은
제품 소개·주제별 정본 위치·충돌 시 권위·실행 및 검증 진입점을 안내합니다.

제품·경험·시스템·상태는 논리적 책임이며, 파일명·문서 수·독서 순서는 강제하지
않습니다. 기존 자료를 연결하고 과업에 필요한 부분을 선택합니다. 제품 문서 전체를
전역 `instructions`에 추가하거나 설치 과정에서 다른 프로젝트의 파일을 일괄
생성·이전하지 않습니다. 상세 안내·예시도 자동 주입·복사 대상이 아닙니다.

제품 원장은 현재 구현·검증 근거/한계·남은 문제·승인된 작업 연결로 간결하게
유지합니다. 승인된 목표와 실제 구현, 현행 지식과 결정 이력, 제품 상태와 세션
체크포인트를 구분하고, 관련 코드·미커밋 변경·실행 증거와 대조합니다. 문서 관리가
분석 전용 범위나 제품 승인·공유 자원 경계를 넓히지 않습니다.

[프로젝트 지식·원장 운용 기준](project-knowledge.md) ·
[선택적 진입점 예시](../examples/project-AGENTS.md)

적용 후에는 아래 [전역 파일 일치 확인](#전역-파일-일치-확인) 명령으로 활성 파일 3개와 이전 파일의 부재를 확인합니다.

## 설치 요청 프롬프트

파일을 수정하고 명령을 실행할 수 있는 에이전트에게 다음 요청을 전달할 수 있습니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.
1. OS·실제 전역 경로·기존 설치·Node.js·브라우저를 확인하고,
   기존 파일을 백업한 뒤 관련 항목만 병합해줘. 개인 설정·자격증명·다른 도구는
   보존하고, 같은 이름의 사용자 정의와 충돌하면 필요한 선택만 질문해줘.
2. global/AGENTS.md, global/agents/lead.md, global/opencode.jsonc를
   전역에 적용하고, 이전 engineer.md·design.md·research.md·critic.md는
   전역에서도 원본 백업·idle 확인 후 삭제해줘(진행 세션 강제 종료·전환 금지).
   최종 승인 내용은 비공개 백업에만 두고 자동 복원하지 마. 환경별 차이도 보고해줘.
   Native Build/Plan/General/Explore 이름과 Plan의 Native 프롬프트·일반 파일 편집 제한은 보존해줘.
   이전 같은 출처의 design-specialist/design-architect/ux-scout/ui-ux-critic/product-reviewer와
   engineer/design/research/critic 호출은 새 작업에 별칭으로 재등록하지 마.
   이전 architect.md도 원본을 보존하고 등록에서 제외해줘.
   진행 세션은 강제 종료·전환하지 마. 저장소의 docs/archive/agents/architect.md는 전역 agents에 복사하지 마.
   같은 이름의 사용자 정의가 있거나 정본과 다르면 덮어쓰지 말고 충돌을 확인해줘.
   기존 세션 모델은 강제 이전하지 말고 새 작업부터 새 ID를 사용해줘.
   자체 제작 편집 훅 플러그인은 설치하지 말고, 과업에 맞을 때만 설치된 Impeccable의
   공식 `detect --json` 수동 검사를 선택적으로 사용해줘.
    프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
   experimental.subagent_depth=3(루트0,기본1~2,유용할때만3)과 Build(Lead·General·Explore·Plan),
   Lead(Plan·General·Explore)의 호출 허용 목록을 함께 적용해줘.
   Plan에는 별도 system·권한 허용 목록을 추가하지 말고, General·Explore 위임도 분석 한정으로 운용해줘.
   고정 파이프라인·별도 라우터·필수 검토 단계는 만들지 마.
   자기 호출·미등록 대상 거부와 깊이 상한을 유지하고, 각 부모가 자식 결과를 해석·통합하게 해줘.
   계획/분석만 승인됐으면 하위도 그 범위를 지키고, 자식의 권한을 부모 제한의 자동 상속으로 보지 마.
    기존 프로젝트별 제약이 충돌하면 덮어쓰거나 제한을 우회하지 말고 그 충돌을 보고해줘.
3. 기존 Impeccable 설치를 확인하고, 새 설치나 명시적 갱신이 필요할 때만
   공식 npm `latest` 태그를 사용해줘. 명령은 다음과 같아:
   npx --yes impeccable@latest install --providers=opencode --scope=global --no-hooks
   실제로 해결된 버전과 공식 출처를 기록하고 공식 `detect --json` 수동 실행을 검증해줘.
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
5. OpenCode Go 모델 접근과 Context7 인증을 확인해줘.
   Mobbin은 유료 선택 사항이라 필수가 아니야. 사용자가 쓰길 원할 때만 인증하고,
   아니면 `mcp.servers.mobbin`에 `"disabled": true`를 두거나 항목을 지워도 돼. 필요한 구독·인증만 안내하고,
   비밀값을 채팅·저장소에 기록하거나 비용이 다른 모델로 임의 대체하지 마.
   OAuth는 사용자가 /mcps에서 진행하게 해줘.
6. 실제 5개 운영 역할·모델·MCP·기존 스킬 인식과 정본/설치본 일치,
   삭제된 4개 운영 파일의 전역 부재·카탈로그 제외·호출 실패와 함께 확인해줘.
   agent-routing-native.mjs로 권한을, delegation-native-integration.mjs의 격리 로컬 모의 모델로
   Lead 실행·Build 직접 General·선택 Plan 자문·깊이3·상한 차단·실제 도구 거부·소유 세션 재개·새 근거로의 복구와
   명시 세션 제한의 상속/비소급, 그리고 선택된 제한 General 확인의 비변경 mechanics를 확인해줘.
   사용자 기존 세션의 규칙은 수정하지 마.
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
| Mobbin(선택) | [Mobbin](https://api.mobbin.com/mcp)은 유료 서비스라 **선택 사항**입니다. 쓰지 않으면 `mcp.servers`에서 `"disabled": true`로 두거나 항목을 지워도 하네스는 동작합니다. |
| 선별 외부 스킬 | [osmontero](https://github.com/osmontero/opencode-skills)·[Uxcel](https://github.com/Uxcel-Lab/product-skills). [ID·라이선스·해시·중복 판단](openspec-and-skills.md). 전체 설치 스크립트는 실행하지 않습니다. |
| Vercel React Best Practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills)의 `vercel-react-best-practices`(MIT, v1.0.0). 현재 `~/.agents/skills/`에 설치되어 React/Next 작업에서 사용합니다. |

Mobbin을 쓸 때만 인증하고, 필요 없으면 건너뜁니다. MCP 설정은 V2 정본 `mcp.servers` 아래에 두며, 비활성화에는 `"disabled": true`를 사용합니다. Mobbin OAuth 인증은 사용자가 OpenCode의 `/mcps`에서 진행합니다.

Intent 선택 설치 명령(POSIX 셸):

```sh
DO_NOT_TRACK=1 npx -y skills@1.7.2 add https://github.com/ghaida/intent/tree/v1.7.1 --skill journey --skill organize --skill wireframe -g -a opencode -y --copy
```

현재 공식 CLI는 선택한 세 스킬을 `~/.agents/skills/`에 설치하며 OpenCode가 전역 호환 소스로 인식합니다. 공유 스킬 위치와 `~/.agents/.skill-lock.json`의 기존 항목을 보존하고 중복 설치하지 않습니다. 저장소는 Intent 원본을 복제하지 않으며 `wireframe`의 CSS·JS·스타일가이드도 원본과 함께 설치합니다.

이 저장소는 자체 제작 스킬을 번들하지 않습니다. 2026-10-24 이전의 `task-first-ux-review`는 폐기했고, 같은 목적은 설치된 `designing-user-experience`·`ux-heuristics-audit`와 Design의 과업 비교 원칙으로 대체합니다. 2026-10-24 전역 적용에서 기존 세션이 모두 idle임을 확인한 뒤 `~/.agents/skills/task-first-ux-review/`와 `~/.config/opencode/plugins/ksi-impeccable-detector/`를 백업으로 옮겼습니다. 백업은 `/tmp/opencode/ksi-depth3-install-qxzxj_rl/pre-apply-20261024T111208Z/retired/`에 있습니다. 선별 외부 스킬 6종은 프로젝트 `.opencode/skills/`와 전역 `~/.agents/skills/`에 동일 바이트로 설치되어 있습니다.

OpenSpec은 설치 대상이 아닙니다. `openspec init`이나 `openspec update`를 실행해 생성물을
복구하지 않습니다. 이 저장소의 과거 명세·생성물은 [역사 기록](archive/openspec-2026-10-26/README.md)으로만 보존하며, 실제 역할·권한·검증 계약은 `global/`·README·실행 테스트를 따릅니다.

## 전역 파일 일치 확인

적용 후 저장소 파일과 전역 파일을 비교하려면 다음 명령을 사용합니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/lead.md ~/.config/opencode/agents/lead.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
for role in engineer design research critic; do
  test ! -e "global/agents/$role.md" || exit 1
  test ! -e "$HOME/.config/opencode/agents/$role.md" || exit 1
done
```

중첩 허용치 `experimental.subagent_depth=3`(기본값 1)는 전역 설정이 소유합니다. 위 `cmp`로 정본/설치본을 대조하고, 선언·호출 정책은 `node tests/agent-routing-native.mjs`, 격리된 실제 Native 중첩·상한·이전 역할 호출 실패는 `node tests/delegation-native-integration.mjs`로 확인합니다. 전자는 콜드 위치 준비·실제 모델/브라우저 실행의 증거가 아니며 후자도 로컬 모의 모델로서 전문 판단력을 평가하지 않습니다. [현재 실행 근거와 한계](engineer-routing-validation.md)

Context7 키는 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키·OAuth 토큰·개인 `cli.json`은 저장소에 기록하지 않습니다. 필요한 서비스 인증은 사용자별로 진행하고, OAuth는 사용자가 OpenCode의 `/mcps`에서 처리합니다. 구성·서비스 상태·독립적인 개인 스킬은 전역 설정 사본에 포함되지 않습니다.

등록·연결 문제가 의심되면 이 저장소에서 `node scripts/capabilities.mjs`로 [선택 진단](validation.md#능력-연결-진단)을 실행할 수 있습니다. 이 유틸리티는 전역 플러그인이 아니며 설치·자동 복구를 수행하지 않습니다.
