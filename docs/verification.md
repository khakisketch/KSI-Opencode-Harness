# Verification and compatibility

## 범위

- 기록된 호환성 기준: OpenCode 1.18.29, Node >=20. 다른 version/OS는 실제 실행 전까지 미검증입니다.
- 공식 Superpowers pin: `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`, package 6.3.0.
- `npm test`, `npm run check`, `npm run check:package`, `npm pack --dry-run`, `git diff --check`는 source checkout에서 수행하는 개발/패키지 게이트입니다. 설치된 production package에는 test, CI, `check-package`가 의도적으로 없습니다.
- CI에 Node 20/22와 OS matrix 설정이 있어도, 설정의 존재는 해당 matrix가 통과했다는 주장이 아닙니다. 실제 실행 결과만 기록합니다.

## 정적·새 process 검사

source checkout에서 다음을 실행하고 결과를 기록합니다.

```bash
npm run check
npm test
npm run check:package
npm pack --dry-run
git diff --check
```

package gate는 manifest, 실제 tarball, offline local-tarball install, plugin hook, 여섯 role, command와 policy reference를 확인합니다. path/filename gate는 알려진 금지 경로와 필수 파일만 검사하며, 유효한 filename 안에 들어간 secret content까지 찾아내거나 secret-free를 보증하지 않습니다. source와 tarball content를 수동 검토하고, production artifact에 test/CI/check-package, credential, session log, `.opencode`가 없는지 확인합니다.

새 OpenCode process에서 `opencode debug agent <role>`의 model/variant/steps/permission을 필요한 필드만 확인하고, `opencode debug skill`로 role별 skill 접근을 확인합니다. Plan permission과 reserved subagent 정의 전체의 교체(model/variant와 유효한 양의 정수 steps는 보존)는 관리되는 변경으로 기록하고, 기존 options 등과 이름 충돌도 확인합니다. Plan의 기타 설정과 Plan/Build model 및 Build tool permission 및 사용자의 credential/provider/MCP 변경 여부는 별도로 확인합니다. model 목록 조회는 live-call·품질 PASS가 아니며, cost metadata가 없거나 0인 것은 무료 실행의 증거가 아닙니다.

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

**2026-09-08 독립 로컬 검증:** Test Runner가 `npm run check`를 실행해 50/50 tests 통과를 확인했습니다. 실제 tarball의 offline install·bare package-name import·config hook 검사와 pack dry-run(24개 파일), diff whitespace 검사도 통과했습니다. 이는 로컬 검증이며 원격 CI 결과와 구분합니다.

**Execution-control evidence:** native `subagent_depth: 1`이 올바르게 거절되었고, corrected integration 뒤 author-requested helper 4 checks, Developer shell의 `npm test` 4 checks, 별도 root Test Runner 4 checks가 보고되었습니다. Primary는 native parent/child metadata와 author-feedback title도 확인했습니다. 이는 작은 helper lifecycle 검증이지 cost/complexity benchmark가 아닙니다.

Startup diagnosis는 [troubleshooting.md](troubleshooting.md)에 기록되어 있습니다. health/agent/command/skill/session headless probes와 짧은 new/continue PTY probes는 같은 generic error를 재현하지 못했으며, root cause는 확정되지 않았고 fix도 주장하지 않습니다.

Build가 검증 결과와 실제 native helper 관계를 확인했습니다. 이 기록 시점에 원격 OS matrix·두 번째 PC·live slash-command invocation·품질/비용 benchmark는 미검증입니다. 게시된 commit의 원격 CI 상태는 README의 workflow 링크에서 별도로 확인합니다. 개인 scratch path, raw session ID와 세션 setup narration은 distributable evidence에 포함하지 않습니다.
