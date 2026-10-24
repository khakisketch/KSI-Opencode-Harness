# KSI OpenCode Harness

**Build가 제품 실행을 총괄하고, 필요한 전문가를 동적으로 위임해 구현·검증·교정까지 이어가는 OpenCode Native 하네스입니다.**
전역 지침·에이전트·모델/도구 권한을 구성하고, UI 소스 검사는 설치된 Impeccable의 공식 수동 검사를 사용합니다. 별도 실행 프레임워크나 필수 승인 파이프라인은 없습니다.

[시작하기](#시작하기) · [역할과 위임 구조](#역할과-위임-구조) · [개발 워크플로](#개발-워크플로) · [디자인 및 검증 도구](#디자인-및-검증-도구) · [설치·업데이트](#설정-및-설치-경로) · [검증 범위](#추가-검증)

> Clone/pull만으로는 전역 환경이 바뀌지 않습니다. [설치 안내](docs/installation.md)에 따라 기존 사용자 설정을 보존해 적용하세요.

## 시작하기

기본 메인은 Build입니다. 일반 문장으로 목표와 제약을 전달하며, 별도 명령이나 고정된 Plan→Build→Design 전환 순서는 필요 없습니다.

- **개발:** Build 선택 → “CSV 내보내기를 구현하고 테스트와 실제 흐름을 검증해줘.”
- **계획만 요청:** Plan을 선택 → “예약 업무의 남은 목표와 구현 순서를 검토해줘. 구현은 하지 마.”
- **UI 중심 작업:** Design을 메인으로 선택해도 됩니다 → “결제 완료 흐름을 개선하고 실제 렌더로 검증해줘.”

한 작업의 메인은 한 명입니다. 이는 책임 소유 원칙이지 작업자 한 명이나 직렬 실행을 뜻하지 않습니다. Design을 메인으로 선택했다면 맡은 UI 단위의 통합·완료를 책임지며 별도의 Build를 추가하지 않습니다. Plan이 메인이면 승인된 계획 결과를 책임지며, 계획 요청을 하위 위임으로 구현 승인처럼 바꾸지 않습니다.

## 사용자 상호작용 계약

사용자는 목표·의도·제약만 주거나 “그냥 해줘”라고 할 수 있습니다. 하네스는 사용자가 아키텍처·테스트·역할·모델·수용 기준을 잘 설명할 것이라고 가정하지 않습니다.

- 코드·제품·기존 자료를 먼저 조사하고, 가정과 안전한 기본값을 세워 기술 작업을 진행합니다.
- 질문은 **권한이 필요한 지점**에만 합니다: 목표·우선순위 충돌, 제품 계약·비용·보안·데이터 정책 변경, 되돌리기 어려운 작업, 접근 권한 부재, 사용자 가치 판단이 갈리는 중요한 UI 선택.
- 질문에는 상황, 선택지, 추천, 기본값, 잘못 선택했을 때의 영향을 함께 적습니다.
- 시각적 선택은 말로 묻지 않고 **보여줍니다**. 현재 화면 주석, 와이어프레임, 연결된 흐름, 스타일 예시, 실제 구현 상태 중 질문을 해결하는 가장 저렴한 구체물을 실제 과업 맥락에서 보여주고, 추상적 설명 대신 보여준 결과에 대한 반응을 받습니다. 승인 범위 안에서는 보여주고 진행하는 쪽을 우선합니다.
- 보고에는 결과, 실제 검증 증거, 상태(완료/부분/차단), 남은 위험·미해결, 다음 통합 결과를 적습니다.
- 기술 방법·역할·모델·테스트 선택을 사용자에게 떠넘기거나, 이미 승인된 작업의 실행을 다시 승인받지 않습니다.
- 사용자가 직접 진단·검수·프로젝트 관리를 해야 한다고 가정하지 않습니다. 하네스가 조사·검증·복구를 책임집니다.

## 역할과 위임 구조

Native 이름 **Plan·Build·General·Explore**는 유지하고, 기본 전문 역할은 **Engineer·Design·Research·Critic**으로 구성합니다. Architect 파일은 보존하되 기본 호출에서 제외합니다. 다음은 **가능한 동적 트리의 한 예시**이며 관계·호출 순서·호출 개수는 고정하지 않습니다.

```text
Build — depth 0 · 제품 실행 총괄·통합·최종 인수
 ├─ Engineer — depth 1 · 독립 기술 개발 단위 완결
 │    ├─ General — depth 2 · 구현·테스트·수정
 │    └─ Plan — depth 2 · 중요한 방향·기술 계약 자문
 │         └─ Explore — depth 3 · 관련 코드 탐색
 ├─ Design — depth 1 · UX 단위 설계·구현 조율·렌더 교정
 │    └─ General — depth 2 · UI 구현·기술적 결함 수정
 └─ Critic — depth 1 · 필요한 제품/UX/기술 독립 비평
```

조사·설계와 최종 인수의 Build는 **같은 제품 실행 책임자**입니다. Research의 결과는 호출한 Design/Plan 등이 해석하고, 각 부모는 맡은 단위의 결과를 검토·통합해 반환합니다. 중간 역할은 단순 전달자가 아닙니다. 모든 요청에 깊이 3을 사용하거나 모든 역할을 호출하지 않습니다.

**대표 사용 흐름:** Build가 목표·현재 상태에서 다음 통합 결과를 고르고 복잡한 기술 단위는 Engineer, UX 단위는 Design에 맡깁니다. 각 소유자는 조사·설계·구현·테스트·수정까지 완결하고 중요한 방향·공유 계약만 Plan에 자문합니다. Critic의 근거 있는 발견은 같은 담당 세션의 수정·재검증으로 연결합니다. Build는 공통 계약·충돌·통합·종단 사용자 과업과 최종 인수에 집중하고 남은 승인 목표를 잇습니다. 중요한 미결 UI 선택은 추상적으로 묻지 않고 실제 화면·와이어프레임·연결 흐름·스타일 예시로 먼저 보여주며, 보여준 결과에 대한 반응과 추천·손익을 바탕으로 결정합니다. 승인 범위 안에서는 보여주고 진행하는 쪽을 우선하고, 일상적인 판단은 자율 진행합니다.

Build는 명확한 작은 구현을 General에 직접 맡기거나 직접 처리하며 Research·Explore를 사용할 수도 있습니다. Design을 메인으로 시작하면 Engineer·Research·Critic 등을 직접 호출할 수 있습니다. Engineer와 Design은 남은 깊이 안에서 서로 필요한 독립 단위를 맡길 수 있지만 같은 과업을 조상에게 되돌리지 않습니다.

독립적인 작업 단위는 다음처럼 병렬로 진행할 수 있습니다. Design A·B는 같은 `design`의 별도 세션이며 각자 맡은 단위의 진단·설계·구현 조율·렌더 검증까지 책임집니다.

```text
Build — 전체 목표·공통 계약·교차 일관성·통합·최종 인수
 ├─ Engineer A — 데이터 API 개선 → General A
 ├─ Engineer B — 분석 워커 개선 → General B
 └─ Design C   — 자료 비교 경험 개선 → General C
```

분할 기준은 화면 수가 아니라 작업의 완결성과 의존성입니다. 시간 이득이 조율·모델 비용에 비해 유효하고 사용자 예산 안에 있을 때 병렬로 맡기며, 같은 파일·브라우저 상태는 한 소유자가 변경하도록 조율합니다. 공통 디자인·컴포넌트·API 계약은 공유하고 Build가 통합 결과의 일관성을 확인합니다. 각 단위의 후속 수정은 기존 담당 세션을 재사용하고, 의존성이 크거나 작은 작업은 직접·직렬 처리합니다. 충분한 조사·근거는 재사용하며 중복 수집을 피합니다.

| 역할 / Native ID | 책임 | 모드 | 배포 기본 모델 |
| --- | --- | --- | --- |
| **Build** / `build` | 제품 실행 총괄·다음 작업 연결·통합·테스트·최종 인수 | primary | 세션 선택, 전역 모델 미고정 |
| **Plan** / `plan` | 제품·기술 방향, 요구·우선순위·대안·의존성 독립 자문 | all | `opencode-go/muse-spark-1.3-contributor#xhigh` |
| **General** / `general` | 맡은 구현·실행·기술적 결함 수정 | subagent | `opencode-go/muse-spark-1.3-contributor#high` |
| **Explore** / `explore` | 기존 코드·구조 탐색 | subagent | `opencode-go/muse-spark-1.3-contributor#low` |
| **Engineer** / `engineer` | 기술 단위 설계·구현 조율·테스트·복구·반복 개선 | subagent | `opencode-go/muse-spark-1.3-contributor#high` |
| **Research** / `research` | 심층 조사·사례 비교·기술/제품/UX 대안·적용 조건·원본 근거 | subagent | `opencode-go/muse-spark-1.3-contributor#medium` |
| **Design** / `design` | UI/UX·여정·정보 구조·인터랙션·구현 조율·렌더 교정 | all | `opencode-go/muse-spark-1.3-contributor#high` |
| **Critic** / `critic` | 제품·UX·코드·기술 설계의 독립 비평·반례·누락 검토 | subagent | `opencode-go/muse-spark-1.3-contributor#xhigh` |

표는 저장소의 배포 정본이며 2026-10-24 전역 적용본과 일치합니다. 실제 모델의 역할별 품질·비용 검증은 별도입니다. [적용 상태·모델 정책·검증 근거](docs/engineer-routing-validation.md).

**Architect와 이전 역할:** `architect`는 더 이상 등록·호출되지 않습니다. 원본은 `docs/archive/agents/architect.md`에 보존합니다. 기술 단위 설계·구현은 Engineer, 중요한 방향·아키텍처 자문은 Plan, UI 단위는 Design이 맡습니다. `design-architect`는 `design`, `ux-scout`는 `research`, `ui-ux-critic`·`product-reviewer`는 `critic`으로 이전됐고, 이전 ID를 새 작업의 별칭으로 다시 등록하지 않습니다. 기존 세션은 idle 상태로 보존되지만 새 작업의 호출 대상은 아닙니다.

**작업 단위 기준**은 호출 가능한 역할 목록과 별개입니다.

| 작업 단위 | 소유자 | 경계 |
| --- | --- | --- |
| 다단계 기술 단위 — 미해결 구현 결정, 여러 파일·계약·상태, 테스트/수리 반복 | Engineer | General에는 이미 결정된 작은 슬라이스만 |
| 단일 슬라이스 — 대상 파일·수정·테스트가 이미 정해짐 | General (Engineer/Design 소유 단위 안) | 설계·아키텍처·UX 결정과 단위 인수 없음 |
| 모든 UX/인터페이스 단위 | Design | 작은 UI 수정 포함; General은 결정된 UI 슬라이스 실행 가능 |
| 요구·우선순위·순서 | Plan | 구현·구현 승인 없음 |
| 위치·사실 검색 | Explore | 국소 검색·추출; 대안 합성·디자인 판단 없음 |
| 근거 비교·적용 조건·미확인 | Research | 제품 코드 작성 없음 |
| 독립 검토 | Critic | 구현·재설계·최종 인수 없음 |

한 단위의 소유자는 바뀌지 않습니다. 전문 역할 호출은 별도 하위 산출물이 있을 때만 하며, 같은 단위를 Engineer↔Design 또는 Plan↔Engineer 사이에서 왕복시키지 않습니다. 경계 자문은 소유권 이전이 아닙니다.

### Build의 첫 소유자 선택

Build는 역할 이름이 아니라 **작업 단위와 책임**으로 첫 소유자를 고릅니다.

```text
제품 목표·제약 → (필요 시 Plan/Research) → Build가 다음 통합 결과 선택
  ├─ 기술 단위 → Engineer → General/Explore/Research/Plan/Design/Critic ↺
  └─ UX 단위   → Design   → General/Research/Engineer/Critic ↺
→ Build 통합·종단 과업 검증·최종 인수
```

1. **요구·우선순위·방향이 불명확하거나 큰 전환·정체** → Plan에 분석 자문. Plan은 구현·승인하지 않습니다.
2. **UX/인터페이스 표면이 있음** → 크기와 무관하게 Design. 작은 UI 수정도 Design이 소유하고, 결정된 슬라이스만 General이 실행할 수 있습니다.
3. **미해결 구현 결정·여러 파일/계약/상태·테스트/수리 반복** → Engineer. Engineer가 기술 단위를 끝까지 소유합니다.
4. **대상 파일·수정·검증이 이미 정해진 단일 슬라이스** → General 또는 직접. 범위가 커지면 Engineer/Design으로 반환합니다.
5. **기술과 UX가 함께 있는 제품 단위** → Build가 공통 계약·순서를 정하고 Engineer와 Design에 나눕니다. Design은 UI 단위, Engineer는 그 뒤의 기술 계약을 소유하며, 같은 파일·브라우저 상태는 한 소유자만 변경합니다.
6. **코드 위치·사실이 불명확** → Explore. **자료가 충돌하거나 대안·적용 조건을 비교해야 함** → Research. 둘 다 소유자가 결과를 해석합니다.
7. **중요한 독립 검토가 필요** → Critic. 필수 게이트가 아니며, 발견은 소유자의 수정·반증으로 이어집니다.

**Build → General vs Build → Engineer**

| | Build → General | Build → Engineer |
| --- | --- | --- |
| 조건 | 접근·계약·검증이 이미 정해진 단일 슬라이스 | 아직 결정·조정이 필요한 다단계 기술 단위 |
| 예 | 오타, 단일 테스트 수정, 알려진 설정 변경, 명확한 국소 리팩터 | 새 API+데이터/마이그레이션, 권한·상태·동시성, 원인 불명 버그, 여러 모듈 통합 |
| Build가 넘기는 것 | 대상 파일·변경·완료 조건·검증 | 목표·확정 계약·허용 범위·현재 상태·검증 조건 |
| 소유권 | Build가 작은 슬라이스를 관리하고 General은 실행만 | 기술 단위 소유권이 Engineer로 이전 |
| 하위 호출 | 없음 | General·Explore·Research·Plan·Design·Critic |
| 범위가 커지면 | Engineer/Design으로 반환 | Engineer가 계속 소유 |

General은 “작은 Engineer”가 아니라 **이미 결정된 슬라이스의 실행자**입니다. Engineer는 “큰 General”이 아니라 **기술 단위의 소유자**입니다. Build가 General을 직접 호출하는 것은 Engineer를 거치지 않는 독립적인 작은 실행이고, Engineer가 General을 호출하는 것은 Engineer 단위 안의 구현 슬라이스를 맡기는 것입니다.

이 구분은 모델 성능이나 실행 위치와 무관합니다. General이 Qwen 27B·Qwen Flash Next 같은 로컬 코딩 모델로 바뀌어도 General은 결정된 슬라이스 실행자이고, Engineer는 사고·설계·조율이 필요한 기술 단위 소유자입니다. 모델이 강해져도 소유권이 자동으로 General에 이전되지 않으며, 모델이 약해지면 Engineer가 슬라이스를 더 좁게 주거나 직접 수행합니다. 반대로 Engineer가 더 강한 모델을 쓰더라도 이미 결정된 작은 실행까지 모두 떠안을 필요는 없습니다.

**General을 로컬 코딩 모델로 바꿀 때**

1. `agents.general.model`만 바꾸고 역할·권한·소유권 계약은 유지합니다.
2. 로컬 런타임의 도구 호출·컨텍스트·라이선스·데이터 정책을 확인합니다.
3. 결정된 슬라이스 벤치마크로 구현·테스트·수리 품질을 비교합니다.
4. 품질이 부족하면 슬라이스를 더 좁게 주거나 Engineer가 직접 수행합니다.
5. 불명확한 기술 단위를 General에 넘겨 소유권을 사실상 이전하지 않습니다.

이 원칙은 기술+UX 혼합 작업에도 적용됩니다. Engineer와 Design이 직접 협의할 수는 있지만, 같은 단위를 조상에게 되돌리거나 두 역할이 동시에 소유하지 않습니다.

### Engineer 기술 단위 흐름

기술 단위도 바로 코드부터 쓰지 않습니다. 먼저 계약·상태·실패 경로를 확인하고, 필요한 근거를 모은 뒤 구현·검증·수리까지 소유합니다. 아래는 예시이며 고정 단계가 아닙니다.

```text
[1] 접수와 경계
Build → Engineer: 목표·확정 계약·허용 범위·현재 상태·검증 조건
Engineer: API/데이터·상태 소유·권한·호환성·마이그레이션·복구 위험 확인

[2] 근거
  ├─ 코드 위치·호출 경로 → Explore
  ├─ 외부 문서·대안·충돌 근거 → Research / Context7
  └─ 요구·우선순위·기술+제품 방향이 불명확 → Plan 자문

[3] 설계·구현
Engineer: 인터페이스·데이터/상태 소유·실패 복구·마이그레이션 설계
  ├─ UI 경계·상태·상호작용 계약 → Design과 직접 협의 (UI 소유권은 Design)
  ├─ 이미 결정된 파일·수정·테스트 슬라이스 → General
  └─ 작은/긴밀한 작업 → Engineer 직접 구현

[4] 검증·수리
General/Engineer: 빌드·테스트·실행 → 기술 결함 수정 ↺
Engineer: 실제 런타임·데이터·복구·호환성 확인
  └─(선택) Critic: 계약·아키텍처·보안·테스트 엄밀성 독립 비평

[5] 반환
Engineer → Build: 변경·검증 환경/버전·목표 충족·미해결·통합 작업
```

**Engineer가 다른 역할을 쓰는 조건**

| 역할 | 쓰는 조건 | 기대 반환 | 하지 않는 것 |
| --- | --- | --- | --- |
| Explore | 파일·심볼·호출 경로가 불명확 | 경로·사실 | 설계·대안 판단 |
| Research | 외부 문서·사례·대안·충돌 근거가 필요 | 원본·비교·적용 조건·미확인 | 제품 코드·최종 설계 |
| Plan | 요구·우선순위·방향·큰 전환이 불명확 | 대안·의존성·권장 순서 | 구현·승인 |
| General | 대상 파일·수정·테스트가 이미 결정됨 | 구현·실행·국소 수리 | 아키텍처·UX 결정 |
| Design | UI 경계·상태·상호작용 계약이 걸림 | UX 단위 설계·렌더 판단 | 기술 단위 소유권 이전 |
| Critic | 계약·보안·아키텍처·테스트 엄밀성 검토가 중요 | 근거 있는 발견 | 수정·재설계·인수 |

General은 강제가 아닙니다. Engineer가 직접 구현할 수 있고, General에는 발견·설계·조율이 필요한 작업을 맡기지 않습니다. Plan 자문은 분석 범위에 머물며, Engineer가 구현 승인을 대신받는 통로가 아닙니다.

Engineer는 `diagnosing-bugs`, `evolving-apis-and-schemas`, `investigating-performance`, `reviewing-security`, `vercel-react-best-practices`, `building-accessible-interfaces`를 필요한 범위에서 사용합니다. 스킬은 역할이나 필수 단계가 아니라 판단 렌즈입니다.

**버그·성능 회귀 디버깅:** 원인을 모르는 실패는 바로 수정하지 않습니다. `diagnosing-bugs`로 ① 재현 가능한 실패 신호 만들기 → ② 가설·이분·계측으로 원인 좁히기 → ③ 최소 수정 → ④ 회귀 테스트·가드 → ⑤ 실제 런타임 재검증 순서로 갑니다. 단순하고 원인이 명확한 오타·설정·한 줄 수정에는 이 루프를 강제하지 않습니다. 재현 환경이나 실장비가 없어 전체 루프를 만들 수 없으면 진행을 멈추지 말고, 확보 가능한 신호·미확인 범위·필요한 환경을 명시한 뒤 부모와 대안을 정합니다. 같은 문제를 두 번 이상 고쳤는데도 재발하면 기존 수정을 반복하지 말고 재현 루프와 가설을 다시 세웁니다.

### Critic 호출 지점

Critic은 제품·UX·코드·기술 설계의 독립 검토를 맡지만, 모든 작업의 필수 게이트가 아닙니다. 호출자는 질문과 실제 근거를 넘기고, 발견은 소유자가 수정·반증·미해결로 처리합니다.

| 호출자 | 검토 질문 | 넘길 근거 | 결과 처리 |
| --- | --- | --- | --- |
| Build | 제품 통합·종단 과업·인수 근거가 충분한가 | 원요구·확정 계약·실제 빌드/렌더 | 소유자 수정 후 Build 인수 |
| Design | 구현 전 구조·흐름 가설, 구현 후 실제 렌더·상태·상호작용 | 목표·제약·원본 캡처·빌드/상태 | Design이 타당성 판단 후 같은 General 또는 직접 수정 |
| Engineer | 기술 계약·아키텍처·보안·테스트 엄밀성 | 코드·계약·실행/실패 경로·버전 | Engineer가 수정·반증 |
| Plan | 계획·대안·우선순위의 가정과 누락 | 원요구·제약·분석 근거 | Plan이 분석에 반영, 구현 승인 아님 |

General·Explore·Research는 Critic을 직접 호출하지 않고 소유자에게 반환합니다. Critic은 수정·재설계·최종 인수를 하지 않으며, 문제 개수·점수·필수 반복 횟수를 만들지 않습니다. 중요한 최종 검토는 작업에 참여하지 않은 새 세션에 맡깁니다.

- 운영 역할은 `opencode-go/muse-spark-1.3-contributor`를 공통 사용하고, Plan·Critic은 `xhigh`, Engineer·Design·General은 `high`, Research는 `medium`(시험 배정), Explore는 `low`로 추론 강도를 조정합니다. Build는 전역 모델을 고정하지 않습니다. Variant별 실제 품질·비용 우위는 아직 비교 측정하지 않았으며, 근거가 쌓이면 조정합니다.

- `experimental.subagent_depth=3`은 **루트 0 아래 최대 3단계**입니다. 기본적으로 1~2단계를 사용하고 유용한 필요가 있을 때만 세 번째를 사용합니다. `all`은 메인/하위 실행 가능이라는 뜻이며 권한·위임 깊이와 별개입니다.
- Build·Plan·Engineer·Design은 허용된 전문가를 선택해 호출합니다. Research는 Explore에 한정된 근거 추출을 맡길 수 있습니다. General·Explore·Critic은 말단입니다. 자기 호출·미등록 대상·Architect는 거부하며 `build`는 하위 역할로 호출하지 않습니다. 이는 역량/권한 경계이지 고정 업무 순서가 아닙니다.
- 깊이가 다 찼거나 도구가 차단되면 허용 작업을 직접 수행하거나 부족한 전문 작업을 부모에게 반환합니다. 같은 과업을 조상에게 재위임하거나 막힌 호출을 반복하지 않습니다.
- Plan은 Native 프롬프트와 일반 파일 편집 제한을 유지합니다. 계획·분석만 승인됐으면 하위 Design/General도 그 범위만 수행해야 합니다. **Plan의 역할 제한은 자동 상속되지 않지만, 명시한 Native 세션 제한은 자식 생성 시 상속할 수 있습니다.** 엄격한 보호가 필요하면 기존 제한을 보존한 세션 규칙 또는 제한 실행환경을 하위 생성 전에 준비하고 실제 거부를 확인합니다. Plan 선택만으로 세션 제한이 자동 설치되거나 기존 자식에 소급 적용되는 것은 아니며 OS·네트워크 샌드박스도 아닙니다.
- 중요한 진척·재개·곁작업 후에는 Build가 남은 목표와 다음 통합 결과를 판단합니다. 선택·기술 계약이 중요하거나 불명확하면 Plan의 방향 반박을 활용하고 실제 실행·결과 확인으로 잇습니다. 일상적 설계·수정은 Engineer·Design이 해결합니다. 자문 보고만으로 멈추거나 새 범위를 임의로 시작하지 않습니다. Plan은 필수 승인자·기억 저장소·두 번째 구현 총괄이 아닙니다.
- 하위 조사·설계·구현이 실패하거나 Critic이 중요한 문제를 발견하면 각 부모가 유효한 부분 결과와 실패 근거를 확인하고 다음 접근을 판단합니다. 새 자료·교정된 조건·변경된 가설 없이 같은 요청을 반복하지 않습니다. 필요한 기존 담당자에게 교정을 연결하거나 접근법·배분을 바꾸고, 실제 차단은 해당 범위만 명시하며 독립적인 승인 작업은 계속합니다.
- 기존 세션의 역할·모델은 설정 변경만으로 자동 이전되지 않습니다. 특히 Plan·Design을 메인으로 고를 때는 세션 모델도 확인하세요.

Engineer·Design은 맡은 단위의 구현·검토·수정을 직접 연결합니다. Build에는 매번 수정 목록을 승인받으러 돌아오는 대신 중요한 결정·충돌·실제 차단과 통합 가능한 결과를 반환합니다. General 호출은 강제가 아니며 작은 작업은 직접 구현합니다.

Engineer·Design은 한 단위에서 General·Explore·Research·Plan·Critic을 각각 다른 하위 산출물에 동시에 활용할 수 있습니다. 고정된 단일 자식 구조가 아니며, 작업 단위의 소유권과 남은 깊이 한도가 기준입니다.

Explore는 범위가 정해진 검색·원본 추출로 ‘어디에 무엇이 있는가’를 답합니다. Research는 자료가 충돌하거나 대안·적용 조건·미확인을 비교해야 할 때 ‘어떤 설명이 근거에 더 맞는가’를 종합합니다. 경계는 로컬/웹 도구가 아니라 질문의 성격이며, Explore도 허용된 원본을 읽을 수 있지만 비교·종합·디자인 판단은 하지 않습니다. Research는 검색 과정을 자신의 세션에 남기고 **원본 이미지·URL·자료·대상 상태**, 관측 사실, 영향/원인 가설, 적용 조건·한계를 부모에게 반환합니다. 해결 방향은 후보이지 채택된 제품 규칙이 아닙니다. 수신자도 원본을 확인하며 새 보고서 양식이나 문제 개수를 요구하지 않습니다.

Critic은 기존 UI/UX Critic과 Product Reviewer의 검토 기능을 통합합니다. 배정 질문에 맞는 제품·UX·코드·아키텍처 근거와 설치된 적합한 스킬을 사용하며, 매번 모든 분야를 인증하지 않습니다. 원래 요구와 실제 종단 과업, 저장·복귀·실패 복구·기능 간 모순·근거 없는 완료 주장도 검토합니다. UI 비평에는 실제 렌더·조작이 필요하며 구조적 문제와 국소 구현·취향을 구분합니다. 설계자의 자기평가를 정답으로 받거나 문제·점수·개수를 채우지 않습니다. 직접 수정·배포·추가 위임·새 범위 결정·최종 승인은 하지 않습니다. 발견은 기존 담당자의 수정·반증·명시적 미해결로 연결합니다. 중요한 최종 검토는 설계/교정에 참여하지 않은 새 세션에 맡기며, 역할·모델·세션 분리만으로 판단력 향상이 보장되지는 않습니다.

## 기본 OpenCode와 비교

KSI Harness가 기본 OpenCode와 다른 점은 다음과 같습니다.

| 항목 | 기본 OpenCode | KSI Harness |
| --- | --- | --- |
| 전문 역할 | 사용자 정의 에이전트 지원 | Engineer·Design·Research·Critic |
| 완료 판단 | 기본 에이전트 지침 | 승인된 작업의 완료·재승인 기준 명시 |
| 위임 | General·Explore·하위 세션 지원 | 작업 단위 위임·공유 자원 소유 기준 명시 |
| UI 편집 검사 | 플러그인으로 확장 가능 | 공식 Impeccable `detect` 수동 실행 |
| 디자인 방법론 | 별도 설치 | Impeccable·Intent를 선택 사용 |
| 브라우저 | 데스크톱 Native Browser 제공 | Native Browser·Playwright CLI 선택·세션 기준 |
| 모델 라우팅 | 에이전트별 모델 설정 지원 | General·Explore·Plan·Engineer·Design·Research·Critic 모델 지정 |

구조와 과정을 정리한 것이며, 디자인 품질 향상을 A/B로 입증한 것은 아닙니다.

## 개발 워크플로

- OpenSpec을 채택한 프로젝트에서는 승인된 요구·기능·API/데이터·계약 변경을 `openspec/`의 change/spec/design/tasks로 관리합니다. 기존 정본·변경 이력을 일괄 폐기하지 않으며 코드·런타임·검증 기록과 명세를 구분합니다. 작은 버그·스타일·국소 리팩터링에는 새 변경 명세나 고정 단계를 강제하지 않습니다.
- 변경 소유는 Build(요구 승인·통합·아카이브), Engineer(기술 artifact 내용), Design(UX artifact 내용)으로 나눕니다. Plan은 분석·제안만 하며 승인 artifact를 대신 작성하지 않습니다. `openspec-propose`의 계획 경계는 일반적인 ‘승인 작업 계속’보다 우선하며, 제안 완료를 구현 승인으로 바꾸지 않습니다. [도입·외부 스킬](docs/openspec-and-skills.md)

- Native 세션·계획·이력으로 결정·남은 작업·다음 통합 결과·검증 근거를 이어갑니다. 재개·통합·중요 진척 시에는 필요한 주장에 관련된 코드와 미커밋/미추적 변경, 실제 실행 빌드, 검증 버전·환경을 대조합니다. 정본은 요구 계약의 권위이고 코드·실행은 구현 현실의 근거입니다. 요약·문서 지도·HEAD 하나로 현재 상태를 대신 판단하지 않으며, 유효한 근거는 재사용하고 변경 영향만 다시 확인합니다. 고정 단계·새 정본 양식·필수 추적 파일은 요구하지 않습니다.
- 위임할 때 핵심 원문·출처·문제·실제 제약을 넘기고, 사용자 확정사항과 Build의 해석·설계 가설을 구분합니다. 미선택을 거절·영구 유지로 간주하지 않으며, 담당자는 목표·제약 안에서 근거로 가설을 조정합니다. 새 자식 세션에는 부모 문맥이 자동 전달되지 않으므로 사용자 제약·원본 증거·작업+상태를 명시적으로 넘기고, 이어 쓰는 자식 세션은 같은 세션을 `sessionID`로 재사용합니다. 공유 파일·브라우저 자원은 한 소유자를 정합니다. 메인은 해당 빌드의 결과로 원래 문제의 해결 여부를 판단합니다.
- 승인 범위는 중간 재승인 없이 진행하고, 실제 데이터에 가까운 조건에서 저장·연동·실패 복구 등 관련 흐름을 확인합니다.
- 제품 개발 요청은 대상 제품의 대표 흐름을 실제 런타임에 일찍 연결하고, 위임에도 그 납품 대상을 전달합니다. 시안·시뮬레이션은 설계 탐색에 사용할 수 있지만 채택한 결정은 승인된 제품 작업에 연결하며, 별도 데모의 성공을 제품 연동 완료로 보지 않습니다. 시안·분석만 요청한 범위와 실제 자료·기기·접근 제약은 존중하고, 연결하지 못한 부분은 차단·미검증으로 구분합니다.
- 항목 목록이 아닌 승인된 목표를 기준으로 관련 개선을 수행합니다. 명시적 제외는 지키고, 목표 확대·계약·비용·보안·데이터 정책 변경은 확인합니다.
- 공유 실행환경·데이터·보안에 영향을 주는 고위험 위임에서는 변경 가능한 자원과 보존할 상태를 명확히 전달하고, 가능한 경우 작업 전용 인스턴스·사본·최소 권한 계정으로 제한합니다. 역할 이름이나 `edit: deny`를 샌드박스로 간주하지 않습니다. 성공을 위해 공유 원장·증거·정책을 임의로 바꾸지 않으며, 백업이 있다는 것만으로 변경이 승인되지는 않습니다. 범위를 넘는 복구가 필요하면 해당 실행 경로만 멈추고 증거와 필요한 결정을 반환합니다. 메인은 성공 결과뿐 아니라 중요한 변경·우회 조치가 승인 범위 안인지도 확인하고, 독립적인 승인 작업은 계속합니다.
- 모의·미검증 결과는 실제 완료와 구분하고, 유효한 검증은 재사용합니다. 진척이 멎으면 가설을 바꾸되 새 근거가 없으면 차단 사유를 보고합니다. 목표와 관련 검증을 충족하면 마칩니다.

주요 업무 흐름·정보 구조 변경, 기능 간 연결·제품 계약 영향, 사용자 지적의 재발, 인수 근거 부족에서는 해당 불확실성을 다룰 독립 검토를 기본으로 합니다. 매 작업에 모든 검토자를 호출하는 단계는 아닙니다. 수정은 기존 담당 세션으로 잇고, 검토는 해당 작업에 참여하지 않은 별도 세션에서 원요구·제약·실제 결과를 바탕으로 접근법 자체도 비판할 수 있습니다. UI 비평은 UI/UX 범위이며 제품 전체 인수는 메인 책임입니다. 중요한 과업·계약·안전 문제는 **수정 후 재검증 / 근거로 반증 / 미해결**을 구분하고, 미해결 범위는 완료로 주장하지 않습니다. 사소한 제안을 모두 필수 수정으로 만들지는 않습니다.

막히면 지침부터 늘리지 않고, 지식·관찰/접근·실행 수단·판단 중 무엇이 부족한지 구분합니다. 필요한 자료·스킬·도구·전문 역할을 선택합니다.

이 기준은 위임·인수 운영 지침입니다. 하네스가 프로젝트별 OS·컨테이너·SSH 권한을 자동으로 격리하거나 기존 사고의 복구를 승인하는 것은 아닙니다. 실제 실행 제한은 해당 환경에서 별도로 구성·확인해야 하며, 지침 적용만으로 사고 예방이 보장됐다고 주장하지 않습니다.

## 디자인 및 검증 도구

중요한 UI 변경은 사용자의 별도 지시 없이 구조·핵심 조작을 정하기 전에 Design이 실제 화면·상호작용·관련 사례를 근거로 판단합니다. 근거가 충분하면 재사용하고 부족하면 조사하며 필요한 스킬은 실제로 적용합니다. 기계적 수정에 불필요한 조사를 붙이지 않습니다. Research는 필요할 때만 넓은 관찰·문제 후보·외부 참고와 원본 근거를 넘깁니다.

| 필요한 일 | 도구 |
| --- | --- |
| 제품 패턴 참고 | 해당 제품 우선, 필요할 때 Mobbin(선택·유료) |
| 라이브러리 문서 | Context7 |
| 흐름·정보 구조·화면 대안 | Intent `@journey`·`@organize`·`@wireframe` (선택) |
| 과업·UX 검토 | `designing-user-experience`·`ux-heuristics-audit` (설치된 경우) |
| 디자인 비평·소스 검사 | Impeccable, 공식 `detect --json` 수동 검사 |
| 실제 화면·상호작용 확인 | 데스크톱은 Native Browser, 헤드리스·반복은 Playwright CLI |
| 저장·연동·실패 원인 확인 | 프로젝트의 API·로그·테스트 데이터·허용된 데이터 조회 |
| React/Next.js 구현·성능 | Vercel React Best Practices(설치된 경우) |
| 기존 UI의 절제된 모션 개선 | Emil Kowalski Motion(선택) |

### 역할별 스킬 경계

| 역할 | 주로 쓰는 스킬·도구 | 의도적으로 맡기지 않는 것 |
| --- | --- | --- |
| Build | OpenSpec, `opencode`, 통합·검증 도구 | 특정 디자인·기술 방법의 대행 |
| Plan | `opencode`, 분석 보조 | 구현·디자인 실행 |
| Engineer | `diagnosing-bugs`, `evolving-apis-and-schemas`, `investigating-performance`, `reviewing-security`, `vercel-react-best-practices`, `building-accessible-interfaces`, `playwright-cli`, Context7 | 디자인 방향·최종 UX 결정 |
| Design | `designing-user-experience`, `journey`, `organize`, `wireframe`, `building-accessible-interfaces`, `ux-heuristics-audit`, `ux-copy`, `impeccable`, `mobbin-design`, `playwright-cli`, `vercel-react-best-practices`, `emilkowalski-motion` | API/마이그레이션·보안 리뷰의 소유 |
| General | `vercel-react-best-practices`, `evolving-apis-and-schemas`, `building-accessible-interfaces`, `playwright-cli`, `opencode` | 디자인·전략·아키텍처·보안 리뷰 |
| Explore | 없음 — 읽기·검색 도구만 | 디자인·리서치·구현 |
| Research | `playwright-cli`, `mobbin-design`, `journey`, `organize`, `building-accessible-interfaces`, `opencode` | 구현·최종 디자인·승인 |
| Critic | `playwright-cli`, `impeccable`, `journey`, `organize`, `vercel-react-best-practices`, `opencode`, `reviewing-security`, `building-accessible-interfaces`, `ux-heuristics-audit`, `evolving-apis-and-schemas`, `investigating-performance`, `ux-copy` | 구현·재설계·최종 인수 |

General은 의도적으로 코딩·검증 스킬만 허용하고, 디자인·전략·아키텍처·보안 리뷰 스킬은 허용하지 않습니다. Explore는 스킬 없이 코드 위치·사실만 찾습니다. Engineer·Design은 필요한 기술·디자인 스킬을 넓게 사용하되, 각자의 소유권 경계는 유지합니다. 권한과 실제 설치·발견은 별개이므로 새 스킬을 추가할 때는 설치 상태와 이 표를 함께 확인합니다.

`diagnosing-bugs`(Engineer)와 `ux-copy`(Design·Critic)는 2026-10-24 trial로 설치했습니다. 설치 출처는 `mattpocock/skills`의 `diagnosing-bugs`, `anthropics/knowledge-work-plugins`의 `design/skills/ux-copy`로 고정했습니다. 2~3개 실제 작업에서 반복 수정·원인 발견·문구 교정이 실제로 줄었는지 확인하고, 효과가 없거나 호출만 늘면 제거합니다.

스킬은 역할이나 필수 개발 단계를 추가하는 장치가 아닙니다. 필요한 범위만 읽고 적용하며, 원본 보존·참고용 와이어프레임과 실제 제품의 시각 기준을 구분합니다. 이 저장소는 스킬 원본을 번들하지 않으므로 기존 설치를 재사용하거나 [공식 출처별 설치](docs/installation.md#외부-도구-출처)를 별도로 확인해야 합니다. 권한 허용이나 MCP 연결이 스킬 설치를 뜻하지는 않습니다.

외부 스킬의 제한된 실행과 제품 전체의 인수를 구분하는 적용 정책은 [스킬 연결 검토](docs/validation.md#스킬-연결-검토-2026-10-17)에 기록했습니다. 사용자 범위·예산은 지키며, 스킬 종료를 미충족 제품의 완료로 간주하지 않습니다. 등록이나 본문 검토를 실제 활용 성능 검증으로 간주하지 않습니다.

등록·연결 상태가 의심되면 `node scripts/capabilities.mjs`로 선택 점검합니다. 설치·인증·모델 호출은 하지 않으며 결과는 실제 권한·제품 품질의 증거가 아닙니다. 추적 대상은 위 8개 역할입니다. Research·Critic은 제품/보고서 편집·임의 Shell·서버 기동·설치·배포를 거부하고 각각 `research-*` / `critic-*` 고유 CLI 세션을 사용합니다. Engineer·Design은 승인 단위의 구현 권한을 갖습니다. 필요한 Context7 문서 조회와 역할별 설치 스킬을 허용하고 Research의 Mobbin 검색 3개를 유지합니다. 임의 스킬·MCP 액션은 허용하지 않습니다. 브라우저·CLI·execute는 읽기 전용 샌드박스가 아니므로 승인된 환경·계정·상태 전이를 사용합니다. [현재 구성·검증 범위](docs/engineer-routing-validation.md)

### UI/UX 작업 흐름 — 사고·조사·설계·구현·검증

UI 단위는 코드부터 쓰지 않습니다. 먼저 사용자 과업·대표 데이터·큰 실패 비용을 확인하고, 기존 화면·패턴·근거를 조사한 뒤 구조·상태·상호작용 가설을 세웁니다. 작고 명확한 수정은 이 과정을 줄여 바로 구현할 수 있습니다. 아래는 Build가 메인인 경우의 예시이며 고정 단계·필수 호출이 아닙니다.

```text
[1] 이해와 근거
Build — 목표·제약·인수 조건 확인
  └─(선택) Plan — 요구·우선순위·대안·의존성 자문 (구현·승인 없음)
Design — 기존 화면·데이터·흐름 직접 확인
  ├─ 코드 위치·사실 → Explore
  ├─ 외부 사례·대안·충돌 근거 → Research
  └─ 필요 시 designing-user-experience·journey·organize·wireframe·Mobbin

[2] 설계 가설
Design — 문제 정의 → 대안 비교 → 구조·상태·상호작용·시각 가설
  ├─ 기술 계약·API/데이터/권한 영향 → Engineer와 직접 협의
  └─(선택) Critic — 구현 전 구조·흐름 가설을 원요구·제약·근거로 비평

[3] 구현
Design → General — 이미 결정된 구현 슬라이스 (작은 작업은 Design 직접 구현 가능)
  General — 구현 → 빌드/테스트 → 기술적 결함 수정
  Engineer — 기술 계약이 걸린 부분은 기술 단위로 소유

[4] 검증과 교정
Design — 실제 렌더·조작·상태·회귀 확인
  - 연구·레퍼런스·설계 의도가 결과에 반영됐는가
  - 원래 과업이 쉬워졌는가, 부작용은 없는가
  - 웹 UI는 Impeccable `detect --json`으로 기계적 발견 확인
  └─(선택) Critic — 실제 빌드·상태·상호작용을 독립 비평
       └─ 발견 → Design이 타당성 판단 → 같은 General 세션에 교정 ↺

[5] 인수
Design — 단위 결과·증거·미해결 반환
Build — 제품 통합·교차 일관성·최종 인수
  └─(선택) 새 Critic 세션 — 중요한 최종 검토
```

**Critic은 필수 게이트가 아닙니다.** 중요한 UX/IA 변경, 기능 간 연결·제품 계약 영향, 반복되는 사용자 지적, 인수 근거 부족처럼 독립 판단이 필요한 때 호출합니다. 구현 전에는 구조·흐름 가설을, 구현 후에는 실제 빌드·상태·상호작용을 검토합니다. Design의 자체 렌더 검증은 UI 인수에 필요하며, Critic의 발견은 Design이 타당성을 판단해 같은 구현 담당 세션의 수정·재검증으로 연결합니다. Critic은 수정·재설계·최종 인수를 하지 않습니다. Design이 메인이면 맡은 UI 단위의 통합·완료를 담당하며 제품 전체 인수로 확대하지 않습니다.

**Plan은 언제 쓰나.** 매 작업의 필수 단계가 아닙니다. 요구·우선순위가 불명확하거나, 큰 방향 전환·기술+제품 계약 판단이 필요하거나, 국소 수정이 반복 실패할 때 호출합니다. Plan은 Explore/Research로 근거를 확인하고 대안·의존성·권장 순서를 비교하지만 구현·승인·artifact 작성은 하지 않습니다. Plan의 분석 범위는 하위 호출에도 유지되어야 하며, 엄격한 격리는 자식 생성 전에 세션 제한으로 준비해야 합니다.

**Critic은 무엇으로 검토하나.**

| 검토 질문 | 사용하는 스킬·도구 |
| --- | --- |
| 휴리스틱 위반·심각도·우선순위 | `ux-heuristics-audit` |
| 키보드·스크린리더·포커스·대비 | `building-accessible-interfaces` |
| 여정·정보 구조·발견 가능성 | `journey`, `organize` |
| 디자인 품질·소스 규칙 | `impeccable` (Design이 실행한 `detect --json` 결과 포함) |
| 실제 렌더·조작·상태 | Browser, `playwright-cli` |
| React/Next 구현·성능 | `vercel-react-best-practices` |
| API·스키마·마이그레이션 호환성 | `evolving-apis-and-schemas` |
| 측정 기반 성능·병목 | `investigating-performance` |
| 에러·빈 상태·CTA 문구 | `ux-copy` |
| 보안·공격자 경로 | `reviewing-security` |
| 하네스·도구 자체 | `opencode` |

Critic의 스킬 허용 목록은 `playwright-cli`, `impeccable`, `journey`, `organize`, `vercel-react-best-practices`, `opencode`, `reviewing-security`, `building-accessible-interfaces`, `ux-heuristics-audit`, `evolving-apis-and-schemas`, `investigating-performance`, `ux-copy` 12개입니다. 전체 워크플로가 하위 에이전트·서버·쓰기를 요구하면 허용된 부분만 렌즈로 적용하고 나머지는 미제공으로 보고합니다. Design은 같은 외부 방법을 설계·자체 검토에 사용하되, 독립 비평을 자기 승인으로 대체하지 않습니다.

**문구·에러·빈 상태:** `ux-copy`는 마이크로카피·에러·빈 상태·CTA를 다룰 때 사용합니다. 사용자 상태와 다음 행동을 먼저 정하고, 명확성·일관성·복구 경로를 확인한 뒤 실제 렌더의 관련 상태에서 검토합니다. 원시 사유 코드를 그대로 노출하지 않으며, 문구 수정이 시각·상호작용 검증을 대체하지 않습니다. 줄바꿈·과밀·레이아웃은 Design의 구성 판단과 렌더 검증으로 다룹니다. Critic이 `ux-copy`를 쓰더라도 전체 제품·UX·기술 검토 범위를 문구 검토로 축소하지 않습니다. OpenCode에서는 `/ux-copy` 슬래시 명령이 아니라 스킬 본문을 읽는 렌즈로 사용합니다.

**OpenSpec은 언제 쓰나.** 승인된 요구·API/데이터·계약이 바뀌는 UI 작업은 OpenSpec change에 연결합니다. Design은 UX artifact 내용을, Engineer는 기술 artifact 내용을, Build는 요구 승인·통합·아카이브를 맡습니다. Plan은 분석·제안만 합니다. 작은 버그·스타일·국소 리팩터링에는 새 change를 강제하지 않으며, `openspec-propose`의 계획 경계는 구현 승인으로 넘지 않습니다.

열거되지 않은 문제도 주변 상태·공유 컴포넌트·연결 화면에서 발견하고, 목표 달성에 필요한 개선은 직접 수행합니다. 무관한 발견은 보고하되 새 과제로 확대하지 않습니다.

화면 구성을 바꿀 때에는 실제 과업 기준으로 대안의 손익과 채택 이유를 비교하고, 어떤 관찰이 그 구성을 반증할지 명시합니다. 밀도·비례·간소화도 실제 화면에서 핵심 과업이 쉬워졌는지로 평가하며, 필요한 근거·복구 경로·안전 정보가 계속 발견 가능한지 확인합니다. 문구나 조작 요소를 무조건 줄이는 것을 개선으로 간주하지 않습니다.

피드백은 그 프로젝트의 판단 이유와 함께 연결 화면에 적용합니다. 목표 관련 문제가 남고 다음 변경의 효과를 설명할 수 있으면 계속하며, 목표와 관련 검증이 충족되면 종료합니다. 시각적 완성도가 목표라면 그것도 인수 조건입니다. 반복 실패는 원인을 재진단하고, 무관한 취향 변경이나 횟수 채우기로 반복하지 않습니다. 증거·접근·필수 결정이 부족하면 완료로 처리하지 않습니다. 유효한 검증은 재사용하며, 별도 보고서·필수 리뷰어·고정 반복 횟수는 없습니다.

도구 부재를 단정하기 전에 카탈로그를 검색합니다. 캡처 실패는 원인과 대안을 확인하고, 시각 검증을 코드 리뷰로 조용히 대체하지 않습니다. 캡처·결론은 프로젝트가 정한 위치에 기록합니다. CLI는 작업별 고유 세션만 열고 자신이 만든 세션만 닫으며, 프로젝트 테스트와 기존 증빙은 보존합니다. 브라우저 정책과 검증 이력: [검증 안내](docs/validation.md)

## Impeccable 소스 검사

공식 Impeccable 스킬은 자동 훅이 없는 환경에서 편집 후 `detect --json`을 한 번 실행하도록 안내합니다. Design은 웹 UI 편집 후 변경 대상에 이 명령을 실행해 기계적 발견을 수정하고, 남은 발견을 검토로 넘깁니다. 네이티브 플랫폼은 소스 검사기를 건너뜁니다. 이 저장소는 자체 편집 훅 플러그인을 배포하지 않습니다.

```sh
.opencode/skills/impeccable/scripts/impeccable detect --json <changed-targets>
```

대상·한도·규칙은 설치된 Impeccable 버전의 공식 문서를 따릅니다. 검사는 소스 전용이며 실제 화면 사용성·시각 품질 검증을 대신하지 않습니다. 상세: [검증 안내](docs/validation.md)

## 설정 및 설치 경로

| 저장소 파일 | 전역 적용 위치 |
| --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` |
| `global/agents/design.md` | `~/.config/opencode/agents/design.md` |
| `global/agents/research.md` | `~/.config/opencode/agents/research.md` |
| `global/agents/engineer.md` | `~/.config/opencode/agents/engineer.md` |
| `docs/archive/agents/architect.md` | 원본 보존용, 설치·발견 대상 아님 |
| `global/agents/critic.md` | `~/.config/opencode/agents/critic.md` |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` |

- 기존 파일은 백업하고 관련 항목만 병합합니다. 이전 4개 커스텀 ID의 은퇴·병합은 [설치 안내](docs/installation.md#기존-역할에서-이전)를 따릅니다.
- 적용 후 `cmp`·`diff`로 저장소 정본과 비교할 수 있습니다.
- 설치 프롬프트와 외부 도구 출처: [설치 안내](docs/installation.md)
- `CONTEXT7_API_KEY`는 환경변수로 전달하며 비밀값은 저장소에 넣지 않습니다.

네 역할 파일만 복사하면 충분하지 않습니다. 최대 깊이 3·Build/Plan 호출 권한을 담은 설정, 커스텀 역할의 재위임 권한과 공통 지침을 함께 적용해야 위 구조로 동작합니다. 사용자 인증·개인 설정은 배포 사본에 포함하지 않습니다.

제품 요구·변경 계약은 채택한 프로젝트의 OpenSpec과 기존 정본에서, 구현 상태는 코드·런타임·테스트·CI에서 확인합니다.

## 추가 검증

```sh
node --test tests/completion-guidance.test.mjs
node --test tests/capabilities.test.mjs
node --test tests/permission-probe.test.mjs
node --test tests/delegation-errors.test.mjs
node --test tests/compaction-continuity.test.mjs
node tests/agent-routing-native.mjs
node tests/delegation-native-integration.mjs
```

- `delegation-native-integration.mjs`는 격리 환경과 로컬 모의 모델을 사용하며 외부 모델을 호출하지 않습니다. 역할 라우팅 검사는 모델 호출 없이 자신의 임시 세션에서 정책을 조회합니다.
- 최근 확인 환경: OpenCode 2.1.4 / Playwright CLI 0.1.22 / Linux arm64 (이전 검사의 버전·범위는 검증 기록 참고, 다른 OS는 미확인)
- `agent-routing-native.mjs`는 적용된 설치본의 깊이·호출 정책·모델·본문, Research/Critic의 CLI·스킬·문서 도구 경계를 검사합니다. 전역 교체 전에는 통과를 기대하지 않습니다. `delegation-native-integration.mjs`는 격리 Native에서 중첩·상한, 수정 허용/거부, 자식 재개·복구·증거 반환, 명시 세션 제한의 상속/비소급과 Engineer/Design 구현 경로를 확인합니다. 모델은 로컬 scripted fixture이며 자율 판단력·실제품 완성도·OS 격리의 증거는 아닙니다. [최신 실행 근거와 한계](docs/engineer-routing-validation.md)
- 2026-10-17 모의 UI에서는 당시 명칭의 `Build → Design Architect → General` 중첩·같은 자식 세션 교정·원본 렌더 재평가를 확인했습니다. 새 역할의 모든 호출 경로·실제품 품질·장기 완주·비용 절감까지 입증한 것은 아닙니다. [이전 실행 근거](docs/validation.md#역할-구조-변경-2026-10-17)
- `compaction-continuity-live.mjs`(선택형)는 수동 Compact 전후의 목표·확정 결정·미확정 후보·작업 상태 유지와 곁작업 복귀를 확인합니다. 2026-10-17 두 변형(keep 8192/15000) 모두 통과해 현재 설정을 유지했습니다. [결과와 한계](docs/validation.md#긴-세션-compact-연속성-검사-2026-10-17)
- 선택형 실모델 검사와 결과 해석: [검증 안내](docs/validation.md)

## 알아둘 점

- 소스 검사는 실제 화면 사용성·시각 품질·기능 검증을 대신하지 않습니다.
- 상세: [설치 안내](docs/installation.md) · [검증 안내](docs/validation.md)

[MIT](LICENSE) — Copyright (c) 2026 KSI
