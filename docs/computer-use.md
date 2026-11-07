# Cua Driver 컴퓨터 사용 (선택 기능)

이 문서는 **이 Mac 사용자**의 설치 상태를 기록합니다. 다른 Mac이나 Linux에 자동 배포되지 않습니다. [공식 빠른 시작](https://cua.ai/docs/cua-driver/quickstart) · [에이전트 연결](https://cua.ai/docs/cua-driver/guides/connect-your-agent) · [권한 모드](https://cua.ai/docs/cua-driver/guides/permissions).

## 이 Mac의 설치와 보호

- 2026-10-31 공식 드라이버 전용 설치기로 **0.38.0**을 설치했습니다. GitHub 릴리스는 prerelease로 표시됩니다. `/Applications/CuaDriver.app`, `~/.local/bin/cua-driver` 링크, `~/.cua-driver/` 상태를 사용합니다. `~/.local/bin`이 PATH에 없으면 절대 경로를 사용하세요.
- 설치기는 배포 아카이브 SHA-256 `121cf20cafd2cfa69dd720e8967350c6406b22e558be6889de7a1ae3343b6d4b`를 공식 SHA256SUMS와 대조했습니다. `cosign`이 없어 Sigstore 검증은 하지 않았습니다. 설치된 앱은 `codesign --verify --deep --strict`를 통과했고 서명은 `Developer ID Application: Cua AI, Inc. (YCK386LBJ7)`, 번들 ID는 `com.trycua.driver`입니다. 설치기와 helper의 검토 사본은 `~/.local/share/cua-install-audit/`에 있습니다.
- 설치 전 공식 환경 변수 `CUA_DRIVER_RS_TELEMETRY_ENABLED=0`을 설정했고 이후 `telemetry disable`로 영구 비활성화했습니다. 환경 변수 없이 상태를 재확인했을 때 persisted disabled, 설치 ID 미생성이었습니다. MCP 프로세스에도 환경 변수를 설정했습니다.
- OpenCode V2 전역 `mcp.servers.cua-driver`는 로컬 `cua-driver mcp`입니다. 공식 `mcp-config --client opencode`로 OpenCode에만 스킬을 설치하고 출력된 구형 형태를 V2 CLI로 등록했습니다. 기존 설정 백업은 소유자 전용 `~/.local/share/cua-install-audit/opencode-before-20261031-002429/`에 있습니다. 공유 서버를 재시작하지 않았습니다.
- 실제 데몬은 기본 **standard** 모드, 정책·manifest 없음으로 보고했습니다. 앱 allowlist는 없으며 일반 데스크톱 앱에 접근할 수 있도록 설정됐습니다. `unrestricted`나 `--dangerously-bypass-approvals`는 사용하지 않았습니다. Standard도 관찰·입력을 폭넓게 허용하므로, 화면 내용은 에이전트와 현재 모델 제공자에 전달될 수 있습니다. 기존 로그인 Chromium 프로필 연결은 별도 grant가 필요하며 자동 부여하지 않았습니다. Cua 보호와 macOS 권한은 그대로입니다.
- Plan/Explore에는 `cua-driver_*` MCP 액션을 deny하는 역할별 규칙을 추가했습니다. 이는 모든 Cua MCP 도구를 막는 역할 제한이지 앱 제한이 아닙니다. 기존 shell을 통한 Cua CLI 실행은 별도로 막지 않았으므로 OS 샌드박스나 엄격한 비변경 보장이 아닙니다. Build/General에는 해당 deny를 추가하지 않았습니다. 새 작업의 파괴적·금전적·외부 통신 행동은 설치 승인과 별개로 사용자 승인이 필요합니다.

## 권한과 검증

**현재 확인 (2026-10-31):** 사용자가 macOS 권한과 추가 동의를 직접 처리한 후 `permissions status --json`은 Accessibility와 Screen Recording 모두 **true**, `source.attribution: driver-daemon`, 번들 `com.trycua.driver`를 반환했습니다. Cua만 재실행한 뒤 끊긴 MCP는 OpenCode의 해당 서버 connect API로 재연결했습니다. 공유 OpenCode 서버는 재시작하지 않았습니다.

다른 환경에서 설치하거나 다시 권한을 확인할 때는 사용자가 직접:

1. 시스템 설정 → 개인정보 보호 및 보안 → **손쉬운 사용**에서 CuaDriver를 켭니다.
2. 개인정보 보호 및 보안 → **화면 및 시스템 오디오 녹음**에서 CuaDriver를 켭니다.
3. macOS가 종료 후 다시 열기를 제안하면 수락합니다. 항목이 없거나 한 항목만 나오면 `~/.local/bin/cua-driver permissions grant`를 다시 실행하고 안내를 따릅니다. 에이전트는 토글을 누르거나 TCC DB를 변경하지 않았습니다.
4. `~/.local/bin/cua-driver permissions status`, `~/.local/bin/cua-driver doctor`, `opencode mcp list`로 다시 확인합니다. Cua 재실행 후 연결이 끊겨 있으면 OpenCode의 `/mcps`에서 Cua 서버만 재연결합니다. doctor의 경고를 읽으세요. 등록은 실제 입력·화면 읽기 성공을 보장하지 않습니다.

**실제 동작 검증:** 부모 세션의 연결된 Cua MCP로 계산기를 열고, 기존 창을 변경하지 않도록 별도 프로세스·창의 계산기 인스턴스를 만들었습니다. 접근성 토큰을 사용한 백그라운드 버튼 입력으로 `6 × 7`을 계산하고, 새 접근성 읽기와 실제 창 캡처에서 `42`를 확인했습니다. 같은 시험 창에 `press_key`로 보낸 `5`도 새 상태에 반영됐습니다. 시험 세션은 `end_session`으로 종료했고 공유 데몬은 유지했습니다. 계산기는 검증 대상일 뿐 앱 허용 목록이 아닙니다. 모든 앱·제스처, 전체 데스크톱 좌표 입력, 재로그인 후 동작이나 Linux 실기는 검증하지 않았습니다.

### 후속 진단 (2026-10-31)

초기 grant는 시간 초과됐고 첫 토글 승인 확인 후에도 `unknown` 및 MCP 연결 실패가 있었습니다. 당시 프로세스는 `wait_for_grants`에서 대기했고 별도 fresh-permission-probe는 손쉬운 사용 true, 화면 기록 false였습니다. 이후 사용자가 정확한 앱 항목과 추가 동의를 처리했다고 답한 뒤 위의 두 권한 true 및 실제 캡처·입력이 확인됐습니다. 어떤 승인 단계가 원인이었는지는 분리 검증하지 않았습니다. TCC DB 수정·초기화나 권한 게이트 우회는 하지 않았습니다.

## Linux (문서상 요구사항, 이 작업에서 미시험)

공식 가이드는 x86_64 Linux 데스크톱, X11 또는 XWayland 및 AT-SPI 2를 요구합니다. Debian/Ubuntu 최소 환경은 `libxi6`, `at-spi2-core`가 필요할 수 있고, 데스크톱 세션에서 `cua-driver serve`를 실행해야 합니다. GNOME은 번들 WinRects helper 설치 후 로그아웃·재로그인이 필요할 수 있습니다. 배포판·Wayland compositor와 실제 권한은 별도 확인해야 하며, 이 Mac 설치는 Linux 동작의 증거가 아닙니다.
