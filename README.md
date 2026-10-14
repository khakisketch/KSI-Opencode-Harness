# KSI OpenCode Harness

**OpenCode의 기본 능력으로 제품을 구현하고, 실제 동작을 검증하며, 완료 기준을 충족하면 멈춥니다.**

[![OpenCode V2](https://img.shields.io/badge/OpenCode-V2-blue)](https://opencode.ai/v2/)
[![MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![Check](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml/badge.svg)](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml)

## 사용 방법

기존 OpenCode에서 **원하는 결과·제약·완료 기준**을 알려주세요. 별도 KSI 설치는 필요 없습니다.
실행·권한·세션 관리는 OpenCode Native에 맡깁니다. [제품 완성 원칙](examples/project-AGENTS.md)은
선택형 예시입니다. 필요할 때만 기존 전역 또는 프로젝트 `AGENTS.md` 한 곳에 병합하고,
같은 정책을 여러 지침 파일에 반복하지 마세요.

> **npm 설치기는 레거시입니다.** 공개 `ksi-opencode-harness` beta 배포본에는 과거 역할과
> 운영 문서가 포함돼 있습니다. 현재 구성에 설치하거나 재적용하지 마세요.

- **기능 수정:** “저장 실패 후 재시도를 고쳐줘. 기존 API를 유지하고 실제 저장·재시도 결과를 확인해줘.”
- **새 기능:** “관리자 주문 취소를 구현해줘. 권한과 결제 계약을 보존하고 실패·거부 시나리오까지 검증해줘.”
- **화면 개선:** “예약 화면을 실제 소스에서 개선해줘. 저장 동작을 유지하고 실제 렌더와 사용자 흐름을 확인해줘.”

시각적 전문성이 필요한 작업에는 기존 Design Specialist를 활용합니다. 작은 기계적 변경에는
위임을 강제하지 않으며, Plan 분석·리뷰도 고정 단계가 아닙니다.
설정이 필요할 때만 [최소 설정 예시](opencode.jsonc.example)를 병합하세요. Plan `all`은
메인·자식 호출을 모두 허용하지만 자동 호출을 보장하지 않습니다. 기존 모델·권한은 유지합니다.
커밋·Push·배포에 KSI 별도 승인 규칙을 추가하지 않습니다. 기존 OpenCode 권한과 사용자 요청 범위를 따릅니다.
CE·OpenDesign은 명시적으로 선택하는 외부 도구이지 기본 의존성이 아닙니다. 기존 전역 설치는 임의로 삭제하지 않습니다.

## 실제 검증

에이전트 리뷰를 받았다는 사실은 제품 동작 증거가 아닙니다. 기존 프로젝트의 테스트·빌드와
실제 사용자 흐름을 확인하고, 발견한 관련 결함을 수정한 뒤 영향받는 부분을 다시 검증합니다.
검사별 참고 범위는 [검증 안내](docs/verification.md)에 있으며 모든 검사를 매번 요구하지 않습니다.

이 저장소는 실행 프레임워크가 아닌 제품 개발 원칙과 최소 설정 예시입니다. 저장소 변경 확인:

```sh
npm run check
```

현재 문서 링크·최소 설정·비공개 패키지 경계만 검사합니다. 별도 KSI 검사 래퍼·설치기는 없습니다.
이 결과는 실제 제품 검증이 아닙니다.

## 레거시와 기록

과거 역할 설치기, 운영 매뉴얼, 계획/상태 정본, 외부 디자인 통합과 전용 스크립트는 현재
트리에서 제거했습니다. 과거 내용은 Git 기록으로 확인하며 운영 경로로 다시 적용하지 않습니다.

현재 원본은 설치기 배포본이 아니며 `package.json`의 `private: true`로 발행을 막았습니다.
기존 발행 버전·사용자 설치 파일은 변경하지 않았습니다. 이전 CLI가 필요한 기존 사용자는
이미 사용하던 정확한 배포 버전 또는 해당 Git 리비전을 사용해야 하며, 현재 원본에는 CLI가 없습니다.
과거 설치기로 현재 사용자 설정·Design Specialist를 덮어쓰지 마세요.

작업 진행은 Native 세션·Git·실제 검사 결과로 확인합니다. 제품 요구사항·승인 결정은 해당
제품의 기존 문서에 유지하고, 지속 기록을 요청받았거나 실제로 필요할 때만 갱신합니다.
KSI 전용 원장·상태·체크포인트나 고정 계획 경로는 요구하지 않습니다. Native Plan 저장물을
프로젝트 문서로 매번 복제할 필요도 없습니다. 과거 기록은 Git 이력에 보존돼 있습니다.

## 라이선스

[MIT](LICENSE) — Copyright (c) 2026 KSI
