# 설치 안내

> **상태 (2026-10-27):** 전역 5개 역할과 공통 지침을 적용·검증했고 설치본 검사 **146/146**이 통과했습니다. 기본 하네스 파일은 정본과 일치합니다. ai-memory를 선택적으로 연결하면 `opencode.jsonc`에 `mcp.servers.ai-memory` 항목이 추가되어 정본과 바이트가 달라질 수 있으므로, 역할·권한은 설치본 검사로 확인합니다. [검증 근거와 한계](validation.md)

이 저장소는 전역 OpenCode 환경에 자동 설치되지 않습니다. clone/pull 후 아래 순서로 **기존 설정을 보존하면서** 적용하세요. 다른 컴퓨터·다른 프로젝트에는 별도 적용이 필요합니다.

## 적용 파일

| 저장소 | 전역 경로 | 역할 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 제품 이해·위임·제품 수용·안전 지침 |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 5개 역할, 깊이 3, 모델·권한, MCP 설정 |
| `global/agents/lead.md` | `~/.config/opencode/agents/lead.md` | 배정 과업 완결 책임자 프롬프트 |

`global/opencode.jsonc`의 Context7·Mobbin MCP는 선택 기능입니다. API 키·OAuth 토큰·유료 구독은 사용자별이며 저장소에 포함되지 않습니다. Mobbin은 기본 `disabled: true`이며 필요할 때만 활성화합니다. Mobbin 없이도 하네스는 동작합니다.

## 설치 전에

1. OpenCode V2가 설치되어 있고 `opencode --version`이 동작하는지 확인합니다.
2. 기존 `~/.config/opencode/`의 `AGENTS.md`, `opencode.jsonc`, `agents/lead.md`를 백업합니다.
3. 같은 이름의 사용자 정의가 있으면 덮어쓰지 말고 차이를 확인합니다.
4. 진행 중인 세션은 강제 종료·전환하지 않습니다. 기존 세션의 저장된 모델·권한도 자동으로 바꾸지 않습니다.

```sh
BACKUP="$HOME/.config/opencode-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP/agents"
cp -a "$HOME/.config/opencode/AGENTS.md" "$BACKUP/AGENTS.md"
cp -a "$HOME/.config/opencode/opencode.jsonc" "$BACKUP/opencode.jsonc"
cp -a "$HOME/.config/opencode/agents/lead.md" "$BACKUP/agents/lead.md"
echo "$BACKUP"
```

## 적용

```sh
# 저장소 루트에서 실행
cp global/AGENTS.md "$HOME/.config/opencode/AGENTS.md"
cp global/opencode.jsonc "$HOME/.config/opencode/opencode.jsonc"
cp global/agents/lead.md "$HOME/.config/opencode/agents/lead.md"
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
2. global/AGENTS.md, global/opencode.jsonc, global/agents/lead.md를 적용해줘.
   이전 engineer/design/research/critic 역할과 OpenSpec 활성 구성은 재설치하지 말고,
   진행 세션이 없을 때만 기존 파일을 백업 후 제거해줘.
3. 기존 세션의 모델·권한은 강제로 바꾸지 말고, 서비스·다른 프로젝트·운영 환경은
   재시작하거나 변경하지 마.
4. 아래 검증 명령을 실행하고, 기본 정본/설치본 일치(ai-memory 선택 항목 제외)·실패·미확인을 구분해 보고해줘.
```

## 확인

```sh
# 공통 지침·Lead는 정본과 바이트 일치
for f in AGENTS.md agents/lead.md; do
  cmp "global/$f" "$HOME/.config/opencode/$f" && echo "OK $f"
done

# opencode.jsonc는 ai-memory 연결 시 선택 항목이 추가될 수 있습니다.
# 기본 정본과 비교하려면 ai-memory 항목을 제외하거나 아래 설치본 검사를 사용하세요.

# 설치본 5개 역할 등록·모델·권한·본문 검사 (모델 호출 없음)
node tests/agent-routing-native.mjs

# 격리 Native 서버 위임·복구·병렬·세션 제한 통합 검사 (로컬 fixture 모델)
node tests/delegation-native-integration.mjs
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
```

기존 세션의 모델·권한은 설치 전 값으로 자동 복원되지 않습니다. 필요한 경우 세션별 설정을 별도로 확인하세요.

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
