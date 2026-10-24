# Engineer 중심 구성 — 적용·검증 상태

2026-10-24. 이전 8개 구성의 근거는 [기존 검증 기록](validation.md)에 보존합니다. 이 문서는 Engineer 도입 이후의 상태만 다룹니다. 설정 선언, 정책 조회, scripted Native 실행, 실제 모델 실행, 실제 제품 인수는 서로 다른 증거입니다.

## 정본과 전역 설치

- 시작 시 저장소와 `origin/main`은 `adeaa3c`로 일치하고 작업 트리는 깨끗했습니다.
- 단일 Muse 라우팅·Engineer 정리는 커밋 `24c3154`로 원격 `main`에 배포했고, 2026-10-24 역할 단위 감사 정본 `3504606`을 실제 전역에 적용했습니다. 전역은 이제 Native 4개 + Engineer·Design·Research·Critic, 깊이 3, Research medium 시험 배정입니다. 이전 `437e615` 계통의 4역할·설정은 `/tmp/opencode/ksi-depth3-install-qxzxj_rl/pre-apply-20261024T111208Z/`에 보존했습니다.
- 보호 중이던 이전 `design-architect` 세션 6개가 모두 idle임을 확인한 뒤 적용했습니다. 기존 세션·저장 모델·다른 제품·공유 서비스는 강제 변경하지 않았고, 이전 역할 파일은 발견 경로 밖으로 이동했습니다.
- 기본 운영 역할은 Native 4개 + Engineer·Design·Research·Critic입니다. Architect는 원본 그대로 `docs/archive/agents/architect.md`에 보존하고 발견 경로·설정 등록에서 제외합니다. 숨김 등록만 남기는 대안은 아홉 번째 등록·직접 선택 가능성을 남기므로 채택하지 않았습니다. Plan의 충분한 실제 기술 자문 검증 전에는 최종 폐기하지 않습니다.

## 모델: 확인한 ID와 제한

아래 ID·Variant는 설치된 Native 카탈로그와 `/api/model`에서 확인했습니다. 운영 역할 전체가 `opencode-go/muse-spark-1.3-contributor`를 사용하고 역할별 추론 강도만 다릅니다. 모두 도구 지원을 광고하지만 실제 호출·성능 보장은 아닙니다. Build의 전역 모델은 설정하지 않습니다.

| 역할 | 정본 ID | Variant / 주요 조건 |
| --- | --- | --- |
| Plan | `opencode-go/muse-spark-1.3-contributor#xhigh` | minimal/low/medium/high/xhigh; Contributor 학습 사용 조건 |
| Critic | `opencode-go/muse-spark-1.3-contributor#xhigh` | 동일 모델·최고 추론 강도 |
| Engineer | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| Design | `opencode-go/muse-spark-1.3-contributor#high` | 동일 모델·high |
| Research | `opencode-go/muse-spark-1.3-contributor#medium` | 동일 모델·medium (시험 배정) |
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

### Variant 배정 판단

- **Engineer·Design = high:** 일반 구현·렌더 반복은 high로 두고, 중요한 미해결 기술·디자인 판단에만 xhigh를 선택합니다. xhigh를 상시 기본으로 둘 근거는 아직 없습니다.
- **Critic = xhigh:** 독립 검토는 반례·누락·계약 충돌을 찾는 판단 비중이 높아 최고 추론 강도를 유지합니다.
- **Research = medium (시험):** Explore가 추출을 맡고 Research가 비교·종합하는 분업을 전제로 비용을 낮춰 봅니다. 실제 비교 품질이 부족하면 high로 되돌립니다.
- **Plan = xhigh:** 방향·우선순위·기술+제품 자문의 판단 비중이 높습니다.
- 위 배정은 카탈로그 지원과 역할 분업에 따른 가설이며, 역할별 품질·지연·총비용 비교 측정은 아직 없습니다.

## 작업 단위·루프 감사

호출 가능한 역할 목록과 작업 단위의 소유 기준을 분리했습니다. Engineer·Design은 한 단위에서 General·Explore·Research·Plan·Critic을 각각 다른 하위 산출물에 호출할 수 있으며, 고정된 단일 자식 구조가 아닙니다. 소유권과 남은 깊이 한도가 기준입니다.

- **Engineer:** 미해결 구현 결정, 여러 파일·계약·상태, 테스트/수리 반복이 있는 다단계 기술 단위를 소유합니다. General에는 대상 파일·수정·검증이 이미 정해진 슬라이스만 맡깁니다.
- **General:** 이미 결정된 단일 슬라이스를 실행·검증하고 반환합니다. 설계·아키텍처·UX 결정, 단위 인수, 여러 차례 조율을 맡지 않습니다. 발견·설계·조율이 필요해지면 소유 단위로 돌아갑니다.
- **모델 교체와 라우팅:** General/Engineer의 구분은 모델 성능·실행 위치가 아니라 작업 단위 소유권으로 유지합니다. 향후 General을 Qwen 27B·Qwen Flash Next 같은 로컬 코딩 모델로 바꾸더라도 General은 결정된 슬라이스 실행자이고, Engineer는 사고·설계·조율이 필요한 기술 단위 소유자입니다. 모델이 강해져도 소유권은 자동 이전되지 않습니다.
- **General 로컬 모델 교체 절차:** 역할 계약은 유지하고 `agents.general.model`만 바꿉니다. 로컬 도구·컨텍스트·라이선스·데이터 정책을 확인하고, 결정된 슬라이스 벤치마크로 구현·테스트·수리 품질을 비교합니다. 품질이 부족하면 슬라이스를 좁히거나 Engineer가 직접 수행하며, 불명확한 단위를 General에 넘겨 소유권을 이전하지 않습니다.
- **역할별 스킬:** General은 `vercel-react-best-practices`, `evolving-apis-and-schemas`, `building-accessible-interfaces`, `playwright-cli`, `opencode`만 허용하고 디자인·전략·보안 리뷰 스킬은 막습니다. Explore는 스킬 표면이 없고, Research는 근거 6종, Critic은 검토 12종을 사용합니다. Engineer·Design은 기술·디자인 스킬을 넓게 사용하되 소유권 경계를 유지합니다.
- **Trial skills:** `diagnosing-bugs`(Engineer)와 `ux-copy`(Design/Critic)를 2026-10-24 설치했습니다. Engineer는 재현 루프·가설·회귀 가드, Design/Critic은 에러·빈 상태·CTA 문구에 사용합니다. 2~3개 실제 작업 후 유지/제거를 판단하며 효과는 아직 미검증입니다.
- **Design:** 크기와 무관하게 모든 UX/인터페이스 단위를 소유합니다. General이 결정된 UI 슬라이스를 실행할 수 있지만 디자인 소유권은 이전되지 않습니다.
- **UI/UX 검토:** Design이 조사·설계 후 General에 구현을 맡기고, 실제 렌더에서 연구·레퍼런스·설계 의도가 결과에 반영됐는지와 원래 과업을 확인합니다. 중요한 단위는 구현 전 가설 또는 구현 후 결과를 Critic이 독립 비평할 수 있으며, 발견은 Design의 판단을 거쳐 같은 General 세션의 교정·재검증으로 이어집니다. Critic은 필수 게이트가 아니고 수정·최종 인수를 하지 않습니다. 새 역할·필수 단계가 아니라 기존 허용 루프를 README에 명시한 것입니다.
- **Explore vs Research:** 경계는 로컬/웹 도구가 아니라 질문입니다. Explore는 범위가 정해진 검색·원본 추출(보통 로컬 코드), Research는 충돌하는 자료의 비교·대안·적용 조건·미확인 종합입니다.
- **루프:** Engineer↔Design, Plan↔Engineer 호출은 별도 하위 산출물이 있을 때만 허용하며 같은 단위를 왕복시키지 않습니다. 깊이 3과 자기 호출·조상 왕복 금지가 무한 루프를 막지만, 권한만으로 소유권이나 분석 전용 범위를 강제하지는 않습니다.
- **Plan:** 분석 전용 범위는 하위에도 유지해야 하며, Plan은 Explore·Research·Critic만 호출합니다. Engineer·Design·General은 Plan의 직접 위임 대상이 아니며, 구현 가능성이 걸린 질문은 Build로 반환합니다. 엄격한 격리는 자식 생성 전에 명시 세션 제한이나 제한 환경으로 준비하고 실제 효과를 확인해야 합니다.

## 위임과 권한

| 호출자 | 허용 대상 |
| --- | --- |
| Build | Plan, Engineer, Design, General, Explore, Research, Critic |
| Plan | Explore, Research, Critic — 배정된 분석 범위만 |
| Engineer | Plan, Design, General, Explore, Research, Critic |
| Design | Plan, Engineer, General, Explore, Research, Critic |
| Research | Explore |
| General / Explore / Critic | 없음 |

모든 목록은 앞선 `* deny` 뒤에 명시 허용하며 자기 호출·하위 Build·미등록 대상·Architect를 거부합니다. 남은 깊이는 Native가 제한하며 루트 0 아래 최대 3, 보통 1~2입니다. Engineer↔Design 허용이 같은 과업의 조상 왕복을 승인하지는 않습니다.

Plan의 Native 프롬프트·파일 편집 제한은 유지합니다. 역할 권한은 자식에 자동 상속되지 않으며, 엄격한 분석 격리는 기존 제한을 보존한 명시 세션 규칙 또는 제한 실행환경을 하위 생성 전에 준비해야 합니다. 세션 규칙은 생성 시 상속되고 기존 자식에 소급되지 않습니다. 자동 Plan 격리 플러그인·OS/네트워크 샌드박스는 추가하지 않습니다.

## OpenSpec·스킬

[도입 기록](openspec-and-skills.md)과 [승인된 운영 계약](../openspec/specs/engineer-workflow/spec.md)을 참조합니다. 이 Harness 프로젝트만 초기화하며 기존 문서·변경 이력·다른 제품은 일괄 이전하지 않습니다. 제3자 원본 스킬은 저장소에 번들하지 않습니다. 스킬 설치·발견·권한·실제 적용의 증거는 구분합니다.

2026-10-24 감사에서 자체 `task-first-ux-review` 스킬과 `ksi-impeccable-detector` 편집 훅 플러그인을 폐기했습니다. Design은 웹 UI 편집 후 공식 Impeccable `detect --json`을 수동 실행하고, 네이티브 플랫폼은 소스 검사를 건너뜁니다. 외부 스킬만 유지하며, 설치된 스킬의 워크플로가 하위 에이전트·서버·쓰기를 요구하면 Research/Critic은 허용된 범위만 렌즈로 적용하고 나머지는 미제공으로 보고합니다.

## 검증 결과

### 회귀·격리 Native

- 2026-10-24 역할 단위·부품 감사 후 모의 회귀 **101/101**, OpenSpec **2/2** 통과. 자체 플러그인 폐기와 함께 core/adapter/native-hook 검사 41개를 제거했으며, 남은 검사를 약화해 통과시킨 것이 아닙니다. 기존 Impeccable·외부 스킬 원본은 수정하지 않았습니다.
- 최종 정본을 복사한 Native **2.1.4 scripted 통합 312/312** 통과(UI/UX 흐름 문서·Critic 스킬 매핑·General 소유권 계약 반영 후 재실행). 근거 `/tmp/opencode/ksi-deleg-ECyQpE`의 manifest·메시지·요청 로그입니다. 모델을 fixture로 대체했으므로 실제 제공자의 추론·품질 검사가 아닙니다.
- 기존 깊이 3·초과 거부·실제 수정 거부·동일 자식 재개·실패 후 새 근거 복구·단일 도구 결과별 실제 바이트 반환·세션 제한의 전체 순서 포함 상속/비소급 검사를 유지했습니다.
- 새 Engineer 수정 허용, `Build→Engineer→Plan→Explore`, `Build→Engineer→General` 구현·동일 General 재수정, `Design→General` UI 파일 구현을 확인했습니다. 읽기 전용 Research/Critic/Plan의 실제 거부는 별도로 유지했습니다.
- 병렬 L에서는 **같은 Build turn**의 Engineer·Design이 독립 파일을 실제 write/read했습니다. 각 세션의 세 번 요청 시간창이 교차함을 확인했고, 상대 파일 변경·공유 계약 바이트 변경 없이 부모에 둘 다 반환됐습니다. 이는 분리 소유한 작업의 Native 동시 실행 근거이며, 모든 실모델·공유 데이터에서 충돌이 불가능하다는 보장은 아닙니다.
- 역할 카탈로그는 기본 8개이며 Architect의 숨김 phantom도 허용하지 않는 검사로 보강했습니다. 역할별 Muse Variant·단일 `opencode-go` provider·Build 전역 미고정·Critic의 정확한 스킬 허용도 정본과 대조합니다.

최신 전역 적용용 6개 파일은 `/tmp/opencode/ksi-depth3-install-qxzxj_rl/next/`에 최신 정본 바이트로 갱신했고, 2026-10-24 11:12Z에 전역에 적용했습니다. 적용 전 파일은 `/tmp/opencode/ksi-depth3-install-qxzxj_rl/pre-apply-20261024T111208Z/`에 보존했습니다. `tests/agent-routing-native.mjs` 설치본 검사 **327/327** 통과(근거 `/tmp/opencode/ksi-agent-routing-An32Qi`), `scripts/capabilities.mjs`에서 8개 역할 등록과 MCP 2개 연결을 확인했습니다. 이는 설치·정책 검증이며 실제 모델의 판단력·제품 완성도 검증이 아닙니다.

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

현재 Muse 단일 구성에서 Engineer·Design의 **실모델** 동시 쓰기 충돌, Design의 실제 이미지·Browser/렌더 교정, Plan의 충분한 기술 자문 성능은 아직 미검증입니다. 이전 GLM Design·DeepSeek Engineer의 실제 실행은 당시 모델 구성의 역사적 근거로만 남습니다. 전역 등록·설치 권한 검사는 2026-10-24 완료했습니다(327/327). 이전 구성의 검사 통과를 새 모델 실호출이나 장기 제품 개발 능력으로 재해석하지 않습니다.
