# Design Primary 실무 가이드

Design은 승인된 시각·제품 디자인을 위한 **독립적인 native Primary**입니다. 기본 graph의 subagent가 아니며 v1에서는 `task`를 호출하지 않습니다. Plan과 Build도 `task(design)`을 호출하지 않습니다. Build가 production 통합과 최종 검증을 소유합니다.

## 세션 선택

한 세션에서 현재 작업에 맞는 Primary를 사용자가 직접 선택합니다.

```text
/models                         # 현재 Primary의 native model/variant 선택
Plan   -> 범위·결정·수용 기준 정리
Design -> 승인된 시각 작업의 실제 artifact 제작·검토
Build  -> 승인 artifact를 production에 통합하고 검증
```

`/models` 선택은 현재 Primary/session의 native 선택입니다. spawned child의 model을 자동으로 고정한다고 말하지 않습니다. child routing이 필요하면 설치된 OpenCode가 지원하는 `agent.<role>.model`/`variant`를 사용자가 별도로 설정하고 실제 metadata로 확인합니다. 이 plugin은 provider, model, variant, temperature, top-p를 선택하거나 대체하지 않습니다.

## 언제 Design으로 전환하는가

Build는 decomposition 때와 새 evidence가 들어올 때 의미적으로 판단합니다.

| 상태 | Build의 다음 행동 |
| --- | --- |
| 기존 component/token/template를 그대로 따르는 작은 수정 | Design loop 없이 진행 |
| hierarchy, interaction, reference fidelity의 중요한 결정이 미정 | 누락된 결정·필요 evidence·영향 scope를 사용자에게 보여 주고 Design으로 전환 요청 |
| 이미 승인된 artifact와 props/events/states가 있음 | Developer가 그 실제 prototype/source를 재사용하도록 통합 |

미정인 시각 결정에 의존하는 UI 작업만 멈춥니다. 독립적인 backend, data, test, 문서 작업은 각 소유권 안에서 계속할 수 있습니다. Developer는 승인된 prototype과 실제 tokens/components를 재사용하며, 빈칸을 새 방향으로 발명하지 않습니다.

## Artifact와 승인

1. 실제 repository UI와 기존 pattern을 읽고, 승인된 scope에서 하나의 강한 concept를 먼저 만듭니다.
2. 중대한 UX trade-off가 있을 때만 2–3개 concept을 비교합니다. critical uncertainty에는 최소 질문만 합니다.
3. preview server, render/capture tool, browser/MCP와 scope는 한 번 승인받고, in-scope refinement마다 다시 묻지 않습니다.
4. material visual approval은 사용자가 실제로 검사할 수 있는 **rendered artifact의 이름/version/scope**에 묶습니다.
5. renderer/image가 없으면 기본 상태는 `NOT visually approved`입니다. source, code block, screenshot 파일의 존재만으로 visual inspection이나 approval을 추론하지 않습니다.

Handoff에는 긴 명세 대신 approved artifact/source/reproduction, 짧은 relevant props/events와 loading/empty/error/permission states, unresolved constraints, viewport/interaction acceptance만 담습니다. Build가 통합하고, integrated viewport/state를 다시 확인합니다. Prototype approval은 product acceptance나 배포 승인이 아닙니다.

## Ordered gates (OpenDesign-inspired, paraphrased)

Workflow adapted in our own words from OpenDesign concepts (Apache-2.0); no copied text. Run gates in order and do not prototype before gates 1–3 are locked.

1. Brief gate — collect user, purpose, density, exclusions. Ask on unknowns, never guess. Version the brief (for example `brief v1`) and cite that version in Evidence.
2. Token block prerequisite — list reused tokens/components first. No invented hex or ad-hoc palette. A missing token is an unresolved constraint, not a silent invention.
3. Aesthetic direction lock — record one explicit direction before prototyping. The prototype follows it; an alternative needs a new direction plus Human re-approval.
4. Hierarchy then prototype — settle hierarchy/layout first, then build the prototype with real content, real loading/empty/error/permission states, and responsive viewports.
5. Self-review checklist — confirm all states render, text contrast is readable, viewports 640/768/1024/1280 have no unintended overflow, and anti-AI-pattern rules hold: no indigo defaults, no purple-blue gradients, no emoji-as-icons.
6. Handoff then Human approval — fill the existing handoff format with artifact/version/scope, brief version, token block, and inspection evidence, then wait for Human approval. design-task Evidence must cite brief version plus token block.

Design의 기본 read/discovery에는 secret filter가 적용됩니다. 기본 preview는 **현재 OpenCode 작업 디렉터리의 `design-previews/`**이며 편집은 `ask`입니다. 플러그인은 이를 native worktree-relative 경로로 변환하므로 Git 하위 디렉터리나 비-Git 작업 폴더에서도 전체 경로를 넓히지 않습니다. checkpoint 예외는 기존 Git 작업 연속성 정책을 따릅니다. 사용자가 추가하는 project UI permission은 native worktree-relative 경로이며 자동 재해석하지 않습니다.

Shell, external directory, webfetch, Playwright 계열은 `ask`이고 task와 `playwright_browser_run_code_unsafe`는 마지막 `deny`로 유지됩니다. Root `allow`와 scalar edit `allow`는 허용하지 않습니다. Edit `allow`는 worktree-relative 경로여야 하며 절대 경로, drive/UNC 경로, 빈 경로 조각, `.`/`..` traversal은 거부합니다. Glob은 첫 wildcard 앞에 구체적인 디렉터리 범위가 있어야 하며(`src/components/**`), exact 상대 파일 경로도 사용할 수 있습니다. `**/**`, `*.tsx`, `Card*.tsx` 같은 root-level 패턴은 거부합니다. 이는 패턴의 범위 검사일 뿐 frontend 소유권이나 symlink 안전성을 증명하지 않습니다. 승인 범위 밖을 가리키는 symlink를 사용하지 말고 실제 위치를 먼저 확인해야 합니다.

Root `deny`/`ask`와 명시된 named tool/path override는 순서대로 적용됩니다. 이 permission은 OS/security sandbox가 아닙니다. Design의 model, variant, temperature, top_p, color 등 사용자 설정은 보존하고, KSI는 mode/description/prompt/permission을 관리하며 `steps`를 검증합니다(기본 60). Plan은 기존 관리 권한을 유지하고, Plan/Build 모델 및 Build 설정은 보존됩니다.

## 승인된 local browser pipeline

선택적 MCP 설정은 [`../examples/design.project.jsonc`](../examples/design.project.jsonc)에 있습니다. 이 예시는 model-free이며, 프로젝트의 **선택된 UI/story/style 경로만** `agent.design.permission.edit` 아래에 둡니다. `*.tsx` blanket grant, schema/auth/backend 경로는 넣지 않습니다.

현재 기록된 실제 검증은 Linux의 OpenCode 1.18.29에서 official `@playwright/mcp@0.0.80`을 pinned npx invocation으로 연결하고, 이미 설치된 official Chrome을 사용한 것입니다. MCP 연결과 browser launch, model image inspection은 서로 다른 증거입니다.

설치된 MCP package manifest도 확인했으며 install lifecycle hook은 없고 Playwright/core는 `1.63.0-alpha-2026-08-31`로 pin되어 있습니다. 이미 충분한 기존 renderer가 있으면 그것을 재사용하고 별도 renderer를 중복하지 않습니다.

```text
npx --yes @playwright/mcp@0.0.80
  --headless --isolated --block-service-workers --browser chrome
  --caps vision --image-responses allow
  --allowed-origins 'http://127.0.0.1:*;http://localhost:*'
  --output-dir design-previews/artifacts
```

이 pipeline은 browser를 자동 설치하지 않습니다. 지원되는 Chrome이 이미 설치되어 있어야 하며 browser install은 별도 사용자 동의입니다. `--allowed-origins`는 보안 boundary나 egress isolation이 아니고 redirect를 모두 포함하지도 않습니다. trusted local/synthetic page만 사용하고 personal profile, extension, credentials, public host, customer data는 사용하지 않습니다. `--output-dir`는 default output location일 뿐 path sandbox가 아닙니다. screenshot 도구에 workspace-relative `design-previews/artifacts/<name>.png`를 명시하고 agreed scope를 지킵니다.

첫 synthetic 검사는 desktop `1280x800`과 mobile `390x844`, horizontal overflow 없음, 선택 state 표시를 확인했습니다. 실제 Design Primary가 resize/navigate/screenshot/read/snapshot/click, mobile screenshot/read, close를 수행했고 task call이나 source change는 없었습니다. 별도 prototype 검사에서는 원본을 재사용해 허용된 제목·색상만 변경한 preview 파일을 직접 생성하고, 두 viewport를 다시 캡처·READ한 뒤 사용자 피드백 대기로 반환했습니다. Build가 실제 diff와 PNG를 확인했습니다. `screenshot`/`screenshotwithfilename` 결과는 text path를 반환할 수 있으므로 PNG를 직접 READ해야 합니다. 이는 도구·작업 경로 검증이지 product design approval이나 cost/model benchmark가 아닙니다.

## Handoff 시작점

[`../examples/design-handoff.md`](../examples/design-handoff.md)의 template을 복사해 artifact/version/scope를 먼저 채웁니다. material 작업은 `NOT visually approved`로 시작하고, 실제 PNG를 읽은 사용자 확인 뒤에만 `VISUALLY APPROVED`로 바꿉니다.

## Visual loop and review mode

Material UI must run the visual loop: render, capture desktop `1280x800` plus mobile `390x844`, READ each PNG via vision, list findings vs brief/tokens/direction, fix, then re-capture and re-read at least one full iteration (single verified capture suffices for established-pattern reuse); no handoff without it. The established-pattern exception is an existing approved artifact plus token-identical reuse with cited artifact version, else full loop. Require at least one intermediate capture plus READ when layout changes across breakpoints, else state why not applicable. `gpt_imagegen` outputs are mockups/assets only, never evidence.

Review mode is read-only and hook-enforced: Build requests it with `Mode: review` plus `Allowed write paths: none` (contract-validated; prototype requests need concrete paths and no `Mode:`). On task completion the hook records the child session from completion metadata and denies `edit`/`write`/`apply_patch`/`bash`/`task`/`lsp` from it under `DESIGN_REVIEW_PERMISSION` (`edit: * deny`, `lsp: deny`); `session.deleted` clears the marker. Enforcement needs the child session id in completion metadata. Compare the approved artifact plus brief version plus captures and return `VISUAL PASS`/`FAIL`/`BLOCKED-no-render`; it never replaces Human approval. Gate 6 waits for Human approval only on the user-facing Design primary; `design-task` returns its result instead of waiting.

Design and `design-task` hold `mobbin_*`, `gpt_imagegen`, and `context7_*` at `ask`; no other role gains `mobbin_*` or `gpt_imagegen`, and only research keeps its separate `context7_*` allow. `external_directory`: Design primary `ask`, `design-task` `deny` (review denies it).
