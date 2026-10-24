# OpenSpec + 외부 스킬 통합

## 1. 버전 및 생성물

- OpenSpec CLI **1.15.0** (npm `@fission-ai/openspec@latest`, MIT).
  사전 확인: Node v24.19.0 / npm 11.17.0, 기존 글로벌 설치 없음,
  preinstall/postinstall 훅 없음.
- 스키마는 `spec-driven` 단일. 채팅 명령어는 하이픈형 (`/opsx-propose`).
- `openspec init --tools opencode`를 임시 디렉토리에서 먼저 검증 후
  적용했다. 생성물: `openspec/`, `.opencode/commands/opsx-*.md` 6종,
  `.opencode/skills/openspec-*` 6종. 커스텀 어댑터 없음.
- 원칙: 스펙 영향 변경만 공식 아티팩트를 상황에 맞게 사용한다.
  고정 파이프라인 없음, 작은 버그/스타일 면제, 완료된 변경만 아카이브한다.
  CLI 표면이 달라지면 실제 출력을 변경에 기록한다.

## 2. 확정 스펙과 기존 문서의 관계

- 기존 README/전역 역할 계약/아카이브 히스토리는 그대로 유지한다.
- 제품 정식 스펙: `openspec/specs/engineer-workflow/spec.md`
  (델타를 공식 sync 절차로 병합한 것. 변경은 OPEN 유지).
- 확정 라우팅: 복잡한 기술 구현 → Engineer, 모든 UX/인터페이스 → Design,
  작고 명확한 수정 → General/직접 허용, 로드맵 + 통합/최종 승인 → Build.
  Engineer는 담당 유닛이지 제품 전체 소유가 아니다.
- Architect는 바이트 동일하게
  `global/agents/architect.md` → `docs/archive/agents/architect.md`로
  이동했다 (sha256 `e29693ea…`, 9014 bytes, HEAD와 일치).
  `agents.architect` 설정 항목은 제거됐고 기본 엣지도 없다.
  Plan 자문 검증이 실제로 충분해질 때까지 보존하며, 최종 삭제는 미정이다.
  아카이브 파일 자체는 본 변경의 소유가 아니다.
- 모델 후보 문자열은 미검증이므로 스펙에 포함하지 않는다.

## 3. 외부 스킬 6종 (프로젝트 로컬 + 전역 설치 완료)

` .opencode/skills/{6ID}/`에 원본 바이트 + 스킬별 MIT 원문과 함께 설치됐고,
2026-10-24 전역 적용에서 `~/.agents/skills/{6ID}/`에도 동일 바이트로
복사했다. Native 조회에서 6종·기존 OpenSpec 6종·기존 전역 스킬이 함께
발견됐다(고유 ID 25개). 증거: `.opencode/artifacts/engineer-skills-install.json`
(전체 해시 + 라이선스 해시), `.opencode/artifacts/engineer-skill-discovery.json`,
`/tmp/opencode/skills-api-final.json`, 전역 설치 기록
`/tmp/opencode/ksi-depth3-install-qxzxj_rl/global-skills-install-20261024T111808Z.json`.
리포 번들 방지를 위해 6종은 루트 `.gitignore`에 등록됐다.
스위트 설치기나 동반 자동설치는 사용하지 않았다.

재현법: 소스 리포를 `--depth 1`로 받아 핀 커밋을 확인하고, 스킬
디렉토리만 원본 그대로 복사한 뒤 핀 커밋의 MIT 원문을 각 트리에 넣는다.
osmontero `install.sh`는 파괴적이므로(리포 외 스킬 삭제, 전역 설정 교체)
검토만 하고 절대 실행하지 않는다.

| ID | 소스 경로 | 핀 커밋 | SKILL.md SHA256 | LICENSE SHA256 |
|---|---|---|---|---|
| `designing-user-experience` | osmontero `skills/designing-user-experience/` (+ references) | `04b471cb5274eff9b3ac31c1ea62585d86a75300` | `5dd4ca082ab5f838bcfb64904e20d660d4cc739c0267b1e08f3259ba24eb9477` | `2fbc345f227be248dc0bd0a9faf6f15a9ae9d06be6aa3e56e6f433e0bbe6410b` |
| `building-accessible-interfaces` | osmontero `skills/building-accessible-interfaces/` | `04b471cb…` (동일) | `e27313d3d5122dfa815bef558136bdb539b046fad58e2f173a6398cff3b250f3` | `2fbc345f…` (동일) |
| `evolving-apis-and-schemas` | osmontero `skills/evolving-apis-and-schemas/` (+ references) | `04b471cb…` | `375a926318c581d78728b20cc3bf192b61e62d9957b5b4e6d1b9fc262cf4207f` | `2fbc345f…` |
| `investigating-performance` | osmontero `skills/investigating-performance/` (+ references) | `04b471cb…` | `d6892dc355717f6802e68a8a1ba8b5a4483560101f07f656401e4700d038f64e` | `2fbc345f…` |
| `reviewing-security` | osmontero `skills/reviewing-security/` (+ references) | `04b471cb…` | `096e4e8b2cc08d96bf3f4a094523875cdb6f465661e75ae05159171fdc4c0ec4` | `2fbc345f…` |
| `ux-heuristics-audit` | uxcel `ux/audits/heuristics/SKILL.md` (단일 파일) | `5007cd0241ccaa51ae2e4681f9618912dc10e239` | `cd0b83010b18091a3f2baef924ca3877b956a4a6f9873f9e222e8c64beb34090` | `c04fd8eb7a99e8027e7f832c759387d2175b345cae47cd277e2759d7e325b488` |

출처: https://github.com/osmontero/opencode-skills,
  https://github.com/Uxcel-Lab/product-skills (둘 다 MIT).
  설치된 6종의 SKILL.md 해시는 검토본과 바이트 단위로 일치한다.
  정정: 구 스테이징 복사본에는 LICENSE가 없었고, 핀 MIT 원문은 설치된
  로컬 트리에 들어갔다.

### 검토 결과

- 6종 모두 마크다운 가이드 + 레퍼런스이며, 번들 실행 스크립트와
  allowed-tools/autowrite 권한이 없다. 로컬호스트 도구 참조와 폰트 CDN
  링크만 있고 외부 전송·설치 훅은 없다.
- 선정 근거: 상태 설계(빈/로딩/에러) 공백, a11y 공백, API 마이그레이션
  공백, 측정 기반 성능 공백, 공격자 경로 보안 리뷰 공백, 심각도 등급
  휴리스틱 감사 렌즈. 각각 Design/Engineer/Critic 트랙에 매핑된다.

## 4. 제외·폐기 결정

- **2026-10-24 `task-first-ux-review` 폐기.** 이전에는 작은 변경용
  저의식 렌즈로 유지했지만, 자체 제작 스킬의 유지보수 부담을 줄이고
  외부 스킬을 우선한다는 사용자 결정에 따라 제거했다. 같은 목적은
  설치된 `designing-user-experience`·`ux-heuristics-audit`와 Design의
  "실제 과업 기준 대안 손익·반증 관찰" 원칙으로 대체한다. 동일한
  일대일 대체가 아니라 통합이며, 이전 유지 판단은 당시 기록으로만 남긴다.
- **2026-10-24 `ksi-impeccable-detector` 폐기.** OpenCode용 자체 편집
  훅 대신 설치된 Impeccable의 공식 `detect --json` 수동 검사를 사용한다.
  자동 편집 후 요약과 `ksiImpeccable` 메타데이터는 제공되지 않으며,
  Design이 편집 후 한 번 실행하는 절차로 대체한다. 소스 검사는 실제
  렌더·상호작용 검증이 아니다.
- `designing-frontend-interfaces` 제외 (Impeccable 중복).
- 전체 스위트·메타 스킬 제외. Impeccable, Intent 3종, Mobbin, Playwright,
  Vercel, 모션/취향 스킬 및 히스토리 보존.

## 5. 적용 현황과 남은 상태

- 발견 ≠ 적용 증거: 스킬이 조회·권한 목록에 있다고 실제 적용이
  증명된 것은 아니며, 6종 일괄 실행을 의무화하지 않는다. 각 실행은
  자체 증거를 인용한다.
- `reviewing-security`는 세션에서 로드되어 라우팅 데이터·도구 경계의
  경로 기반 리뷰에 사용됐다 (6종 전체 실사용 주장 아님).
  Critic은 위 3종을 포함해 검토·기술 렌즈 12종을 읽기 전용 출처로
  허용받았다. General은 코딩·검증 5종만 허용하고, Explore는 스킬 표면
  없이 동작한다. Engineer·Design은 스킬 기본 허용이며, 2026-10-24 전역
  적용에서 새 역할·권한과 6종 전역 사본이 설치됐다.
- 모델/프로바이더 프라이버시 GLM 본문 필터는 단일 Muse 라우팅 정리에서
  제거됐다. 이는 데이터 노출을 바꾸는 스펙 요구사항이 아니며, 현재 구성은
  `opencode-go` 단일 provider와 Contributor 학습 사용 조건을 명시한다.
- 기술 검증 현황: 회귀 **101/101**, OpenSpec 2/2, Native scripted
  **312/312**. 2026-10-24 자체 플러그인 폐기와 함께 core/adapter/native-hook
  검사 41개를 제거했으며, 남은 검사를 약화해 통과시킨 것이 아니다.
  실제 Muse 단일 구성의 Engineer·Design 동시 쓰기·렌더·Plan 자문과
  Research medium의 비교 품질은 미검증이며, 상세는
  `docs/engineer-routing-validation.md`를 따른다.
- 전역 설치는 2026-10-24 완료했다. 본 변경은 실제 Muse 모델의 역할별
  품질·비용, Design 렌더 교정, Research medium 비교 품질 증거가 남아
  OPEN 유지하며 미완료 상태에서 아카이브하지 않는다.

## 6. 추가 스킬 후보 검토 (2026-10-24, 조사만·미설치)

현재 역할별 스킬 경계와 겹치지 않으면서 실제 공백을 메우는 후보만 골랐다. 설치 수는 품질 증거가 아니며, 라이선스·스크립트·네트워크·역할 충돌을 확인했다. 이 표는 **2026-10-24 조사 시점의 후보 목록**이며, 실제 trial 설치 상태는 7을 따른다.

| 후보 | 출처·라이선스 | 메우는 공백 | 추천 역할 | 메모 |
| --- | --- | --- | --- | --- |
| `tdd` | [Matt Pocock](https://github.com/mattpocock/skills), MIT | 테스트 우선·seam·mocking·red-green | Engineer, General | self-contained; 1.1M installs |
| `diagnosing-bugs` | [Matt Pocock](https://github.com/mattpocock/skills), MIT | 재현 루프·가설·이분·HITL | Engineer | self-contained; optional HITL shell template |
| `code-review-and-quality` | [Addy Osmani](https://github.com/addyosmani/agent-skills), MIT | 5축 코드 리뷰 | Critic, Engineer | repo-level `references/` 필요 |
| `playwright-best-practices` | [Currents](https://github.com/currents-dev/playwright-best-practices-skill), MIT | E2E·flaky·POM·CI·a11y 테스트 | Engineer, General, Critic | `playwright-cli` 보완 |
| `api-and-interface-design` | [Addy Osmani](https://github.com/addyosmani/agent-skills), MIT | 계약·Hyrum·버전·모듈 경계 | Engineer | self-contained |
| `observability-and-instrumentation` | [Addy Osmani](https://github.com/addyosmani/agent-skills), MIT | 로그·메트릭·트레이스·알림 | Engineer, Critic, Build | shared checklist 필요 |
| `supabase-postgres-best-practices` | [Supabase](https://github.com/supabase/agent-skills), MIT | 스키마·인덱스·RLS·쿼리·마이그레이션 | Engineer (조건부) | Postgres 프로젝트만 |
| `ux-copy` | [Anthropic knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins), Apache-2.0 | 마이크로카피·에러·빈 상태·CTA | Design, Critic | Design 공백 |
| `vercel-composition-patterns` | [Vercel](https://github.com/vercel-labs/agent-skills), MIT | compound component·props·상태 | Engineer, General (React) | React 프로젝트만 |

### 추천 순서

- **1차 — 공통 공백 4종:** `tdd`, `diagnosing-bugs`, `playwright-best-practices`, `code-review-and-quality`.
- **2차 — 계약·운영 2종:** `api-and-interface-design`, `observability-and-instrumentation`.
- **조건부:** `supabase-postgres-best-practices`(Postgres), `ux-copy`(UX 문구), `vercel-composition-patterns`(React 컴포넌트 설계).

1차는 테스트·디버깅·E2E·리뷰의 실제 공백을 메우고 프로젝트 스택에 덜 묶인다. 2차는 API 계약과 운영 가시성을 보강한다. 조건부 후보는 해당 스택을 쓰는 프로젝트에서만 설치한다.

### 도입하지 않은 것

- **Superpowers 전체:** 완전한 개발 방법론과 강한 TDD·서브에이전트 흐름이 하네스의 역할 소유권·Critic 선택성과 충돌한다.
- **Addy 25종 전체:** 컨텍스트·권한 표면이 커지고 역할 경계가 흐려진다.
- **OpenAI `codex-security`:** Codex 전용 MCP/스캔 도구에 의존하며, `openai/skills` 저장소는 deprecated다.
- **Vercel `web-design-guidelines`:** 기존 `building-accessible-interfaces`·`ux-heuristics-audit`·Impeccable과 중복된다.
- **디자인 취향·마케팅·범용 awesome 목록:** 역할과 무관하거나 유지보수·품질 편차가 크다.

### 도입 시 주의

- Addy 스킬은 per-skill 설치 시 repo-level `references/`가 빠질 수 있다. whole-repo 복사 또는 shared references를 함께 두고 경로를 확인한다.
- “항상 TDD/리뷰” 같은 스킬 문구는 하네스의 승인 범위·Critic 선택성·작은 수정 면제보다 우선하지 않는다. 스코프 렌즈로 사용한다.
- 설치 전 `npx skills add <repo> --list`와 `SKILL.md`·스크립트·라이선스를 확인하고, `--copy`로 설치한다.
- 설치 후 역할별 skill 권한과 README 스킬 경계 표를 갱신하고, 회귀·OpenSpec·Native 검사를 다시 실행한다.

## 7. 실제 문제 기반 재평가 (2026-10-24)

6의 추천은 일반 공백과 채택 신호 중심이었다. 아래 실제 문제 기준 우선순위가 6의 1차 4종 추천을 대체한다. 실제 개발 기록의 문제를 기준으로 다시 평가하면, 새 스킬이 **직접** 해결하는 문제는 많지 않다. 이미 하네스 지침·역할·기존 스킬로 해결된 문제와 새 스킬이 직접 돕는 문제를 구분한다.

| 실제 문제 | 근거 | 기존 대응 | 새 스킬 판단 |
| --- | --- | --- | --- |
| 반복 수정·원인 추정으로 국소 수정 반복 | 공통 지침의 정체 시 재진단, 10/22 API 오류 가설 사례 | Engineer의 재진단·Critic | **`diagnosing-bugs` — 직접 도움** |
| 완료 주장에 대한 최신 검증 증거 부족 | 공통 지침, Critic의 완료 주장 검토 | 공통 evidence 규칙·테스트 | `verification-before-completion`은 중복 가능 |
| UI 단순화가 인식 단서를 지우고 주 조작을 오노출 | 10/22 실사용 감사 | Design의 과업·인식 단서 기준, `ux-heuristics-audit`, Impeccable | `design-critique`는 기존과 중복 |
| 텍스트만으로 구조를 조기 확정 | 10/23 EDGE 사례 | Design의 시각 근거·wireframe·journey | 새 스킬 불필요 |
| 원시 사유 코드·어색한 줄바꿈·에러/빈 상태 문구 | 10/23 감사 정정 | Design의 문구 판단, 부분적 | **`ux-copy` — 직접 도움** |
| 브라우저 캡처 실패·자식 `browser.disconnected` | 10/21 Scout, 브라우저 경로 | Native/Playwright 경로·권한 지침 | `playwright-best-practices`는 E2E 테스트 설계에만 부분 도움 |
| 하위 컨텍스트 손실·장기 세션 | 10/24 복구·Compact 검증 | handoff 규칙·세션 재사용·Compaction | `handoff`/`context-engineering`은 부분 중복 |
| 읽기 전용 역할에 보고서 작성 지시·없는 경로 반복 | 10/22 실사용 감사 | handoff·권한·경로 규칙 | 새 스킬 불필요 |
| 오래된 디자인 입력을 현행으로 오인 | 10/22 Safety Edge | Design의 권위 확인 | 새 스킬 불필요 |
| 테스트 엄밀성·회귀 테스트 부족 | Critic 발견, 프로젝트 테스트 | 기존 테스트·TDD 지침 | `tdd`는 예방적, 직접 실패 증거는 아직 부족 |
| API 계약·마이그레이션 | 구체적 실패 기록 없음 | `evolving-apis-and-schemas`, OpenSpec | `api-and-interface-design`은 신규 소비자 계약에서 별도 가치 — 조건부 |
| 운영 로그·메트릭 부재 | Safety Edge의 Edge→RC→Core 추적 공백 가능성 | 실행·실패 복구 검증 | `observability`는 제품별 검토 가치 높음 — 전역 강제 아님 |
| 고객 인터뷰·사용성 조사 데이터 | 아직 실제 조사 데이터·필요성 불명확 | journey/organize는 흐름·IA 분석 | `research-synthesis`는 중복 아님 — 데이터 축적 후 검토 |

### 조정된 우선순위

- **1차 trial 2종:** `diagnosing-bugs`(Engineer), `ux-copy`(Design, Critic).
- **조건부 1종:** `playwright-best-practices` — 실제 Playwright E2E 테스트가 있는 프로젝트에서만.
- **보류:** `tdd`, `code-review-and-quality`, `design-critique`, `handoff`/`context-engineering`, Postgres, React composition.
- **조건부 재검토:** `api-and-interface-design`(신규 소비자 계약), `observability-and-instrumentation`(Safety Edge/Edge→RC→Core 추적), `research-synthesis`(실제 고객 조사 데이터).
- **제외:** `verification-before-completion`은 공통 AGENTS와 중복되고 필수 게이트로 오해될 수 있다. Superpowers/Addy 전체 묶음과 Codex 전용 보안 플러그인도 제외한다.

### 후속 검토 트리거

- Safety Edge에서 하나의 관측 이벤트 ID가 Edge 생성→RC 수신→Core 저장으로 이어지는지 추적하기 어려워지면 `observability-and-instrumentation`을 해당 제품에 한정해 검토한다. 모든 프로젝트에 OpenTelemetry·모니터링 인프라를 강제하지 않는다.
- 새 API의 소비자 계약·버전·멱등성·오류 계약을 처음 설계하는 작업이 반복되면 `api-and-interface-design`을 Engineer 조건부로 검토한다.
- 실제 고객 인터뷰·설문·사용성 테스트 데이터가 축적되면 `research-synthesis`를 Research/Design 조건부로 검토한다. journey/organize와 동일한 스킬이 아니다.
- 프로젝트에 실제 Playwright E2E 테스트가 생기면 `playwright-best-practices`를 조건부로 검토한다.

`diagnosing-bugs`는 “바로 고치지 말고 재현 루프를 먼저” 만들게 해 반복 수정·가설 확정 문제를 직접 줄인다. `ux-copy`는 에러·빈 상태·CTA 문구의 실제 수정 비용을 줄인다. `playwright-best-practices`는 E2E 테스트가 실제로 있는 경우에만 flaky·CI·POM 문제를 다룬다. Native Browser 연결 문제 자체를 해결하는 스킬은 아니므로 그 문제에는 기존 브라우저 경로 지침을 유지한다.

### 효과 확인 방법

설치 후 2~3개의 실제 작업에서 다음을 비교한다.

- 같은 문제를 몇 번 반복 수정했는가, 원인 발견까지 걸린 시간이 줄었는가
- 에러·빈 상태·CTA 문구에 대한 사용자 교정이 줄었는가
- E2E 테스트의 flaky·캡처 실패·CI 재실행이 줄었는가
- 스킬 호출이 실제 작업을 늘리지 않고 판단을 줄였는가

효과가 없거나 호출만 늘면 제거한다. 설치 수·평가 점수는 효과 증거로 사용하지 않는다.

### 2026-10-24 trial 설치

- `diagnosing-bugs` — Matt Pocock, MIT, `~/.agents/skills/diagnosing-bugs`. Engineer가 원인 불명·반복 실패에 사용한다. 선택적 HITL shell template 포함, 설치 훅 없음.
- `ux-copy` — Anthropic knowledge-work-plugins, Apache-2.0, `~/.agents/skills/ux-copy`. Design·Critic이 에러·빈 상태·CTA·온보딩 문구에 사용한다. 공유 `~/.agents/CONNECTORS.md`를 함께 배치했다.
- Critic 허용 목록은 12종으로 늘렸고, Engineer/Design 지침에 사용 조건을 추가했다. General·Explore·Research는 기존 경계대로 이 두 스킬을 허용하지 않는다.
- 설치 기록·해시·라이선스: `/tmp/opencode/ksi-depth3-install-qxzxj_rl/trial-skills-install.json`.
- 사용 흐름: Engineer는 재현 루프→가설→최소 수정→회귀 가드→런타임 재검증, Design/Critic은 사용자 상태→문구→복구 경로→실제 렌더 상태 확인.
- 2~3개 실제 작업 후 유지/제거를 결정한다. 아직 효과는 미검증이다.

### Trial 범위와 주의

- `diagnosing-bugs`는 원인 불명·반복 실패에만 사용한다. 재현 환경·실장비가 없어 전체 루프를 만들 수 없으면 진행을 멈추지 말고, 확보 가능한 신호·미확인 범위·필요 환경을 반환한다. 원본의 엄격한 “재현 루프 없이는 다음 단계 금지”를 모든 작은 수정에 적용하지 않는다.
- `ux-copy`는 화면 구성·정보 구조·레이아웃 판단을 대체하지 않는다. 어색한 줄바꿈·텍스트 과밀은 Design의 구성 판단과 실제 렌더 검증으로 다룬다. Critic이 사용하더라도 전체 제품·UX·기술 검토 범위를 문구 검토로 축소하지 않는다.
- Anthropic 원본 `ux-copy`는 Claude 전용 `/ux-copy` 명령과 커넥터 설명을 포함한다. OpenCode에서는 슬래시 명령이 아니라 스킬 본문을 읽는 렌즈로 사용하고, 연결되지 않은 도구는 미제공으로 보고한다.
- 출처를 고정한다: `mattpocock/skills`의 `diagnosing-bugs`, `anthropics/knowledge-work-plugins`의 `design/skills/ux-copy`. 같은 이름의 다른 배포와 혼동하지 않는다.
