# 설치 안내

> **검증 범위:** 전역 5개 역할과 공통 지침의 설치본 검사 및 격리 Native 검사의 결과와 시점은 [검증](validation.md)에 기록합니다. ai-memory를 선택적으로 연결하면 `opencode.jsonc`가 정본과 바이트 단위로 다를 수 있으므로 역할·권한은 설치본 검사로 확인합니다. 소스·설치·실행 중 로딩은 각각 별도로 확인하세요.

이 저장소는 전역 OpenCode 환경에 자동 설치되지 않습니다. clone/pull 후 아래 순서로 **기존 설정을 보존하면서** 적용하세요. 다른 컴퓨터·다른 프로젝트에는 별도 적용이 필요합니다.

> [!IMPORTANT]
> **소스·설치본·활성을 구분합니다.** `global/`은 정본(소스), `~/.config/opencode/`는 설치본, catalog 조회는 활성(로딩) 확인입니다. clone/pull만으로 전역이 바뀌지 않습니다.

```text
[global/ 정본] ─차이 확인·수동 병합 + 설치기─→ [~/.config/opencode/ 설치본]
                                            ↓ catalog에서 active 확인
```

## 적용 파일

| 저장소 | 전역 경로 | 역할 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 제품 이해·위임 중심 운영·제품 수용·안전 지침 |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 5개 역할, 깊이 3, 모델·권한, MCP 설정 |
| `global/agents/lead.md` | `~/.config/opencode/agents/lead.md` | 배정 과업 완결 책임자 프롬프트 |
| `global/commands/*.md` | `~/.config/opencode/commands/` | 선택형 `/ux-audit`·`/debug`·`/perf` 바로가기 |
| `global/plugins/ksi-visual-workflow/` | `~/.config/opencode/plugins/ksi-visual-workflow/` | 아래 전용 설치기로 적용하는 Native 시각 작업 어댑터 |
| `global/plugins/ksi-capabilities-inventory/` | `~/.config/opencode/plugins/ksi-capabilities-inventory/` | 필요할 때만 호출하는 기능 목록 도구 |
| `global/plugins/ksi-session-evidence/` | `~/.config/opencode/plugins/ksi-session-evidence/` | 필요할 때만 호출하는 세션 증거 요약과 공유 감사 core |

Lead Goal 상태 전달과 Native Decision 보조 연결은 저장소 소스로 제공됩니다. 내려받기만으로
전역에 설치되거나 활성화되지는 않습니다. 특히 상태
전달만으로 Lead Goal이 자동 시작되지는 않습니다. 각각의 현재 상태와 데이터 전송 조건은
[Native Goal](native-goal.md)과 [Native Decision](native-decision.md)을 확인하세요.

`global/opencode.jsonc`의 Context7·Mobbin MCP는 선택 기능입니다. API 키·OAuth 토큰·유료 구독은 사용자별이며 저장소에 포함되지 않습니다. 현재 정본은 사용자의 선택으로 Mobbin을 켜 두었으며, 사용하지 않으면 `disabled: true`로 끕니다. Mobbin 없이도 하네스는 동작합니다.

> [!CAUTION]
> **적용 방식:** `opencode.jsonc`는 항상 수동 병합이며 통째로 덮어쓰지 않습니다. `AGENTS.md`·`agents/lead.md`·`commands/*.md`도 대상이 없거나 운영자가 하네스 관리로 확정한 경우에만 복사하고, 사용자 정의가 있으면 diff 후 필요한 부분만 합칩니다. 자동 병합 스크립트는 이 저장소에 없습니다. 기본 적용에서 시각 어댑터는 전용 설치기가 관리하며, 선택형 ai-memory는 아래 별도 절을 따릅니다.

## 설치 전에

1. OpenCode V2가 설치되어 있고 `opencode --version`이 동작하는지 확인합니다.
2. 기존 `~/.config/opencode/`의 `AGENTS.md`, `opencode.jsonc`, `agents/lead.md`와 같은 이름의 명령 파일을 백업합니다.
3. 같은 이름의 사용자 정의가 있으면 덮어쓰지 말고 차이를 확인합니다.
4. 진행 중인 세션은 강제 종료·전환하지 않습니다. 기존 세션의 저장된 모델·권한도 자동으로 바꾸지 않습니다.

백업할 경로와 그 상위 디렉터리에 심볼릭 링크가 있거나 출처가 불명확하면 먼저 중단하고 실제 대상을 확인하세요. 아래 예시는 확인을 마친 일반 경로에서만 사용하며, 경로 확인과 복사 사이에 경로가 바뀌는 경쟁을 막지는 못합니다.

```sh
# 소유자 전용 백업 (0700, 충돌 없는 고유 경로). 없는 원본은 건너뜁니다.
umask 077
BACKUP="$(mktemp -d "$HOME/.config/opencode-backup-XXXXXX")"
mkdir -p "$BACKUP/agents"
for f in AGENTS.md opencode.jsonc agents/lead.md; do
  if [ -e "$HOME/.config/opencode/$f" ]; then
    cp -a "$HOME/.config/opencode/$f" "$BACKUP/$f"
  else
    echo "없음(건너뜀): $f"
  fi
done
if [ -d "$HOME/.config/opencode/commands" ] && [ ! -L "$HOME/.config/opencode/commands" ]; then
  cp -a "$HOME/.config/opencode/commands" "$BACKUP/commands"
else
  echo "없거나 링크임(확인 필요): commands/"
fi
echo "$BACKUP"
```

## 적용

먼저 [설치 전에](#설치-전에) 백업을 마치고, 기존 파일의 실제 상태를 확인합니다. 자동 병합 스크립트는 이 저장소에 없으므로, 아래는 운영자가 직접 비교하고 범위를 정해 합치는 **수동 절차**입니다.

```sh
# 덮어쓰기 전에 기존 파일 목록과 링크 여부부터 확인
ls -la "$HOME/.config/opencode/" "$HOME/.config/opencode/agents/" "$HOME/.config/opencode/commands/" 2>/dev/null
```

> [!CAUTION]
> **`opencode.jsonc`의 원문을 도구 출력·세션 로그에 그대로 찍지 않습니다.** 기존 설정에는 API 키·토큰·자격증명 참조가 들어 있을 수 있습니다. 비교는 로컬 에디터에서 직접 열고, 에이전트·보고서에는 값 대신 구조 차이(어떤 최상위 키·서버·역할 항목이 추가/삭제되는지)만 정리해 전달합니다. `diff`·`cat` 원문을 그대로 붙여넣지 않습니다.

> [!CAUTION]
> **이미 있는 `opencode.jsonc`를 정본으로 통째로 덮어쓰지 않습니다.** 전체 복사는 ai-memory 선택 항목·무관한 MCP·사용자 설정·자격증명 참조를 지웁니다. 하네스가 관리하는 역할·깊이·권한 항목만 골라 기존 파일에 수동으로 합치고, 나머지 사용자 항목은 그대로 둡니다.

- **대상 파일이 없을 때만** 새로 만듭니다. 정본을 에디터로 열어 대상 경로에 직접 저장하되, 저장 전에 해당 경로가 심링크가 아니고 상위 디렉터리가 예상 위치인지 먼저 확인합니다. 조금이라도 의심스러우면 중단하고 경로를 정리한 뒤에 진행합니다.
- **운영자가 해당 대상을 하네스 관리로 확정한 경우**에만 같은 이름 복사를 허용합니다. 사용자 정의가 섞여 있으면 필요한 부분만 에디터에서 합칩니다.
- **`opencode.jsonc`는 항상 수동 병합입니다.** 하네스 항목(5개 역할·깊이 3·모델·권한)만 반영하고, 기존 `mcp.servers.*`·공유·자격증명·다른 에이전트 설정은 보존합니다. 링크된 대상을 따라 덮어쓰지 않습니다.

```sh
# 시각 어댑터만 전용 설치기로 적용합니다.
# (수정·미관리 파일과 symlink는 덮어쓰지 않고 중단)
node scripts/install-visual-workflow.mjs
node scripts/install-visual-workflow.mjs --verify
```

이전 전문 역할(`engineer`, `design`, `research`, `critic`)과 OpenSpec 활성 구성은 **재설치하지 않습니다.** 같은 이름의 기존 파일이 있더라도 사용자 정의일 수 있으므로 자동으로 삭제하거나 덮어쓰지 않습니다. 출처와 사용 중인 세션을 확인하고, 제거가 필요한 경우에만 운영자의 명시적 승인 후 해당 파일을 비공개 백업합니다. 전체 역할 이전표와 과거 설치 프롬프트는 [설치 이력](archive/2026-10-26/installation-history.md)에 있습니다.

### 설치 요청 프롬프트

파일 수정과 명령 실행이 가능한 에이전트에게 다음을 전달할 수 있습니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.

1. OS·전역 경로·기존 설치·Node.js·OpenCode V2를 확인하고, 기존 파일을 소유자 전용 백업
   (umask 077 + mktemp -d 고유 경로)에 저장해줘. 없는 원본은 건너뛰고 파괴적으로 덮어쓰지 마.
   개인 설정·자격증명(ai-memory 포함)·MCP·다른 프로젝트·다른 도구는 보존해줘.
   이미 있는 전역 파일을 정본으로 통째로 덮어쓰지 말고, 차이는 로컬에서 직접 확인해줘.
   opencode.jsonc·자격증명의 원문은 도구 출력·보고서에 그대로 찍지 말고, 값 대신
   구조 차이(어떤 항목이 추가/삭제되는지)만 정리해 보고해줘.
2. 대상 파일이 아예 없을 때만 에디터에서 직접 만들고, 대상이 심링크이거나 이미 있으면
   중단하고 수동 확인을 요청해줘 (링크를 따라 덮어쓰지 마). 사용자 정의가 있으면
   필요한 하네스 항목만 에디터에서 수동으로 합쳐줘. 특히 opencode.jsonc는 전체 교체 금지이며,
   하네스 역할·깊이·권한 항목만 기존 파일에 합치고 ai-memory·무관 MCP·사용자
   설정은 유지해줘. 이 저장소에 자동 병합 스크립트는 없으므로 직접 병합해줘.
   시각 작업 어댑터는 node scripts/install-visual-workflow.mjs로 적용하고
   --verify로 파일 일치를 확인한 뒤, 실행 중 활성은 catalog의 active로 별도 확인해줘.
    이전 engineer/design/research/critic 역할과 OpenSpec 활성 구성은 재설치하지 마.
    같은 이름의 기존 파일은 사용자 정의일 수 있으니 자동 제거하지 말고 출처와
    세션 상태를 확인해 보고해줘. 제거는 별도 승인과 백업 후 해당 파일만 해줘.
    일괄 삭제·rm -rf는 금지해줘.
3. 기존 세션의 모델·권한은 강제로 바꾸지 말고, 서비스·다른 프로젝트·운영 환경은
   재시작하거나 변경하지 마.
4. 아래 검증 명령을 실행하고, 정본/설치본 일치(사용자·ai-memory 선택 항목 제외)·실패·미확인을 구분해 보고해줘.
   설치본 검사는 모델을 호출하지 않지만 자체 임시 세션·fixture만 만들므로,
   완전한 읽기 전용 검사는 아님을 참고해줘.
```

## 확인

```sh
# 하네스 관리로 확정한 대상만 정본과 바이트 비교 (사용자 정의 병합본은 비교 대상 아님)
for f in AGENTS.md agents/lead.md; do
  cmp "global/$f" "$HOME/.config/opencode/$f" && echo "OK $f"
done
for f in global/commands/*.md; do
  cmp "$f" "$HOME/.config/opencode/commands/$(basename "$f")" \
    && echo "OK commands/$(basename "$f")"
done

# opencode.jsonc는 수동 병합 + 사용자·ai-memory 항목 보존이 정상이므로
# 정본 바이트 일치를 기대하지 않습니다. 역할·권한은 설치본 검사로 확인합니다.

# 설치본 5개 역할 등록·모델·권한·본문 검사 (모델 호출 없음, 자체 임시 세션·fixture만 생성)
node tests/agent-routing-native.mjs

# 격리 Native 서버 위임·복구·병렬·세션 제한 통합 검사 (로컬 fixture 모델)
node tests/delegation-native-integration.mjs

# 시각 도구와 Native 스킬 attachment·이미지·권한 전달 (실제 품질 평가 아님)
node tests/visual-workflow-native.mjs

# 시각 어댑터 파일 일치 검사 (파일 해시 확인; 실행 중 활성은 아래 catalog로 별도 확인)
node scripts/install-visual-workflow.mjs --verify
```

- 설치본 검사 **146/146**, 격리 Native **363/363**은 2026-10-28의 이전 결과입니다. 이후 Lead 모델 변경 후 설치본 전체 검사는 재실행하지 않았으며, 검사 수는 버전에 따라 달라질 수 있습니다.
- 설치본 검사는 모델을 호출하지 않지만 자체 임시 세션·fixture만 만들므로 완전한 읽기 전용 검사는 아닙니다. 기존 제품·세션·서비스 설정은 바꾸지 않습니다.
- `--verify` 통과는 설치 파일과 정본의 해시 일치이지 실행 중 로딩 보장이 아닙니다. 활성은 Native plugin catalog에서 해당 플러그인의 `active` 상태로 별도 확인합니다.
- 검사 통과는 라우팅·권한·지침 전달의 증거이지, 모델의 디자인 판단력이나 실제 제품 완주를 인증하지 않습니다.
- 문제가 있으면 백업을 되돌리고, 설치본·세션·서비스 상태를 구분해 보고합니다.

> [!TIP]
> **확인 순서:** 바이트 일치(공통 지침·Lead·명령) → 설치본 검사(역할·모델·권한) → 격리 Native(위임·시각) 순으로 봅니다. `opencode.jsonc`가 ai-memory 선택 항목 때문에 다르면 실패가 아니라 “선택 항목 추가”로 구분합니다.

## 되돌리기

1. 현재 설정을 **별도의 소유자 전용 백업**으로 보존합니다. 설치 후 같은 파일에 추가한 사용자 변경이 있을 수 있으므로 이전 백업을 일괄 복사하지 않습니다.
2. 현재 파일과 이전 백업의 차이를 로컬에서 확인하고, 되돌릴 하네스 항목만 합칩니다. 자격증명이나 설정 원문을 세션 로그에 출력하지 않습니다. 경로 또는 상위 디렉터리가 심링크이거나 관리 주체가 불분명하면 중단합니다.
3. 특정 파일 전체 복원이 꼭 필요할 때만 해당 경로와 덮어쓸 변경을 운영자가 확인한 후 복원합니다. 설치 후 추가한 다른 파일이나 설정은 지우지 않습니다.

기존 세션의 모델·권한은 파일 복원만으로 자동 복원되지 않습니다. 필요한 경우 세션별 설정을 별도로 확인하세요.

> [!WARNING]
> **되돌리기의 한계:** 파일은 백업으로 돌아오지만, 이미 바뀐 세션 설정·서비스 상태·외부 스킬 갱신까지 자동으로 되돌아오지 않습니다. 되돌린 뒤에는 위 [확인](#확인) 명령으로 설치본·세션·서비스 상태를 구분해 보고합니다.

### 시각 작업 어댑터

전용 설치기는 두 실행 파일과 해시 manifest만 관리하며, managed 업그레이드 전 백업하고 수정·미관리 파일과 symlink는 덮어쓰지 않습니다. 기록된 파일이 없어졌거나 예상 밖 항목이 있으면 중단하고, 상대 `XDG_CONFIG_HOME`도 거부합니다. [설치기 상세와 경합 한계](visual-workflow.md#설치확인해제). 공식 외부 스킬은 번들하지 않으므로 필요 스킬은 아래 공식 경로로 별도 설치합니다. 파일 감시로 반영되며 서비스 재시작은 하지 않습니다.

해제·복원은 해당 `ksi-visual-workflow` 폴더만 발견 경로 밖에 보존한 뒤 필요 버전을 복원합니다. 외부 스킬·다른 plugin은 유지합니다. 도구 입력, 보안 경계, PNG 보관과 receipt 무효화는 [시각 작업 도구](visual-workflow.md)에 정리했습니다.

### 선택: 기능 목록·세션 증거

필요한 도구만 각 전용 설치기로 적용합니다. 기존 설정·모델·MCP 설정을 병합하거나 서비스를 재시작하지 않습니다.

```sh
node scripts/install-capabilities-inventory.mjs
node scripts/install-capabilities-inventory.mjs --verify
node scripts/install-session-evidence.mjs
node scripts/install-session-evidence.mjs --verify
```

각 설치기는 자신의 디렉터리와 해시 manifest만 관리하며, 기존 managed 파일이 수정됐거나 누락된 경우, 예상 밖 항목·심볼릭 링크·상대 `XDG_CONFIG_HOME`을 만나면 중단합니다. managed 업그레이드 전에는 이전 파일을 별도로 백업합니다. 파일별 교체는 원자적이지만 여러 파일의 교체 전체와 경로 검사 사이의 경쟁까지 원자적으로 보장하지는 않습니다. **다른 플러그인이 같은 도구 ID를 등록하는지는 설치기가 검사하지 않습니다.** Native에서는 같은 이름의 나중 등록이 앞선 정의를 덮을 수 있으므로 적용 전에 도구 목록과 소유자를 확인합니다. `--verify`는 파일 일치만 확인하며 실행 중 활성은 별도 확인해야 합니다. 이미 진행 중인 모델 요청은 이전 도구 스냅샷을 유지할 수 있으므로 새 등록은 이후 요청과 구분해 확인합니다.

해제할 때는 현재 파일의 변경을 확인·백업하고 해당 도구의 디렉터리만 자동 발견 경로 밖으로 보존합니다. 다른 플러그인·사용자 설정은 건드리지 않습니다. 파일 감시로 인한 재로드가 진행 중인 세션에 영향을 줄 수 있으므로 적용 시점은 운영자가 결정합니다.

`scripts/session-audit.mjs`도 `global/plugins/ksi-session-evidence/core.mjs`를 사용하므로 저장소 배포 시 두 파일을 함께 포함해야 합니다. 호출 방식과 개인정보·순서·증거 한계는 [기능 목록과 세션 실행 증거](workflow-evidence.md)를 따릅니다.

## 선택: 스킬·외부 플러그인

외부 스킬·플러그인은 **공식 설치·업데이트 도구와 기본 배치**를 유지합니다. 하네스가 원문·실행기·hook을 재작성하거나 별도 경로로 합치지 않습니다. 이 저장소에는 외부 스킬이 번들되지 않으므로 clone/pull만으로 다른 컴퓨터에 설치되지는 않습니다.

| 위치 | 용도 |
| --- | --- |
| `~/.agents/skills/` | skills CLI 등의 공용 설치 위치; 도구별 연결·사본은 설치기가 관리 |
| `~/.config/opencode/skills/` | OpenCode 전역 스킬; 공식 설치기의 제공자별 배치 유지 |
| `~/.claude/skills/`, `~/.gemini/skills/`, `~/.github/skills/` | 각 제공자용 공식 배치; 같은 스킬의 여러 사본도 정상 |
| `<프로젝트>/.opencode/skills/` | 프로젝트 범위 설치; 채택한 설치 방식에 따라 버전·공유 관리 |

- 공식 설치기가 만든 제공자별 사본·심볼릭 링크·명령·hook은 단순 중복으로 보고 지우지 않습니다. OpenCode가 같은 ID의 여러 소스를 발견하면 우선순위에 따라 하나를 선택하며, 설치 사본 수가 모델의 중복 로드 수는 아닙니다.
- 복사·링크 방식도 공식 설치기를 따릅니다. 현재 `playwright-cli`의 패키지 링크는 유지하며, 경로를 수동으로 통합하지 않습니다.
- 설치기 관리 기록(`~/.agents/.skill-lock.json` 등)과 라이선스를 보존합니다. 이전의 “전부 수동 사본”, “같은 ID는 한 곳에만” 안내는 제공자별 배치와 관리 기록을 충분히 확인하지 않은 설명이므로 정정합니다.
- 호환성·권한·보안 충돌은 실제 문제를 확인한 뒤 공식 설정·옵션으로 해결합니다. 업데이트가 복원한 hook을 자동 제거하거나 다른 도구의 설정을 덮어쓰지 않습니다.
- `autoinvoke`는 자동 실행 스위치가 아니라 모델의 선택 목록 노출 여부입니다. 생략하면 기본 노출되며, `metadata.opencode/autoinvoke: false`여도 `@skill-id`나 명시적인 skill 도구 호출로 불러올 수 있습니다. 별도 명시 선택 전용 스킬의 사용 조건은 유지합니다.

공통 `AGENTS.md`는 Build·Lead·General 등 담당 에이전트가 일반 요청에서도 필요한 스킬을 직접 선택하도록 안내합니다. 명령을 대신 실행하는 구조가 아니라 Native `skill({ id: ... })`를 사용합니다. 디자인에서는 흐름·정보 구조·배치와 시각 마감·문구·모션·접근성을 구분해 필요한 관점만 조합하고, 기술 작업도 진단·성능·보안·계약 변경에 맞춰 선택합니다. 외부 스킬 원문이나 프로젝트별 문서는 일괄 수정하지 않습니다.

### 갱신 경로

| 설치 주체 | 갱신 방법 |
| --- | --- |
| Impeccable | 사용자 전역 설치 위치에서 공식 `npx impeccable update`; 제공자별 파일·엔진·hook은 설치기가 관리 |
| skills CLI로 설치한 스킬 | 공식 `npx skills update -g` 또는 대상 스킬 지정; 관리 기록의 소스·고정 ref가 적용되므로 새 릴리스로 이동하려면 공식 `skills add`로 선택한 ref를 갱신 |
| Playwright CLI의 스킬 | 패키지 관리자로 `npm update -g @playwright/cli`; Node 설치 위치 변경 시 공식 설치·스킬 연결 안내로 재확인 |
| ai-memory | 데이터·설정 백업 후 공식 `ai-memory upgrade`, ai-memory 서비스 재시작·확인. 하네스 설치기는 기준 버전보다 최신인 바이너리를 낮춰 설치하지 않음. [상세](ai-memory.md#업데이트) |
| 직접 복사한 외부 원본 | 원래 출처의 업데이트·설치 방법 사용; 관리 도구에 등록되지 않은 사본까지 자동 갱신된다고 가정하지 않음 |
| 로컬 통합 가이드 | `mobbin-design` 등은 공식 배포본의 자동 갱신 대상이 아님; 외부 원본 도입과 구분 |

**skills 1.7.4 주의:** 문서에서는 `skills check`를 확인 전용으로 설명하지만, 확인한 설치본의 dispatch는 `check`를 `update`와 같은 경로로 보냅니다. 읽기 전용 조사에서 `check -g`를 실행하지 않습니다. 조사에는 관리 기록·원본 Git 트리·패키지 메타데이터를 사용합니다. 실제 갱신은 사용자 승인 후 `update -g -y`로 실행했습니다. 버전별 CLI의 동작을 확인하고 사용하세요. [공식 명령 안내](https://github.com/vercel-labs/skills/blob/main/docs/commands.md).

## 선택: ai-memory 전역 기억

에이전트 간 장기 기억이 필요하면 ai-memory를 별도 계층으로 연결할 수 있습니다. 하네스의 역할·제품 정본을 대체하지 않습니다.

```sh
node scripts/install-ai-memory.mjs
node scripts/install-ai-memory.mjs --verify
```

- OpenCode·Claude Code·Codex에 MCP와 lifecycle hook을 연결합니다.
- 포트 `49375`, 데이터 `~/.local/share/ai-memory`, systemd 사용자 서비스를 사용합니다.
- **allowlist:** `.ai-memory.toml`이 있는 저장소만 수집합니다.
- cloud LLM·임베딩·프로젝트 간 profile·자동 압축은 끕니다.
- Codex는 새 hook을 한 번 신뢰해야 합니다. Claude Code는 MCP 사용 전 로그인이 필요할 수 있습니다.

수동 병합 때는 기존 `mcp.servers.ai-memory` 항목을 유지하세요. 전체 교체로 해당 항목이 사라졌다면 이후 `node scripts/install-ai-memory.mjs`를 다시 실행해 복원하세요. 프로젝트 마커, 보안 한계, 해제 방법은 [ai-memory 안내](ai-memory.md)를 참고하세요.

## 더 보기

- [문서 안내](README.md)
- [프로젝트 지식과 상태](project-knowledge.md)
- [검증과 한계](validation.md)
- [2026-10-26 설치 이력](archive/2026-10-26/installation-history.md)
- [퇴역 OpenSpec 기록](archive/openspec-2026-10-26/README.md)
