# 설치 안내

이 저장소는 개인 전역 OpenCode 환경에 자동 설치되지 않습니다. 설치 전 대상 환경과 기존 파일을 확인하고, 사용자 설정과 자격증명을 보존하면서 관련 항목만 적용하세요.

## 적용 파일

| 저장소 파일 | 전역 적용 위치 | 용도 |
| --- | --- | --- |
| `global/AGENTS.md` | `~/.config/opencode/AGENTS.md` | 공통 작업·완료 지침 |
| `global/agents/design-specialist.md` | `~/.config/opencode/agents/design-specialist.md` | Design Specialist 역할·권한 |
| `global/opencode.jsonc` | `~/.config/opencode/opencode.jsonc` | 에이전트 설정·MCP 연결 등 |
| `global/plugins/ksi-impeccable-detector/` | `~/.config/opencode/plugins/ksi-impeccable-detector/` | 제한된 UI 소스 검사 플러그인 |

## 설치 요청 프롬프트

파일을 수정하고 명령을 실행할 수 있는 에이전트에게 다음 요청을 전달할 수 있습니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.
1. OS·실제 전역 경로·기존 설치·Node.js·브라우저를 확인하고,
   기존 파일을 백업한 뒤 관련 항목만 병합해줘. 개인 설정·자격증명·다른 도구는
   보존하고, 같은 이름의 사용자 정의와 충돌하면 필요한 선택만 질문해줘.
2. global/AGENTS.md, global/agents/design-specialist.md, global/opencode.jsonc를
   전역에 적용하고 필요한 환경별 경로 차이를 보고해줘.
   global/plugins/ksi-impeccable-detector/도 전역 plugins/에 적용해줘.
   OpenCode V2가 자동 발견하므로 중복 plugins 등록이나 npm 설치는 하지 마.
   프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
3. 기존 Impeccable 설치를 확인하고, 새 설치나 명시적 갱신이 필요할 때만
   공식 npm `latest` 태그를 사용해줘. 명령은 다음과 같아:
   npx --yes impeccable@latest install --providers=opencode --scope=global --no-hooks
   실제로 해결된 버전과 공식 출처를 기록하고 detect와 Native 연동을 검증해줘.
   기존 설치가 확인한 latest와 같으면 재설치하지 마. 버전 번호를 고정 요구하지 말고,
   매 작업마다 자동 업데이트하지 마. 최신 배포본의 자동 훅 지원은 확인 없이 단정하지 마.
   Intent는 아래 공식 1.7.1 출처에서 journey·organize·wireframe만 전역 설치하고,
   각 스킬의 원본 참고 자료도 보존해줘. --all·6개 에이전트·추가 훅은 설치하지 마.
   기존 스킬·전역 lock을 확인하고 충돌이 없을 때 아래 선택 설치 명령을 적용해줘.
   원본 수정·강제 덮어쓰기·init·프로젝트 문서 생성·타 클라이언트 훅·목록 외 스킬
   추가는 하지 마. 제품 코드·데이터와 다른 세션·서비스도 변경하지 마.
4. 연결된 데스크톱에서는 Native Browser, 연결되지 않은 자식·헤드리스 환경이나 반복 자동화에는
   Playwright CLI를 사용할 수 있게 확인해줘. 기존 CLI·Chrome·원본 playwright-cli 스킬을 재사용하고,
   CLI가 없을 때만 공식 @playwright/cli@0.1.22 설치를 검토해줘. 프로젝트 init이나 테스트 의존성
   교체는 하지 말고 Playwright MCP·agent-browser를 기본 도구로 추가하지 마.
5. OpenCode Go·OpenAI 모델 접근과 Context7 인증을 확인해줘.
   Mobbin은 유료 외부 서비스이므로 기본 비활성으로 두고, 필요할 때만 사용자가
   활성화·인증하도록 안내해줘. 필요한 구독·인증만 안내하고, 비밀값을 채팅·저장소에
   기록하거나 비용이 다른 모델로 임의 대체하지 마. OAuth는 사용자가 /mcps에서 진행하게 해줘.
6. 실제 에이전트·모델·MCP·impeccable 및 Intent 3개 스킬 인식과 참고 자료를 확인하고 임시 fixture에서
   detect와 변경 파일 자동 검사 훅을 검증해줘. 적용 완료·인증 대기·실패를 구분하고,
   설치한 Git 커밋·외부 도구 버전·환경별 차이를 보고해줘.
```

## 외부 도구 출처

| 도구 | 공식 출처와 설치 범위 |
| --- | --- |
| Impeccable | [공식 저장소](https://github.com/pbakaus/impeccable), [npm 패키지](https://www.npmjs.com/package/impeccable). 전역 OpenCode 설치 시 공식 npm `latest`를 확인합니다. 2026-10-15 확인 당시 `latest`와 현재 설치본은 [4.5.2](https://www.npmjs.com/package/impeccable/v/4.5.2)였으며, 이 버전은 고정 요구가 아닙니다. |
| Intent | [공식 v1.7.1](https://github.com/ghaida/intent/tree/v1.7.1)에서 `journey`·`organize`·`wireframe`과 각 스킬의 원본 참고 자료만 선택 설치합니다. |
| Playwright CLI | [공식 저장소 및 원본 스킬](https://github.com/microsoft/playwright-cli). 기존 `@playwright/cli` 0.1.22를 재사용하며, Playwright MCP는 기본 구성에서 제거했습니다. |
| Context7 | [Context7](https://mcp.context7.com/mcp) 원격 서비스에 연결합니다. 사용자별 계정 인증이 필요합니다. |
| Mobbin(선택) | [Mobbin](https://api.mobbin.com/mcp)은 유료 외부 서비스라 기본 비활성으로 두고, 필요할 때 사용자가 활성화·인증합니다. |

저장소 정본은 Mobbin을 기본 비활성으로 둡니다. 설정 입력에서는 `"enabled": false`를 사용하고, 필요할 때 `"enabled": true`로 바꾼 뒤 인증합니다.

Intent 선택 설치 명령(POSIX 셸):

```sh
DO_NOT_TRACK=1 npx -y skills@1.7.2 add https://github.com/ghaida/intent/tree/v1.7.1 --skill journey --skill organize --skill wireframe -g -a opencode -y --copy
```

현재 공식 CLI는 선택한 세 스킬을 `~/.agents/skills/`에 설치하며 OpenCode가 전역 호환 소스로 인식합니다. 공유 스킬 위치와 `~/.agents/.skill-lock.json`의 기존 항목을 보존하고 중복 설치하지 않습니다. 저장소는 Intent 원본을 복제하지 않으며 `wireframe`의 CSS·JS·스타일가이드도 원본과 함께 설치합니다.

## 전역 파일 일치 확인

적용 후 저장소 파일과 전역 파일을 비교하려면 다음 명령을 사용합니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/design-specialist.md ~/.config/opencode/agents/design-specialist.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
diff -r global/plugins/ksi-impeccable-detector ~/.config/opencode/plugins/ksi-impeccable-detector
```

Context7 키는 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키·OAuth 토큰·개인 `cli.json`은 저장소에 기록하지 않습니다. 필요한 서비스 인증은 사용자별로 진행하고, OAuth는 사용자가 OpenCode의 `/mcps`에서 처리합니다. 구성·서비스 상태·독립적인 개인 스킬은 전역 설정 사본에 포함되지 않습니다.
