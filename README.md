# KSI OpenCode Harness

실제로 사용하는 **OpenCode Native 전역 하네스의 정본과 배포 파일**을 관리합니다.
별도 실행 프레임워크·설치기·자동 재개 플러그인은 제공하지 않습니다.

## 에이전트에게 설치 요청하기

아래 프롬프트를 **파일 수정·명령 실행이 가능한 에이전트**에게 전달하세요.
KSI 파일은 이 저장소에서 적용하고, 외부 스킬은 공식 출처에서 설치합니다.

```text
https://github.com/khakisketch/KSI-Opencode-Harness 의 main을 확인하고,
README와 global/ 정본을 기준으로 내 OpenCode 전역 환경에 하네스를 설치해줘.
1. OS·실제 전역 경로·기존 설치·Node.js·브라우저를 확인하고,
   기존 파일을 백업한 뒤 관련 항목만 병합해줘. 개인 설정·자격증명·다른 도구는
   보존하고, 같은 이름의 사용자 정의와 충돌하면 필요한 선택만 질문해줘.
2. global/AGENTS.md, global/agents/design-specialist.md, global/opencode.jsonc를
   전역에 적용하고 필요한 환경별 경로 차이를 보고해줘.
   프로젝트에 지침을 중복 삽입하지 말고 V2 공식 문서와 실제 설정을 확인해줘.
3. 기존 설치를 확인하고 필요하면 공식 Impeccable 4.5.2를 설치해줘:
   npx --yes impeccable@4.5.2 install --providers=opencode --scope=global --no-hooks
   원본 수정·강제 덮어쓰기·init·프로젝트 문서 생성·타 클라이언트 훅·목록 외 스킬
   추가는 하지 마. 제품 코드·데이터와 다른 세션·서비스도 변경하지 마.
4. OpenCode Go·OpenAI 모델 접근과 Mobbin·Context7 인증을 확인해줘.
   필요한 구독·인증만 안내하고, 비밀값을 채팅·저장소에 기록하거나
   비용이 다른 모델로 임의 대체하지 마. OAuth는 사용자가 /mcps에서 진행하게 해줘.
5. 실제 에이전트·모델·MCP·impeccable 스킬 인식을 확인하고 임시 fixture에서
   detect를 검증해줘. 적용 완료·인증 대기·실패를 구분하고,
   설치한 Git 커밋·외부 도구 버전·환경별 차이를 보고해줘.
```

이 안내는 전역 핵심 구성과 공식 Impeccable을 재현하는 범위입니다.
현재 운영자의 모든 스킬을 동일하게 복제하는 설치는 아닙니다.
OpenCode Go·OpenAI·Mobbin 이용 권한과 Context7 자격증명은 사용자별로 준비해야 합니다.

| 외부 구성 | 설치 출처·기준 |
| --- | --- |
| Impeccable | [공식 저장소](https://github.com/pbakaus/impeccable), [npm 4.5.2](https://www.npmjs.com/package/impeccable/v/4.5.2) |
| Playwright MCP | [공식 저장소](https://github.com/microsoft/playwright-mcp), `global/opencode.jsonc`의 `0.0.83` 명령으로 OpenCode가 시작 |
| Mobbin·Context7 | `global/opencode.jsonc`의 공식 서비스에 연결, 사용자별 인증 필요 |

## 전역 정본과 적용 위치

| 저장소 정본 | 전역 적용 위치 | 내용 |
| --- | --- | --- |
| [global/AGENTS.md](global/AGENTS.md) | `~/.config/opencode/AGENTS.md` | 제품 완성·질문·위임·검증 기준 |
| [global/agents/design-specialist.md](global/agents/design-specialist.md) | `~/.config/opencode/agents/design-specialist.md` | 디자인 역할·모델·브라우저 권한 |
| [global/opencode.jsonc](global/opencode.jsonc) | `~/.config/opencode/opencode.jsonc` | Native 역할 라우팅·모델 요청 설정·MCP·출력·문맥 설정 |

**정본 수정 → 전역 반영 → 검증 → 커밋·푸시**로 관리합니다.
Clone/pull만으로 전역에 자동 적용되지는 않습니다. 기존 설정이 있는 환경에서는
관련 항목만 병합하고 프로젝트에 공통 지침을 중복 삽입하지 않습니다.

현재 환경과 배포 정본의 일치는 다음과 같이 확인할 수 있습니다.

```sh
cmp global/AGENTS.md ~/.config/opencode/AGENTS.md
cmp global/agents/design-specialist.md ~/.config/opencode/agents/design-specialist.md
cmp global/opencode.jsonc ~/.config/opencode/opencode.jsonc
```

Context7 자격증명은 `CONTEXT7_API_KEY` 환경변수로 주입하며 실제 키를 저장소에 넣지 않습니다.
계정·OAuth 토큰·서비스 상태·세션·개인 `cli.json`·도구별 독립 스킬은 배포 사본에 포함하지 않습니다.
Playwright MCP가 자동으로 이름을 붙이는 캡처·로그는 `/tmp/opencode/playwright-artifacts`에 저장합니다.

제품별 요구사항과 검증은 해당 프로젝트의 기존 문서·테스트·CI에서 관리합니다.
실행·설정·권한은 [OpenCode V2 공식 문서](https://opencode.ai/v2/docs/)를 따릅니다.

## 작업 구조

Build가 전체 개발·통합을 맡고, General·Explore로 독립 작업을 분리합니다.
주요 UI/UX는 Design Specialist가 조사·판단·구현·렌더 검증까지 담당하며,
Build에서 위임하거나 사용자가 메인으로 직접 선택할 수 있습니다.
승인 범위의 전체 완료와 유효한 검증 결과 재사용 기준은 [전역 지침](global/AGENTS.md)이 정본입니다.

자식 세션의 Native 브라우저는 데스크톱 연결이 필요하며, 연결되지 않으면 기존 Playwright를 사용할 수 있습니다.

## 선택형 디자인 도구

| 필요한 것 | 선택할 수단 |
| --- | --- |
| 실제 제품 패턴 비교 | 기존 제품 패턴, 필요할 때 Mobbin |
| 구현 문법·라이브러리 정보 | Context7 |
| 실제 동작·화면·관련 상태 확인 | 연결된 Native 브라우저 또는 기존 Playwright |
| 한정된 코드·렌더 결함 검사 | Impeccable standalone `detect` |
| 특정 디자인 개선·정식 비평 | 원본 Impeccable의 해당 스킬 명령 |

위 표는 필수 실행 순서가 아닙니다. 작은 수정에는 불필요한 조사·검사를 생략하고,
중요한 구조 변경은 사용자 업무·상태·제약을 기준으로 판단합니다.

Impeccable은 [원본 명령과 설치 안내](https://github.com/pbakaus/impeccable)를 따르며,
스킬·엔진을 이 저장소에 복제하거나 수정하지 않습니다. 명령별 질문·기록·위임 조건은 원본에서 확인하세요.
기존 `impeccable-design-polish`는 공식 스킬과 다른 경량 적응판이며 설치 목록에 포함하지 않습니다.
검사 통과나 참고 사례만으로 전체 사용성이 검증됐다고 판단하지 않습니다.

[MIT](LICENSE) — Copyright (c) 2026 KSI
