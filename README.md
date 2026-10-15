# KSI OpenCode Harness

OpenCode Native 기반으로 개발·디자인·검증 작업을 연결하는 전역 설정입니다.
Native 에이전트와 제한된 UI 소스 검사기만 구성하며, 별도 실행 프레임워크는 없습니다.
Clone/pull만으로는 전역 설정에 적용되지 않습니다.

[시작하기](#시작하기) · [기본 OpenCode와 비교](#기본-opencode와-비교) · [개발 워크플로](#개발-워크플로) · [디자인 및 검증 도구](#디자인-및-검증-도구) · [UI 소스 검사](#ui-소스-검사) · [설정 및 설치 경로](#설정-및-설치-경로) · [추가 검증](#추가-검증)

## 시작하기

메인 에이전트를 고르고 일반 문장으로 요청합니다. 별도 명령은 필요 없습니다.

- **개발:** Build 선택 → “CSV 내보내기를 구현하고 테스트와 실제 흐름을 검증해줘.”
- **UI 개선:** Design Specialist 선택 → “결제 완료 흐름을 개선하고 실제 렌더로 검증해줘.”

| 역할 | 맡는 일 |
| --- | --- |
| **Build** | 개발의 기본 메인. 구현·통합·검증, UI는 Design Specialist에 위임 가능 |
| **Design Specialist** | UI/UX 조사·구현·렌더 검증 |
| **General** | 위임된 독립 구현·테스트·조사 |
| **Explore** | 읽기 전용 코드·구조 탐색 |
| **Plan** | 선택형 자문. 아키텍처·호환성 비교가 필요할 때 |

```text
사용자: 목표와 제약 전달
  ↓
메인 에이전트 (Build 또는 Design Specialist)
  ├─ 직접 처리
  ├─ 독립 작업 → General / Explore
  ├─ Build가 메인이고 UI 작업이면 → Design Specialist
  └─ 필요할 때만 → Plan 자문
  ↓
메인이 통합·검증
  ↓
완료 보고 또는 차단 사유 보고
```

## 기본 OpenCode와 비교

KSI Harness가 기본 OpenCode와 다른 점은 다음과 같습니다.

| 항목 | 기본 OpenCode | KSI Harness |
| --- | --- | --- |
| 디자인 역할 | 사용자 정의 에이전트 지원 | Design Specialist 역할·검증 기준 구성 |
| 완료 판단 | 기본 에이전트 지침 | 승인된 작업의 완료·재승인 기준 명시 |
| 위임 | General·Explore·하위 세션 지원 | 작업 단위 위임·공유 자원 소유 기준 명시 |
| UI 편집 검사 | 플러그인으로 확장 가능 | Impeccable 엔진의 편집 후 검사 연동 |
| 디자인 방법론 | 별도 설치 | Impeccable·Intent를 선택 사용 |
| 브라우저 | 데스크톱 Native Browser 제공 | Native Browser·Playwright CLI 선택·세션 기준 |
| 모델 라우팅 | 에이전트별 모델 설정 지원 | General·Explore·Design Specialist 모델 지정 |

구조와 과정을 정리한 것이며, 디자인 품질 향상을 A/B로 입증한 것은 아닙니다.

## 개발 워크플로

- Native 세션·계획·이력으로 결정·남은 작업·검증 근거를 이어가며, 고정 단계나 추적 파일을 요구하지 않습니다.
- 메인이 사용자 목표에서 성공 기준을 도출하고, 필요한 누락·결함을 찾아 위임 결과까지 통합합니다. 중요·복잡한 결과는 필요시 General이 근거를 독립 점검합니다.
- 승인 범위는 중간 재승인 없이 진행하고, 실제 데이터에 가까운 조건에서 저장·연동·실패 복구 등 관련 흐름을 확인합니다.
- 기존 권한·API·데이터 계약을 보존하고, 범위 밖 발견은 보고하며 필요한 결정은 질문합니다.
- 모의·미검증 결과는 실제 완료와 구분하고, 유효한 검증은 재사용합니다. 진척이 멎으면 가설을 바꾸되 새 근거가 없으면 차단 사유를 보고합니다. 목표와 관련 검증을 충족하면 마칩니다.

## 디자인 및 검증 도구

Design Specialist는 필요한 도구와 스킬만 골라 씁니다. 정해진 순서는 없습니다.

| 필요한 일 | 도구 |
| --- | --- |
| 제품 패턴 참고 | 해당 제품 우선, 필요할 때 Mobbin(선택·유료) |
| 라이브러리 문서 | Context7 |
| 흐름·정보 구조·화면 대안 | Intent `@journey`·`@organize`·`@wireframe` (선택) |
| 디자인 비평·소스 검사 | Impeccable, 자동 UI 소스 검사 |
| 실제 화면·상호작용 확인 | 데스크톱은 Native Browser, 헤드리스·반복은 Playwright CLI |

Design Specialist 동작 흐름:

```text
┌ UI 개선 요청 — 대상 화면 + 제약
│
├ 1 · 기존 확인
│     사용 상황 · 성공 기준 · 실패 위험 · 기존 코드와 화면
│     개선은 잘된 부분을 보존, 전면 재설계와 구분
│
├ 2 · 레퍼런스 — 필요할 때만
│     실제 사례의 위계 · 밀도 · 조작 비교 (필요하면 Mobbin)
│
├ 3 · 스킬 — 구조·흐름이 애매할 때만
│     @journey   업무 흐름 · 중단 · 복귀
│     @organize  메뉴 · 분류 · 검색 구조
│     @wireframe 별도 화면 구조 대안
│
├ 4 · 구현
│     기존 컴포넌트 · 토큰 우선
│
├ 5 · 자동 소스 검사 — 편집 시점
│     ksi-impeccable-detector
│
├ 6 · 렌더 · 상호작용 검증
│     Native Browser / Playwright CLI → 문제는 그 자리에서 수정
│     필요하면 기존 UI의 전후·동작 비교 (목업·적용본 구분)
│
├ 7 · 디자인 비평 — 필요할 때
│     Impeccable 명령
│
└ 보고 — 구현 범위 · 검증 · 남은 위험 · 요청 밖 발견 문제
```

요청에 없던 문제도 주변 상태·공유 컴포넌트·연결 화면에서 발견해 보고합니다. 범위 밖 문제는 조용히 바꾸지 않습니다.

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
| `global/agents/design-specialist.md` | `~/.config/opencode/agents/design-specialist.md` |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` |
| `global/plugins/ksi-impeccable-detector/` | `~/.config/opencode/plugins/ksi-impeccable-detector/` |

- 기존 파일은 백업하고 관련 항목만 병합합니다.
- 적용 후 `cmp`·`diff`로 저장소 정본과 비교할 수 있습니다.
- 설치 프롬프트와 외부 도구 출처: [설치 안내](docs/installation.md)
- `CONTEXT7_API_KEY`는 환경변수로 전달하며 비밀값은 저장소에 넣지 않습니다.

제품 요구사항과 회귀 검사는 각 프로젝트의 문서·테스트·CI에서 관리합니다.

## 추가 검증

```sh
node --test tests/core.test.mjs tests/adapter.test.mjs
node tests/native-hook-integration.mjs
node --test tests/completion-guidance.test.mjs
```

- 통합 검사는 격리 환경과 로컬 모의 모델을 쓰므로 비용이 들지 않습니다.
- 확인 환경: OpenCode 2.0.29 / Linux arm64 (다른 OS는 미확인)
- 선택형 실모델 검사와 결과 해석: [검증 안내](docs/validation.md)

## 알아둘 점

- 소스 검사는 실제 화면 사용성·시각 품질·기능 검증을 대신하지 않습니다.
- 상세: [설치 안내](docs/installation.md) · [검증 안내](docs/validation.md)

[MIT](LICENSE) — Copyright (c) 2026 KSI
