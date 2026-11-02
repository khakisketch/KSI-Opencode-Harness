# 설치·정리 안내

`global/`은 소스이고 `~/.config/opencode/`는 이 Mac의 설치 위치입니다. clone/pull만으로 전역은 바뀌지 않습니다. 설정 파일·설치 파일·실행 중 등록을 따로 확인합니다.

## 현재 적용 대상

| 소스 | 적용 위치·방식 |
| --- | --- |
| `global/AGENTS.md` | 전역 공통 지침. 기존 사용자 정의를 확인한 뒤 필요한 변경만 반영 |
| `global/opencode.jsonc` | 전역 설정에 수동 병합. 모델·MCP·제공자·권한 전체 교체 금지 |
| `global/agents/lead.md` | 선택형 Lead 정의. 빈 본문으로 Native 기본 실행 지침 보존 |
| `global/commands/` | 선택형 `/debug`·`/perf`·`/ux-audit` 바로가기 |
| `global/plugins/ksi-visual-workflow/` | 시각 도구 전용 설치기 사용 |
| `global/plugins/ksi-capabilities-inventory/` | 필요한 경우에만 기능 목록 도구 설치 |

Build는 직접 완수하며 Lead·General은 부모 모델을 상속합니다. Plan·Explore의 설정, 기존 세션의 저장 모델과 프로젝트별 override는 별도입니다. Native todo는 선택형 상태이고 `/goal`이나 필수 문서 세트를 요구하지 않습니다.

## 안전한 적용 순서

1. 기존 설정과 관리 대상 설치본을 소유자 전용 위치에 백업합니다. symlink·미관리 파일·병행 변경을 조사하고, 자격증명 원문은 출력하지 않습니다.
2. 공통 지침·역할 정의는 확정된 관리 파일에만 반영합니다. `opencode.json(c)`는 통째로 덮어쓰지 않고 승인한 항목만 병합합니다. MCP·제공자·권한·사용자 설정은 보존합니다.
3. 필요한 어댑터만 설치하고 파일 일치를 확인합니다.

   ```sh
   node scripts/install-visual-workflow.mjs
   node scripts/install-visual-workflow.mjs --verify
   # 선택형 진단
   node scripts/install-capabilities-inventory.mjs
   node scripts/install-capabilities-inventory.mjs --verify
   ```

4. Native plugin/agent catalog에서 로딩과 모델·권한을 별도 확인합니다. 파일 일치나 도구 등록만으로 호출 성공을 주장하지 않습니다. OpenCode는 설정을 감시하므로 공유 서비스를 재시작하지 않습니다.
5. [검증](validation.md)의 명시적 시험만 실행합니다. 로컬 실모델 probe를 와일드카드로 실행하지 않습니다.

설치기는 수정·미관리 파일, manifest와 다른 상태, 예상 밖 진입점과 symlink를 안전 중단합니다. 파일별 갱신이므로 중단 시 백업과 해시부터 확인하고 반복 덮어쓰지 않습니다.

외부 PNG는 [고정 운영자 설정](visual-workflow.md#선택적-외부-증거-설정)과 현재 Native 권한 모두가 필요합니다. 기본값은 비활성이며 이미지 복사·링크나 광범위한 임시 디렉터리 허용으로 우회하지 않습니다.

## 이전 설치 정리

- `plugins` 배열의 KSI Lead Goal·Decision 참조만 제거합니다. Native Goal·Decision API, 계정·제공자·다른 플러그인은 제거하지 않습니다.
- 관리된 `ksi-session-evidence` 설치본은 manifest·현재 해시를 대조한 뒤 자동 발견 경로 **밖의 비공개 백업으로 이동**합니다. 미관리·수정된 파일이면 멈추고 조사합니다.
- Lead Goal 자동 시작은 더 이상 개발 예정 항목이 아니며 상태 전달 코드도 유지하지 않습니다.
- `experiments/`에는 UX 비교만 보존합니다. Decision 실험 코드와 전용 시험도 후속 로컬 잔여 정리에서 제거했습니다. 실험 디렉터리 전체를 플러그인 경로로 지정하지 않습니다.
- 예전 `KSI_NATIVE_DECISION_CONSENT`는 공식 `service unset env`로 제거한 뒤 서버를 다시 시작했습니다. 저장 설정과 새 프로세스 환경 모두에서 부재를 확인했습니다. 이 명령은 서버를 중지하므로 서버 자체 셸에 종속되지 않는 별도 유지보수 프로세스에서 수행해야 합니다. 다른 서비스 환경값은 보존합니다.
- Jev는 OpenCode의 내장 원격 Decision 모델 목록이며 별도 로컬 등록·다운로드 모델이 아닙니다. 내장 목록을 없애려고 공유 제공자·계정이나 OpenCode 자체를 수정하지 않습니다.

## 외부 스킬·기억·컴퓨터 사용

공식 스킬은 별도 설치입니다. 공식 설치기가 관리하는 제공자별 사본·링크·lock·라이선스·hook을 단순 중복으로 보고 삭제하지 않습니다. 프로젝트별 스킬과 다른 도구의 설정은 보존합니다. `skills 1.7.4`의 `check`가 설치본에서 update 경로로 연결된 사례가 있으므로 읽기 전용 조사에서 업데이트 명령을 대신 실행하지 않습니다.

Context7 공식 플러그인과 명시적 MCP 설정은 이 정리에서 유지합니다. 공식 플러그인은 기존 MCP를 중복 등록하지 않고 문서 스킬도 제공하므로 성급하게 하나를 삭제하지 않습니다. Mobbin 등 선택 서비스의 인증·유료 구독은 사용자별입니다.

- [ai-memory의 현재 연결·범위·복구](ai-memory.md): 이 Mac의 기존 승인된 전역 자동 기록 정책은 그대로 유지합니다. 하네스 clone·기본 설정 적용이 자동 수집을 새로 켜지는 않습니다. `scripts/install-ai-memory.mjs`의 과거 systemd 설치 경로를 Mac 복구 명령으로 실행하지 않습니다.
- [Cua Driver](computer-use.md): OS 권한과 실제 기기·앱 검증은 별도입니다.
- [분리 작업](isolated-work.md): worktree는 DB·포트·브라우저·OS를 격리하지 않습니다.

## 복구

현재 상태를 새 비공개 백업으로 보존하고, 이전 백업과 비교해 필요한 항목만 복원합니다. 이후 사용자 변경·자격증명·다른 플러그인을 일괄 덮어쓰지 않습니다. 제거한 실험 연결을 백업과 함께 자동 재활성화하지 않습니다.

[현재 검증](validation.md) · [정리 전 설치 기록](archive/2026-11-02/installation-history.md) · [공식 V2 설정](https://opencode.ai/v2/docs/config)
