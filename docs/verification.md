# Verification and compatibility

## 범위

- 기록된 호환성 기준: OpenCode 1.18.29, Node >=20. 다른 version/OS는 실제 실행 전까지 미검증입니다.
- 이 문서/package version은 `0.3.0`입니다. Git 소스 게시, 해당 commit의 CI 통과, npm/GitHub Release 게시는 서로 별도로 확인합니다.
- 공식 Superpowers pin: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, package 6.3.0.
- `npm test`, `npm run check`, `npm run check:package`, `npm pack --dry-run`, `git diff --check`는 source checkout에서 수행하는 개발/패키지 게이트입니다. 설치된 production package에는 test, CI, `check-package`가 의도적으로 없습니다.
- CI에 Node 20/22와 OS matrix 설정이 있어도, 설정의 존재는 해당 matrix가 통과했다는 주장이 아닙니다. 실제 실행 결과만 기록합니다.

## Evidence-tool compatibility

- Tool registration shape: `tool({ description, args, execute })` returning the
  input unchanged, confirmed against `@opencode-ai/plugin@1.15.13`
  (`dist/tool.js`: `export function tool(input) { return input; }`,
  `tool.schema = z`) as bundled in the local OpenCode package cache. The
  installed OpenCode binary is 1.18.31; its `Hooks.tool` map
  (`{ [key]: ToolDefinition }`) is the registration surface used in
  `index.mjs`. A readable 1.18.31 plugin `dist` was not available in this
  environment, so exact shape parity with 1.18.31 remains an unverified
  boundary (no shell, network, or external-directory access was used to
  chase it).
- Offline resolvability: `node -e "import('@opencode-ai/plugin')"` and
  `import('zod')` both fail with `Cannot find package` in this source
  checkout, and the packed tarball declares no dependencies, so the offline
  `npm run check:package` install cannot resolve the native helper either.
  Adding the dependency would require editing `package.json`, which is
  outside this change; therefore `src/evidence-tools.mjs` prefers the native
  helper at runtime and otherwise uses the vendored `{ description, args,
  execute }` identity shape with a minimal validating schema shim for the
  bounded scope-enum/paths-array args.
- Targeted tests: `test/evidence-tools.test.mjs` and `test/env-probe.test.mjs`
  cover the six-tool registration, arg bounds, 4 KiB output bounds with
  truncation notes, degraded (non-fatal) paths, and secret exclusion (no
  titles/prompts/costs in audit output, no environment reads in env-probe,
  no contents/diffs in diffstat). `npm run check`'s `node --check` list is
  fixed in `package.json` and does not yet include the two new source files;
  they are syntax-covered by loading them under `node --test`.

## 정적·새 process 검사

source checkout에서 다음을 실행하고 결과를 기록합니다.

```bash
npm run check
npm run check:package
npm pack --dry-run
git diff --check
```

`npm run check` already ends with `node --test`, so do not run `npm test` again for the same revision.

package gate는 manifest, 실제 tarball, offline local-tarball install, plugin hook, 여섯 role, command와 policy reference를 확인합니다. path/filename gate는 알려진 금지 경로와 필수 파일만 검사하며, 유효한 filename 안에 들어간 secret content까지 찾아내거나 secret-free를 보증하지 않습니다. source와 tarball content를 수동 검토하고, production artifact에 test/CI/check-package, credential, session log, `.opencode`가 없는지 확인합니다.

새 OpenCode process에서 `opencode debug agent <role>`의 model/variant/steps/permission을 필요한 필드만 확인하고, `opencode debug skill`로 role별 skill 접근을 확인합니다. Plan permission, Build coordinator-only permission, reserved subagent 정의 전체의 교체(model/variant와 유효한 양의 정수 steps는 보존)는 관리되는 변경으로 기록하고, 기존 options 등과 이름 충돌도 확인합니다. Plan의 기타 설정과 Plan/Build model 및 사용자의 credential/provider/MCP 변경 여부는 별도로 확인합니다. model 목록 조회는 live-call·품질 PASS가 아니며, cost metadata가 없거나 0인 것은 무료 실행의 증거가 아닙니다.

## Audit의 의미

`npm run audit`는 로컬 OpenCode DB의 assistant metadata(`providerID`, `modelID`, `variant`)를 이용한 관찰용 inventory입니다. model compliance, quality, ROI, cost superiority를 판정하지 않습니다. 최신 route per session만 보고 모든 turn이나 task correctness를 인증하지도 않습니다.

strict audit는 다음 두 인자를 모두 **명시적으로** 요구합니다.

```bash
npm run audit -- \
  --routes=<user-expected-mapping.json> \
  --since=<post-change ISO timestamp> --strict
```

`--routes`는 사용자가 복사·편집한 기대 mapping이어야 하며 [선택 예시](../examples/model-routing.json)를 모두의 기본 설정으로 간주하지 않습니다. `--since`는 변경 이후 실제 시각이어야 합니다. 명시 mapping이 없거나, 시각이 없거나, 인식된 증거가 0이면 strict는 실패합니다. 일반 audit는 비교 mapping 없이 metadata만 관찰합니다.

## 승인된 live smoke 경계

Live call은 quota/API token을 사용하고 입력을 provider로 보낼 수 있습니다. synthetic disposable fixture와 명시적 범위를 사용하며, production data나 credential은 사용하지 않습니다. role graph·tool 경계·실제 diff·독립 test evidence를 각각 기록하되, 한 번의 smoke로 일반 품질·효율·비용 우위나 production readiness를 결론내리지 않습니다.

## 완료 보고 형식

정확한 harness/upstream/runtime version, 실행 platform, source 정적 결과, 실제 호출한 role, upstream integrity, migration 변경, restart 요구와 미검증 경계를 분리해 보고합니다. configured/discovered, live routing, implementation quality, remote publication, Human acceptance를 서로 섞지 않습니다. 실제 publish가 승인·성공하기 전에는 link/tag가 published라고 쓰지 않습니다.

## 날짜가 있는 local evidence의 범위

**이전 0.2 계열 baseline:** 2026-09-08에는 50 tests/24개 패키지 파일을 검증했습니다. 이후 공개 commit `3715dcb`의 51 tests와 6개 OS/Node CI job이 통과했습니다. 이 과거 결과는 아래 Design 0.3.0 변경에 대한 CI 승인이 아닙니다.

**Design 0.3.0 로컬 검증:** Linux/Node 24.19.0에서 독립 Test Runner가 65/65 tests, 실제 tarball offline install/import/config hook, pack dry-run(28개 파일), diff whitespace 검사를 통과했습니다. 독립 리뷰에서 발견한 root/blanket 권한·unsafe tool 재허용·상대 경로 범위 문제를 수정하고 재검토했습니다. 이 로컬 실행은 Windows 전용 cross-drive 분기를 실행하지 않으며, 원격 OS/Node 검증은 해당 commit의 CI 결과를 확인해야 합니다.

**Execution-control evidence:** native `subagent_depth: 1`이 올바르게 거절되었고, corrected integration 뒤 author-requested helper 4 checks, Developer shell의 `npm test` 4 checks, 별도 root Test Runner 4 checks가 보고되었습니다. Primary는 native parent/child metadata와 author-feedback title도 확인했습니다. 이는 작은 helper lifecycle 검증이지 cost/complexity benchmark가 아닙니다.

**Design browser pipeline evidence:** Linux의 실제 OpenCode Design root에서 named Playwright MCP와 명시적으로 선택한 Astra `high`를 사용했습니다. official `@playwright/mcp@0.0.80`의 manifest를 inspect했고 install lifecycle hook은 없었으며 Playwright/core는 `1.63.0-alpha-2026-08-31`로 pin되어 있었습니다. `--headless --isolated --block-service-workers --browser chrome --caps vision --image-responses allow` 및 local-only allowed origins/output 설정으로 synthetic page를 desktop `1280x800`, mobile `390x844`에서 resize/navigate/screenshot/read/snapshot/click하고 close했습니다. 두 PNG를 Primary가 직접 읽어 selected state와 no horizontal overflow를 관찰했으며 task call/source change는 없었습니다. 이는 browser pipeline과 image inspection의 실제 증거이지 product design approval, quality/cost benchmark, egress isolation의 증거가 아닙니다.

Browser/MCP 연결, supported browser launch, model이 PNG를 실제로 볼 수 있음은 각각 확인해야 합니다. cached Chromium의 OS sandbox 실패를 `--no-sandbox`로 우회하지 않았고, 이미 설치된 official Chrome을 사용했습니다. browser install은 별도 consent이며 credentials/auth/data permission과는 별개입니다. screenshot 또는 `screenshotwithfilename`의 text path나 output file 존재만으로 visual inspection을 기록하지 않습니다.

**Design prototype 생성 검증:** 비-Git 작업 폴더에서 native worktree-relative 권한 경로를 보정한 후, 실제 Design Primary가 기존 HTML을 읽고 `apply_patch`로 지정한 preview 파일을 생성했습니다. 원본 대비 변경은 요청한 H1과 header 색상뿐이었으며 responsive CSS와 interaction script는 유지됐습니다. Desktop/mobile 렌더를 캡처·READ하고 선택 동작을 확인한 뒤 `NOT visually approved / awaiting Human feedback`으로 반환했습니다. Build가 실제 diff와 PNG를 확인했으며, 생산 코드 반영이나 사용자 승인을 가장하지 않았습니다.

CI와 source package checks는 browser-free로 유지되어 portable합니다. 위 native browser pipeline의 실제 실행은 현재 Linux에서만 확인했으며, 다른 OS/browser와 remote CI 결과는 이 evidence로 대체하지 않습니다.

Startup diagnosis는 [troubleshooting.md](troubleshooting.md)에 기록되어 있습니다. health/agent/command/skill/session headless probes와 짧은 new/continue PTY probes는 같은 generic error를 재현하지 못했으며, root cause는 확정되지 않았고 fix도 주장하지 않습니다.

Build가 검증 결과와 실제 native helper 관계를 확인했습니다. 이 기록 시점에 원격 OS matrix·두 번째 PC·live slash-command invocation·품질/비용 benchmark는 미검증입니다. 게시된 commit의 원격 CI 상태는 README의 workflow 링크에서 별도로 확인합니다. 개인 scratch path, raw session ID와 세션 setup narration은 distributable evidence에 포함하지 않습니다.
