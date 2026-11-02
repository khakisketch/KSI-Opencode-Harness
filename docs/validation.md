# 현재 검증과 한계

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

## 소스 배포 범위

공개 GitHub `main`에 공유하는 대상은 하네스 소스·설치기·문서·합성 시험입니다. 로컬 `.ai-memory.toml`, `.opencode` 설정, 루트 운영 메모, 실제 증거 이미지·기억 데이터·자격증명·백업·모델 가중치는 포함하지 않습니다. clone이 다른 컴퓨터의 설정이나 자동 수집을 변경하지 않으며 별도 릴리스 태그·계정·운영 서비스 배포와도 구분합니다.

배포 전에는 미푸시 커밋과 최종 포함 파일을 검토하고 staged 복사본에서 시험합니다. 비밀 패턴 검사는 보조이며 완전한 유출 방지나 전체 Git 이력 감사가 아닙니다. 설치·활성·제품 수용의 구분은 그대로 유지합니다.

## 명시적 검증 경로

```sh
# 설치본 역할·권한: 모델 호출 없음, 자체 임시 세션/fixture 생성
node tests/agent-routing-native.mjs
# 별도 HOME·서버·로컬 scripted 모델
node tests/delegation-native-integration.mjs
node tests/native-guidance-integration.mjs
node tests/visual-workflow-native.mjs
# 파일 해시 일치: active 여부와 별도
node scripts/install-visual-workflow.mjs --verify
```

기본 Node 회귀는 유지된 `tests/*.test.mjs`를 명시적으로 열거해 실행합니다. 실모델/live probe·실험 시험은 자동 포함하지 않습니다. 기능 제거로 폐기한 시험을 통과 수에 포함하지 않으며, 남은 권한·검증 경계를 약화하지 않습니다.

## 증거의 한계

scripted 모델·합성 PNG·단위 시험은 도구 전달과 권한·복구의 증거입니다. 실모델의 자율적 완주·장기 맥락 유지·디자인 품질·Codex 대비 우위는 입증하지 않습니다. 실제 과업의 재촉·재설명·재작업·시간·비용으로 [별도 평가](harness-evaluation.md)해야 합니다.

외부 이미지 허용은 기본 비활성입니다. PNG 구조·해시와 단일 소스 해시는 실제 빌드·촬영 시각·제품 인수의 증거가 아닙니다. 설정·권한 철회는 원자적이지 않고 이미 전달한 이미지는 회수할 수 없습니다. worktree 역시 런타임 격리가 아닙니다.

과거 모델 trial에서 테스트·렌더 확인 후에도 실제 화면 가림 결함이 남았던 사례를 교훈으로 유지합니다. 테스트·도구 완료·스크린샷 수를 제품 수용으로 바꾸지 않습니다.

[정리 전 상세 기록](archive/2026-11-02/README.md) · [이전 문서 이력](archive/2026-10-26/README.md)
