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

## 3. 프로젝트 로컬 스킬 6종 (설치 완료, 전역 변경 없음)

` .opencode/skills/{6ID}/`에 원본 바이트 + 스킬별 MIT 원문과 함께 설치됐다.
Native 조회에서 기존 OpenSpec 6종과 함께 12종 전부 발견됨이 확인됐다.
증거: `.opencode/artifacts/engineer-skills-install.json` (전체 해시 +
라이선스 해시), `.opencode/artifacts/engineer-skill-discovery.json`.
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

## 4. 제외 결정 및 task-first 유지

- `task-first-ux-review` 유지. `reviewing-interface-quality`로 대체하지
  않는다: 후자는 스크린샷 + 계산값 근거의 최종 게이트이고, task-first는
  작은 변경용 저의식 렌즈라 대체 시 저의식 경로가 사라지고 Impeccable과
  중복된다. 실제 비교 결과 대체 부적합이 확인됐다.
- `designing-frontend-interfaces` 제외 (Impeccable 중복).
- 전체 스위트·메타 스킬 제외. Impeccable, Intent 3종, Mobbin, Playwright,
  Vercel, 모션/취향 스킬 및 히스토리 보존.

## 5. 적용 현황과 남은 상태

- 발견 ≠ 적용 증거: 스킬이 조회·권한 목록에 있다고 실제 적용이
  증명된 것은 아니며, 6종 일괄 실행을 의무화하지 않는다. 각 실행은
  자체 증거를 인용한다.
- `reviewing-security`는 세션에서 로드되어 라우팅 데이터·도구 경계의
  경로 기반 리뷰에 사용됐다 (6종 전체 실사용 주장 아님).
  Critic은 `reviewing-security`/`building-accessible-interfaces`/
  `ux-heuristics-audit` 3종을 읽기 전용 출처로 허용받았다.
  Native general·Engineer·Design은 스킬 기본 허용이며, 기존 전역 역할은
  변경 없이 설치됐으므로 전역 신규 권한은 보류 중이다.
- 모델/프로바이더 프라이버시 GLM 본문 필터는 단일 Muse 라우팅 정리에서
  제거됐다. 이는 데이터 노출을 바꾸는 스펙 요구사항이 아니며, 현재 구성은
  `opencode-go` 단일 provider와 Contributor 학습 사용 조건을 명시한다.
- 기술 검증 현황: 회귀 142/142, OpenSpec 2/2, Native scripted 308/308.
  실제 Muse 단일 구성의 Engineer·Design 동시 쓰기·렌더·Plan 자문은
  미검증이며, 상세는 `docs/engineer-routing-validation.md`를 따른다.
- 전역 설치는 활성 설정 보호 하에 보류 중. 본 변경은 전역 런타임
  (GLM/렌더/DGX) 공백이 해소될 때까지 OPEN 유지하며 미완료 상태에서
  아카이브하지 않는다.
