# ai-memory — 퇴역 (2026-11-07)

ai-memory 장기 기억을 퇴역했습니다.

- 설치본 플러그인 제거, 로컬 서버(LaunchAgent `local.ksi.harness-ai-memory`) 중지·plist 제거, DB 백업 후 보관.
- 백업: `~/.local/share/ksi-harness-backups/harness-aimemory-retire-*/` (DB tar + 플러그인 + 설치기/테스트/본 문서 원본).
- 유지된 판단 기록은 `docs/architecture/decisions.md`에 이미 있으며, 별도 이관 없이 유효합니다. 세션 원시 기록은 DB 백업에 보존됩니다.
- 대체: 작업 상태·의존성은 프로젝트별 Beads(`bd`), 설계 결정 정본은 Git/프로젝트 문서, 실행 증거는 `docs/evidence-pack.md` 5항. 단일 진실원칙을 `docs/development.md`에서 확인하십시오.
- 자동 수집·세션 후크·컨텍스트 주입은 폐지되었습니다. Beads에 모든 실행 기록을 자동 저장하지 않습니다. 중요한 결정·재사용 지식만 `bd remember`로 남깁니다.
- 잔존 스킬 정리(2026-11-08): 플러그인 퇴역 후에도 전역 발견 경로에 남아 있던 `~/.agents/skills/ai-memory-*` 6종을 `~/.local/share/ksi-harness-backups/harness-ai-memory-skills-20261108-185854/`로 이동했습니다. 스킬 본문이 발견 가능한 상태로 남아 에이전트가 사용할 수 있던 경로를 제거했습니다.
