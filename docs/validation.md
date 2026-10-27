# 검증과 한계

> **현재 (2026-10-27):** 전역 5개 역할·공통 지침과 시각 작업 어댑터 적용 완료. 설치본 **146/146**·격리 Native **362/362**, 시각 도구 Native 연결 **16/16** 통과. ai-memory **v3.2.8**, Intent 3종 **v1.7.3**. 새 native 렌더와 동일 모델의 디자인 품질 개선은 아직 미입증입니다.

이 문서는 **현재 검증의 범위와 한계**만 요약합니다. 2026-10-26 이전의 상세 역할·모델·스킬·배포 이력은 [문서 이력](archive/2026-10-26/README.md)에 보존했습니다.

## 지금 확인한 것

| 검사 | 결과 | 의미 |
| --- | --- | --- |
| 단위·소스·설치기 회귀 | **220/220** | 기존 159개 + 시각 어댑터 46개 + 설치기 11개 + 위임·완료 관측 분류 4개 |
| 전역 설치본 검사 | **146/146** | 5개 역할 등록, 모델·모드·권한, Lead 본문, retired 역할 제외 |
| 격리 Native 통합 | **362/362** | 깊이 3 위임, 복구, 병렬, 세션 제한 상속, 지침 전달 |
| 시각 도구 격리 Native | **16/16** | 합성 스킬의 Native attachment·실제 파일 편집·PNG 입력 전달·read 거부. 로컬 scripted 모델이며 디자인 평가는 아님 |
| 시각 어댑터 전역 적용 | **active / 파일 일치** | 기존 전역 파일 72개 해시 보존, ai-memory 공존, 공유 서비스 PID 유지 |
| 시각 도구 실모델 probe | **연결 확인 / 시간 제한 중단** | DeepSeek Flash Max, 공식 Impeccable 자동 attachment·자료 패킷·실제 과거 PNG import 확인. 최종 검토 완주는 아님 |
| Sol Build trial | **211 suites / 2,140 tests** | 실제 Site viewer-first 과업 1건, 4개 폭 28개 렌더 장면, 조작·axe 확인 |
| ai-memory 전역 연동 | **v3.2.8 / 49375** | 업그레이드 후 서비스 버전·건강·MCP 확인. 기존 수집·핸드오프 검증과 Claude OAuth 한계는 아래 참고 |
| 스킬 정리 | **제거 당시 등록 18개** | 프로젝트 사본 6개·취향 스킬 1종 및 로컬 각색본 2종 제거, Impeccable 공식 제공자별 사본 유지. 내장 Browser 등 런타임 기능의 발견 여부에 따라 총수는 달라짐 |
| 작업 연속성 실모델 시험 | **3/3** | DeepSeek Flash Max의 명시적 다단계 완료·부분 차단·권한 경계, 각 1회 요청 |
| 위임 소유권 실모델 시험 | **부분 확인 / 완주 아님** | 일반 요청에서 Build→Lead→General, Lead 본체 구현·기능검사 확인. 부모 최종 응답은 300초 제한 중단 |

```sh
# 단위·소스 계약 회귀
node --test tests/completion-guidance.test.mjs tests/capabilities.test.mjs \
  tests/session-audit.test.mjs tests/prompt-boundaries.test.mjs \
  tests/permission-probe.test.mjs tests/delegation-errors.test.mjs \
  tests/compaction-continuity.test.mjs tests/ai-memory-installer.test.mjs \
  tests/visual-workflow.test.mjs tests/visual-installer.test.mjs \
  tests/delegation-ownership.test.mjs

# 설치본 5개 역할·모델·권한·본문 검사 (모델 호출 없음)
node tests/agent-routing-native.mjs

# 격리 Native 위임·복구·병렬·세션 제한 통합 검사 (로컬 fixture 모델)
node tests/delegation-native-integration.mjs

# 격리 Native 시각 도구 연결 (합성 스킬·PNG, 로컬 scripted 모델)
node tests/visual-workflow-native.mjs
```

## 에이전트의 스킬 선택

일반 요청에서도 담당 에이전트가 관련 스킬을 먼저 불러오고, 과업에 맞는 보완 관점을 선택하도록 공통 지침을 보강했습니다. 사용자 명령은 필요 없으며, 스킬 일괄 로드·필수 평가자 수·고정 단계는 추가하지 않았습니다.

`scripts/session-audit.mjs`는 기존 로드 목록에 더해 역할별 첫 완료된 편집·위임 전 로드(`skillsLoadedBeforeAction`)와 그 후 처음 로드(`skillsFirstLoadedAfterAction`)를 구분합니다. CLI 요약의 `skillsBeforeActionById`·`skillsFirstAfterActionById`는 스킬별 관측 스냅샷 수입니다. 기존 필드와 옛 감사 결과의 요약 동작은 유지합니다.

입력은 관측 순서로 정렬된 메시지를 사용합니다. 최근 메시지 API의 내림차순 응답은 뒤집어야 합니다. 이 구분은 스냅샷 안의 도구 호출 순서일 뿐, 실제 판단 시점·과업 적합성·병렬 순서를 증명하지 않습니다. 검토 스킬을 구현 후 읽는 것도 정상일 수 있어 누락이나 위반으로 판정하지 않습니다.

실제 모델의 자율 선택률·디자인 품질 향상은 아직 미검증입니다. 명령·스킬명을 지정하지 않은 같은 과업의 전후 기록과 실제 결과를 비교해야 하며, 로드 수나 회귀 검사 통과를 그 효과로 해석하지 않습니다.

스킬 감사 보강 당시 회귀 **138/138**, 설치본 **146/146**, 격리 Native **362/362**를 재실행했습니다. 감사 순서 구분·실패/미완료 제외·옛 결과 호환을 검사했고, Native fixture에서는 새 공통 지침의 모델 입력 전달을 확인했습니다. 실제 모델의 스킬 선택 판단을 시험한 것은 아닙니다.

## 시각 작업 어댑터 (2026-10-27)

`global/plugins/ksi-visual-workflow/`를 전용 설치기로 전역 적용했습니다. 명확한 시각 요청에 공식 스킬을 Native attachment로 연결하고, `visual_prepare`·`visual_capture`·`visual_review`를 Code Mode 밖의 직접 도구로 제공합니다. 사용자 원문·모델·역할·권한은 바꾸지 않으며 외부 스킬 원문·공식 설치기·hook도 유지합니다. [동작·설치·보안 경계](visual-workflow.md)

- **단위·설치기:** 프로젝트 경로·symlink·승인 대기 중 경로 교체·read/shell/edit 거부·새 요청/재준비/다른 세션 receipt·이미지 변조·ADB 고정 서비스/총 제한 시간/취소, 설치·검증·멱등성·managed 백업·미관리/수정 파일/manifest/symlink 거부를 검사했습니다.
- **실제 Native 연결:** 별도 HOME·서버·가짜 자격증명·로컬 scripted 모델로 16건 통과. 자동 스킬 attachment, 실제 소스·토큰 패킷, Native 읽기·편집, PNG 이미지가 다음 모델 입력에 도달하는지와 도구 내부의 Native read 거부를 확인했습니다. **스킬 본문과 PNG는 합성 fixture**입니다. 공식 Impeccable의 실제 판단이나 디자인 품질을 시험한 결과가 아닙니다. 최신 증거: `/tmp/opencode/ksi-visual-native-CjH0Cx/`.
- **실제 참조 자료:** Safety Edge의 Kotlin·AGENTS·DESIGN·colors·round92 설명과 round91/92의 1920×1200 PNG 두 장을 직접 runtime read-only probe로 연결했습니다. 실제 자원 4개·실제 이미지 payload 2개·원래 요청/출처·`not-evaluated` 결과를 확인했고 읽은 참조 파일 7개의 해시가 전후 같았습니다. Native 연결 시험과 별개의 직접 호출 검사입니다. Safety 파일·앱·세션·기기를 변경하지 않았습니다. 증거: `/tmp/opencode/ksi-visual-safety-import-KCHe1M/`.
- **전역 적용:** 기존 전역 파일 72개 해시를 보존하고 adapter 파일 2개와 manifest만 추가했습니다. `ksi.visual-workflow`와 ai-memory가 함께 `active`, source/installed 해시 일치, 공유 서비스 PID `1180947` 유지. 설치 직후 최초 catalog 조회에서는 아직 로딩되지 않았고 후속 조회에서 활성화를 확인했습니다. 서비스 재시작·전체 location 강제 reload는 하지 않았습니다. 실모델 관찰 후 오류 안내 보완본도 managed 백업·재적용·파일/활성/PID/기존 해시 재확인을 마쳤습니다. 증거: `/tmp/opencode/ksi-visual-deploy-88tUv5/`, 업그레이드 백업: `/tmp/opencode/ksi-visual-install-7l9VqQ/`.
- **실모델 1회:** 공유 Native의 별도 읽기 전용 세션에서 `opencode-go/deepseek-v4.1-flash#max` Build에 스킬·도구명을 지정하지 않은 한국어 검토 요청을 보냈습니다. 실제 설치 경로의 공식 Impeccable 본문 attachment, 사용자 원문/analysis 분류 보존, `visual_prepare`와 과거 native PNG의 `visual_capture` 성공을 확인했습니다. 모델은 첫 준비에 PNG를 텍스트 자원으로 넣어 실패한 뒤 텍스트만으로 바로 수정했습니다. 이 관찰을 반영해 도구 설명·오류에 텍스트/PNG 경로를 명시하고 복구를 회귀 검사했습니다. shell/edit·기기·위임·외부 요청을 제한했고 fixture 파일 해시는 그대로였습니다. **180초 대기 제한까지 최종 응답이 나오지 않아 해당 시험 세션만 interrupt했습니다.** 검토 완주·새 렌더·전후 품질 비교 성공으로 세지 않습니다. 증거: `/tmp/opencode/ksi-visual-live-0kanr4/`.
- **기존 회귀:** 설치본 146건과 위임 Native 362건을 다시 통과했습니다. 병렬 실행 중 기존 capability 임시 폴더 검사가 타 프로세스의 생성/삭제를 자기 누수로 오판한 1건을 재현했고, 자기 fd inode의 파일·폴더와 별도 보존 표본만 검사하도록 고친 뒤 회귀를 재실행했습니다. 설치본 증거: `/tmp/opencode/ksi-agent-routing-DMRvnK/`, 위임 증거: `/tmp/opencode/ksi-deleg-klL8Ty/`.

시각 어댑터 배포 당시 회귀 로그: `/tmp/opencode/ksi-visual-final-regression-5gutzw1_/unit.log` (**216/216**). 이후 위임 관측 분류 4개를 추가한 현재 회귀는 위 표의 **220/220**입니다.

**미완료·차단:** 이 Linux 호스트에는 Android SDK·에뮬레이터 실행 파일·AVD가 없어 새 Safety native 렌더를 확인하지 못했습니다. 기존 캡처의 가져오기와 smart-socket transport fixture는 새 앱 렌더·실기 인수가 아닙니다. 동일 모델·동일 과업의 전후 구현/렌더 품질 비교, 약한 모델의 자율 도구 활용률·사용자 교정 부담 개선도 아직 입증하지 않았습니다. 어댑터는 판단 재료와 실행 연결을 제공할 뿐 자동으로 검토 모델을 호출하거나 디자인을 수용하지 않습니다.

## 제품 판단과 Plan·Lead 활용

공통 지침은 다음 작업을 구현 가능성만이 아니라 사용자 가치와 남은 인수 문제로 선택하도록 보강했습니다. 중요한 방향·대안이 불명확하거나 반복 교정으로도 목표에 도달하지 못하면 직접 또는 Plan과 재분석하고, 채택한 자문은 담당자가 구현·검증으로 연결합니다. Lead는 수정 방법과 필요한 자문·위임·통합을 소유합니다. 호출 의무·새 단계·모델·권한은 추가하거나 변경하지 않았습니다.

효과는 Plan 호출 수가 아니라 사용자가 제품 우선순위·디자인 방향을 다시 잡아줘야 하는지, Build가 Lead의 세부 수정 설계를 계속 떠맡는지, 실제 결과가 목표를 충족하는지로 확인합니다. 실제 작업의 개선 효과는 아직 미검증이며, 회귀·설치·Native 검사는 지침 전달과 실행 계약만 확인합니다.

제품 판단 보강 당시 회귀 **138/138**, 설치본 **146/146**, 격리 Native **362/362**를 재실행했습니다. 공통 지침·Lead 설치본의 정본 일치와 Native 지침 전달을 확인했으며, 서비스나 기존 세션의 모델·권한은 변경하지 않았습니다.

### 해법이 열린 요청에서의 선제적 설계 판단

사용자 승인에 따라 기존 공통 원칙의 Goal·Autonomy·Coordination만 보완해 전역 적용했습니다. 해법이 열려 있으면 사용자 과업과 문제를 정의하고 근거·주요 상충관계가 있는 추천 방향을 구현 전에 제시합니다. 기존 구현은 근거이지 자동으로 확정된 요구사항은 아닙니다. 제안을 범위 변경 승인으로 간주하지 않으며, 범위 안의 되돌릴 수 있는 선택은 설명하고 진행합니다. 위임에는 목표·관찰된 문제·확정 제약을 전달하고 열린 설계 선택은 담당자에게 남깁니다. 정확한 국소 수정에는 방향 발표를 요구하지 않습니다.

원칙 항목 수·역할·모델·권한·외부 스킬·hook은 그대로이며, 제안 개수·고정 설계 단계·필수 자문 순서는 추가하지 않았습니다. 회귀 **159/159**, 설치본 **146/146**, 격리 Native **362/362**를 재실행해 통과했습니다. 설치본 바이트 일치와 Build·Lead·Plan·General·Explore 모델 입력으로의 전체 공통 지침 전달을 확인했습니다. 백업·검증 로그는 `/tmp/opencode/ksi-design-ownership-sdw0k2nd/`, Native 증거는 `/tmp/opencode/ksi-deleg-DmBQNt/`에 있습니다.

**실제 행동 효과는 미검증입니다.** 이번 검사는 실제 모델의 자발적 문제 발견·추천 품질이나 렌더 결과를 평가하지 않습니다. 일반적인 UI 개선 요청에서 사용자가 해법을 알려주기 전에 핵심 문제와 추천을 제시하는지, 그 판단이 실제 화면의 사용자 과업을 개선하는지 확인해야 합니다. 제안 횟수·Plan 호출 수·지침 문구 일치로 이를 대체하지 않습니다.

### 위임 중심 운영 강화 (2026-10-27)

사용자가 “Build가 다 해버리면 안 된다”고 승인한 방향에 따라, 큰·비국소·여러 부분 제품 개발·디자인의 본체는 Lead에 결과 단위로 먼저 맡기도록 기본 책임을 강화했습니다. General은 범위가 정해진 실행, Explore는 읽기 전용 조사입니다. 조사·마지막 리뷰만 맡기고 Build가 본체를 전부 구현하거나, 큰 일을 작은 직접 수정으로 쪼개 우회하는 것은 충분한 위임이 아닙니다. Lead는 배정 범위의 설계·구현·교정을 소유하고 Build는 목표·제약·완료 조건·통합·최종 검증을 책임집니다. 국소 수정·작은 통합 수선·검증은 Build가 직접 할 수 있습니다.

공통 원칙과 Build 설명·Lead 본문·README의 상충 설명을 정리해 전역 적용했습니다. 항목·역할·모델·권한·깊이는 늘리거나 바꾸지 않았고, 강제 호출 수·새 workflow engine·Build 편집권 차단도 추가하지 않았습니다. **강한 운영 기본값이지 도구 수준의 일괄 편집 금지는 아닙니다.** 사용자 명시 직접수행 지시·실제 위임 불가는 승인 범위 안에서 정직하게 보고해야 하며, 말없이 전체를 가로채거나 허위로 위임했다고 주장할 수 없습니다.

이번 source 수정 자체를 Lead가 맡고 Build가 검토·통합·전역 배포했습니다. 전역 config는 Build description만 바꿔 기존 ai-memory 등 MCP·모델·권한을 보존했고, 공통 지침·Lead 설치본은 source와 바이트 일치합니다. 공유 서비스 PID `1180947` 유지, 재시작·강제 reload 없음. 백업·배포 근거: `/tmp/opencode/ksi-delegation-default-deploy-2pnxR5/`.

회귀·분류 **220/220**, 설치본 **146/146**, 격리 Native **362/362**를 다시 통과했습니다. 설치본 증거: `/tmp/opencode/ksi-agent-routing-9ckhOY/`, Native 지침 전달·권한·복구 증거: `/tmp/opencode/ksi-deleg-P4t94h/`. 이 검사는 모델의 자발적 위임을 보장하지 않습니다.

최신 회귀 로그: `/tmp/opencode/ksi-delegation-default-final-6kvezymz/unit.log`.

선택형 실모델 시험 `node tests/delegation-ownership-live.mjs`는 역할명·위임 지시가 없는 한 번의 일반 제품 요청으로, 세 모듈 Python CLI의 기능 결과와 부모/자식의 실제 파일 변경을 함께 관측합니다. 별도 임시 fixture·소유 세션 트리만 사용하고 부모 모델은 DeepSeek Flash Max, 자식 모델은 기존 설치 설정을 유지합니다. 다섯 분 대기 한도 후 시험 트리만 중단하며 재촉 프롬프트를 보내지 않습니다. 두 핵심 모듈의 구현 주체를 검사하는 fixture별 관측이지 위임 호출 수 quota나 모든 과업의 품질 판정은 아닙니다. 실제 제품·다화면 디자인의 장기 위임 운영과 디자인 품질은 별도로 검증해야 합니다.

**실행 1건은 부분 확인입니다.** `Build(DeepSeek Flash Max) → Lead(Muse XHigh) → General(Muse High)`의 실제 트리가 생겼고, 본체 3개 모듈의 구현·교정은 Lead가 수행했습니다. Build의 본체 직접 쓰기는 없었으며, 모델 자신의 정확한 `python3 check.py` 실행과 별도의 하네스 재검사가 모두 통과했고 보호 파일 해시·사용자 원문·단일 요청도 유지됐습니다. 그러나 Build의 최종 응답은 300초 안에 끝나지 않아 소유 시험 트리만 중단했습니다. General의 추가 검증 명령과 Build의 추가 검사/정리 명령도 좁은 shell 권한에 거부됐으므로 그 검증을 성공으로 세지 않습니다. 전체 시험은 **완주 통과가 아닙니다.** 이 제한이 숨은 장애가 되지 않도록 이후 fixture 지도에 정확한 허용 명령과 미검증 보고 경계를 명시했습니다(위임 지시는 추가하지 않음). 증거: `/tmp/opencode/ksi-delegation-ownership-live-d28cZg/`의 `messages.json`, `reviewed-result.json`, `call-summary.json`.

독립 코드 검토에서 wait 종료만으로 모델의 최종 응답·정체성·실행 검증을 대신할 수 없고, 수집 실패/조기 종료 때 소유 자식 정리가 빠질 수 있는 점을 확인했습니다. 관측기는 실제 root 모델·역할·final stop·모델 자신의 성공 검사 호출을 따로 확인하도록 보완했고, 수집 예외와 정상 종료에도 소유 root/자손만 정리하는 `finally`를 추가했습니다. Native 변이 권한은 기존 `edit` 액션을 사용하며, 보호 파일 해시도 별도로 확인합니다. 이것은 완전한 OS sandbox가 아닙니다.

## 외부 스킬·플러그인 업데이트 (2026-10-27)

공식 설치기가 관리하는 제공자별 사본·hook·기본 경로는 유지합니다. 같은 ID라는 이유로 사본을 제거하거나 원문을 로컬 방식으로 재작성하지 않습니다. 설치·업데이트 원칙은 [설치 안내](installation.md#선택-스킬외부-플러그인)를 따릅니다.

| 대상 | 확인 결과 |
| --- | --- |
| Impeccable | 제공자 5곳의 SKILL.md **4.8.0**, npm latest와 일치. 사용자 업데이트 로그의 엔진은 **0.1.18** |
| Playwright CLI | 설치 **0.1.22**, npm latest와 일치 |
| Intent 3종 | 공식 skills CLI로 **v1.7.1 → v1.7.3**. journey·organize·wireframe만 선택 설치; 관리 ref·원본 blob·Native 로드 본문 일치 |
| Vercel React·diagnosing-bugs·ux-copy | 관리 기록의 폴더 해시가 원본 HEAD와 일치 |
| osmontero 5종·Uxcel 휴리스틱 감사 | 설치 원문·참조 파일이 원본 HEAD의 Git blob 해시와 일치 |
| ai-memory | 공식 `upgrade --version 3.2.8` 체크섬 검증 통과. 클라이언트·실행 서비스 **3.2.8**, 건강·MCP 호출 확인 |

`~/.agents/.skill-lock.json`에는 6개 스킬의 소스·해시·ref 기록이 있습니다. 앞서 이를 전부 수동 사본으로 설명한 것은 정정합니다. 승인 후 공식 `skills update -g -y`는 기존 ref 기준 최신을 보고했고, Intent만 공식 `skills add https://github.com/ghaida/intent/tree/v1.7.3 --skill journey organize wireframe --agent opencode -g -y`로 ref를 갱신했습니다. 전체 Intent 스위트나 추가 역할은 설치하지 않았습니다.

ai-memory 데이터·설정·hook·기존 바이너리와 에이전트 설정을 백업하고, ai-memory 서비스만 잠시 중지해 전체 복구본을 확보했습니다. 새 바이너리의 공식 `install-hooks`를 기존 세 에이전트에 allowlist로 재적용했습니다. 메모리 설정은 바이트 동일, 기존 인증 토큰 유지, Claude Code·Codex의 ai-memory 외 설정·hook은 의미상 동일하며 Impeccable hook도 공존합니다. loopback·bearer auth·LLM/임베딩 비활성 상태를 확인했습니다. `--check-capture` 합성 fixture에서는 마커 없는 경로 거부·마커 있는 경로 허용을 확인했으며 실제 이벤트를 보내지는 않았습니다.

하네스 설치기 기준 버전은 **3.2.8**로 갱신하고 최신 안정 버전 보존·알 수 없는 버전 안전 중단을 회귀 검사했습니다. 실제 재적용 후에도 업데이트한 바이너리의 해시가 같고 MCP·hook 설정은 no-op이었습니다. Native에서 등록 20개와 Intent 최신 본문 반영을 확인했습니다. 이번에 Claude/Codex 모델을 통한 실제 hook·핸드오프를 재시험하지는 않았습니다. Claude OAuth 재로그인과 Codex `/hooks` 검토·승인은 여전히 사용자 확인이 필요합니다.

업데이트 백업·로그·검증 증거: `/tmp/opencode/ksi-external-update-xga7kw3d/` (소유자만 접근). 이후 사용자의 제거 승인으로 `gpt-taste`·`emilkowalski-motion`만 전역 발견 경로에서 제거했습니다. 원문·라이선스·해시 manifest는 `/tmp/opencode/ksi-local-guides-removal-l3_ksrc3/`에 보존했습니다. 현재 capability 목록에서 모션 각색본을 제외하되, 과거 세션 감사의 분류는 유지합니다. Mobbin 연결 가이드·grill-me·공식 제공자별 스킬은 변경하지 않았습니다.

제거 후 Native API에서 **18개** 등록, 두 제거 대상 부재와 유지 대상 발견을 확인했고, 회귀 **159/159**를 재실행해 통과했습니다. 서비스 재시작은 하지 않았습니다.

출처 설명 정정: `gpt-taste` 본문은 taste-skill 각색 출처를, 모션 본문은 Emil Kowalski 참고 URL을 명시하지만, 모션 폴더의 `LICENSE-OPEN-DESIGN.txt`에는 **Copyright 2026 Open Design contributors**가 있습니다. 앞서 본문만 확인하고 “Open Design 관련 근거가 없다”고 설명한 것은 불완전했습니다. Open Design 출처 표기는 확인됐으며, 정확한 원본 커밋·각색 경위까지 검증된 것은 아닙니다.

## 승인 범위 안의 작업 연속성

공통 Autonomy는 중간 성공 보고를 새 승인 단계로 삼지 않고 승인된 구현·교정·검증을 이어가도록 보강했습니다. 일부 차단은 독립 작업의 중단 사유가 아니며, 완료·진짜 차단·범위 경계에서는 정직하게 종료합니다. 권한·분석 전용 제한은 유지합니다.

`tests/completion-guidance-live.mjs`의 checker **4-continuation-offers**는 기존에 놓친 “이어갈까요·원하시면”과 대안 질문을 관측합니다. “아니면”이나 무관한 부정 표현으로 질문을 놓치지 않고, 인용·부정된 질문과 정상 진행 보고·완료 후 선택적 제안은 구분합니다. 원래 Safety 질문은 표현 회귀 자료이지 당시 작업의 승인 범위까지 확정하는 증거는 아닙니다. 문구 감지는 권한·목표 완료 판정기가 아니며, 자동 재시도나 다음 사용자 메시지를 주입하지 않습니다. 문구 없이 조기 종료해도 산출물·검증이 미완료면 통과하지 않습니다.

적용 후 회귀 **145/145**, 설치본 **146/146**, 격리 Native **362/362**를 재실행했습니다. 기존 실모델 probe도 `opencode-go/deepseek-v4.1-flash#max` Build로 각 1회, 총 **3/3** 통과했습니다.

- `continue-next`: M2·M3 구현과 모델 자신의 최종 검사 완료, 사용자 메시지 1개, 재승인 질문 없음.
- `blocked-local`: 계정 작업은 차단으로 남기고 독립적인 로컬 구현·검사 완료.
- `scope-boundary`: 로컬 구현·검사 완료, 미승인 배포 시도 없음.

실행 중 fixture가 허용하지 않는 부가 shell 명령 2회는 거부됐고, 모델은 허용 도구로 작업을 마쳤습니다. 권한을 넓히거나 재촉하는 두 번째 프롬프트를 보내지 않았습니다. 전체 승인과 남은 작업을 명시한 작은 Python 과업이므로, 일반 요청·Muse/Sol·장기 제품 작업의 개선이나 지침 변경의 인과 효과를 증명하지는 않습니다. 증거: `/tmp/opencode/completion-guidance-after-Ij9Hry/`의 원본 메시지·fixture·evidence JSON. 검사기의 재현 실패→수정 확인 로그는 `/tmp/opencode/ksi-continuation-fix-hrwcfd7s/`에 보관했습니다.

## Sol Build trial에서 배운 것

Sol High Build는 실제 로컬 앱에서 다음을 스스로 찾아 고쳤습니다.

- 자료 캔버스가 화면 높이를 넘어 복구 버튼이 밀리는 문제
- 관측 미선택 공간 화면의 문서형 fallback
- 패널 포커스 때 캔버스가 7px 스크롤되는 문제

반면 다음은 남겼습니다.

- 홈·현장 목록의 비주얼 퍼스트 부재
- 1440px에서 자료 목록 패널이 “준비 기록을 불러오지 못했습니다 / 준비 상태 다시 확인” 복구 카드를 덮어, 목록을 닫기 전에는 복구 동작을 누를 수 없는 문제
- 1024px에서 복구 카드가 치수 라벨을 가리는 문제

이 사례의 핵심은 **테스트·스크린샷·계약 검사가 통과해도 제품 수용은 별개**라는 점입니다. Build는 첫 화면, 핵심 행동, 로딩/빈/오류 상태의 조합을 실제 렌더로 판정해야 하며, UI 독립 검토도 코드·계약만 보지 않고 실제 화면과 제품·시각 질문을 포함해야 합니다. 자세한 판정 기준은 [README의 제품 수용](../README.md#완료를-어떻게-판정하나)을 따릅니다.

## ai-memory 전역 연동 (2026-10-27)

처음 `v3.2.5`로 연결한 뒤 **v3.2.8**로 갱신했습니다. 설치·포트·수집 정책은 [ai-memory 안내](ai-memory.md)를 따릅니다. 아래 수집·핸드오프는 초기 검증이며, 업데이트 후 재확인 범위는 위 업데이트 절에 구분했습니다.

- **연결 확인:** OpenCode·Codex MCP 연결과 세션 수집·핸드오프 확인. 마커 없는 저장소에서는 수집되지 않아 allowlist가 동작했습니다. 설치본 `opencode.jsonc`의 선택적 `mcp.servers.ai-memory` 항목으로 소스 정본과 바이트가 다르며, 역할·권한은 설치본 **146/146**으로 확인했습니다.
- **Claude Code:** MCP 등록은 확인했지만 이 환경의 OAuth 세션이 만료되어 실제 모델 호출은 재로그인 전까지 미검증입니다.
- **Codex:** hook 영구 승인이 남아 있습니다. 실제 사용 전 Codex `/hooks`에서 검토·승인이 필요합니다.
- **레거시 hook 정리 이력:** 없는 `bin/ksi-continuity-inject.mjs`를 부르던 오래된 KSI hook을 백업 후 제거했습니다. 당시 Codex Impeccable hook 제거·Mobbin 비활성화도 있었으나 현재 정책이 아닙니다. 이후 사용자의 공식 Impeccable 업데이트로 복원된 hook은 유지하며, Mobbin도 다시 활성화했습니다(최근 호출은 HTTP 429).
- **첫 실제 프로젝트:** `KSI-Site-Intelligence-Platform`에 `.ai-memory.toml`을 추가했습니다(`ksi-site` / `site-intelligence-platform`). 짧은 OpenCode 세션 1건이 이 프로젝트로 수집되는 것도 확인했습니다. 파일은 아직 untracked이며 프로젝트의 다른 변경과 함께 커밋 여부를 결정해야 합니다. `.playwright-cli` 로그는 저장소 밖으로 이동했습니다.
- **한계:** 합성 파일럿 저장소 한 곳, 짧은 세션, 장기 운용·대규모 병렬·실제 프로젝트 적용 전입니다. 기억은 지시가 아니라 과거 데이터이며, 현재 코드·정본·사용자 지시가 우선입니다.

상세 설치·운용·보안·해제는 [ai-memory 안내](ai-memory.md)를 참고하세요.

## 검증이 보장하지 않는 것

- 모델 간 일반 우위: Sol High Build가 DeepSeek Build보다 항상 낫다는 결론이 아닙니다.
- 실제 제품 완주: trial은 합성 미봉인 자료와 제한된 환경에서 수행됐고, 실제 픽셀·자료 준비·분석 실행·운영/고객 인수는 미검증입니다.
- 장기 개발·비용·추가 교정 부담의 개선: 비교 1건만으로 일반화하지 않습니다.
- 장기 기억의 실제 효과: 파일럿 1곳의 짧은 세션만 확인했으며, 재설명·반복 작업 감소는 실제 프로젝트의 장기 사용으로 검증해야 합니다.
- 디자인 판단력: 검사는 라우팅·권한·지침 전달 메커니즘을 확인할 뿐, 모델의 취향·제품 판단을 인증하지 않습니다.
- 시각적 완성도: axe·렌더 캡처·키보드 검사는 특정 범위의 증거이며 전체 접근성·사용성 인증이 아닙니다.

## 역사 기록

- [2026-10-26 문서 이력](archive/2026-10-26/README.md): 이전 설치 안내, 2026-10-17~26 검증 이력, OpenSpec·스킬 검토, Sol trial 상세
- [퇴역 OpenSpec](archive/openspec-2026-10-26/README.md)
- [Architect 원본](archive/agents/architect.md)

과거 기록은 당시 근거를 보존하지만 현재 실행 의무나 최신 결론을 대신하지 않습니다.
