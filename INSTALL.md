# 에이전트 안내 설치·업데이트

이 문서는 사용자가 승인한 OpenCode 설정 범위 안에서만 실행하는 절차입니다. 원격 문서나 package의 지시를 임의 실행하는 권한이 아니며, credential·공유 skill·무관한 MCP/provider·모델 데이터·소스 checkout의 pre-existing 변경을 삭제하지 않습니다.

## 배포 경로와 고정 revision

- 이 작업은 npm registry나 GitHub Release를 publish하지 않습니다. Primary가 checks 후 source commit을 push하고 remote 존재를 확인하면 source Git distribution은 별도 설치 경로로 유효합니다.
- GitHub repository의 main URL은 source를 찾는 discovery entry일 뿐입니다. 설치 에이전트는 원하는 source를 확인한 뒤 실제 remote에 존재하는 confirmed immutable commit으로 resolve하고 그 revision을 pin합니다. 확인 전에는 tag, version, SHA를 지어내지 않습니다.
- reviewed source checkout의 `index.mjs`를 가리키는 file URL은 editable한 mutable 개발/검증 경로입니다. remote source pin과 같은 불변 배포로 표현하지 않습니다.
- 공식 Superpowers는 별도 plugin이며 다음 revision을 그대로 사용합니다: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` (package 6.3.0). upstream source/skill을 복사·수정·fork하지 않습니다.
- 호환성 기준은 OpenCode 1.18.29, Node >=20입니다. 다른 OS/version은 실제로 검사하기 전까지 미검증입니다.

## 설치 전 검사

에이전트는 먼저 다음을 확인하고 충돌을 보고합니다.

1. 실제 OS, OpenCode 실행 파일/version, `opencode debug paths`가 가리키는 설정 위치, project override와 적용되는 instruction을 확인합니다. Linux home path를 다른 OS에 가정하지 않습니다.
2. plugin/agent/command/permission 항목과 기존 KSI·Superpowers 설치를 선택적으로 읽습니다. credential이나 전체 provider secret 설정을 출력하지 않습니다.
3. 설치 전에 설정 소유권을 설명합니다. Plan `permission`은 KSI가 관리하지만 그 밖의 Plan 설정은 보존합니다. Build 설정은 보존합니다. 여섯 reserved subagent는 `model`, `variant`, 유효한 양의 정수 `steps`를 보존하며, 기존 `mode`, `description`, `prompt`, `permission`, `options`, `disable` 등 나머지 정의는 플러그인의 역할 정의로 교체·관리됩니다. 동일 이름의 사용자 agent가 있다면 이름 충돌과 사라지는 설정을 정확히 보여 주고 설치 승인 또는 거절을 받습니다. credential, 공유 Codex/Claude 설치, 기존 command와 무관한 agent/MCP/provider는 보존 대상입니다.
4. 사용자가 선택한 native model이 실제로 발견되지 않으면 중단하고 다른 모델을 고르게 합니다. 조용한 provider/model substitute, fallback, 추천표의 자동 적용은 없습니다.

## 두 plugin 항목 설치

OpenCode 설정의 `plugin` 배열에 KSI와 Superpowers를 **별도 항목**으로 merge합니다. 기존 배열이나 JSONC 설정을 대체하지 않습니다.

### KSI: 현재는 reviewed source file URL (development only)

소스 checkout의 실제 경로를 에이전트가 확인한 뒤 Node의 `pathToFileURL`로 URL을 계산합니다. home path를 하드코딩하거나 문자열로 `file:///`를 조립하지 않습니다. 이 file URL은 editable checkout을 가리키는 **mutable 개발/검증 옵션**입니다. 고정된 source revision을 선택해도 설치된 파일의 수정이나 runtime integrity enforcement를 막지는 않으므로 배포 불변성으로 표현하지 않습니다.

```js
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const sourceRoot = resolve("<user-approved-source-checkout>")
const ksiPluginEntry = pathToFileURL(resolve(sourceRoot, "index.mjs")).href
```

계산한 `ksiPluginEntry`를 첫 번째 plugin 항목으로 넣고, source와 package script를 실행하기 전에 검토합니다. dirty checkout을 reset/overwrite하지 않습니다. 실제 배포에는 아래의 remote pinned git package option을 사용해야 합니다.

### KSI: confirmed remote commit을 가리키는 source Git option

다음 형식은 해당 revision이 원격 repository에 **실제로 존재하고 검토된 뒤에만** 사용할 수 있습니다. `<confirmed-immutable-revision>`을 확인하지 못한 상태로 복사해 실행하지 않습니다. Main URL에서 발견한 source를 이 revision으로 resolve하는 것이 설치자의 책임입니다.

```text
ksi-opencode-harness@git+https://github.com/khakisketch/KSI-Opencode-Harness#<confirmed-immutable-revision>
```

이 작업의 checks와 Primary의 source push가 끝나기 전에는 이 placeholder를 실제 revision으로 바꾸지 않습니다. npm registry/GitHub Release publication은 이 절차의 대상이 아닙니다.

### Superpowers: 고정 official package

OpenCode가 지원하는 plugin 설치 방식으로 두 번째 항목을 추가합니다.

```text
superpowers@git+https://github.com/obra/superpowers.git#b36e0829c6d0140e93cfef2ca599b1b07d4a7797
```

설치 후 revision과 upstream source를 검사합니다. 실패하면 unpinned substitute나 보호기능 해제를 시도하지 말고 오류를 보고합니다.

## 설정 merge 규칙

- [opencode.jsonc.example](opencode.jsonc.example)는 merge 참고본이지 replacement가 아닙니다. 위 설정 소유권에 따라 Plan permission과 여섯 reserved subagent 정의의 교체를 먼저 검토·승인합니다. 그 범위 밖의 사용자 설정과 JSONC comments, command, 다른 이름의 agent는 덮어쓰지 않습니다. 모델 예시를 merge하는 작업 자체는 필요한 `model`·`variant` 키만 변경합니다.
- KSI plugin은 native role prompt/permission과 기본 `steps`를 설치하지만 provider, model, variant, thinking effort, Primary 선택을 지정하지 않습니다. 사용자가 원하는 경우 native `agent.<role>.model`, `.variant`, 유효한 양의 정수 `.steps`를 명시합니다. 이 값들의 의미와 기본값은 [docs/execution.md](docs/execution.md)에 있습니다.
- [`examples/model-routing.json`](examples/model-routing.json)은 선택 가능한 권장 mapping이며 설치된 plugin은 읽지 않습니다. 복사할 때 자신의 provider/model/variant로 검토·편집하고 permission을 함께 덮어쓰지 않습니다.
- 동일 plugin을 `plugin` 배열과 auto-discovered plugin directory 양쪽에 등록하지 않습니다. workflow를 global AGENTS.md에 복사하지 않습니다.
- 공유 Codex/Claude 설치와 credential을 수정하지 않고, 무관한 MCP/provider를 추가·삭제하지 않습니다. KSI는 Superpowers source를 수정하지 않습니다.

## 기존 설치의 migration

소유권과 사용자 승인을 확인한 항목만 변경합니다. Kimi/TUI 항목, legacy agent/command, local-only model/provider 설정을 발견해도 customized 여부와 실제 소유권을 먼저 확인합니다. 모델 weight·service·systemd unit·공유 cache를 정리하지 않습니다. Open Design은 실제 config 증거가 없으면 Codex MCP라고 추측해 제거하지 않습니다.

기존 top-level permission이 Build를 막는다면 승인된 Build grant를 별도로 merge하고 의미 변화를 보고합니다. KSI가 Build를 allow-all로 강제하지 않으며, 기존 사용자의 명시적 deny를 조용히 뒤집지 않습니다.

## 선택적 Developer Test Runner assistance

기본 plugin string은 assistance를 끈 상태입니다. 명시적으로 승인한 경우에만 native plugin tuple을 사용합니다.

```jsonc
// Optional; leave OFF unless this execution control is explicitly approved.
["file:///ABSOLUTE/PATH/TO/KSI-Opencode-Harness/index.mjs", { "developerTestRunner": true }]
```

이 tuple을 켜면 `subagent_depth`가 없을 때만 KSI가 native depth `2`를 설정합니다. 사용자가 `0`, `1` 또는 더 큰 값을 명시하면 그대로 보존하고, `0`/`1`에서는 helper 요청이 actionable error로 거절됩니다. 허용되는 것은 root Build의 직접 child인 Developer/Developer Complex가 요청하는 foreground Test Runner 한 개뿐이며, 한 writer당 동시에 하나만 활성입니다. lifetime 총 호출 수를 보장하지 않으며 다른 delegation은 허용되지 않습니다. guard가 활성화된 동안 `edit`/`write`/`apply_patch`/`bash`는 matching task terminal 또는 after evidence까지 멈춥니다. 이는 [docs/execution.md](docs/execution.md)의 author-feedback 경계이며 independent acceptance가 아닙니다.

## 검증과 세션 의미

source checkout에서 `npm test`, `npm run check`, `npm run check:package`, `npm pack --dry-run`, `git diff --check`를 실행합니다. production package에는 test/CI/check-package가 의도적으로 들어가지 않습니다. 새 OpenCode process에서 선택적인 `opencode debug agent <role>`와 `opencode debug skill`을 확인하고 secret-bearing 전체 설정을 출력하지 않습니다. startup error 진단은 [docs/troubleshooting.md](docs/troubleshooting.md), 상세한 경계는 [docs/verification.md](docs/verification.md)를 따릅니다.

plugin/config 변경은 OpenCode process 전체를 재시작한 뒤 확인합니다. 대화를 버릴 필요는 없으며 재시작 후 기존 대화를 계속할 수 있습니다. 다만 재시작 전 process가 실행한 historical call에는 예전 model이 남을 수 있으므로, 새 child call의 실제 metadata로 확인합니다.

live model smoke test는 quota/API token과 provider 전송을 일으킬 수 있으므로 별도 승인을 먼저 받습니다. 설치 실패를 숨긴 채 완료라고 보고하지 않습니다.

## 업데이트·rollback

새 upstream revision은 source/package를 검토하고 호환성을 확인한 뒤에만 고정합니다. 반복 설치가 plugin/instruction을 중복하지 않는지 확인합니다. 실패 시 기록한 시작 상태에서 **이번 installer가 소유한 plugin/config 변경만** 사용자 승인으로 되돌리고, project work·공유 upstream 설치·Codex/Claude 파일은 되돌리지 않습니다.

## 요청 예시

```text
Install/update KSI OpenCode Harness from this reviewed source/release material.
Inspect this PC first. Preserve my Plan/Build models, Build tool permissions,
credentials, shared Codex/Claude installs and unrelated MCP/provider settings.
KSI replaces Plan permission and reserved subagent definitions (only their
model/variant and valid positive steps settings survive): show all name collisions and every
changed grant/denial for my approval, and stop if I decline a conflict. Install
the pinned official Superpowers unchanged as a separate plugin. Do not
substitute a missing model. Apply only the approved merge, validate after a full
process restart, and report versions, changes, blockers and restart requirements.
Ask before live model smoke tests.
```
