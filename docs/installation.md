# 설치·정리 안내

`global/`은 소스이고 `~/.config/opencode/`는 이 Mac의 설치 위치입니다. clone/pull만으로 전역은 바뀌지 않습니다. 설정 파일·설치 파일·실행 중 등록을 따로 확인합니다.

## 현재 적용 대상

| 소스 | 적용 위치·방식 |
| --- | --- |
| `global/AGENTS.md` | 전역 공통 지침. 기존 사용자 정의를 확인한 뒤 필요한 변경만 반영 |
| `global/opencode.jsonc` | 전역 설정에 수동 병합. 모델·MCP·제공자·권한 전체 교체 금지 |
| `global/agents/` | 현재 운영 역할 파일 없음. 4프로파일(Build/Plan/General/Explore)은 `global/opencode.jsonc`에 정의 |
| `global/commands/` | 선택형 `/debug`·`/perf`·`/ux-audit` 바로가기 |
| ~~`global/plugins/ksi-visual-workflow/`~~ | 2026-11-06 퇴역. 시각 실행은 agent-browser, 회귀·E2E는 Playwright. 소스·테스트는 백업 보관 |
| `global/plugins/ksi-capabilities-inventory/` | 소스 경로 이름과 달리 **프로젝트 전용** 진단. 이 하네스의 `.opencode/plugins/`에만 설치 |

Build는 유일한 개발 총괄로 직접 완수를 기본으로 하며, 공유 소스는 어떤 역할에도 모델을 고정하지 않습니다. Plan은 분석 역할로 Explore만 호출합니다(독립 Root 실행 시; Build 자식 실행 시 깊이 1 가드가 재위임을 거부 — 의도된 동작). Native 편집 제한은 유지합니다. UI 판단은 Build가 맡고, 결정론적 검사기를 근거로 쓰며, 필요하면 독립 읽기 전용 검토를 한 번 요청합니다. 자식은 말단이라 추가 위임하지 않습니다. 이것만으로 셸·네트워크까지 엄격한 비변경이 되는 것은 아닙니다. 기존 세션의 저장 모델·권한과 프로젝트별 override는 별도이며 새 설정을 소급 적용하지 않습니다. Native todo는 선택형 상태이고 `/goal`이나 필수 문서 세트를 요구하지 않습니다.

이 Mac의 로컬 권장값은 Build 세션 Muse Spark 1.3 Contributor, Plan Go Muse Spark 1.3 Contributor xhigh, Explore Go DeepSeek V4.1 Flash High, General DGX Spark `dgx-spark/qwen-flash-next`입니다. 머신별 주소·제공자·모델 설정은 휴대용 소스 기본값에 넣지 않습니다. 기존 General 세션의 저장 모델은 소급 변경되지 않습니다.

이 Mac의 DGX Spark 제공자는 로컬 설정에만 등록했습니다. LAN 주소 `172.30.1.44`는 `curl`·`nc`에서는 연결됐지만 Node/Python/C에서는 `EHOSTUNREACH`였고, **Tailscale 주소 `100.116.163.1`은 Node에서도 정상**이었습니다. 원인은 **macOS Local Network Privacy가 `node`의 로컬 네트워크 접근을 아직 허용하지 않은 것**입니다. `nehelper` 로그에 `Local network preference not yet set, prompting for node`, `Showing local network alert for node`가 기록됐고, `launchctl`에서 실행한 Node도 같은 실패였습니다. 시스템 설정의 **개인정보 보호 및 보안 → 로컬 네트워크**에서 `node`를 허용하면 LAN 주소도 사용할 수 있습니다. 이 프롬프트는 프로세스 서명/번들 ID 단위라 Node 업데이트 뒤 다시 나타날 수 있습니다. 이번에는 OS 권한을 대신 변경하지 않았고, Tailscale 경로로 제한된 Native 도구 왕복(읽기→쓰기→읽기, 바이트 일치, 최종 표식)을 통과해 기존 General을 `dgx-spark/qwen-flash-next`로 전환했습니다. 이는 전송·도구 왕복 확인이지 코딩 품질·긴 문맥 평가가 아닙니다. Tailscale이 꺼지면 General 호출이 실패하므로, 수동으로 상속으로 되돌리거나 제공자 경로를 다시 확인합니다. 자동 fallback은 없습니다.

## 안전한 적용 순서

1. 기존 설정과 관리 대상 설치본을 소유자 전용 위치에 백업합니다. symlink·미관리 파일·병행 변경을 조사하고, 자격증명 원문은 출력하지 않습니다.
2. 공통 지침·역할 정의는 확정된 관리 파일에만 반영합니다. `opencode.json(c)`는 통째로 덮어쓰지 않고 승인한 항목만 병합합니다. MCP·제공자·권한·사용자 설정은 보존합니다.
3. 필요한 어댑터만 설치하고 파일 일치를 확인합니다.

   ```sh
   # 이 하네스 프로젝트에서만 쓰는 선택형 진단; 전역 대상은 지원하지 않음
   node scripts/install-capabilities-inventory.mjs --project "$PWD"
   node scripts/install-capabilities-inventory.mjs --project "$PWD" --verify
   ```

4. Native plugin/agent catalog에서 로딩과 모델·권한을 별도 확인합니다. 파일 일치나 도구 등록만으로 호출 성공을 주장하지 않습니다. OpenCode는 설정을 감시하므로 공유 서비스를 재시작하지 않습니다.
5. [검증](validation.md)의 명시적 시험만 실행합니다. 로컬 실모델 probe를 와일드카드로 실행하지 않습니다.

설치기는 수정·미관리 파일, manifest와 다른 상태, 예상 밖 진입점과 symlink를 안전 중단합니다. 소스를 한 번 읽어 해시·배포 bytes를 일치시키며 발견 경로 밖에서 전체 staging 후 의존 파일→entrypoint→manifest 순서로 게시합니다. 신규 파일·manifest는 hard link의 atomic no-clobber를 쓰고 지원되지 않으면 중단합니다. 기존 관리 파일은 최종 비교 후 rename하므로 비협조 writer와의 compare→rename race는 남습니다. 협조 잠금이 임의 외부 편집까지 막지는 않습니다. 파일별 게시이지 세대 트랜잭션이 아니며 Native hot reload에서 중간 버전을 볼 수 있습니다.

위 상세 잠금·manifest 규칙은 capabilities-inventory 설치기에만 적용됩니다. 부모 디렉터리의 검사와 생성 사이에는 비협조 프로세스의 경합이 남습니다.

외부 PNG 고정 운영자 설정은 플러그인 퇴역과 함께 폐지했습니다. 증거 기록은 [증거팩](evidence-pack.md)을 따릅니다.

### 설치 잠금과 중단 복구

- 목록: `<project>/.opencode/.ksi-capabilities-inventory-install.lock`.

동일 설치기의 동시 실행과 `--verify`는 잠금이 있으면 중단합니다. 게시 전 실패는 자신이 만든 staging만 정리하고 원래 오류를 보존합니다. 게시 시작 후 실패·프로세스 종료는 잠금과 staging을 조사 증거로 남기며 자동 탈취·롤백·재시도하지 않습니다.

잠금이 오래됐다는 이유만으로 지우지 않습니다. 먼저 실행 중 설치기가 없는지 확인하고 대상·manifest·잠금·백업을 발견 경로 밖의 비공개 위치에 보존합니다. 파일별 해시와 이후 사용자 변경을 대조해 혼합 상태인지 확인한 뒤 승인된 관리 파일만 복구합니다. 조사 완료 후 정확한 잠금 폴더만 발견 경로 밖으로 옮기고 설치·`--verify`·Native catalog를 다시 확인합니다. 살아 있는 설치기의 잠금이나 다른 플러그인 디렉터리를 통째로 지우지 않습니다.

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

### 이 Mac의 스킬 범위 조정 (2026-11-02)

- 영상·연출 6종(`continuity-editing-axis-match`, `director-visual-language`, `reference-driven-video-prompting`, `scene-blocking-and-staging`, `storyboard-shot-design`, `world-asset-identity-lock`)은 전역 발견 경로 밖으로 이동했습니다. 대상 영상 프로젝트가 지정되지 않아 임의의 제품 저장소에는 설치하지 않았습니다. 필요 프로젝트의 `.opencode/skills/`에만 원본·리소스를 함께 배치합니다.
- `find-skills`는 이 하네스의 `.agents/skills/find-skills/`에만 보존합니다. 전역 사본과 전역 lock 항목은 제거했습니다. Vercel Skills CLI 자체의 제거와는 다릅니다.
- `ksi.capabilities-inventory`는 이 하네스의 `.opencode/plugins/ksi-capabilities-inventory/`에서만 동작합니다. 전역 관리본은 발견 경로 밖으로 이동했고, 설치기는 명시한 절대 프로젝트 경로만 받습니다. 다른 프로젝트에는 설치하지 않습니다.
- `opencode_console` MCP, Context7·Cua Driver·Mobbin, Impeccable 및 기존 계정·모델·권한은 유지합니다. Context Mode·Ghidra·추가 플러그인 marketplace는 설치하지 않았습니다. Ghidra는 필요 프로젝트에서 별도 검토합니다.
- 원본과 이전 설정은 `~/.local/share/ksi-harness-backups/skill-scope-20261102-183546/`에 보존했으나, 2026-11-08 정리로 삭제했습니다. 영상 스킬 보관 위치는 그 아래 `disabled-global-skills/`였으며 자동 발견 경로가 아니었습니다. 필요한 스킬은 업스트림에서 프로젝트별로 재설치합니다.

### 이 Mac의 스킬 범위 조정 (2026-11-06)

- `hallmark`·`design-taste-frontend`를 전역 발견 경로(`~/.agents/skills/`) 밖으로 이동했습니다. 대시보드 중심 제품에 Taste의 기업 홈페이지 방법론을 기본 적용하지 않기 위함이며, 두 스킬의 전역 lock 항목도 함께 제거했습니다. 원본과 lock 변경 전 상태는 `~/.local/share/ksi-harness-backups/harness-final-20261106-152008/disabled-global-skills/`에 보존했으나, 2026-11-08 정리로 삭제했습니다.
- 필요한 프로젝트에는 해당 저장소의 `.agents/skills/` 또는 `.opencode/skills/`에 Skills CLI로 개별 설치합니다. 예: 마케팅 웹 프로젝트의 Taste, 필요시 해당 프로젝트의 Hallmark. 전역 재설치는 하지 않습니다.
- `puppeteer-core` 전역 패키지는 Hallmark의 렌더 검사 경로가 참조하므로 유지합니다. Hallmark를 쓰는 프로젝트가 없으면 제거를 재검토합니다.

### Anthropic Engineering·Design 스킬 라이브러리 (2026-11-08)

[anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins)의 Engineering 10종·Design 7종을 **플러그인 실행이 아니라 고정 커밋 스킬 라이브러리**로 보관합니다.

- 위치: `external/anthropic-knowledge-work-plugins/` (Apache-2.0, 커밋 `e050c2ec856373787143d7057663a6ebd1277df3`)
- 보관 범위: `SKILL.md`만. `.claude-plugin`, `.mcp.json`, `CONNECTORS.md`는 Claude Code 패키징이라 제외했습니다.
- 전역 설치하지 않습니다. 필요한 프로젝트에만 설치합니다.

```sh
node scripts/install-external-skills.mjs --list
node scripts/install-external-skills.mjs --project /abs/path/to/project --set design
node scripts/install-external-skills.mjs --project /abs/path/to/project --set all --verify
```

- `--set engineering|design|all`, `--skill <name>`으로 고릅니다.
- 기존 파일이 다르면 덮어쓰지 않고 실패합니다. 상대 경로·심볼릭 링크 대상도 거부합니다.
- 격리 OpenCode 2.2.6에서 프로젝트 설치 후 `design-critique` 활성화(HTTP 204 + skill 메시지)를 확인했습니다. 이는 발견·로딩 증거이며 제품 품질 개선의 증거가 아닙니다.

상황별 선택: 운영 장애는 `incident-response`, 실제 배포는 `deploy-checklist`, 복잡한 데이터 파이프라인 검증은 `testing-strategy`, 화면 비평·접근성·문구·인계는 해당 Design 스킬을 필요할 때만 씁니다.

### 추가한 선택형 스킬

공식 Skills CLI `1.7.4`에서 스킬·에이전트·전역 범위를 명시하고 아래 커밋으로 설치했습니다. 이 버전의 CLI는 OpenCode를 universal agent로 취급해 `~/.agents/skills/`에 설치하므로 **다른 호환 에이전트도 발견할 수 있습니다**. 다른 에이전트의 설정·훅은 변경하지 않았습니다. 설치 파일은 아래 원본과 해시로 대조했으며 본문은 수정하지 않았습니다. CLI telemetry/security-audit 전송은 이번 호출에서 비활성화했습니다.

| ID | 원본 | 고정 커밋 |
| --- | --- | --- |
| `security-audit` | [cloudflare/security-audit-skill](https://github.com/cloudflare/security-audit-skill) | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` |
| `hallmark` | [Nutlope/hallmark](https://github.com/Nutlope/hallmark) | `4f6a46c6dc325d40ab268c93e25c7b96676ebccd` |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `12af471f627f866411b4bd785b19646d3672784c` |

Impeccable은 누적 필수 절차가 아니라 담당자가 과업에 맞게 고르는 대안입니다. 사용자가 정한 브랜드·기능·권한이 우선이며, Impeccable을 무조건 호출하지 않습니다. 새 디자인용 자동 훅·별도 보안 에이전트는 추가하지 않았습니다. Hallmark의 렌더 검사 의존성으로 `puppeteer-core@25.16.0`만 전역 설치했고 npm lifecycle script와 브라우저 다운로드는 실행하지 않았습니다. 기존 Chrome과 별도의 임시 프로필을 사용합니다. `hallmark`·`design-taste-frontend`는 2026-11-06에 전역에서 제외되어 위 표의 해당 행은 당시 설치 기록입니다. 필요한 프로젝트에만 개별 설치합니다.

Impeccable은 같은 버전이 두 경로에 **호스트별 변형**으로 설치되어 있습니다. `~/.agents/skills/impeccable`은 범용·타 에이전트용(`$impeccable`, `agents/` 포함), `~/.config/opencode/skills/impeccable`은 OpenCode용(`/impeccable`, `.opencode` 경로, allowed-tools)입니다. 활성화 텍스트로 OpenCode가 후자를 로드하는 것을 확인했습니다. 두 복사본은 함께 갱신해야 합니다.

Cloudflare는 일상 보안 질문의 guidance와 명시적 전체 감사를 구분합니다. 전체 감사는 하위 에이전트·보고서 비용이 있고 대상 코드를 실행하려면 네트워크·환경·쓰기·자원을 제한한 **OS 수준 격리**가 필요합니다. worktree나 이 스킬 설치는 그 격리를 제공하지 않습니다. 격리가 없으면 실행 검증을 보류하고 미확인 사실을 남깁니다.

스킬·프로젝트 로컬 설치본·lock·백업은 공개 하네스 소스에 묶지 않습니다. 다른 컴퓨터에는 이 표와 공식 설치 방법을 검토해 필요한 항목만 별도로 설치합니다. 자동 업데이트는 하지 않았으며, 이후 업데이트 때에는 고정 ref·설치 범위·의존성과 지침 변화를 다시 확인합니다.

- [ai-memory 퇴역 기록](ai-memory.md): 2026-11-07에 자동 기록·후크·서버를 중지하고 DB를 백업 후 제거했습니다. 전역 자동 수집 정책은 폐지되며, clone·기본 설정 적용으로 수집이 다시 켜지지 않습니다.
- [Cua Driver](computer-use.md): OS 권한과 실제 기기·앱 검증은 별도입니다.
- [분리 작업](isolated-work.md): worktree는 DB·포트·브라우저·OS를 격리하지 않습니다.

## 복구

현재 상태를 새 비공개 백업으로 보존하고, 이전 백업과 비교해 필요한 항목만 복원합니다. 이후 사용자 변경·자격증명·다른 플러그인을 일괄 덮어쓰지 않습니다. 제거한 실험 연결을 백업과 함께 자동 재활성화하지 않습니다.

[현재 검증](validation.md) · [정리 전 설치 기록](archive/2026-11-02/installation-history.md) · [공식 V2 설정](https://opencode.ai/v2/docs/config)
