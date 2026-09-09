# KSI OpenCode Harness

[![Check workflow](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml/badge.svg)](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml) · [MIT](LICENSE) · Node `>=20`

OpenCode의 native agent/task 그래프에 **계획·시각 디자인·구현·검증의 경계**를 더하는 플러그인입니다. 모델 서버나 독립 실행기가 아니며, 모델을 고르거나 자동 승격하지 않습니다.

> **설치는 검토한 Git commit에 고정하세요.** Git 소스 설치, npm registry 게시, GitHub Release는 서로 다른 배포 경로입니다. 이 안내는 확인 가능한 원격 소스 revision을 사용하며, npm 패키지나 Release가 게시되었다고 가정하지 않습니다.

Design 기능을 사용하려면 해당 기능이 포함된 revision인지 확인하세요. 위 CI 배지는 게시된 main 결과이며, 미커밋 변경을 검증하지 않습니다.

## 목차

- [에이전트로 설치](#에이전트로-설치)
- [사용 흐름](#사용-흐름)
- [Design Primary](#design-primary)
- [역할과 모델](#역할과-모델)
- [설정 소유권](#설정-소유권)
- [검증과 한계](#검증과-한계)
- [문서](#문서)

## 에이전트로 설치

설치 작업은 먼저 이 PC의 OpenCode 설정과 기존 설치를 읽고, 아래 경계를 확인한 뒤 사용자가 승인한 merge만 적용해야 합니다. [INSTALL.md](INSTALL.md)를 설치 에이전트에게 함께 전달하세요.

```text
Read INSTALL.md from the reviewed source or Git distribution. Inspect this PC first.
Install KSI OpenCode Harness and the pinned official Superpowers as two separate
OpenCode plugins. Preserve my Plan/Build models, Build tool permissions,
credentials, shared Codex/Claude installs, and unrelated MCP/provider settings.
Explain that KSI manages Plan permission and replaces the six reserved subagent
definitions, preserving each definition's model/variant and valid positive integer
native steps; preserve Plan's other settings and Build config.
Design is primary-only: preserve its native model preferences, and review its
managed prompt/permissions and scoped preview/UI paths before installation.
Show every name collision and changed grant/denial for my approval, and stop if I
decline a conflict. Do not substitute a missing model. Validate, restart the full
OpenCode process, continue the conversation if desired, and report the result.
Ask before any billable live model smoke test.
```

### 배포 경로와 고정

- GitHub repository URL은 원하는 source를 찾는 **discovery entry**입니다. 설치 에이전트는 원하는 source를 확인한 뒤 실제로 존재하는 immutable remote commit으로 resolve하고 그 revision을 pin해야 합니다. 문서에 SHA를 지어내거나 remote가 이미 갱신됐다고 쓰지 않습니다.
- 이 작업은 npm package나 GitHub Release를 게시하지 않습니다. Primary가 checks 후 source commit을 push하고 remote 존재를 확인하면, 그 source Git distribution은 유효한 설치 경로가 됩니다.
- source checkout의 `file:` URL은 editable한 **mutable 개발/검증 경로**입니다. 고정된 source revision의 runtime integrity를 대신하지 않습니다. 설치 형식과 rollback 경계는 [INSTALL.md](INSTALL.md)를 따릅니다.
- 공식 Superpowers는 KSI와 별도 plugin으로 설치하며, 다음 upstream revision을 그대로 pin합니다: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`.

## 사용 흐름

```text
Plan   -> Explore -> 계획/결정 -> (선택) Plan Reviewer -> Human 승인
Design -> 실제 artifact -> Human 시각 검토 -> 승인 handoff
Build  -> 작은 작업은 직접 수행
       -> Developer 또는 Developer Complex -> writer 종료
       -> Test Runner -> Reviewer -> Build의 독립 검증
```

위 그래프는 native `task` 호출의 읽기 쉬운 요약입니다. Design은 v1에서 incoming/outgoing `task`가 없으며, Plan과 Build도 `task(design)`을 호출하지 않습니다.

| 역할 | 실제 책임 |
| --- | --- |
| Plan | 범위·수용 기준을 정리하고 승인 가능한 계획을 작성합니다. 구현하지 않습니다. |
| Explore | 지정된 경로와 증거를 좁게 조사합니다. |
| Developer | 승인된 범위에서 소유한 경로를 구현하고 targeted verification을 실행합니다. |
| Developer Complex | 결합된 상태·계약·수리 작업을 담당합니다. |
| Test Runner | writer와 독립적으로 지정된 검사를 실행하고 실패를 분류합니다. |
| Reviewer | 실제 diff와 증거를 검토하며 승인이나 배포를 대신하지 않습니다. |
| Design Primary | 승인된 시각 작업의 실제 artifact를 만들고, v1에서는 `task`를 호출하지 않습니다. |

기본 graph는 일반 작업을 우회하거나 worker를 재귀 위임하지 않습니다. 작은 작업은 Build가 직접 수행하고, 복잡도와 독립 검증 필요에 따라 역할을 선택합니다. 명시적으로 켠 `developerTestRunner`만 좁은 예외이며, 자세한 조건은 [execution.md](docs/execution.md)에 있습니다. 권한·계약의 상세 내용은 [architecture.md](docs/architecture.md)에 있습니다.

`/complete`는 승인된 범위를 Build 그래프로 끝내라는 요청이고, `/review`는 실제 diff와 결과를 독립적으로 검토하라는 요청입니다. 둘 다 Human 승인이나 배포 승인이 아닙니다.

```text
/complete 승인된 범위 안에서 구현하고, writer 종료 후 테스트와 독립 검토 증거를 모아 결과를 보고해 주세요.
/review 현재 diff·관련 테스트 결과·변경 범위만 검토하고 결함·누락·미검증 경계를 보고해 주세요. 승인이나 배포는 하지 마세요.
```

### Design을 선택하는 시점

사용자는 `/models`에서 현재 **Plan / Design / Build Primary**의 native model/variant를 선택할 수 있습니다. 이 선택이 spawned child의 model을 자동으로 고정하지는 않습니다. child에 model이 필요하면 native `agent.<role>.model`/`variant`를 별도로 설정하고 실제 metadata를 확인하세요. KSI는 provider/model을 고르거나 대체하지 않습니다.

Build는 decomposition과 새 evidence마다 다음을 의미적으로 판단합니다.

- 기존 component/token/template를 따르는 작은 UI 수정은 Design loop 없이 진행합니다.
- hierarchy, interaction, reference fidelity가 미정이면 **누락된 결정·필요 evidence·영향 scope**를 사용자에게 보이고 Design으로 전환합니다. 그 UI에 의존하는 작업만 멈추고 독립 작업은 계속합니다.
- 승인된 prototype/source가 있으면 Developer가 실제 artifact와 tokens/components를 재사용합니다. 빈 방향을 새로 발명하지 않습니다.

material visual approval은 사용자가 실제로 읽은 rendered artifact의 `name@version`과 scope에만 묶입니다. renderer/image가 없으면 `NOT visually approved`로 남기며 source나 파일 존재를 approval로 해석하지 않습니다. 한 번 승인한 preview/browser scope 안의 refinement는 매번 재승인하지 않습니다. 실무 절차와 짧은 handoff는 [docs/design.md](docs/design.md)와 [examples/design-handoff.md](examples/design-handoff.md)를 참고하세요.

선택적 local browser 예시는 [examples/design.project.jsonc](examples/design.project.jsonc)에 있습니다. 공식 `@playwright/mcp@0.0.80`과 이미 설치된 Chrome으로 Linux에서 synthetic desktop `1280x800`/mobile `390x844`와 선택 state, no horizontal overflow를 실제 확인했지만, 이는 product approval이나 model/cost benchmark가 아닙니다. browser install은 별도 동의이며 `--allowed-origins`와 output path는 security/path sandbox가 아닙니다.

설정/plugin을 바꾼 뒤에는 **OpenCode process 전체를 재시작**해야 새 설정을 읽습니다. 대화를 버릴 필요는 없으며 재시작 뒤 기존 대화를 계속할 수 있습니다. 재시작 전 호출은 이전 plugin/role/model을 사용했을 수 있으므로 새 child call의 실제 metadata를 확인하세요.

## 역할·모델·실행 한도

이 플러그인은 provider, model, variant, thinking effort를 선택하거나 강제하지 않습니다. 사용자가 native role에 지정한 `model`, `variant`, 유효한 양의 정수 `steps`는 보존합니다. 생략한 `steps`에는 다음 native 기본값이 적용됩니다.

| 역할 | 호출자 | 기본 `steps` |
| --- | --- | ---: |
| `design` Primary | 사용자 선택 | 60 |
| `explore` | Plan, Build | 20 |
| `plan-reviewer` | Plan | 24 |
| `developer` | Build | 60 |
| `developer-complex` | Build | 80 |
| `test-runner` | Build | 16 |
| `reviewer` | Build | 32 |

`steps`는 native agent iteration/실행 step budget이며 provider token budget, thinking effort, nested-agent depth와 다른 값입니다. provider-specific variant/effort 지원과 한도는 보편 규칙이나 benchmark가 아닙니다. 일반적인 `high`/`medium` 선택에 model-specific `max`를 기본으로 강제하지 않습니다. 전체 의미와 선택 가능한 variant 발견 방법은 [execution.md](docs/execution.md)를 참조하세요.

설정을 명시할 때만 OpenCode native `agent` 항목에 필요한 키를 merge합니다. 지원되지 않는 model/variant는 magic prompt tag로 보정하지 않고 native 설정에서 발견·확인해야 합니다.

```jsonc
{
  "agent": {
    "developer": {
      "model": "provider/approved-model",
      "variant": "supported-variant"
    }
  }
}
```

설정하지 않은 역할은 OpenCode native inheritance를 따릅니다. 따라서 Primary의 비싼 모델을 물려받을 수도 있습니다. 비용·지연·데이터 경계를 확인하고 의도적으로 선택하세요. 모델을 바꿔도 role permission은 바뀌지 않으며 local-to-cloud fallback도 없습니다. 선택 가능한 mapping 예시는 [examples/model-routing.json](examples/model-routing.json)에서 확인할 수 있지만 설치된 plugin은 그 파일을 읽지 않습니다.

## 설정 소유권

| 영역 | 설치 시 의미 |
| --- | --- |
| Plan permission | KSI가 관리하는 값으로 교체됩니다. 설치 전 현재 grant/denial을 확인합니다. |
| 여섯 reserved subagent 정의 | KSI 역할 정의로 교체됩니다. 각 정의에서 `model`·`variant`와 유효한 양의 정수 `steps`만 보존하고, `mode`·`description`·`prompt`·`permission` 등 나머지는 관리합니다. |
| Plan의 기타 설정 | Plan `permission`은 KSI가 관리하지만 그 밖의 Plan 설정은 보존합니다. |
| Build config와 Build tool permission | 보존합니다. 승인 없이 allow-all로 바꾸지 않습니다. |
| 기존 agent 이름 충돌 | 사라지는 항목과 권한 변화를 보여 주고 승인 또는 중단합니다. |
| credential, provider/MCP, 공유 Codex/Claude 설치 | KSI가 수정하지 않습니다. 기존 설정 전체를 replacement하지 않습니다. |

`opencode.jsonc.example`는 replacement가 아니라 참고용 merge 예시입니다. 설치 후에는 KSI와 Superpowers를 별도 plugin 항목으로 유지하고, source checkout의 개발 script와 설치된 production package의 경계를 구분하세요.

## 검증과 한계

source checkout에서 개발·패키지 검사를 실행합니다:

```bash
npm run check
npm run check:package
git diff --check
```

`npm test`, `npm run check`, `npm run check:package`, `npm pack --dry-run`은 source checkout용입니다. 설치된 production package에 test, CI, `check-package`가 포함된다고 가정하지 않습니다. CI workflow의 matrix가 있어도 실제 실행 결과 없이 모든 OS·Node 조합의 통과를 주장하지 않습니다.

라우팅 audit은 local OpenCode DB의 `providerID`, `modelID`, `variant` metadata를 세는 관찰용 inventory입니다. 품질·비용·무료 실행·모든 task의 correctness를 인증하지 않습니다. strict 비교에는 사용자의 기대 routes 파일과 변경 후 timestamp를 실제 값으로 넣습니다.

```bash
npm run audit -- \
  '--routes=<path/to/user-expected-routes.json>' \
  '--since=<POST_CHANGE_ISO_TIMESTAMP>' --strict
```

대화 재시작, live model smoke, 다른 OS/PC, remote source publication, Human acceptance는 이 정적 검사로 검증되지 않습니다. live call은 quota/API token과 provider 전송을 일으킬 수 있으므로 별도 승인 없이는 실행하지 않습니다.

## 문서

- [INSTALL.md](INSTALL.md): 에이전트 설치, source Git pin, merge·migration 경계
- [docs/architecture.md](docs/architecture.md): native role graph와 책임
- [docs/design.md](docs/design.md): Design Primary, approval gate와 browser pipeline
- [docs/execution.md](docs/execution.md): steps, model/variant discovery, opt-in helper lifecycle
- [docs/verification.md](docs/verification.md): 검사, audit 의미, 미검증 경계
- [docs/troubleshooting.md](docs/troubleshooting.md): startup/session/provider 진단과 조사 기록
- [docs/releasing.md](docs/releasing.md): source push 이후의 수동 publication 절차
- [examples/design.project.jsonc](examples/design.project.jsonc): 좁은 Design edit path와 선택적 local MCP merge 예시
- [examples/design-handoff.md](examples/design-handoff.md): `NOT visually approved`로 시작하는 짧은 handoff template
