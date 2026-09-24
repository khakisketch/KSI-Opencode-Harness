# Native role architecture

## 역할과 권한

Plan은 Human과 범위·수용 기준을 설계하고 합의합니다. Design은 승인된 시각 작업을 위한 독립적인 user-facing Primary이며 foreground local read-only `explore`와 `design-critic`에만 위임합니다. Reviewer는 plan-critique mode에서 중요한 계획을 독립적으로 비평하지만 승인하지 않습니다. Explore는 Plan·Build·Design이 공유하는 제한적 조사 역할이며 Design 호출에 승인권을 주지 않습니다. 숨은 `design-critic`은 foreground read-only 독립 critique이며 수정·승인하지 않고 PNG를 읽지 못하면 `BLOCKED-no-render`를 반환합니다. 별도 standing Architect는 없습니다. Build는 승인된 계획과 Design artifact의 구현·통합·완료를 소유합니다.

```text
Plan (peer Primary) -> Explore -> plan decisions -> (optional) Reviewer (plan-critique mode) -> Human agreement
Design (peer Primary) -> foreground explore + design-critic (read-only) -> rendered artifact -> Human visual review -> approved handoff
Build (peer Primary) -> Developer (including complex work) -> writer idle -> Test Runner -> Reviewer -> Build verification
Codex/Claude internal agent structures untouched.
```

Plan, Design, and Build are peer user-selected Primaries; Plan/Build dispatch workers, and Design dispatches only foreground local read-only explore plus design-critic with single-line artifact/version plus desktop/mobile PNG Evidence. Codex/Claude internal agent structures are untouched.

Plan/Build Primary가 native `task`로 역할을 호출하고, Design Primary는 foreground `explore`/`design-critic`에만 호출합니다. No Design → Research/external child, developer, task recursion, or Design as target. `design-critic`로의 dispatch는 artifact/version과 TWO workspace-relative PNG claim(desktop/mobile)을 한 줄 `Evidence:`에 담습니다. 기본값에서는 Plan은 구현 역할을 호출할 수 없고 worker는 다시 위임할 수 없습니다. 명시적으로 켠 `developerTestRunner`만 root Build의 직접 child인 Developer에서 foreground Test Runner로 이어지는 좁은 예외입니다. 호출자는 세션의 최신 `chat.params`로 확인하며 unknown caller는 거부합니다. 이는 native-tool 경계이지 OS sandbox가 아니며, 허용된 shell을 통한 임의 subprocess를 막는 장치도 아닙니다.

## Design sufficiency gate

Build는 decomposition과 새 evidence에서 시각 결정의 충분성을 의미적으로 판단합니다. 기존 pattern을 따르는 minor UI는 Design loop 없이 진행하고, material하게 미정인 hierarchy·interaction·reference fidelity는 누락된 결정, 필요한 evidence, 영향을 받는 scope를 사용자에게 제시한 뒤 Design 전환을 권합니다. 의존하는 UI만 일시 중지하며 독립 작업은 계속합니다. 승인된 prototype/source가 있으면 Developer는 실제 artifact, tokens, components, props/events/states를 재사용하고 대체 방향을 발명하지 않습니다. 이는 prompt/contract 판단이지 keyword classifier나 state machine이 아닙니다.

Material visual approval은 실제로 사용자가 검사한 rendered artifact의 이름/version/scope가 있어야 합니다. renderer나 image가 없으면 `NOT visually approved`로 남기며 source·code·파일 존재를 inspection으로 해석하지 않습니다. 상세한 browser evidence와 handoff 형식은 [design.md](design.md)와 [../examples/design-handoff.md](../examples/design-handoff.md)에 있습니다.

## 모델 설정: plugin은 선택하지 않음

런타임은 `ROLES`에 역할 이름, `CALLS`에 caller graph, 역할별 native `steps` 기본값을 공개합니다. 여섯 reserved subagent(explore, developer, test-runner, reviewer, research, design-critic)는 기존 `model`, `variant`, 유효한 양의 정수 `steps`를 보존하고, `mode`, `description`, `prompt`, `permission`, 기타 options 등 나머지 정의를 관리합니다. Plan은 `permission`만 교체하고 다른 설정은 보존합니다. Build는 coordinator-only Primary로, 사용자 `model`/`variant`/`steps`는 보존하되 product edit·shell grant는 bookkeeping-only permission으로 교체하고 직접 구현 시도를 hook에서 차단합니다. 같은 이름의 사용자 agent와 충돌하는지 설치 전에 확인해야 합니다. 플러그인은 어떤 provider/model/thinking effort도 할당하지 않습니다. model/variant와 provider-specific variant 지원은 사용자가 native 설정과 설치된 OpenCode에서 확인하며, 추천 mapping이나 magic prompt tag를 enforcement하지 않습니다.

사용자가 native `agent.<role>.model`, `.variant`, 유효한 양의 정수 `.steps`를 설정하면 그 값을 사용합니다. 생략한 steps에는 Build 200, Design 60, Explore 20, Developer 80, Test Runner 24, Reviewer 32, Research 20, Design-critic 20이 적용됩니다. 복잡한 Developer 작업은 기본 80 steps를 사용하며, handoff에 coupled state·concurrency·migration·deliberate repair 범위가 문서화된 경우에 한해 Build가 명시적 120-step 조건을 승인할 수 있습니다. 생략한 model/variant는 OpenCode의 native inheritance를 따르며 Primary의 비싼 모델을 물려받을 수도 있습니다(미지정 critic도 native를 물려받아 costly/non-vision일 수 있음). 설치자는 역할별 비용·지연·데이터 경계를 보고 의도적으로 선택해야 합니다. 모델/variant 미발견 시 자동 fallback이나 silent substitute는 없습니다. `steps`, provider token budget, thinking effort, `subagent_depth`, helper concurrency의 차이는 [execution.md](execution.md)에 정리되어 있습니다.

[`examples/model-routing.json`](../examples/model-routing.json)은 선택 사항인 portable sample이며 enforcement 대상이 아닙니다. 사용하려면 파일을 복사·편집하고 native `agent` 설정에 필요한 model/variant 키만 merge합니다. 기존 permission, Primary 설정, 다른 agent 키를 덮어쓰지 않습니다. 설치된 plugin은 예시 파일을 읽거나 자동 enforcement하지 않으며, quality/cost 우위도 주장하지 않습니다. Sample은 다섯 explicit model entries(explore, developer, test-runner, reviewer, research)만 예시하며 숨은 `design-critic`은 unpinned으로 native를 물려받습니다. Sample 내용은 machine-local routing과 다를 수 있으며, machine-local 선택은 portable default로 승격되지 않습니다.

## Superpowers와 workflow

공식 Superpowers는 `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`에 고정된 별도 plugin입니다. KSI는 upstream skill을 복사하거나 patch하지 않습니다. Superpowers의 general-agent mapping이 KSI의 role·permission·approval 경계를 덮어쓰지 않습니다. 사용자는 설치 전에 관리되는 permission 변경을 검토하고 충돌 시 거절할 수 있습니다.

Plan은 조사·설계·승인을, Build는 실행 조정·분업·증거 판정·완료 관리를 담당하며 product 구현은 항상 Developer에 위임하고 Test Runner/Reviewer 증거로 검증합니다. Research는 외부 버전 근거를 맡고, 통합 UI 충실도는 Reviewer visual-fidelity mode가 맡습니다. `/complete`와 `/review` 기본 command는 기존 command가 없을 때만 추가되며 Human 승인·배포 승인을 대신하지 않습니다.

## 소유권과 한계

한 shared worktree에는 한 writer만 둡니다. 병렬 구현은 명시적으로 분리된 worktree와 비중첩 소유권이 있을 때만 허용합니다. task contract 형식 검사는 구조를 확인할 뿐 실제 테스트의 진실성이나 Human acceptance를 보증하지 않습니다. permission read filter는 defense in depth이며 secret isolation이 아닙니다. local check와 reviewer 의견은 CI·배포·Human acceptance가 아닙니다.
