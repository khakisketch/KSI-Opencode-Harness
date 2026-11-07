# 현재 검증과 한계

### GitHub CI 가동 + 하드코딩 tmp 경로 수정 (2026-11-07)

- `.github/workflows/verify.yml` 추가 (오프라인 전용, 네이티브 제외). 첫 실행에서 `mkdtemp('/tmp/opencode/...')` 하드코딩이 Ubuntu에서 ENOENT로 실패 → `UNIT_TMP` 폴백(`os.tmpdir()`)으로 수정 후 통과.
- `verify` 워크플로 초록불 확인 (5da57ac). 네이티브 검사는 로컬 opencode 바이너리 필요라 CI 제외, 로컬에서 수행.

### 외부 리뷰 반영·CI 도입 (2026-11-07, 2.2.6)

- 외부 리뷰에서 지적된 항목 수정: `bd claim`→`bd update <id> --claim` 오기 2건, rule-id 재검증 vs 매 라운드 전체 패스의 모순 해소(known 결함은 rule-id로 재확인 + 매 라운드 신규 탐색 병행), Design 역할 문구(검수 전용→독립 UX 판단·비평, 단 구현 금지 유지), Plan→Explore 권한의 위치별 동작 명시, T7 compact 판정 엄격화(200 확정 + 사용 가능 분리).
- 문서 불일치 수정: decisions Design MiMo, README/installation 5프로파일·MiMo, "자동 훅 금지"→최소 이벤트 연결 허용, `global/AGENTS.md` Jev 한 줄 추가 후 설치본 동기화.
- GitHub Actions CI 추가(`.github/workflows/verify.yml`, --offline만; 네이티브는 로컬 opencode 바이너리 필요). 실패한 `--all` 3건 중 2건은 기존 설치본 drift(AGENTS.md 미동기화, 인벤토리 구 4프로파일)였고, 1건은 테스트의 관대한 compact 판정. 전부 수정 후 `--all` 7/7, 오프라인 286/286, lifecycle 24/24, routing 128/128.

### OpenCode 2.2.1 → 2.2.6 업그레이드 (2026-11-07)

- Homebrew `opencode-v2` 2.2.1 → 2.2.6. 업그레이드 전 설치본 설정·버전 증거를 `~/.local/share/ksi-harness-backups/harness-upgrade-20261107-170407/`에 보존. 구 버전 바이너리는 brew cleanup으로 제거됨(재설치 시 내려받기 필요).
- 업그레이드 후 전체 회귀: 오프라인 **286/286**, 격리 Native 4종·설치본 역할·인벤토리 포함 **7/7 단계 통과**. 2.2.5→2.2.6 변경분 중 하네스 관련 확인 항목(compaction % 버퍼, Go DeepSeek 한도, MCP 안정화, bash 폴백, Console override 허용)은 후속 파일럿에서 개별로 검증 예정.
- 업그레이드 과정에서 발견된 설치본 drift 2건 수정: `AGENTS.md` 공통 지침(ai-memory→Beads 문구) 동기화, capabilities 인벤토리 설치본 재게시(구 4프로파일 lead 잔재 제거). 둘 다 업그레이드가 아닌 기존 drift이며, ре그레션으로 오인하지 말 것.

### ksi-visual-workflow 퇴역 (2026-11-06)

- 자체 플러그인을 비활성화하고 소스·설치기·전용 테스트 4종을 제거했습니다(백업 `~/.local/share/ksi-harness-backups/harness-visual-retire-20261106-171446/`에 설치본·소스 tar 보관). `verify-harness.mjs`에서 외부 테스트 합류·전용 native 스크립트·`visual-verify` 단계를 제거했습니다. 세션 감사 휴리스틱(합성 세션 대상)은 손대지 않았습니다.
- 대체: 웹 실행·관찰·조작·캡처는 agent-browser, 회귀·E2E는 Playwright, 디자인 판단은 Design, 증거 기록은 `docs/evidence-pack.md` 5항. 아래 오프라인 수치 변화는 전용 테스트 제거분이며, 위임·역할·인벤토리 회귀는 그대로 통과해야 합니다.
- ADB 에뮬레이터 직접 캡처는 대체 미확인이라 별도 실측 대상으로 남겼습니다(Maestro·Midscene 포함 외부 도입은 검증 후).
- Design 모델 교체 (2026-11-06): Sol High → Go MiMo V2.6 Pro. V-suite 6종 블라인드에서 Sol High 6/6·MiMo 6/6 동점(시드 결함 메커니즘·수치 특정 동급). 이미지 입력 프로브 단독은 미확정이었으나 V-suite 렌더 열람으로 해소. 설치본 한정, 소스는 무고정 유지.
- Design 직접 접근 검증 통과: 격리 http 서브에 Playwright Chromium으로 접속, 캡처 2장 직접 열람(배지 색·상세 문구 등 화면 전용 증거 보고), 요소 좌표 보고, 검색 조작 12→3행 확인. `visual_*` 없이 수행, 수정·위임 없음.
- Design 읽기전용 강제 실측 (격리 /tmp, 전 수단 시도): `edit` deny는 edit/write/이미지생성 채널만 차단하고, shell(echo·tee·python·node·curl -o·mkdir)은 무제한 통과, 경로 제한 없음. 현행 읽기전용은 툴 타입 수준이며 파일시스템 격리가 아님. 엄격한 비수정이 필요하면 Native 세션 권한으로 shell까지 제한하거나 OS 격리를 쓸 것 (브라우저 CLI가 shell 경유이므로 트레이드오프 명시). 프로브 산출물은 삭제済.
- Native 세션 생명주기 실측: `tests/session-lifecycle-native.mjs` 격리 검증 23/23.
- Decisions API 도입: 서버 API 직접 호출로 채택 (별도 플러그인 없음 — credential 탐색 실패로 제거). `jev-1.13-free`, cost 0 확인. T1에서 Build 선판단(위임)과 Jev(direct 0.95) 불일치 기록, 실행 결과로 판정 예정. 사용법은 `docs/development.md`에 최소 기록.
- Beads 파일럿: PR 리뷰 스크래치 저장소에 opt-in 도입, V1/V2 루프 추적·기각·미지적 기록. 이 Mac 하네스 루트 `AGENTS.md`(gitignore·로컬 전용)의 의무 사용 문구는 opt-in으로 수정 — 계획 권한은 Build/Plan 유지, Native todo 유효.
- Sleev 파일럿 (1대·단일 provider): opencode-go 라우팅 → MiMo V1 블라인드 동등 판정(시드 결함·수치·깊이 동급) → 효과 미입증으로 즉시 `disable`, 설정 바이트 일치 복원. 채택 보류, 재측정 시 동일 프로토콜 사용. (초기 '차단' 판정은 서버 경로 실측 후 해소 — 로컬 capabilities 선언만 불가하고 서버 라우팅은 정상 동작.)

## 권고 개선 (2026-11-02, 정리·Explore 변경 이후)

**현재 역할은 Build 단일 총괄의 직접 완수 기본, Plan은 Explore만 조사 위임입니다. 중간 소유자 역할은 없습니다. 공유 소스는 어떤 역할에도 모델을 고정하지 않습니다. 이 Mac의 로컬 권장값은 Build 세션 Muse Spark 1.3 Contributor, Plan Sol High, Explore OpenCode Go DeepSeek V4.1 Flash High, General DGX Spark 로컬 모델입니다.** 새 역할·필수 중간 단계·별도 실행 엔진·자동 제공자 전환·추가 과금은 넣지 않았습니다.

- **완수·이어가기:** 원래 목표·최신 교정·거부 방향·보존 조건을 간결하게 전달하고 부분 완료·차단을 구분합니다. 한도·접속·권한 실패를 코드 결함과 분리하며, 기존 자식의 저장 모델·권한이 설정 변경으로 소급 갱신되지 않는 점을 명시했습니다.
- **평가:** 직접·위임·혼합 모두 일반 과업 성공 대상입니다. 회상·행동 재개·실제 검증을 분리하고 실행 약속·실행 중 변경을 성공이나 신선한 검증으로 올리지 않습니다. timestamp 충돌·관련 동률은 미확인입니다. live probe를 실제 모델로 다시 실행한 결과는 아닙니다.
- **시각 도구:** 선택형 안내 실패 격리, 공유 초기화·개별 캡처 권한, 취소·unload와 소유 파일 정리, 24시간 idle expiry, 제한된 중간 교정 출처 전달, 명시적 Hallmark/Taste 선택 존중을 추가했습니다. 실제 화면·기기 품질을 자동 판정하지 않습니다.
- **기능 목록·설치:** 목록별 2초 deadline·취소와 정상 항목 부분 보존, 불완전 목록의 부재 단정 금지를 적용했습니다. 설치기는 소스 bytes 일회 읽기·발견 경로 밖 잠금/staging·신규 파일 no-clobber 게시를 사용합니다. 기존 관리 파일의 비협조 writer race와 파일별 게시의 중간 상태는 남으며 [복구 절차](installation.md#설치-잠금과-중단-복구)를 명시했습니다.

### 개선 후 검증

OpenCode **2.2.5**에서 아래를 확인했습니다. 테스트 수는 회귀 범위이지 제품 품질 점수가 아닙니다.

| 검사 | 결과 | 실제 확인 범위 |
| --- | --- | --- |
| 단위·설치기 회귀 | **486/486**, 자동 발견 18개 파일 | 신규 resilience·검증 러너·Design 계약 테스트 포함. 실모델/live 파일 자동 실행 없음 |
| 격리 Native 직접 실행·위임 | **243/243** | 깊이-1·5프로파일 계약, Plan 직접 자문·깊이 상한 증명·퇴역 exclusion(lead 포함)·제한된 형제 작업·Design 카탈로그/정책 포함 |
| Native 공통 지침 전달 | **통과** | Build·Lead에 공통 소스와 Native 기본 지침 전달. 이해·자율 판단의 증명은 아님 |
| 격리 기능 목록 | **30/30** | 프로젝트 경계·선택 조회·건너뛴 목록의 unknown·다른 위치 미노출 |
| 격리 시각 연결 | **40/40**, 자식 사용 켬 | 실제 Native 자식의 허용된 이미지 읽기, 중간 교정·선택 안내 실패 후 진행, 합성 PNG 저장·철회 경계 |
| 설치본 역할·권한 | **128/128** | 실제 전역 catalog와 정책, 모델 추론 없음 (Design 포함) |
| 실제 설치·보존 대조 | **통과** | 두 설치기 `--verify`, 공통 지침·플러그인 소스 일치, Explore=Go·Design=Sol catalog(General은 DGX 다운으로 일시 상속), 잠금 해제와 Native active 상태 별도 확인 |
| DGX General 실제 호출 | **통과(2회)** | 제한된 도구 왕복 **15.86초**와 설치 기본값 무도구 응답 **3.13초**. 모델·바이트·표식·권한 확인 |

독립 검토로 추가 발견한 부분 staging 오류·신규 파일 덮어쓰기, 취소된 context의 예약 누수·후속 파일 변경 삭제, 쉼표 상태 절·누락 timestamp 오판을 회귀로 재현해 수정했습니다. Ownership 검사도 보호된 `python3 -I -S verify.py`가 실제 checker subprocess 종료 코드를 기록하게 해 성공 문구만으로 통과하지 않습니다. wrapper·checker·report는 isolated·stdlib-first import로 로컬 `subprocess.py/json.py/runpy.py`와 환경 경로의 가로채기를 차단하고 정상 제품 모듈·실패 exit도 검사했습니다. 비격리 과거 호출은 성공 증거로 인정하지 않습니다. 최종 전체 회귀는 이 후속 수정까지 포함합니다.

권한·취소·경합의 단위 재현은 합성 seam 검증입니다. Native 연결 시험은 별도 HOME·서버와 loopback scripted 제공자를 사용했고 실제 DGX 추론·실기기·Native interrupt의 완전한 하위 종료·실모델 자율 품질을 입증하지 않습니다. Python import 경로 보호는 신뢰된 Python 설치를 전제로 하며 임의 악성 제품 코드를 가두는 OS sandbox가 아닙니다. 외부 스킬 원문과 기억 수집 정책은 변경하지 않았습니다.

이 Mac의 전역 설정은 DGX 제공자 등록, Plan의 Explore-only 호출 규칙 추가, Explore의 Go 경로 전환, General 로컬 override만 구조적으로 달라졌습니다. 공유 소스는 모델을 고정하지 않으며, 기존 Plan/Explore Cua deny, Build 설정, 별도 MCP JSON의 전체 bytes는 보존됐습니다. `ksi.visual-workflow`, 프로젝트 전용 `ksi.capabilities-inventory`, ai-memory·Context7의 Native active와 폐기 연결 부재를 확인했고, 공유 서비스 재시작은 하지 않았습니다. 기능 목록은 실제 현재 세션 호출에서도 새 deadline·조회 상태 metadata를 반환했습니다.

### Explore OpenCode Go 전환 (2026-11-03)

- 사용자 승인에 따라 이 Mac의 Explore만 `opencode/deepseek-v4.1-flash#high`에서 **`opencode-go/deepseek-v4.1-flash#high`**로 변경했습니다. 같은 모델·variant의 Go 경로이며, 모델 목록 단가 기준 입력 $0.30/출력 $1.20에서 $0.15/$0.60으로 낮아집니다. 공유 소스는 모델을 고정하지 않으므로 이 변경은 설치본 한정이며, Build·Lead·Plan·General의 권한은 그대로입니다.
- Go 경로에는 별도 한도가 있고 이전에 Go-limit 실패가 관측됐습니다. 실패 시 자동 fallback 없이 수동 재시도·원복합니다. 실제 청구 귀속과 체감 품질은 한 주 사용량으로 다시 확인해야 하며, 이 변경만으로 전체 비용이 크게 줄었다고 주장하지 않습니다.
- `tests/prompt-boundaries.test.mjs`, `tests/delegation-native-integration.mjs`의 소스 기대값과 `tests/agent-routing-native.mjs`의 설치 기대값을 함께 갱신했습니다. 실제 전역 `/api/agent`에서 Explore가 `opencode-go/deepseek-v4.1-flash#high`로 확인됐고, 적용 후 단위 **486/486**, 격리 위임 **371/371**, 설치 역할 **146/146**을 다시 통과했습니다.
- `node scripts/verify-harness.mjs --all`로 오프라인·Native 4종·설치본 3종·상태 표를 한 번에 재실행해 **8/8 단계** 통과를 확인했습니다. 실패 시 로그와 종료 코드를 남기며, `--live`는 기본 포함하지 않습니다.

### 소스 모델 고정 제거 (2026-11-03, 배포 portable화)

- 사용자 승인에 따라 공유 소스는 어떤 역할에도 모델을 고정하지 않습니다. `global/opencode.jsonc`의 Plan·Explore `model`과 `global/agents/lead.md`의 `model` 줄을 제거하고, 권한·모드·설명은 그대로 두었습니다. 모델 권장값은 [개발·검증 루프](development.md)와 README에만 두고, 머신별 선택은 설치본에만 둡니다.
- 이 Mac 설치본의 Lead Sol High는 `~/.config/opencode/opencode.jsonc`의 `agents.lead.model`로 옮겼습니다. 설치본 `agents/lead.md`는 소스와 바이트 단위로 일치합니다. Explore Go·General DGX·Plan Sol 고정은 설치본에만 있습니다.
- `tests/prompt-boundaries.test.mjs`와 `tests/delegation-native-integration.mjs`의 소스 기대값을 “모델 고정 없음”으로 바꾸고, 격리 fixture는 소스에 모델이 없어도 loopback 모델을 기계적으로 부여하도록 고쳤습니다. `tests/agent-routing-native.mjs`의 설치본 기대값은 로컬 선택 그대로이며, 소스·설치본 `lead.md` 일치 검사는 유지됩니다.
- 적용 후 `prompt-boundaries` **14/14**, 격리 위임 **372/372**, 설치 역할 **146/146**, 오프라인 **486/486**, 공통 지침 전달을 다시 통과했습니다. 소스 portable화 이후에도 같은 명령으로 재확인했습니다(위임 371→372는 추가된 fixture 모델 부여 검사 1건).

### Lead 제거·Build 단일 총괄 (2026-11-06)

- 사용자 승인에 따라 중간 소유자 Lead를 제거했습니다. Build가 유일한 개발 총괄이며 자식은 말단입니다. `experimental.subagent_depth` 3 → 1, Build 자식 허용에서 `lead` 제거, `global/agents/lead.md` 삭제(최종 승인 내용은 비공개 백업 `~/.local/share/ksi-harness-backups/harness-no-lead-20261106-134247/`에만 보존, tombstone 없음). Plan 자문(선택)·병렬 worktree·같은 자식 resume 관례는 `docs/development.md`에 명시했습니다.
- 설치본도 동일하게 적용했습니다(lead 미등록, catalog 확인). Plan Sol High·Explore Go DeepSeek·General DGX 고정은 설치본에만 있습니다.
- 평가기 진단도 교리에 맞췄습니다. Build를 소유 단위 검증 대상으로 포함하고, Lead 분기는 제거 전 세션의 역사적 파싱용으로만 남겼습니다.
- 검증 결과: 단위 **486/486**, 격리 위임 **230/230**, 설치 역할 **111/111**, 공통 지침 전달 **통과**. 깊이 상한 증명(C)·Plan 직접 자문(P)·Build 직접 실행(T)·같은 자식 resume 수리(D)·병렬 fan-out(L)·제한 상속(I)·퇴역 exclusion(X, lead 포함)을 모두 실제 Native 호출로 확인했습니다. 위임 fixture는 계약 변경에 맞춰 재작성했으며, red 단계에서 마커 충돌·깊이 가드 오판단·거부 문구 미비를 재현 후 수정했습니다.

### Design 역할 신설·Worktree 실검증 (2026-11-06)

- 최종 5프로파일(Build/Plan/General/Explore/Design) 체계를 완성했습니다. Design은 자문 전용(mode all, subagent·edit deny, 코드 수정·위임 금지)으로 소스는 모델을 고정하지 않고, 설치본에만 Sol High를 고정했습니다.
- 이미지 입력 검증: 합성 PNG 읽기 과제에서 Sol High·DeepSeek V4.1 Flash·Muse Spark가 `IMAGETEST_OK`로 통과했습니다. DGX Qwen은 서버 다운(`connection refused`, Tailscale 경로 자체는 살아있음)으로 미확인이며, 모델 판정이 아니라 서버 상태 문제입니다. 복구 후 재확인 예정이며, 그전까지 Design 모델을 변경하지 않습니다.
- Build → Design 실제 호출을 검증했습니다(20초, 자식 세션 1개 생성, 도구 호출 없음, 근거 없는 판단 대신 화면 부재를 정직하게 반환). 설치본 catalog에 Design이 mode all·Sol High로 등록됨을 확인했습니다.
- Worktree 실검증: Native 도구로 worktree 2개 생성·목록 확인, 각 worktree에 독립 세션을 두고 10초에 병렬 읽기 완료, 미커밋 변경이 있는 worktree의 제거 거부(삭제 없이 `has modified or untracked files`로 실패) 확인 후 정리, 최종 목록·git 상태 깨끗함을 확인했습니다. force 삭제는 실행하지 않았습니다(도구 계약상 미커밋 변경 유실).
- DGX 장애 (2026-11-06, 진행 중): Tailscale 피어는 살아있고(10ms) vLLM 포트(8000)만 양쪽 경로에서 닫혀 있어, 서버 프로세스 다운으로 판단했습니다. 이 Mac에서는 재시작 수단이 없어 설치본 General을 부모 상속으로 되돌렸습니다(원라인 복구 가능, provider 블록은 유지). 복구 후에는 제한된 Native 도구 왕복을 먼저 통과해야 DGX로 복귀합니다. DGX Qwen의 이미지 입력 지원 여부도 그때 함께 재확인합니다.
- 검증 결과: 단위 **486/486**, 격리 위임 **243/243**, 설치 역할 **128/128**, 공통 지침 전달 **통과**. 소스 계약(prompt-boundaries)·설치본 역할·fixture CONTRACT에 Design을 반영했습니다.

### agent-browser·agent-desktop 파일럿 (2026-11-06, 로컬 한정)

- 사용자 승인에 따라 이 Mac에만 `agent-browser@0.41.2`·`agent-desktop@1.2.0`을 `npm -g`로 설치했습니다(postinstall 허용 경고가 있었으나 두 바이너리 동작을 확인). 공유 소스·전역 MCP 설정은 바꾸지 않았습니다.
- 웹: 예제 페이지 open → snapshot → click → get url → close를 통과했습니다. 내장 Chrome 156이 stable보다 뒤처져 213개 CVE 수정이 밀렸다는 경고를 확인하고 `agent-browser install`로 157.0.8103.38을 받아 업데이트한 뒤 재검증도 통과했습니다.
- 네이티브: 계산기 headless 검증(`6 × 7` → `42`)을 통과했습니다. `launch`는 창 비표시·비포커스로 떴고, 스냅샷 ref 5개 클릭이 `AXPress succeeded`로 전달됐으며, 재읽기에서 표현식과 결과값을 확인한 뒤 `close-app`으로 정리했습니다.
- 근거는 macOS 공식 페이지입니다. `click`·`type`·`set-value` 등 ref 동작은 headless로 전부 되며, `--headed`가 필요한 것은 double-click·triple-click·hover·drag·마우스 직접 조작뿐입니다. 효과 판단은 AX 리턴이 아니라 재읽기로 합니다.
- **한계:** 이 Mac의 agent-desktop은 화면 기록이 denied라 `screenshot`은 미검증입니다. headed 경로·알림·드래그도 미검증이며, 개인정보 포함 출력 취급과 MCP 연결 시 Plan/Explore deny 패리티는 적용 전입니다. [사용 규칙](development.md#권장-도구-로컬)을 따릅니다.

### 로컬 General 사용 (2026-11-03, 설치본 한정)

- LAN 주소 `172.30.1.44:8000`은 같은 시점에 `curl`·`nc`·Ruby·Perl에서 연결됐고 모델 ID·컨텍스트 32,768을 확인했습니다. 반면 Node `fetch`·Python·컴파일한 C 테스트는 `EHOSTUNREACH`였습니다. **원인은 macOS Local Network Privacy였습니다.** `nehelper` 로그에 `Local network preference not yet set, prompting for node (node-5555…)`, `Showing local network alert for node`, 그리고 “node 앱이 로컬 네트워크에 있는 기기를 찾도록 허용하겠습니까?” 프롬프트가 기록됐습니다. 허용 전에는 Node의 LAN 연결이 `EHOSTUNREACH`로 거부됩니다. `launchctl`에서 실행한 Node도 같은 실패여서 OpenCode 서비스에만 국한된 문제가 아닙니다. Apple platform binary인 `curl`·`nc`·Ruby·Perl은 이 프롬프트 없이 통과했고, Tailscale CGNAT 주소 `100.64.0.0/10`은 local-network 대상이 아니어서 Node에서도 통과한 것으로 보입니다. DGX 서버 다운이나 모델 실패가 아닙니다.
- **Tailscale 주소 `100.116.163.1:8000`은 Node에서도 정상**이었습니다. 이 경로로 제한된 Native 세션을 실행해 **15.86초**에 읽기→쓰기→읽기, 결과 바이트 일치, `LOCAL_TOOL_SMOKE_OK` 표식을 확인했습니다. 네 assistant turn 모두 `dgx-spark/qwen-flash-next`였고, 셸·네트워크·위임은 허용하지 않았습니다.
- 설치본 General을 `dgx-spark/qwen-flash-next`로 전환했고 실제 `/api/agent`에서 일치하는 것을 확인했습니다. 이어서 **모델을 명시하지 않은 General 세션**이 **3.13초**에 `DGX_GENERAL_DEFAULT_OK`를 반환하고 도구를 호출하지 않았으며 assistant 모델도 DGX로 기록된 것을 확인했습니다. 소스는 여전히 상속을 기본값으로 두며, DGX 주소·모델은 이 Mac의 설치 설정에만 있습니다. 기존 General 세션의 저장 모델은 소급 변경되지 않습니다.
- **복구:** 사용자가 시스템 설정의 **개인정보 보호 및 보안 → 로컬 네트워크**에서 `node`를 허용하면 LAN 주소도 사용할 수 있습니다. 이 프롬프트는 프로세스의 코드 서명/번들 ID 단위라 Node 업데이트 뒤 다시 나타날 수 있고, Python·컴파일 바이너리도 각각 해당됩니다. 이번 진단에서는 OS 권한을 대신 클릭·변경하지 않았고, 현재 General은 Tailscale 경로를 유지합니다.
- **한계:** 이는 작은 전송·도구 왕복 시험이지 코딩 품질·긴 문맥·복구 능력 평가가 아닙니다. Tailscale이 꺼지거나 DGX가 내려가면 General 호출이 실패하며 자동 fallback은 없습니다. 필요하면 수동으로 상속 모델로 되돌립니다. 변경 전 설치 설정·smoke 영수증은 `~/.local/share/ksi-harness-backups/dgx-tailscale-20261103-014613/`에 보존했습니다.

변경 전 소스 108개·설치본 11개, 기존 미커밋 Explore 패치와 검증 증거는 `~/.local/share/ksi-harness-backups/harness-upgrade-20261102-224619/`에 보존했습니다. 기억 수집 정책·외부 스킬·MCP·기존 Cua 역할 deny는 유지합니다. 이 개선은 로컬 적용이며 commit/push하지 않았습니다.

## 2026-11-02 운영 정리

- **유지:** 직접 완수·선택형 위임, Lead/General 모델 상속, Native 기본 지침·todo·선택형 Goal, 실제 시각 검토, 기존 MCP·기억·권한 경계.
- **제거:** KSI Lead Goal 상태 전달·자동 시작 계획, 전역 Decision 보조 연결과 전용 실험 코드·시험·영구 동의 환경값, 전역 세션 증거 요약 도구와 그 설치기·전용 runtime 시험.
- **분리:** UX 비교만 `experiments/`의 명시 실행으로 보존합니다. 파일 기반 세션 감사는 `scripts/session-audit.mjs`와 `scripts/lib/session-audit-core.mjs`의 오프라인 진단으로 유지합니다.
- **보존:** 첫 정리 직전 백업은 `~/.local/share/ksi-harness-backups/cleanup-20261102-170950/`, 후속 Decision 잔여 정리 백업은 `~/.local/share/ksi-harness-backups/decision-residue-20261102-173330/`입니다. 계정·토큰·제품 저장소·기존 병행 변경은 삭제하지 않았습니다. 첫 정리에서는 재시작하지 않았고, 사용자가 잔여 환경값 제거를 요청한 후 공식 CLI로 해당 값만 제거·재기동했습니다.

### 정리 후 재검증

| 검사 | 결과 | 범위 |
| --- | --- | --- |
| 유지된 단위·설치기 회귀 | **393/393**, 명시한 16개 파일 | 삭제·실험 분리한 시험은 기본 수치에서 제외. 보존한 오프라인 감사·분리 작업·시각 권한 경계 포함 |
| 격리 Native 직접 실행·위임 | **365/365** | 별도 HOME·서버·scripted 모델. 부모 모델 상속·직접 수정·기존 권한·이어가기 |
| Native 기본/공통 지침 전달 | **통과** | Build·Lead 입력에 공통 지침과 Native 기본 system 전달 |
| 격리 시각 연결 | **32/32** | 합성 PNG·외부 증거·설정 철회·이어가기·read 거부 |
| 설치본 역할·권한 | **146/146** | 실제 전역 설치본, 모델 호출 없음, 자체 fixture·세션만 생성 |
| 명시 실행한 보존 UX 실험 | **3/3** | 기본 회귀와 별개. Decision 코드·시험은 후속 잔여 정리에서 폐기 |

기본 회귀 로그는 위 백업의 `cleanup-unit-tests.log`에 있습니다. 이전 **444/444**와 개수 경쟁을 하지 않습니다. 기능 폐기와 함께 전용 시험을 제거하거나 실험으로 옮겼으며 남은 경계를 약화하지 않았습니다.

실제 plugin catalog에서 `ksi.native-lead-goal-status`, `ksi.native-decision`, `ksi.session-evidence`의 부재를 확인했습니다. Native Goal·todo, Context7·ai-memory, KSI 기능 목록·시각 도구는 active였습니다. 현재 세션의 도구 목록에서도 `ksi_native_decision`·`session_evidence_summary`가 없고 네 시각 도구가 남았습니다. 시각 설치기의 `--verify`가 통과했습니다.

설치 config의 구조 비교는 승인한 플러그인 두 항목 삭제만 확인했고, 별도 MCP JSON은 바이트 단위로 보존됐습니다. 공통 지침·Lead 설치본은 소스와 일치합니다. 이전 ai-memory·컴퓨터 사용 문서와 네 문서의 역사 원문도 정리 전 백업과 일치합니다. 독립 읽기 전용 검토에서도 추가 중요 결함은 발견되지 않았지만 전체 자격증명 저장소 감사는 아닙니다.

**후속 잔여 정리:** 별도 유지보수 프로세스에서 공식 CLI로 `KSI_NATIVE_DECISION_CONSENT`만 제거하고 재시작·API health를 확인했습니다. 저장 설정과 새 도구 프로세스 환경 모두에서 부재를 확인했고, 다른 서비스 설정은 구조적으로 동일하며 모델·MCP·공통 지침 파일은 바이트 단위로 보존됐습니다. 전용 실험 디렉터리도 제거했습니다. 로컬 설정의 Jev/Decision 모델 override는 없었습니다. OpenCode 제공 목록의 원격 Jev 항목은 로컬 잔여가 아니므로 삭제하지 않았습니다. 백업·역사 기록은 보존했고, 이 정리 단계에서는 commit/push·운영 제품 변경을 하지 않았습니다.

## 외부 스킬 범위 조정 후 검증 (2026-11-02)

- 현재 소스의 단위·설치기 회귀 **393/393**, 16개 명시 파일 통과. 기능 목록 설치기는 명시한 절대 프로젝트 경로만 받고 전역 HOME/XDG를 설치 대상으로 쓰지 않습니다. 미관리·수정본·symlink 거부와 로컬 설치본의 공개 제외도 검사했습니다.
- 프로젝트 전용으로 바꾼 Native 기능 목록 시험 **28/28** 통과. 별도 HOME·서버·로컬 scripted 모델에서 프로젝트의 플러그인·스킬은 동작하고, 무관한 두 번째 위치의 catalog와 실제 모델 입력에는 노출되지 않는 것을 확인했습니다. 실모델의 스킬 선택 품질을 검증한 것은 아닙니다.
- 실제 공유 서버에서도 이 하네스에는 `find-skills`와 기능 목록 플러그인이 있고, 별도 임시 위치에는 둘 다 없었습니다. 세 신규 스킬·Impeccable이 임시 위치에도 등록된 것을 양성 대조로 확인했으며 영상 6종은 두 위치 모두에서 없었습니다. 전역/프로젝트 구분은 단순 빈 catalog만 보고 판정하지 않았습니다. 프로젝트 도구의 실제 호출도 완료됐습니다.
- 신규 스킬 **242개 파일**은 고정한 원본 커밋과 일치합니다. Cloudflare의 보고서·coverage 검증기 합성 시험 **65/65** 통과. 실제 제품의 보안 감사나 대상 코드 실행은 하지 않았습니다.
- Hallmark는 기존 Chrome·임시 프로필로 렌더 검사를 실행해 합성 화면 **5장**, Taste는 **3개 너비·3장**을 생성했습니다. fixture는 스타일 합격을 목적으로 하지 않아 lint 지적이 남는 정상 음성 사례입니다. 렌더 실행 확인이지 디자인 품질 합격이 아닙니다. 외부 사진·이미지 생성·유료 API·자동 훅은 실행하지 않았습니다.
- 기존 OpenCode 설정 JSON/JSONC와 프로젝트 설정은 바이트 단위로 보존했고 다른 기존 스킬 lock 항목도 보존했습니다. `opencode_console`을 포함한 기존 MCP 연결은 유지됐으며 공통 지침 설치본은 소스와 일치합니다. 공유 서비스 재시작·계정/모델/권한 변경은 하지 않았습니다.
- 배포 전 시각 연결 재검사에서는 HOME 하위 시험 폴더가 상위의 실제 `.agents/skills/impeccable`을 발견해 합성 스킬 전달 검사가 실패했습니다. Native의 상위 경로 탐색을 고려해 시험 폴더를 HOME 밖 임시 경로로 옮겼고 같은 검사가 **32/32** 통과했습니다. 실제 사용자 스킬을 삭제하거나 전달 검사를 완화하지 않았습니다. 이 수정은 시험 격리이며 제품의 디자인 품질·실행 격리를 증명하지 않습니다.

이 단계의 백업·원본 커밋·설치 로그·검증 영수증은 `~/.local/share/ksi-harness-backups/skill-scope-20261102-183546/`에 있습니다. Claude-Mem의 비교 우위는 측정되지 않아 ai-memory를 교체하지 않았고 Context Mode는 설치하지 않았습니다. [설치 범위](installation.md#이-mac의-스킬-범위-조정-2026-11-02)와 [기억 비교](ai-memory.md#claude-memnative-컨텍스트와의-비교-2026-11-02)를 함께 확인하세요.

## Explore 유료 모델 변경 (2026-11-02)

- 사용자 요청으로 Explore만 `openai/gpt-6-luna#low`에서 **`opencode/deepseek-v4.1-flash#high`**로 변경했습니다. Free·Go가 아닌 유료 Console 경로이며, 추론 수준은 탐색 품질·비용을 관측할 시작점으로 High를 선택했습니다. Build·Lead·General의 모델 상속과 Plan의 Sol High, 기존 권한·MCP·제공자 설정은 유지합니다.
- 계정의 유료 모델 활성화와 `high` variant 제공을 확인했습니다. 전역 설치본은 해당 모델 문자열 하나만 바뀌었으며 실제 Native `/api/agent`에서도 Explore의 제공자·모델·variant가 일치합니다. 기존 자식 세션의 저장 모델을 강제로 변경하거나 공유 서비스를 재시작하지 않았습니다.
- 소스·README·모델 검증 기준을 동기화하고 단위·설치기 회귀 **393/393**, 별도 서버·scripted 모델의 Native 실행·위임 **365/365**를 확인했습니다. DeepSeek 실요청 성공·속도·탐색 품질·사용량은 아직 측정하지 않았습니다. 이 변경은 로컬 적용이며 새 commit/push는 하지 않았습니다.
- 변경 전 설치본·설정 보존 대조·검증 영수증은 `~/.local/share/ksi-harness-backups/explore-deepseek-20261102-220638/`에 비공개로 보관합니다.

## 소스 배포 범위

공개 GitHub `main`에 공유하는 대상은 하네스 소스·설치기·문서·합성 시험입니다. 로컬 `.ai-memory.toml`, `.opencode` 설정, 루트 운영 메모, 실제 증거 이미지·기억 데이터·자격증명·백업·모델 가중치는 포함하지 않습니다. clone이 다른 컴퓨터의 설정이나 자동 수집을 변경하지 않으며 별도 릴리스 태그·계정·운영 서비스 배포와도 구분합니다.

배포 전에는 미푸시 커밋과 최종 포함 파일을 검토하고 staged 복사본에서 시험합니다. 비밀 패턴 검사는 보조이며 완전한 유출 방지나 전체 Git 이력 감사가 아닙니다. 설치·활성·제품 수용의 구분은 그대로 유지합니다.

## 명시적 검증 경로

```sh
# 기본: tests/*.test.mjs 오프라인 회귀 + 시각 외부 증거 단위 검사
node scripts/verify-harness.mjs
# 격리 Native 실행·위임·시각·기능 목록
node scripts/verify-harness.mjs --native
# 실제 설치본 역할·catalog·관리 파일 해시
node scripts/verify-harness.mjs --installed
# 위 세 가지 + 소스/설치본 모델 상태 표
node scripts/verify-harness.mjs --all
```

`--live`는 실제 모델 호출·과금이므로 명시할 때만 실행합니다. 기본 Node 회귀는 `.test.mjs`를 자동 발견하며 `-live.mjs`·`-native.mjs`는 포함하지 않습니다. 전체 로그는 `~/.local/share/ksi-harness-verification/`에 남습니다. [개발·검증 루프](development.md)에 모드별 범위와 남은 제약을 정리했습니다.

## 증거의 한계

scripted 모델·합성 PNG·단위 시험은 도구 전달과 권한·복구의 증거입니다. 실모델의 자율적 완주·장기 맥락 유지·디자인 품질·Codex 대비 우위는 입증하지 않습니다. 실제 과업의 재촉·재설명·재작업·시간·비용으로 [별도 평가](harness-evaluation.md)해야 합니다.

외부 이미지 허용은 기본 비활성입니다. PNG 구조·해시와 단일 소스 해시는 실제 빌드·촬영 시각·제품 인수의 증거가 아닙니다. 설정·권한 철회는 원자적이지 않고 이미 전달한 이미지는 회수할 수 없습니다. worktree 역시 런타임 격리가 아닙니다.

과거 모델 trial에서 테스트·렌더 확인 후에도 실제 화면 가림 결함이 남았던 사례를 교훈으로 유지합니다. 테스트·도구 완료·스크린샷 수를 제품 수용으로 바꾸지 않습니다.

[정리 전 상세 기록](archive/2026-11-02/README.md) · [이전 문서 이력](archive/2026-10-26/README.md)
