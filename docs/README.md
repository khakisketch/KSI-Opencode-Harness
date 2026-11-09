# 문서 안내

처음이라면 **영어 [README](../README.md)** → **[설치](installation.md)** → **[검증](validation.md)** 순서로 보세요. 이 문서는 나머지 문서의 역할을 짧게 안내합니다.

현재 문서는 **지금 해야 할 일과 최신 결론**만 담고, 날짜별 검증·이전 역할·폐기된 절차는 [역사 기록](#역사-기록)으로 분리합니다.

> [!TIP]
> **읽는 순서:** 하네스가 처음이면 README의 [Quick start](../README.md#quick-start)·[How it works](../README.md#how-it-works)·[Verification and limitations](../README.md#verification-and-limitations)만 먼저 보세요. 적용할 때 [설치 안내](installation.md), 결과의 의미를 물을 때 [검증](validation.md)으로 이동합니다.

## 지금 읽을 문서

| 문서 | 읽는 상황 | 내용 |
| --- | --- | --- |
| [README](../README.md) | 하네스가 무엇인지 알고 싶을 때 | 영어 프로젝트 소개, 빠른 시작, 역할 요약, 검증·한계, 문서 진입점 |
| [설치 안내](installation.md) | 내 컴퓨터에 적용할 때 | 적용 파일, 백업, 설치 절차, 확인, 되돌리기 |
| [프로젝트 지식과 상태](project-knowledge.md) | 프로젝트 문서·계획을 정리할 때 | 제품·경험·디자인·시스템·상태 정본, 디자인 정본의 범위, 지속 정본과 과업 계획의 분리 |
| [검증](validation.md) | 현재 검증 범위와 한계를 볼 때 | 최신 시험·설치·활성 결과와 미입증 사항 |
| [개발·검증 루프](development.md) | 하네스를 바꾸고 확인할 때 | 한 명령 검증, 모드별 범위, 모델·환경 제약, UI 작업 흐름·스킬 정책 |
| [디자인 작업](design-work.md) | UI 과업을 구현·검증까지 완료할 때 | 방향·구현·렌더 검증·수정·인계, be-ambitious 선택 사용 |
| [아키텍처 결정](architecture/decisions.md) | 모델이 바뀌어도 유지되는 결정을 볼 때 | 역할·위임·검증·도구의 standing 결정 25항 |
| [ai-memory](ai-memory.md) | 퇴역 기록을 확인할 때 | 2026-11-07 제거, Beads·정본·증거팩으로 대체 |
| [증거팩](evidence-pack.md) | UI 작업의 실행·검증 증거를 남길 때 | 목표·화면·조건·검증·판단 근거 5항, agent-browser 표준 |
| [내장 목표](native-goal.md) | 장기 반복을 선택할 때 | Native 기능만 사용, KSI Lead 연결 없음 |
| [기능 목록·오프라인 진단](workflow-evidence.md) | 도구 등록이나 명시적 로컬 기록을 조사할 때 | 선택형 조회, 실제 검증과 구분 |
| [분리 작업](isolated-work.md) | 병행 변경을 보존하며 별도 작업본을 준비할 때 | 선택한 미커밋 변경 반영, 미리보기, 런타임 격리 한계 |
| [하네스 실제 과업 평가](harness-evaluation.md) | 변경 전후 사용자 부담과 결과를 비교할 때 | 동일 조건·대표 과업·실패 포함·비용과 안전 평가 |

> [!NOTE]
> **상세 구현은 각 문서에 둡니다.** README는 입구·원칙·이동 경로만 담고, 설치 조건·검증 수치·도구 입력과 한계는 해당 문서의 설명을 정본으로 봅니다. 수치·명령이 다르면 각 문서의 최신 결론과 실제 실행 근거를 따릅니다.

## 역사 기록

현재 운영에 필요한 문서가 아닙니다. 당시 결정과 검증 근거를 보존한 기록입니다.

| 기록 | 내용 |
| --- | --- |
| [2026-11-02 정리 전 기록](archive/2026-11-02/README.md) | 이전 검증·설치 서사와 폐기한 Goal/Decision 조사 |
| [2026-10-26 문서 이력](archive/2026-10-26/README.md) | 이전 설치 안내, 2026-10-17~26 검증 이력, OpenSpec·스킬 검토, Sol trial 상세 |
| [Engineer 라우팅 안내](engineer-routing-validation.md) | 구 링크 유지용 짧은 안내 (당시 상세는 위 문서 이력) |
| [OpenSpec·스킬 안내](openspec-and-skills.md) | 구 링크 유지용 짧은 안내 (당시 상세는 위 문서 이력·아래 퇴역 기록) |
| [퇴역 OpenSpec](archive/openspec-2026-10-26/README.md) | 2026-10-26에 퇴역한 OpenSpec 명세·변경·생성물 |
| [Architect 원본](archive/agents/architect.md) | 이전 역할 원본 (발견·등록 제외) |

역사 기록은 현재 계약을 바꾸지 않습니다. 최신 결론은 항상 현재 문서와 실제 코드·실행 근거를 따릅니다.

기본 운영에서 제외한 코드는 [실험 디렉터리](../experiments/README.md)에만 보존합니다. 설치·실행을 권장하는 목록이 아닙니다.
