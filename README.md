# KSI OpenCode Harness

**제품을 먼저 이해하고, 스스로 설계·구현 판단을 내리며, 실제 동작하는 결과물과 화면으로 검증하도록 구성한 OpenCode Native 개발 하네스입니다.**

단순히 지침을 기계적으로 따르거나 체크리스트만 통과시키는 것을 넘어, **① 제품의 목적과 사용자 여정 파악 → ② 기술·디자인 단위의 자율 설계 및 구현 → ③ 실제 런타임 빌드와 렌더링 화면(`scroll 0`) 대조 → ④ 독립 비평과 교정**으로 이어지도록 역할·권한·프롬프트·검증 도구를 정의합니다. 하네스의 라우팅·권한·위임 메커니즘은 자동화 테스트로 검증되며, 실제 제품의 UI/UX 완성도와 장기 개발 성과는 각 제품 과제의 실제 실행 결과로만 입증됩니다.

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

아래는 책임과 증거가 이어지는 방식입니다. 과업에 필요한 부분만 사용하며, 모든 역할·단계를 매번 거치는 고정 파이프라인은 아닙니다.

```text
[Step 0] 제품·여정 이해 (Product Comprehension)
  프로젝트 루트 AGENTS.md + 1순위 정본(PRD/헌장/불변식/여정/ADR) + 연결 라우트·코드 확인
  → "이 제품은 무엇이고, 누가 어떤 환경에서 쓰며, 이 화면/기능이 전체 여정에서 어떤 역할을 하는가?"

[Step 1] 공유 계약 고정 및 단위 배정 (Build / 선택적 Plan 자문)
  기술+UX 혼합 기능은 위임 전 최소 공유 계약(API/데이터 스키마, loading/empty/error/success 상태,
   에러·복구 의미, 파일·브라우저 소유자)을 맞추고 배정 — 기존 화면 배치까지 고정하지 않음
   ├─ 다단계 기술 단위 ──► Engineer (설계·구현·자동 재빌드·테스트·복구 완결)
   └─ 모든 UX/UI 단위 ───► Design   (UX/IA 구조 → 비주얼 조형 직접 작성·렌더 검증)

[Step 2] 도메인 스킬 로드 및 구현 (Engineer / Design / General)
  - Engineer: 도메인 스킬(diagnosing-bugs, evolving-apis-and-schemas 등) 로드 → 직접 구현 또는
              이미 결정된 단일 파일 슬라이스만 General에 위임 → 서버/번들/APK 자동 재빌드·검증
  - Design:   Stage A(designing-user-experience, journey, organize)로 과업 흐름·정보 구조 확립 →
              Stage B(impeccable craft-floor, ux-copy)로 시각 토큰·레이아웃·CSS 직접 작성

[Step 3] 결과물 기반 자체 검증 및 독립 비평 (Critic)
  - 실제 diff + 재빌드된 런타임 + 초기 진입(scroll 0) 목표 기기 캡처·조작 확인
  - 중요 변경은 미참여 Critic이 작성자의 수정 목록만이 아니라 원래 사용자 과업과 보호 계약으로 검토
  - 발견된 문제는 같은 담당 세션(sessionID)을 재개해 수정·재검증 ↺

[Step 4] 4대 제품 인수 게이트 대조 후 완료 (Build)
  ① 실제 제품 라우트·데이터 연결  ② 저장·새로고침·재진입 지속성
   ③ 빈/로딩/에러 복구·필요한 도움말·정직한 상태 표시  ④ 실제 렌더·테스트 provenance 입증
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
      ① **제품·여정 맥락과 목표** (사용자·환경·앞뒤 흐름·정본 경로, 보호할 확정 계약 vs 바꿔도 되는 가설·기존 배치)
     ② **담당 범위와 보호 경계** (수정할 파일, 건드리지 말아야 할 파일·제외 범위)
     ③ **런타임·검증 환경과 증거 경로** (실행 URL/명령, 테스트 데이터, 캡처 저장 경로)
     ④ **기대 산출물과 미해결 질문**
     ⑤ **브라우저/CLI 모드** (서브에이전트에서 데스크톱 Native Browser가 `browser.disconnected`이면 재시도 없이 즉시 `playwright-cli -s=<role>-<task>` 사용)
4. **위임은 인수가 아님 (3대 부모 인수 검증):**
    - 부모는 **① 실제 diff, ② 재빌드·테스트 실행, ③ 초기 진입·핵심 상태의 목표 기기 캡처와 조작**을 직접 확인합니다. 호출·캡처·검사 수만으로 과업 적합성을 인정하지 않습니다.

---

## 디자인·엔지니어링 실행 원칙

### 1. 프로덕트 디자인 (`Design` & `Critic`)
기술적 작동과 디자인 적합성을 구분합니다. 스킬·레퍼런스는 적용 원리가 실제 구성에 반영됐는지까지 확인하며, 별도 보고서·점수표를 요구하지 않습니다.

- **실제 제품 라우트 직접 수정:** 별도 와이어프레임만 요청받은 경우가 아니면 분리된 정적 HTML 파일(`workspace.html` 등)에 도피하지 않고 실제 제품의 라우트와 컴포넌트 트리를 직접 수정·연결합니다.
- **2단계 스킬 로드 (UX/IA → Visual Craft):**
  - **Stage A (과업 흐름·정보 구조):** 코드 수정 전 `designing-user-experience`(복수 화면·비교·네비게이션 재편 시 `journey`, `organize`, `wireframe`)를 호출해 **사용자가 데이터를 탐색·비교·결정하는 정보 구조와 상태 전이**부터 잡습니다.
  - **Stage B (시각 조형·문구 마감):** `impeccable`(`reference/craft-floor.md` + `operate.md`/`new-work.md`)과 `ux-copy`를 호출해 **타이포그래피 스케일, 서피스 명도 대비, 여백 리듬, 마이크로카피**를 직접 작성합니다.
- **과업 기반의 레이아웃 비례와 조형 (고정 비율 강제 지양):**
  - 모든 화면에 획일적인 수치(고정 비율·고정 폭)를 강제하지 않고 **해당 화면의 핵심 사용자 과업과 데이터 성격**에서 구성을 도출합니다.
  - 공간 작업은 시각 과업을, 폼·설정·오류 해결은 해당 콘텐츠와 행동을 우선합니다. 매체 부재는 정직하게 복구하며 다른 자료·시점·출처로 몰래 대체하지 않습니다. 대안은 제품 계약에 맞는 명시적 선택으로 제공합니다.
  - 터치 영역과 읽기 전용 띠의 높이는 별개입니다. 제목·영역도 문맥 전환의 포커스 대상일 수 있으므로 필요한 키보드 포커스를 스타일 때문에 제거하지 않습니다.
- **하네스 내부 메모와 도메인 출처·상태 정보의 명확한 구분:**
  - 내부 에이전트·디버그 잡담은 제품 UI에서 제외하되, 필요한 도움말과 실제 프로토타입·시뮬레이션 고지는 보존합니다.
  - 출처·정합·검증 한계는 판단에 영향을 주는 상태를 눈에 보이게, 보충 근거는 상세로 제공합니다. 요청 접수·모의 렌더를 실제 장치 결과로 표현하지 않습니다.

### 2. 엔지니어링 및 정본 관리 (`Engineer` & `Plan`)
- **코드 선행 대조와 범위 내 자율 재빌드:** 문서는 코드보다 늦게 갱신되므로 계획·구현 전 반드시 실제 파일과 최근 커밋(`git status`/`log`)을 대조해 이미 구현된 기능을 재작업하지 않습니다. 코드 수정 후에는 **자신이 소유한 로컬 번들·개발 서버·격리 컨테이너·승인된 로컬 APK 빌드를 자율 재빌드/재기동**하여 실제 런타임에서 검증하되, **공유 서비스·공유 컨테이너·운영 환경·미승인 실기 상태는 임의로 재시작하거나 변경하지 않습니다.**
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

이 저장소는 회귀·스펙 정합성·설치본 정책·격리 Native 메커니즘을 검사합니다. 실행 감사는 별도의 **선택 진단이며 합격 게이트가 아닙니다.** 어느 검사도 모델의 디자인 판단력이나 제품 완주를 인증하지 않습니다.

```sh
# 1. 단위·소스 계약 회귀 (모델의 판단력 검사가 아님)
node --test tests/completion-guidance.test.mjs tests/capabilities.test.mjs tests/session-audit.test.mjs tests/prompt-boundaries.test.mjs tests/permission-probe.test.mjs tests/delegation-errors.test.mjs tests/compaction-continuity.test.mjs

# 2. OpenSpec 정합성 검사
openspec validate --all

# 3. 전역 설치본 등록·모델·권한·본문 일치 검사 (327 checks, 모델 호출 없음)
node tests/agent-routing-native.mjs

# 4. 격리 Native 서버 깊이 3·위임·복구·병렬·세션 제한 상속 통합 검사 (312 checks, 로컬 fixture 모델)
node tests/delegation-native-integration.mjs

# 선택 진단: 등록 점검과 세션 흔적 관찰 — 품질/합격 판정 아님
node scripts/capabilities.mjs
node scripts/session-audit.mjs <session-json-file-or-dir>
```

- **세션 실행 이상 징후 탐지기 (`scripts/session-audit.mjs`):** 명시적으로 완료된 호출만 관찰 집계하며 미완료·실패를 분리합니다. 배열에 보이는 열람·편집 순서, 이미지 경로 열람과 검증 명령 패턴을 보여주지만 이미지의 관련성·검사 성공·제품 이해를 판정하지 않습니다. 누락 표시는 주입된 지침·앞선 맥락·인라인 이미지·부분 스냅샷을 고려해 수동 확인해야 합니다. 파일 제외·오류·중복 창·명시 ID/익명 스냅샷 범위를 공개하며, 파일 수를 독립 세션 수나 품질 점수로 해석하지 않습니다.
- 상세 검증 기록과 미완료 실증 과제(`openspec/changes/engineer-unit-openspec-skills/tasks.md` §5): [Engineer 구성 검증](docs/engineer-routing-validation.md) · [전체 검증 안내](docs/validation.md) · [OpenSpec 및 외부 스킬](docs/openspec-and-skills.md)

[MIT](LICENSE) — Copyright (c) 2026 KSI
