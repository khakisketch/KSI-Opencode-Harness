# KSI OpenCode Harness

**제품을 먼저 이해하고, 스스로 설계·구현 판단을 내리며, 실제 동작하는 결과물과 화면으로 검증하는 OpenCode Native 개발 시스템입니다.**

단순히 지침을 기계적으로 따르거나 체크리스트만 통과시키는 에이전트가 아니라, **① 제품의 목적과 사용자 여정 파악 → ② 기술·디자인 단위의 자율 설계 및 구현 → ③ 실제 런타임 빌드와 렌더링 화면(`scroll 0`) 대조 → ④ 독립 비평과 교정**으로 제품을 끝까지 완성합니다. 별도 외부 워크플로 엔진이나 강제 승인 파이프라인 없이 OpenCode Native 설정(`global/`)과 검증된 스킬로 동작합니다.

[시작하기](#시작하기) · [업무가 흐르는 방식](#업무가-흐르는-방식) · [역할과 위임 구조](#역할과-위임-구조) · [디자인·엔지니어링 실행 원칙](#디자인엔지니어링-실행-원칙) · [설치 및 파일 구성](#설정-및-설치-경로) · [검증 및 실행 감사](#검증-및-실행-감사)

> Clone/pull만으로는 전역 환경이 바뀌지 않습니다. [설치 안내](docs/installation.md)에 따라 기존 사용자 설정을 보존해 적용하세요.

---

## 시작하기

기본 메인은 **Build**입니다. 정해진 명령어나 고정된 역할 전환 순서 없이, 자연어로 목표와 제약만 전달하면 됩니다.

- **기능·제품 개발 (`Build` 선택):** “현장 정사영상 비교 흐름을 구현하고 실제 화면과 테스트까지 검증해줘.”
- **UI/UX 중심 개선 (`Design` 또는 `Build` 선택):** “운영사 선택 및 대시보드 첫 화면을 프로답게 재설계하고 데스크톱·모바일 렌더로 검증해줘.”
- **방향·우선순위 검토만 요청 (`Plan` 선택):** “남은 마일스톤과 이미 구현된 범위를 대조해서 다음 개발 순서를 정리해줘. 구현은 하지 마.”

### 사용자 상호작용 원칙
사용자가 아키텍처·역할·테스트·디자인 규칙을 일일이 지시할 필요가 없습니다.

- **자율 조사와 진행:** 목표만 주어져도(“그냥 해줘”) 프로젝트 정본과 현재 코드를 먼저 읽고 안전한 기본값을 세워 끝까지 진행합니다. 중간 마일스톤이나 하위 에이전트 완료 시점마다 “계속할까요?”라고 멈추지 않습니다.
- **질문은 권한 경계에서만:** 목표 충돌, 계약·비용·보안·데이터 정책 변경, 되돌리기 어려운 작업, 접근 권한 부재, 사용자 가치가 크게 갈리는 핵심 UI 선택에만 질문합니다(상황·선택지·추천·기본값·영향 명시).
- **시각적 선택은 말 대신 구체물로:** 레이아웃이나 흐름 선택이 필요할 때는 추상적인 텍스트 질문 대신 실제 화면 주석, 와이어프레임, 연결 흐름, 스타일 예시 중 가장 빠른 구체물을 보여주고 반응을 받습니다.
- **증상에서 바로 코드로 뛰지 않음:** 화면·제품 문제가 보고되면 실제 빌드·화면·콘솔·데이터를 먼저 관찰해 **관찰 사실과 원인 가설**을 분리하고, 깨진 사용자 과업과 해결 검증 조건을 정의한 뒤 수정합니다.

---

## 업무가 흐르는 방식

요청이 들어오면 모든 역할(`Build`, `Plan`, `Engineer`, `Design`, `Critic`)은 곧바로 파일을 고치는 대신 다음 **5단계 흐름**으로 움직입니다.

```text
[Step 0] 제품·여정 이해 (Product Comprehension)
  프로젝트 루트 AGENTS.md + 1순위 정본(PRD/헌장/불변식/여정/ADR) + 연결 라우트·코드 확인
  → "이 제품은 무엇이고, 누가 어떤 환경에서 쓰며, 이 화면/기능이 전체 여정에서 어떤 역할을 하는가?"

[Step 1] 공유 계약 고정 및 단위 배정 (Build / 선택적 Plan 자문)
  기술+UX 혼합 기능은 위임 전 최소 공유 계약(API/데이터 스키마, loading/empty/error/success 상태,
  에러·복구 응답, 파일·브라우저 소유자)을 먼저 고정하고 독립 단위로 배정
   ├─ 다단계 기술 단위 ──► Engineer (설계·구현·자동 재빌드·테스트·복구 완결)
   └─ 모든 UX/UI 단위 ───► Design   (UX/IA 구조 → 비주얼 조형 직접 작성·렌더 검증)

[Step 2] 도메인 스킬 로드 및 구현 (Engineer / Design / General)
  - Engineer: 도메인 스킬(diagnosing-bugs, evolving-apis-and-schemas 등) 로드 → 직접 구현 또는
              이미 결정된 단일 파일 슬라이스만 General에 위임 → 서버/번들/APK 자동 재빌드·검증
  - Design:   Stage A(designing-user-experience, journey, organize)로 과업 흐름·정보 구조 확립 →
              Stage B(impeccable craft-floor, ux-copy)로 시각 토큰·레이아웃·CSS 직접 작성

[Step 3] 결과물 기반 자체 검증 및 독립 비평 (Critic)
  - 변경 파일 실제 diff(git status/diff) + 재빌드된 런타임 실행 + 초기 진입(scroll 0) 데스크톱·모바일 캡처 직접 read 판독
  - 중요 변경은 미참여 새 세션의 Critic이 실제 사용자 과업 완수 가능성과 구조·조형·계약 결함을 독립 비평
  - 발견된 문제는 같은 담당 세션(sessionID)을 재개해 수정·재검증 ↺

[Step 4] 4대 제품 인수 게이트 대조 후 완료 (Build)
  ① 실제 제품 라우트·데이터 연결  ② 저장·새로고침·재진입 지속성
  ③ 빈/로딩/에러 상태 복구 및 원시 코드·감사 문구 비노출  ④ 실제 렌더·테스트 provenance 입증
```

---

## 역할과 위임 구조

Native 기본 4개 역할(**Build · Plan · General · Explore**)과 전문 4개 역할(**Engineer · Design · Research · Critic**)의 **8개 역할**로 구성됩니다. 최대 위임 깊이는 **3**(`root 0 → 1 → 2 → 3`, 평소 1~2단계)이며, 고정 파이프라인이 아니라 작업 성격에 따라 필요한 전문가만 동적으로 호출합니다.

| 역할 / ID | 핵심 책임과 소유 범위 | 모드 | 기본 모델 (`opencode-go/muse-spark-1.3-contributor`) | 허용된 하위 호출 (`subagent`) |
| --- | --- | --- | --- | --- |
| **Build** (`build`) | 제품 실행 총괄, 공유 계약 고정, 통합, 종단 검증, 최종 인수 | `primary` | 세션 선택 (전역 미고정) | `plan`, `engineer`, `design`, `general`, `explore`, `research`, `critic` |
| **Plan** (`plan`) | 제품·여정·정본 대조, 미구현 범위 식별, 우선순위·방향·대안 자문 (구현·승인 금지) | `all` | `#xhigh` | `explore`, `research`, `critic` (구현 역할 호출 금지) |
| **Engineer** (`engineer`) | 다단계 기술 단위(API/데이터, 상태·동시성, 보안, 마이그레이션, 복구, 구현·테스트) 완결 | `subagent` | `#xhigh` | `plan`, `design`, `general`, `explore`, `research`, `critic` |
| **Design** (`design`) | 모든 UI/UX 단위 소유, 정보 구조·여정 설계, 시각 계층(토큰·레이아웃·CSS) 직접 작성, 렌더 교정 | `all` | `#xhigh` | `plan`, `engineer`, `general`, `explore`, `research`, `critic` |
| **General** (`general`) | 이미 결정된 단일 파일·수정·테스트 슬라이스 실행 및 검증 (설계·단위 소유 없음) | `subagent` | `#high` | 없음 (말단) |
| **Research** (`research`) | 외부 레퍼런스(Mobbin/웹), 공식 문서(Context7), 충돌 근거 비교·종합 및 원본 반환 | `subagent` | `#high` | `explore` |
| **Explore** (`explore`) | 로컬 코드베이스 내 파일·심볼·호출 경로 빠른 위치 탐색 (20 steps) | `subagent` | `#medium` | 없음 (말단) |
| **Critic** (`critic`) | 미참여 세션에서 사용자 과업·UX·조형·코드·계약·보안의 독립 비평 (수정·인수 없음) | `subagent` | `#xhigh` | 없음 (말단) |

### 역할 간 경계와 핸드오프 규칙

1. **Engineer vs General (소유권과 실행의 분리):**
   - 미해결 설계 결정, 여러 파일·상태·계약 변경, 테스트·수리 반복이 있는 기술 작업은 **항상 `Engineer`가 소유**합니다.
   - `General`은 접근법·대상 파일·검증 방법이 이미 확정된 **단일 슬라이스의 실행자**입니다. 향후 `General`을 로컬 코딩 모델로 교체하더라도 소유권 계약은 변하지 않습니다.
2. **세션 수명주기 (`1 General 세션 = 1 슬라이스`):**
   - 새로운 하위 산출물, 새로운 슬라이스, 또는 중요한 최종 `Critic` 검토는 **항상 새 자식 세션(`sessionID` 생략)**으로 시작합니다.
   - **같은 슬라이스에 대한 후속 수정·보수·재검증만 기존 자식 `sessionID`를 재개(resume)**하여 컨텍스트 오염을 막고 깊이를 아낍니다.
3. **5대 핸드오프 패킷 (새 자식 세션 호출 시 필수 전달):**
   - 새 자식 세션은 부모의 대화 이력을 물려받지 못하므로 전체 대화를 복사하는 대신 다음 5가지를 명확히 전달합니다:
     ① **제품·여정 맥락과 목표** (어떤 제품/사용자를 위한 것인지, 앞뒤 화면·서비스와의 연결, 읽어야 할 정본 문서 경로, 확정 계약 vs 수정 가능한 가설)
     ② **담당 범위와 보호 경계** (수정할 파일, 건드리지 말아야 할 파일·제외 범위)
     ③ **런타임·검증 환경과 증거 경로** (실행 URL/명령, 테스트 데이터, 캡처 저장 경로)
     ④ **기대 산출물과 미해결 질문**
     ⑤ **브라우저/CLI 모드** (서브에이전트에서 데스크톱 Native Browser가 `browser.disconnected`이면 재시도 없이 즉시 `playwright-cli -s=<role>-<task>` 사용)
4. **위임은 인수가 아님 (3대 부모 인수 검증):**
   - 부모(`Build`, `Engineer`, `Design`)는 자식의 텍스트 보고만 믿고 완료 처리하지 않고, 반환 즉시 **① 실제 파일 변경(`git status`/`diff`), ② 재빌드 및 테스트 실행 결과, ③ 초기 진입(`scroll 0`) 데스크톱·모바일 실제 캡처 이미지(`read`)**를 직접 확인합니다.

---

## 디자인·엔지니어링 실행 원칙

### 1. 프로덕트 디자인 (`Design` & `Critic`)
단순히 “오류가 안 나는 관리자 테이블”이 아니라 **실제 프로덕트 디자이너가 설계한 화면**을 만들기 위해 다음 원칙을 강제합니다.

- **실제 제품 라우트 직접 수정:** 별도 와이어프레임만 요청받은 경우가 아니면 분리된 정적 HTML 파일(`workspace.html` 등)에 도피하지 않고 실제 제품의 라우트와 컴포넌트 트리를 직접 수정·연결합니다.
- **2단계 스킬 로드 (UX/IA → Visual Craft):**
  - **Stage A (과업 흐름·정보 구조):** 코드 수정 전 `designing-user-experience`(복수 화면·비교·네비게이션 재편 시 `journey`, `organize`, `wireframe`)를 호출해 **사용자가 데이터를 탐색·비교·결정하는 정보 구조와 상태 전이**부터 잡습니다.
  - **Stage B (시각 조형·문구 마감):** `impeccable`(`reference/craft-floor.md` + `operate.md`/`new-work.md`)과 `ux-copy`를 호출해 **타이포그래피 스케일, 서피스 명도 대비, 여백 리듬, 마이크로카피**를 직접 작성합니다.
- **개발자 스캐폴딩 교체(Elevate)와 비례 규칙:**
  - 기존 화면이 투박한 개발자 스캐폴딩이나 카드 나열이면 옛 스타일을 보존하지 않고 시각 체계부터 새로 잡습니다.
  - **데스크톱 100% 폭 늘림 금지:** 데스크톱(`>480px`)에서 `<select>`, `<input>`, `<button>`을 화면 가로 전체로 늘리거나 카드 하나 아래 화면 절반 이상을 빈 여백으로 방치하지 않습니다(`360–480px` 컨테이너 또는 컴팩트 인라인 툴바 사용).
  - **캔버스 우선 워크스페이스:** 지도·정사영상·비디오·검토 화면에서는 실제 시각 캔버스가 뷰포트의 75% 이상을 차지해야 하며, 거대한 검은 만료 박스로 화면을 가리지 않고 가용 레이어 폴백이나 한 줄 복구 바로 처리합니다.
  - **중첩 카드·Eyebrow 도배 금지:** 습관적인 카드 안의 카드(`card-in-card`) 대신 2단계 뉴트럴 배경 면과 여백 비례로 영역을 나누고, 수치·날짜에는 `tabular-nums`를 적용합니다.
- **하네스/감사 메타 문구의 화면 노출 절대 금지:**
  - `(SYNTHETIC)`, `프로토타입 — 제품 구현 아님`, `등록≠검사≠사용 적합≠정확도`, `정합 근거 없음`, 또는 버튼 위치를 설명하는 문구(`층 전환은 상단 막대에서`)를 **제품 화면(DOM)에 렌더링하는 것은 즉시 실패(Fail)**입니다. 검증 한계는 오직 사용자에게 보내는 채팅 응답에만 적습니다.

### 2. 엔지니어링 및 정본 관리 (`Engineer` & `Plan`)
- **코드 선행 대조와 자동 재빌드:** 문서는 코드보다 늦게 갱신되므로 계획·구현 전 반드시 실제 파일과 최근 커밋(`git status`/`log`)을 대조해 이미 구현된 기능을 재작업하지 않습니다. 코드 수정 후에는 단위 테스트만 돌리고 멈추지 않고 **번들·서버·컨테이너·APK를 자동으로 재빌드/재기동**해 실제 런타임에서 검증합니다.
- **원인 기반 디버깅 (`diagnosing-bugs`):** 원인이 불분명하거나 반복되는 버그는 추측성 수정을 반복하지 않고 **① 재현 신호 확보 → ② 가설·이분 탐색 → ③ 최소 수정 → ④ 회귀 테스트 → ⑤ 런타임 재검증** 순서로 해결합니다.
- **정본(Authority) 우선과 선택적 OpenSpec:**
  - 모든 작업은 각 프로젝트 루트 `AGENTS.md`가 지정한 1순위 정본 문서(`product-state.md`, `00_READ_FIRST.md`, `ADR-*` 등)를 최우선 권위로 따릅니다(문서에 옛 역할명 `Design Specialist` 등이 남아 있으면 현행 `Design` 등으로 자동 매핑).
  - 이미 `openspec/`을 사용하는 저장소에서는 스펙 변경 시 공식 아티팩트를 사용하되, 자체 PRD/ADR 정본 체계를 갖춘 프로젝트에 중복 명세를 만들지 않습니다.

### 3. 역할별 허용 스킬·도구 매핑

| 역할 | 허용된 스킬 및 외부 도구 |
| --- | --- |
| **Build** | OpenSpec, `opencode`, Browser, Playwright CLI, Context7, Mobbin |
| **Plan** | `opencode` (분석 전용; 구현·편집 거부) |
| **Engineer** | `diagnosing-bugs`, `evolving-apis-and-schemas`, `investigating-performance`, `reviewing-security`, `vercel-react-best-practices`, `building-accessible-interfaces`, `playwright-cli`, Context7 |
| **Design** | `designing-user-experience`, `journey`, `organize`, `wireframe`, `impeccable` (`detect --json` 포함), `ux-copy`, `building-accessible-interfaces`, `ux-heuristics-audit`, `mobbin-design`, `vercel-react-best-practices`, `emilkowalski-motion`, `playwright-cli`, Browser, Mobbin |
| **General** | `vercel-react-best-practices`, `evolving-apis-and-schemas`, `building-accessible-interfaces`, `playwright-cli`, `opencode`, `impeccable`, `ux-copy`, `diagnosing-bugs` (전략·IA·보안 리뷰 스킬 제외) |
| **Research** | `playwright-cli`, `mobbin-design`, `journey`, `organize`, `building-accessible-interfaces`, `opencode`, Context7, Mobbin 검색 3종 (`research-*` 고유 CLI 세션) |
| **Critic** | `ux-heuristics-audit`, `building-accessible-interfaces`, `ux-copy`, `impeccable`, `journey`, `organize`, `reviewing-security`, `evolving-apis-and-schemas`, `investigating-performance`, `vercel-react-best-practices`, `playwright-cli`, `opencode`, Context7 (`critic-*` 고유 CLI 세션) |
| **Explore** | 읽기·검색 전용 (`read`, `glob`, `grep`; 스킬·하위 위임 없음) |

---

## 설정 및 설치 경로

저장소의 `global/` 파일 6개가 배포 정본이며, `~/.config/opencode/`에 동일 바이트로 적용되어야 합니다. 상세 절차와 설치 프롬프트는 [설치 안내](docs/installation.md)를 참고하세요.

| 저장소 정본 | 전역 설치 경로 | 설명 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 전 역할 공통 제품 이해·위임·인수·안전 지침 |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 깊이 3, 기본 에이전트 권한·모델, Context7·Mobbin MCP 설정 |
| `global/agents/engineer.md` | `~/.config/opencode/agents/engineer.md` | 기술 단위 소유자 프롬프트·권한 (`#xhigh`) |
| `global/agents/design.md` | `~/.config/opencode/agents/design.md` | UI/UX 단위 소유자 프롬프트·권한 (`#xhigh`) |
| `global/agents/research.md` | `~/.config/opencode/agents/research.md` | 심층 조사·레퍼런스 연구자 프롬프트·권한 (`#high`) |
| `global/agents/critic.md` | `~/.config/opencode/agents/critic.md` | 독립 비평자 프롬프트·권한 (`#xhigh`) |
| `docs/archive/agents/architect.md` | 설치하지 않음 | 아카이브 보존본 (발견·등록 제외) |

---

## 검증 및 실행 감사

이 저장소는 **① 정적/모의 회귀 검사, ② 실제 설치본 권한·라우팅 검사, ③ 격리 Native 서버 중첩 실행 검사, ④ 실제 작업 세션의 행동(정본 열람·스킬 호출·캡처 판독) 감사** 4단계로 검증합니다.

```sh
# 1. 단위 회귀 테스트 (완료 판단·능력 진단·세션 실행 감사·권한 프로브·깊이 오류·압축 연속성 106개)
node --test tests/completion-guidance.test.mjs tests/capabilities.test.mjs tests/session-audit.test.mjs tests/permission-probe.test.mjs tests/delegation-errors.test.mjs tests/compaction-continuity.test.mjs

# 2. OpenSpec 정합성 검사
openspec validate --all

# 3. 전역 설치본 등록·모델·권한·본문 일치 검사 (327 checks, 모델 호출 없음)
node tests/agent-routing-native.mjs

# 4. 격리 Native 서버 깊이 3·위임·복구·병렬·세션 제한 상속 통합 검사 (312 checks, 로컬 fixture 모델)
node tests/delegation-native-integration.mjs

# 5. 정적 능력(8역할·17스킬·2MCP·3CLI) 등록 점검 및 실제 세션 실행 감사
node scripts/capabilities.mjs
node scripts/session-audit.mjs <session-json-file-or-dir>
```

- **세션 실행 감사 (`scripts/session-audit.mjs`):** 지침이 문서에만 머물지 않고 실제 작업 세션에서 작동했는지 확인하기 위해, 세션 로그에서 **역할별 정본 문서(`AGENTS.md`/`ADR`/`product-state.md`) 열람 여부, 실제 `skill` 도구 호출 목록, 렌더링 캡처 이미지(`read`) 판독 횟수, `detect --json` 실행 여부**를 집계하고 누락(`design-edited-without-authority-read`, `design-edited-without-skill-or-craft-reference`, `design-edited-without-visual-capture-read`, `engineer-edited-without-runtime-or-test-check`, `critic-reviewed-without-skill-lens` 등)을 자동으로 검출합니다.
- 상세 검증 기록과 한계: [Engineer 구성 검증](docs/engineer-routing-validation.md) · [전체 검증 안내](docs/validation.md) · [OpenSpec 및 외부 스킬](docs/openspec-and-skills.md)

[MIT](LICENSE) — Copyright (c) 2026 KSI
