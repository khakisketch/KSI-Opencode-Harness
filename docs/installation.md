# 설치 안내

> **상태 (2026-10-27):** 전역 5개 역할과 공통 지침을 적용·검증했고 설치본 검사 **146/146**이 통과했습니다. 기본 하네스 파일은 정본과 일치합니다. ai-memory를 선택적으로 연결하면 `opencode.jsonc`에 `mcp.servers.ai-memory` 항목이 추가되어 정본과 바이트가 달라질 수 있으므로, 역할·권한은 설치본 검사로 확인합니다. [검증 근거와 한계](validation.md)

이 저장소는 전역 OpenCode 환경에 자동 설치되지 않습니다. clone/pull 후 아래 순서로 **기존 설정을 보존하면서** 적용하세요. 다른 컴퓨터·다른 프로젝트에는 별도 적용이 필요합니다.

## 적용 파일

| 저장소 | 전역 경로 | 역할 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 제품 이해·위임 중심 운영·제품 수용·안전 지침 |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 5개 역할, 깊이 3, 모델·권한, MCP 설정 |
| `global/agents/lead.md` | `~/.config/opencode/agents/lead.md` | 배정 과업 완결 책임자 프롬프트 |
| `global/commands/*.md` | `~/.config/opencode/commands/` | 선택형 `/ux-audit`·`/debug`·`/perf` 바로가기 |
| `global/plugins/ksi-visual-workflow/` | `~/.config/opencode/plugins/ksi-visual-workflow/` | 아래 전용 설치기로 적용하는 Native 시각 작업 어댑터 |

`global/opencode.jsonc`의 Context7·Mobbin MCP는 선택 기능입니다. API 키·OAuth 토큰·유료 구독은 사용자별이며 저장소에 포함되지 않습니다. 현재 정본은 사용자의 선택으로 Mobbin을 켜 두었으며, 사용하지 않으면 `disabled: true`로 끕니다. Mobbin 없이도 하네스는 동작합니다.

## 설치 전에

1. OpenCode V2가 설치되어 있고 `opencode --version`이 동작하는지 확인합니다.
2. 기존 `~/.config/opencode/`의 `AGENTS.md`, `opencode.jsonc`, `agents/lead.md`와 같은 이름의 명령 파일을 백업합니다.
3. 같은 이름의 사용자 정의가 있으면 덮어쓰지 말고 차이를 확인합니다.
4. 진행 중인 세션은 강제 종료·전환하지 않습니다. 기존 세션의 저장된 모델·권한도 자동으로 바꾸지 않습니다.

```sh
BACKUP="$HOME/.config/opencode-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/agents" "$BACKUP/commands"
cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP/AGENTS.md"
cp -a "$HOME/.config/opencode/opencode.jsonc" "$BACKUP/opencode.jsonc"
cp -a "$HOME/.config/opencode/agents/lead.md" "$BACKUP/agents/lead.md"
cp -a "$HOME/.config/opencode/commands/." "$BACKUP/commands/" 2>/dev/null
echo "$BACKUP"
```

## 적용

```sh
# 저장소 루트에서 실행
cp global/AGENTS.md "$HOME/.config/opencode/AGENTS.md"
cp global/opencode.jsonc "$HOME/.config/opencode/opencode.jsonc"
cp global/agents/lead.md "$HOME/.config/opencode/agents/lead.md"
mkdir -p "$HOME/.config/opencode/commands"
cp global/commands/*.md "$HOME/.config/opencode/commands/"

# 기존 사용자 파일을 보호하는 전용 설치기
node scripts/install-visual-workflow.mjs
node scripts/install-visual-workflow.mjs --verify
```

이전 전문 역할(`engineer`, `design`, `research`, `critic`)과 OpenSpec 활성 구성은 **재설치하지 않습니다.** 이미 설치되어 있다면 진행 세션이 없는지 확인한 뒤 제거하고, 원본은 비공개 백업에만 보존합니다. 전체 역할 이전표와 과거 설치 프롬프트는 [설치 이력](archive/2026-10-26/installation-history.md)에 있습니다.

### 설치 요청 프롬프트

파일 수정과 명령 실행이 가능한 에이전트에게 다음을 전달할 수 있습니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.

1. OS·전역 경로·기존 설치·Node.js·OpenCode V2를 확인하고 기존 파일을 백업해줘.
   개인 설정·자격증명·다른 프로젝트·다른 도구는 보존하고, 같은 이름의 사용자 정의와
   충돌하면 덮어쓰지 말고 차이를 보고해줘.
2. global/AGENTS.md, global/opencode.jsonc, global/agents/lead.md, global/commands/*.md를 적용해줘.
   시각 작업 어댑터는 node scripts/install-visual-workflow.mjs로 적용하고 --verify로 확인해줘.
   이전 engineer/design/research/critic 역할과 OpenSpec 활성 구성은 재설치하지 말고,
   진행 세션이 없을 때만 기존 파일을 백업 후 제거해줘.
3. 기존 세션의 모델·권한은 강제로 바꾸지 말고, 서비스·다른 프로젝트·운영 환경은
   재시작하거나 변경하지 마.
4. 아래 검증 명령을 실행하고, 기본 정본/설치본 일치(ai-memory 선택 항목 제외)·실패·미확인을 구분해 보고해줘.
```

## 확인

```sh
# 공통 지침·Lead·명령은 정본과 바이트 일치
for f in AGENTS.md agents/lead.md; do
  cmp "global/$f" "$HOME/.config/opencode/$f" && echo "OK $f"
done
for f in global/commands/*.md; do
  cmp "$f" "$HOME/.config/opencode/commands/$(basename "$f")" \
    && echo "OK commands/$(basename "$f")"
done

# opencode.jsonc는 ai-memory 연결 시 선택 항목이 추가될 수 있습니다.
# 기본 정본과 비교하려면 ai-memory 항목을 제외하거나 아래 설치본 검사를 사용하세요.

# 설치본 5개 역할 등록·모델·권한·본문 검사 (모델 호출 없음)
node tests/agent-routing-native.mjs

# 격리 Native 서버 위임·복구·병렬·세션 제한 통합 검사 (로컬 fixture 모델)
node tests/delegation-native-integration.mjs

# 시각 도구와 Native 스킬 attachment·이미지·권한 전달 (실제 품질 평가 아님)
node tests/visual-workflow-native.mjs
```

- 설치본 검사는 **146/146**, 격리 Native는 **362/362**를 기준으로 확인합니다.
- 검사 통과는 라우팅·권한·지침 전달의 증거이지, 모델의 디자인 판단력이나 실제 제품 완주를 인증하지 않습니다.
- 문제가 있으면 백업을 되돌리고, 설치본·세션·서비스 상태를 구분해 보고합니다.

## 되돌리기

```sh
# 위에서 만든 BACKUP 경로를 사용
cp -a "$BACKUP/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
cp -a "$BACKUP/opencode.jsonc" "$HOME/.config/opencode/opencode.jsonc"
cp -a "$BACKUP/agents/lead.md" "$HOME/.config/opencode/agents/lead.md"
cp -a "$BACKUP/commands/." "$HOME/.config/opencode/commands/" 2>/dev/null
```

기존 세션의 모델·권한은 설치 전 값으로 자동 복원되지 않습니다. 필요한 경우 세션별 설정을 별도로 확인하세요.

### 시각 작업 어댑터

전용 설치기는 두 실행 파일과 해시 manifest만 관리하며, managed 업그레이드 전 백업하고 수정·미관리 파일과 symlink는 덮어쓰지 않습니다. `$XDG_CONFIG_HOME`도 지원합니다. 공식 외부 스킬은 번들하지 않으므로 필요 스킬은 아래 공식 경로로 별도 설치합니다. 파일 감시로 반영되며 서비스 재시작은 하지 않습니다.

해제·복원은 해당 `ksi-visual-workflow` 폴더만 발견 경로 밖에 보존한 뒤 필요 버전을 복원합니다. 외부 스킬·다른 plugin은 유지합니다. 도구 입력, 보안 경계, PNG 보관과 receipt 무효화는 [시각 작업 도구](visual-workflow.md)에 정리했습니다.

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

하네스의 `global/opencode.jsonc`를 다시 적용하면 ai-memory 선택 항목이 빠지므로, 이후 `node scripts/install-ai-memory.mjs`를 다시 실행하세요. 프로젝트 마커, 보안 한계, 해제 방법은 [ai-memory 안내](ai-memory.md)를 참고하세요.

## 더 보기

- [문서 안내](README.md)
- [프로젝트 지식과 상태](project-knowledge.md)
- [검증과 한계](validation.md)
- [2026-10-26 설치 이력](archive/2026-10-26/installation-history.md)
- [퇴역 OpenSpec 기록](archive/openspec-2026-10-26/README.md)
