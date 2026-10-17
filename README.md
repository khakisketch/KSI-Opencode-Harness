# KSI OpenCode Harness

**Build가 제품을 총괄하고, 전문 역할이 맡은 작업을 구현·검증까지 이어가는 OpenCode Native 하네스입니다.**
전역 지침·에이전트·모델/도구 권한과 제한된 UI 소스 검사기를 구성합니다. 별도 실행 프레임워크나 필수 승인 파이프라인은 없습니다.

[시작하기](#시작하기) · [역할과 위임 구조](#역할과-위임-구조) · [개발 워크플로](#개발-워크플로) · [디자인 및 검증 도구](#디자인-및-검증-도구) · [설치·업데이트](#설정-및-설치-경로) · [검증 범위](#추가-검증)

> Clone/pull만으로는 전역 환경이 바뀌지 않습니다. [설치 안내](docs/installation.md)에 따라 기존 사용자 설정을 보존해 적용하세요.

## 시작하기

기본 메인은 Build입니다. 일반 문장으로 요청하며, 별도 명령이나 Plan→Build→Design 전환 순서는 필요 없습니다.

- **개발:** Build 선택 → “CSV 내보내기를 구현하고 테스트와 실제 흐름을 검증해줘.”
- **UI 중심 작업:** Design Architect를 메인으로 선택해도 됩니다 → “결제 완료 흐름을 개선하고 실제 렌더로 검증해줘.”

한 작업의 메인은 한 명입니다. UI 중심으로 Architect를 메인으로 선택했다면 그 역할이 통합·인수도 책임지며, 별도의 Build를 추가하지 않습니다.

## 역할과 위임 구조

다음은 복합 제품 개발에서의 대표적인 분업입니다. **모든 요청에 이 트리를 실행하는 것은 아닙니다.**

```text
Build — 목표·통합·최종 인수
 ├─ Plan — 기술 자문·방향 점검
 │    └─ Explore — 필요한 코드 조사
 └─ Design Architect — 맡은 UI 개선 전체 책임
      ├─ UX Scout — 화면·문제 후보·레퍼런스 조사
      ├─ Explore — 기존 코드·컴포넌트 탐색
      └─ General — 구현·실행·기술 검증·수정
           ↕
      Architect — 실제 렌더 재평가·필요한 교정
```

Build는 UI 외의 구현을 General에 직접 맡기거나 Explore·Scout를 직접 사용할 수도 있습니다. 작고 명확한 작업은 직접 처리합니다.

| 역할 / Native ID | 책임 | 모드 | 배포 기본 모델 |
| --- | --- | --- | --- |
| **Build** / `build` | 목표·장기 맥락·통합·최종 인수 | primary | 세션 선택, 전역 모델 미고정 |
| **Plan** / `plan` | 영향이 큰 기술 선택 자문 + 큰 전환·복귀 시 방향 점검 | all | `openai/gpt-6.1-sol#xhigh` |
| **Design Architect** / `design-architect` | 진단·UX/UI 설계·작업자 조율·렌더 개선 | all | `openai/gpt-6.1-sol#high` |
| **UX Scout** / `ux-scout` | 선택형 관찰·문제 후보·외부 사례·원본 근거 수집 | subagent | `openai/gpt-6-luna-fast#high` |
| **General** / `general` | 맡은 구현·실행·기술적 결함 수정 | subagent | `opencode-go/muse-spark-1.3-contributor#high` |
| **Explore** / `explore` | 기존 코드·구조 탐색 | subagent | `opencode-go/muse-spark-1.3-contributor#low` |

- `experimental.subagent_depth=2`는 `Build → Architect → 작업자`까지 허용하는 **최대 깊이**입니다. `mode: all`은 메인/하위 실행을 모두 지원한다는 뜻이지 무제한 위임 권한이 아닙니다.
- Architect는 General·Scout·Explore를 직접 호출하고 같은 작업의 세션을 재사용합니다. 기술 자문이 필요하면 남은 깊이 안에서 Plan도 호출할 수 있습니다.
- Plan은 Explore 조사만 위임합니다. General·Scout·Explore는 추가 위임하지 않습니다. 허용 목록 밖의 역할을 추가하려면 호출 권한도 명시적으로 조정해야 합니다.
- 장기 작업의 연속성은 Build가 Native 세션·이력·프로젝트 자료로 유지하고, 곁작업 뒤에는 승인 범위의 제품 개발로 복귀합니다. 큰 전환, 상당한 곁작업, 원래 문제를 해결하지 못하는 국소 수정 정체, 장기 목표의 완료 판단 전에는 Plan에 원래 목표 대비 방향·누락·남은 작업 점검을 요청할 수 있습니다.
- Plan은 자문이며 필수 승인자·기억 저장소·두 번째 구현 총괄이 아닙니다. 매 작업마다 호출하지 않으며, 점검 결과를 반영하고 다음 작업을 잇는 책임은 Build에 있습니다. Plan 모델은 명시돼 있지 않으면 부모 세션 모델을 상속하므로, 별도 판단 모델로 동작하게 하려면 위 표의 모델 고정이 필요합니다.
- 기존 세션의 역할·모델은 설정 변경만으로 자동 이전되지 않습니다. 특히 Architect를 메인으로 고를 때는 세션 모델도 확인하세요.

Architect는 맡은 UI 단위의 구현·검토를 직접 연결합니다. Build에는 매번 수정 목록을 승인받으러 돌아오는 대신, 중요한 결정·충돌·실제 차단과 최종 통합 결과를 반환합니다.

Scout의 검색·탐색 과정은 자신의 세션에 남깁니다. Architect에는 간결한 관찰과 **같은 원본 이미지·URL·화면 상태**를 전달합니다. Architect도 원본을 직접 확인하고 필요한 추가 조사를 할 수 있으며, Scout의 요약이 설계 확정이나 최종 합격을 대신하지 않습니다.

## 기본 OpenCode와 비교

KSI Harness가 기본 OpenCode와 다른 점은 다음과 같습니다.

| 항목 | 기본 OpenCode | KSI Harness |
| --- | --- | --- |
| 디자인 역할 | 사용자 정의 에이전트 지원 | Design Architect 역할·선택형 UX Scout 구성 |
| 완료 판단 | 기본 에이전트 지침 | 승인된 작업의 완료·재승인 기준 명시 |
| 위임 | General·Explore·하위 세션 지원 | 작업 단위 위임·공유 자원 소유 기준 명시 |
| UI 편집 검사 | 플러그인으로 확장 가능 | Impeccable 엔진의 편집 후 검사 연동 |
| 디자인 방법론 | 별도 설치 | Impeccable·Intent를 선택 사용 |
| 브라우저 | 데스크톱 Native Browser 제공 | Native Browser·Playwright CLI 선택·세션 기준 |
| 모델 라우팅 | 에이전트별 모델 설정 지원 | General·Explore·Plan·Design Architect·UX Scout 모델 지정 |

구조와 과정을 정리한 것이며, 디자인 품질 향상을 A/B로 입증한 것은 아닙니다.

## 개발 워크플로

- Native 세션·계획·이력으로 결정·남은 작업·검증 근거를 이어가며, 고정 단계나 추적 파일을 요구하지 않습니다.
- 위임할 때 핵심 원문·출처·문제·실제 제약을 넘기고, 사용자 확정사항과 Build의 해석·설계 가설을 구분합니다. 미선택을 거절·영구 유지로 간주하지 않으며, 담당자는 목표·제약 안에서 근거로 가설을 조정합니다. 새 자식 세션에는 부모 문맥이 자동 전달되지 않으므로 사용자 제약·원본 증거·작업+상태를 명시적으로 넘기고, 이어 쓰는 자식 세션은 같은 세션을 `sessionID`로 재사용합니다. 공유 파일·브라우저 자원은 한 소유자를 정합니다. 메인은 해당 빌드의 결과로 원래 문제의 해결 여부를 판단합니다.
- 승인 범위는 중간 재승인 없이 진행하고, 실제 데이터에 가까운 조건에서 저장·연동·실패 복구 등 관련 흐름을 확인합니다.
- 항목 목록이 아닌 승인된 목표를 기준으로 관련 개선을 수행합니다. 명시적 제외는 지키고, 목표 확대·계약·비용·보안·데이터 정책 변경은 확인합니다.
- 모의·미검증 결과는 실제 완료와 구분하고, 유효한 검증은 재사용합니다. 진척이 멎으면 가설을 바꾸되 새 근거가 없으면 차단 사유를 보고합니다. 목표와 관련 검증을 충족하면 마칩니다.

막히면 지침부터 늘리지 않고, 지식·관찰/접근·실행 수단·판단 중 무엇이 부족한지 구분합니다. 필요한 자료·스킬·도구·전문 역할을 선택합니다.

## 디자인 및 검증 도구

중요한 UI 변경은 사용자의 별도 지시 없이 구조·핵심 조작을 정하기 전에 Design Architect가 실제 화면·상호작용·관련 제품 사례를 근거로 판단합니다. 근거가 충분하면 재사용하고 부족하면 조사하며, 필요한 스킬은 실제로 적용합니다. 기계적 수정에 불필요한 조사를 붙이지 않습니다. UX Scout는 필수가 아니며, 필요할 때만 넓은 관찰·문제 후보·Mobbin/외부 참고와 원본 근거를 Architect·메인에 넘깁니다.

| 필요한 일 | 도구 |
| --- | --- |
| 제품 패턴 참고 | 해당 제품 우선, 필요할 때 Mobbin(선택·유료) |
| 라이브러리 문서 | Context7 |
| 흐름·정보 구조·화면 대안 | Intent `@journey`·`@organize`·`@wireframe` (선택) |
| 디자인 비평·소스 검사 | Impeccable, 자동 UI 소스 검사 |
| 실제 화면·상호작용 확인 | 데스크톱은 Native Browser, 헤드리스·반복은 Playwright CLI |
| 저장·연동·실패 원인 확인 | 프로젝트의 API·로그·테스트 데이터·허용된 데이터 조회 |
| React/Next.js 구현·성능 | Vercel React Best Practices(설치된 경우) |
| 기존 UI의 절제된 모션 개선 | Emil Kowalski Motion(선택) |

스킬은 역할이나 필수 개발 단계를 추가하는 장치가 아닙니다. 필요한 범위만 읽고 적용하며, 원본 보존·참고용 와이어프레임과 실제 제품의 시각 기준을 구분합니다. 이 저장소는 스킬 원본을 번들하지 않으므로 기존 설치를 재사용하거나 [공식 출처별 설치](docs/installation.md#외부-도구-출처)를 별도로 확인해야 합니다. 권한 허용이나 MCP 연결이 스킬 설치를 뜻하지는 않습니다.

외부 스킬의 제한된 실행과 제품 전체의 인수를 구분하는 적용 정책은 [스킬 연결 검토](docs/validation.md#스킬-연결-검토-2026-10-17)에 기록했습니다. 사용자 범위·예산은 지키며, 스킬 종료를 미충족 제품의 완료로 간주하지 않습니다. 등록이나 본문 검토를 실제 활용 성능 검증으로 간주하지 않습니다.

등록·연결 상태가 의심되면 `node scripts/capabilities.mjs`로 선택 점검합니다. 설치·인증·모델 호출은 하지 않으며, 결과는 실제 권한·동작·제품 품질의 증거가 아닙니다. 추적 대상은 build·general·explore·plan·design-architect·ux-scout 6개 역할입니다. Scout는 제품 편집·추가 위임·임의 Shell을 거부하며, 기존 웹·브라우저 도구와 명명된 Playwright 검사·상호작용 명령을 사용합니다. Mobbin은 확인한 검색 3개만 허용하고 나머지는 승인을 요구합니다. 브라우저·CLI는 읽기 전용 샌드박스가 아니므로 테스트 환경·승인된 상태 전이를 사용합니다. [진단·권한 검증 범위](docs/validation.md#역할-구조-변경-2026-10-17)

### UI 개선의 두 루프

기술적 결함은 구현자가 자체 수정하고, 디자인 개선은 Architect가 실제 결과를 보며 이끕니다. 다음은 동작 예시이지 고정 단계·반복 횟수가 아닙니다.

```text
실제 화면·업무 맥락·근거 수집(필요하면 UX Scout)
  ↓
Architect — 문제 진단·우선순위·구현 가능한 설계
  ↓
General — 구현 → 실행·기술 검사 → 기술적 결함 수정 ↺
  ↓
같은 Architect — 전후 렌더·조작·회귀·원래 과업 재평가
  ├─ 필요한 개선이 남음 → 같은 General 세션에 교정 연결
  └─ 목표와 관련 검증 충족 → Build에 결과·근거·남은 제약 반환
                                  ↓
                            제품 통합·최종 인수
```

위 예시는 Build가 메인인 경우입니다. Architect를 메인으로 시작했다면 마지막 통합·인수도 Architect가 맡습니다.

열거되지 않은 문제도 주변 상태·공유 컴포넌트·연결 화면에서 발견하고, 목표 달성에 필요한 개선은 직접 수행합니다. 무관한 발견은 보고하되 새 과제로 확대하지 않습니다.

피드백은 그 프로젝트의 판단 이유와 함께 연결 화면에 적용합니다. 목표 관련 문제가 남고 다음 변경의 효과를 설명할 수 있으면 계속하며, 목표와 관련 검증이 충족되면 종료합니다. 시각적 완성도가 목표라면 그것도 인수 조건입니다. 반복 실패는 원인을 재진단하고, 무관한 취향 변경이나 횟수 채우기로 반복하지 않습니다. 증거·접근·필수 결정이 부족하면 완료로 처리하지 않습니다. 유효한 검증은 재사용하며, 별도 보고서·필수 리뷰어·고정 반복 횟수는 없습니다.

도구 부재를 단정하기 전에 카탈로그를 검색합니다. 캡처 실패는 원인과 대안을 확인하고, 시각 검증을 코드 리뷰로 조용히 대체하지 않습니다. 캡처·결론은 프로젝트가 정한 위치에 기록합니다.

CLI는 작업별 고유 세션만 열고 자신이 만든 세션만 닫습니다. 프로젝트 테스트와 기존 증빙은 보존합니다.
브라우저 정책과 검증 이력: [검증 안내](docs/validation.md)

## UI 소스 검사

`write`·`edit`·`patch`가 성공하면 `ksi-impeccable-detector` 플러그인이 변경된 UI 파일을 설치된 Impeccable 엔진으로 검사하고, 도구 결과에 요약을 덧붙입니다.
자동 수정·모델 재호출·작업 차단은 하지 않습니다.

동작 흐름:

```text
편집 성공 (write / edit / patch)
  ↓
세션 디렉터리의 UI 파일인지 확인
  ├─ 아니면 → 건너뜀
  └─ 맞으면 → 파일 사본을 격리해 검사
  ↓
설치된 Impeccable 엔진 실행 (detect, 소스 전용)
  ↓
기존 도구 결과에 검사 요약 첨부
```

전후 비교 (예시):

```text
Created file successfully: src/banner.css
```

```text
Created file successfully: src/banner.css

[Impeccable source-only; non-blocking, not rendered UX verification]
src/banner.css: findings — overused-font:1
```

| 구분 | 내용 |
| --- | --- |
| 대상 | CSS·SCSS·SASS·LESS·HTML·JSX·TSX·Vue·Svelte·Astro |
| 제외 | 삭제·비 UI·숨김·의존성·생성 파일, 일반 JS·TS |
| 범위 | 소스 전용. 연결 CSS·디자인 시스템·URL·렌더는 검사하지 않음 |
| 한도 | 파일당 512 KiB, 편집당 8파일·6초 예산, 결과 50개 |

검사 통과는 실제 화면 사용성·시각 품질 검증을 대신하지 않습니다. 상세: [검증 안내](docs/validation.md)

## 설정 및 설치 경로

| 저장소 파일 | 전역 적용 위치 |
| --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` |
| `global/agents/design-architect.md` | `~/.config/opencode/agents/design-architect.md` |
| `global/agents/ux-scout.md` | `~/.config/opencode/agents/ux-scout.md` |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` |
| `global/plugins/ksi-impeccable-detector/` | `~/.config/opencode/plugins/ksi-impeccable-detector/` |

- 기존 파일은 백업하고 관련 항목만 병합합니다. `design-specialist`에서 `design-architect`로의 이름 변경과 `ux-scout` 추가 방법은 [설치 안내](docs/installation.md#에이전트-이름-변경-design-specialist--design-architect)를 따릅니다.
- 적용 후 `cmp`·`diff`로 저장소 정본과 비교할 수 있습니다.
- 설치 프롬프트와 외부 도구 출처: [설치 안내](docs/installation.md)
- `CONTEXT7_API_KEY`는 환경변수로 전달하며 비밀값은 저장소에 넣지 않습니다.

두 역할 파일만 복사하면 충분하지 않습니다. 중첩 깊이와 Build·Plan 호출 권한을 담은 설정, 공통 지침을 함께 병합해야 위 구조로 동작합니다. 사용자 인증·개인 설정은 배포 사본에 포함하지 않습니다.

제품 요구사항과 회귀 검사는 각 프로젝트의 문서·테스트·CI에서 관리합니다.

## 추가 검증

```sh
node --test tests/core.test.mjs tests/adapter.test.mjs
node tests/native-hook-integration.mjs
node --test tests/completion-guidance.test.mjs
node --test tests/capabilities.test.mjs
node tests/agent-routing-native.mjs
```

- `native-hook-integration.mjs`는 격리 환경과 로컬 모의 모델을 사용해 외부 모델을 호출하지 않습니다. 역할 라우팅 검사도 모델 호출 없이 자신의 임시 세션에서 정책을 조회합니다.
- 확인 환경: OpenCode 2.0.32 / Linux arm64 (다른 OS는 미확인)
- `agent-routing-native.mjs`는 설정 원본의 `experimental.subagent_depth==2` 선언 일치와 역할별 호출 정책·역할 모델(Plan 포함)을 검사합니다(55개 통과). 임의의 병합 설정이나 실제 실행을 이 검사만으로 보장하지 않습니다.
- 모의 UI에서는 실제 `Build → Architect → General` 중첩 호출·같은 자식 세션 교정·원본 렌더 재평가를 확인했습니다. 모든 호출 경로·실제품 품질·장기 완주·비용 절감을 입증한 것은 아닙니다. [실행 근거와 한계](docs/validation.md#역할-구조-변경-2026-10-17)
- 선택형 실모델 검사와 결과 해석: [검증 안내](docs/validation.md)

## 알아둘 점

- 소스 검사는 실제 화면 사용성·시각 품질·기능 검증을 대신하지 않습니다.
- 상세: [설치 안내](docs/installation.md) · [검증 안내](docs/validation.md)

[MIT](LICENSE) — Copyright (c) 2026 KSI
