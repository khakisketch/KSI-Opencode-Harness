# Engineer 중심 구성 — 적용·검증 상태

2026-10-24. 이전 8개 구성의 근거는 [기존 검증 기록](validation.md)에 보존합니다. 이 문서는 Engineer 도입 이후의 상태만 다룹니다. 설정 선언, 정책 조회, scripted Native 실행, 실제 모델 실행, 실제 제품 인수는 서로 다른 증거입니다.

## 정본과 전역 설치

- 시작 시 저장소와 `origin/main`은 `adeaa3c`로 일치하고 작업 트리는 깨끗했습니다.
- 단일 Muse 라우팅·Engineer 정리는 커밋 `24c3154`로 원격 `main`에 배포했습니다. 실제 전역은 여전히 `437e615` 계통의 이전 역할·깊이 2 구성입니다. 이전 백업과 비교해 사용자 변경 여부를 확인하며, 새 정본과 다르다는 이유로 덮어쓰지 않습니다.
- 기존 `design-architect`와 관련 부모·후손의 실행이 끝나지 않아, 이전 사용자의 **대기 후 재시도** 결정을 유지합니다. 기존 세션·저장 모델·다른 제품·공유 서비스는 강제 변경하지 않습니다.
- 기본 운영 역할은 Native 4개 + Engineer·Design·Research·Critic입니다. Architect는 원본 그대로 `docs/archive/agents/architect.md`에 보존하고 발견 경로·설정 등록에서 제외합니다. 숨김 등록만 남기는 대안은 아홉 번째 등록·직접 선택 가능성을 남기므로 채택하지 않았습니다. Plan의 충분한 실제 기술 자문 검증 전에는 최종 폐기하지 않습니다.

## 모델: 확인한 ID와 제한

아래 ID·Variant는 설치된 Native 카탈로그와 `/api/model`에서 확인했습니다. 운영 역할 전체가 `opencode-go/muse-spark-1.3-contributor`를 사용하고 역할별 추론 강도만 다릅니다. 모두 도구 지원을 광고하지만 실제 호출·성능 보장은 아닙니다. Build의 전역 모델은 설정하지 않습니다.

| 역할 | 정본 ID | Variant / 주요 조건 |
| --- | --- | --- |
| Plan | `opencode-go/muse-spark-1.3-contributor#xhigh` | minimal/low/medium/high/xhigh; Contributor 학습 사용 조건 |
| Critic | `opencode-go/muse-spark-1.3-contributor#xhigh` | 동일 모델·최고 추론 강도 |
| Engineer | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| Design | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| Research | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| General | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| Explore | `opencode-go/muse-spark-1.3-contributor#low` | 동일 모델·low, 20 steps 유지 |

Build 후보 `opencode-go/gemini-4-argon-contributor#high`는 카탈로그의 low/medium/high를 확인했지만 선택·강제하지 않았습니다. 중요한 Plan 자문에서 다른 모델을 쓰는 것도 Native 세션 선택 사항이며 자동 전환하지 않습니다.

### 비용과 데이터 정책

확인일 기준 Go의 Muse Contributor `$/1M` 입력·출력·캐시 읽기는 `.10/.20/.002`입니다. 카탈로그 비용 0도 무료·로컬이라는 증거가 아닙니다. 역할별 Variant 차이는 추론 강도 설정이며 작업당 총비용·품질 우위는 미측정입니다.

- **Muse Contributor는 요청·응답 학습 사용, Not ZDR** 조건입니다. 기존 사용을 보존하되 이것을 모든 비공개 프로젝트·고객 데이터 전송 승인으로 확대하지 않습니다. 제공자 허용·지역·데이터 정책은 해당 작업에서 확인하며 공유 계정의 Privacy 설정을 임의 변경하지 않습니다.
- 이전 DeepSeek·MiMo·GLM·Luna 배치는 2026-10-24 사용자 결정으로 현재 정본에서 제외했습니다. 그때의 실제 실행 증거는 당시 검증 이력으로만 보존하며 현재 단일 모델 구성의 품질 근거로 재해석하지 않습니다.
- OpenRouter GLM 데이터 필터·Auto 라우팅·DGX Qwen 후보는 현재 구성에 포함하지 않습니다. 제공자 장애나 데이터 정책 거부 시 다른 모델로 자동 폴백하지 않고 실패를 보고합니다.
- 외부 MCP·브라우저·도구 백엔드의 데이터 정책은 모델 제공자 조건과 별개입니다.

정책 출처: [Go 가격·Privacy](https://opencode.ai/v2/docs/console/go), [Native 모델·Variant](https://opencode.ai/v2/docs/models).

## 위임과 권한

| 호출자 | 허용 대상 |
| --- | --- |
| Build | Plan, Engineer, Design, General, Explore, Research, Critic |
| Plan | Engineer, Design, General, Explore, Research, Critic — 배정된 분석 범위만 |
| Engineer | Plan, Design, General, Explore, Research, Critic |
| Design | Plan, Engineer, General, Explore, Research, Critic |
| Research | Explore |
| General / Explore / Critic | 없음 |

모든 목록은 앞선 `* deny` 뒤에 명시 허용하며 자기 호출·하위 Build·미등록 대상·Architect를 거부합니다. 남은 깊이는 Native가 제한하며 루트 0 아래 최대 3, 보통 1~2입니다. Engineer↔Design 허용이 같은 과업의 조상 왕복을 승인하지는 않습니다.

Plan의 Native 프롬프트·파일 편집 제한은 유지합니다. 역할 권한은 자식에 자동 상속되지 않으며, 엄격한 분석 격리는 기존 제한을 보존한 명시 세션 규칙 또는 제한 실행환경을 하위 생성 전에 준비해야 합니다. 세션 규칙은 생성 시 상속되고 기존 자식에 소급되지 않습니다. 자동 Plan 격리 플러그인·OS/네트워크 샌드박스는 추가하지 않습니다.

## OpenSpec·스킬

[도입 기록](openspec-and-skills.md)과 [승인된 운영 계약](../openspec/specs/engineer-workflow/spec.md)을 참조합니다. 이 Harness 프로젝트만 초기화하며 기존 문서·변경 이력·다른 제품은 일괄 이전하지 않습니다. 제3자 원본 스킬은 저장소에 번들하지 않습니다. 스킬 설치·발견·권한·실제 적용의 증거는 구분합니다.

## 검증 결과

### 회귀·격리 Native

- 모의 회귀 **142/142**, OpenSpec **2/2** 통과. 기존 UI 소스 검사 플러그인·Impeccable·기존 스킬 원본은 수정하지 않았습니다.
- 최종 정본을 복사한 Native **2.1.4 scripted 통합 308/308** 통과. 근거 `/tmp/opencode/ksi-deleg-muse-single/ksi-deleg-I4V3Ws`의 manifest·메시지·요청 로그입니다. 메인이 런타임 정본 6개·검사 2개·보존 Architect의 해시 **9개**를 대조했습니다. 모델을 fixture로 대체했으므로 실제 제공자의 추론·품질 검사가 아닙니다.
- 기존 깊이 3·초과 거부·실제 수정 거부·동일 자식 재개·실패 후 새 근거 복구·단일 도구 결과별 실제 바이트 반환·세션 제한의 전체 순서 포함 상속/비소급 검사를 유지했습니다.
- 새 Engineer 수정 허용, `Build→Engineer→Plan→Explore`, `Build→Engineer→General` 구현·동일 General 재수정, `Design→General` UI 파일 구현을 확인했습니다. 읽기 전용 Research/Critic/Plan의 실제 거부는 별도로 유지했습니다.
- 병렬 L에서는 **같은 Build turn**의 Engineer·Design이 독립 파일을 실제 write/read했습니다. 각 세션의 세 번 요청 시간창이 교차함을 확인했고, 상대 파일 변경·공유 계약 바이트 변경 없이 부모에 둘 다 반환됐습니다. 이는 분리 소유한 작업의 Native 동시 실행 근거이며, 모든 실모델·공유 데이터에서 충돌이 불가능하다는 보장은 아닙니다.
- 역할 카탈로그는 기본 8개이며 Architect의 숨김 phantom도 허용하지 않는 검사로 보강했습니다. 역할별 Muse Variant·단일 `opencode-go` provider·Build 전역 미고정·Critic의 정확한 스킬 허용도 정본과 대조합니다.

최신 전역 적용용 6개 파일은 `/tmp/opencode/ksi-depth3-install-qxzxj_rl/next/`에 최신 정본 바이트로 갱신했고 `next-manifest.json`에 런타임 6개·검사 2개·보존 Architect의 해시 9개를 기록했습니다. 이전 `adeaa3c` 준비본은 같은 루트의 `superseded-adeaa3c-next/`로 보존해 혼동하지 않도록 했습니다. **실제 전역은 교체하지 않았으며 `tests/agent-routing-native.mjs`의 설치본 검사는 아직 미실행**입니다. 격리 통과로 전역 적용 완료를 대신하지 않습니다.

### 실제 모델: 기술 개발 단위 (이전 모델 구성, 역사적 근거)

작업 전용 공개 합성 데이터의 Node API에서 검증했습니다. 실제 제품·고객 데이터나 다른 프로젝트를 수정하지 않았습니다. 근거 루트: `/tmp/opencode/ksi-live-engineer-kuz44u/evidence/`.

| 실제 세션 | Native 역할 / 모델 | 확인 결과 |
| --- | --- | --- |
| `ses_e92a9501fffebMovpFDVPWVe0E` | Build / DeepSeek Flash High | Engineer 위임·후속 재개·최종 테스트 직접 확인 |
| `ses_e92a8dfdfffecwJ7rVRWHxxq6P` | Engineer / DeepSeek Flash High | General 구현·수정 조율, 독립 Critic 활용 |
| `ses_e92a88a6fffezA2POpCvg5AHZ2` | General / Muse Contributor High | 최초 구현 후 같은 ID로 세 번 재개: 국소 수정·Critic 교정·새 후속 계약 검사 |
| `ses_e92a6d55fffeODwUkNvVvnNS5l` | Critic / Luna High | 테스트 엄밀성 지적 2건, 기존 담당자가 반영·재검증 |

Native export에서 부모 ID·실제 모델·도구 호출·비용을 확인했습니다. `validate → store → HTTP` 다층 구현과 `node --test tests/api.test.js` **31/31**을 메인도 직접 재실행했습니다. Build가 General을 직접 호출해 Engineer를 건너뛴 결과가 아닙니다. `build_turn{1,2}.export.json`, `engineer_after_turn2.export.json`, `general_after_turn2.export.json`과 Critic export가 원본입니다.

각 세션 assistant 메시지의 Native 비용 합은 **$0.036573805**로 확인했습니다(Build .010564374, Engineer .013409046, General .006579880, Critic .006020505). 청구서와 정산한 금액이나 다른 모델보다 저렴하다는 비교 결과는 아닙니다. 별도 초기 조사·다른 작업 비용은 포함하지 않습니다.

첫 구현의 설정은 개인정보 필터 추가 이전이었고 그때도 Go 공개 합성 데이터만 사용했습니다. OpenRouter 호출 전에 GLM 모델별 필터를 복사해 준비했습니다. Architect 숨김 stub 제거는 이후의 별도 등록 교정이며 기존 기술 단위의 모델·부모 관계·코드 결과를 바꾸지 않습니다. 실제 호출의 복사본 해시와 최종 정본 해시는 같다고 주장하지 않습니다. **2026-10-24 단일 Muse 라우팅 결정 이후 이 표의 DeepSeek·Luna 실행은 현재 구성의 실호출 증거가 아닙니다.**

### 남은 실제 실행 검증

현재 Muse 단일 구성에서 Engineer·Design의 **실모델** 동시 쓰기 충돌, Design의 실제 이미지·Browser/렌더 교정, Plan의 충분한 기술 자문 성능은 아직 미검증입니다. 이전 GLM Design·DeepSeek Engineer의 실제 실행은 당시 모델 구성의 역사적 근거로만 남습니다. 전역 등록·설치 권한 검사도 보호 작업 종료 후 남아 있습니다. 이전 구성의 검사 통과를 새 모델 실호출이나 장기 제품 개발 능력으로 재해석하지 않습니다.
