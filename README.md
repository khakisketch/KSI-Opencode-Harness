# KSI OpenCode Harness

**OpenCode의 기본 능력으로 제품을 구현하고, 실제 동작을 검증하며, 완료 기준을 충족하면 멈춥니다.**

[![OpenCode V2](https://img.shields.io/badge/OpenCode-V2-blue)](https://opencode.ai/v2/)
[![MIT](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)
[![Check](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml/badge.svg)](https://github.com/khakisketch/KSI-Opencode-Harness/actions/workflows/check.yml)

## 사용 방법

기존 OpenCode에서 **원하는 결과·제약·완료 기준**을 알려주세요. 별도 KSI 설치는 필요 없습니다.
[제품 완성 원칙](examples/project-AGENTS.md)이 지침의 유일한 정본입니다. 적용하려면 기존
`AGENTS.md`에 필요한 내용만 병합하세요. 전역 적용본은 정본의 배포 사본이지 별도 정책이 아닙니다.

- **기능 수정:** “저장 실패 후 재시도를 고쳐줘. 기존 API를 유지하고 실제 저장·재시도 결과를 확인해줘.”
- **새 기능:** “관리자 주문 취소를 구현해줘. 권한과 결제 계약을 보존하고 실패·거부 시나리오까지 검증해줘. 푸시는 하지 마.”
- **화면 개선:** “예약 화면을 실제 소스에서 개선해줘. 저장 동작을 유지하고 실제 렌더와 사용자 흐름을 확인해줘.”

시각적 전문성이 필요한 작업에는 기존 Design Specialist를 활용합니다. 작은 기계적 변경에는
위임을 강제하지 않습니다. 역할 호출, 계획·상태 파일 형식, 검토 횟수를 KSI가 규정하지 않습니다.
설정이 필요할 때만 [최소 설정 예시](opencode.jsonc.example)를 참고하세요.

## 실제 검증

에이전트 리뷰를 받았다는 사실은 제품 동작 증거가 아닙니다. 기존 프로젝트의 테스트·빌드와
실제 사용자 흐름을 확인하고, 발견한 관련 결함을 수정한 뒤 영향받는 부분을 다시 검증합니다.
검사별 참고 범위는 [검증 안내](docs/verification.md)에 있으며 모든 검사를 매번 요구하지 않습니다.

이 저장소는 실행 프레임워크가 아닌 원칙·설정 예시·정적 데모입니다. 저장소 변경 확인:

```sh
npm run check
```

현재 문서 링크와 최소 설정 예시만 검사합니다. 별도 KSI 검사 래퍼·설치기·패키지 검사는 없습니다.
이 결과는 실제 제품 검증이 아닙니다.

## 현장 안전점검 UI 데모

현장 담당자가 브리핑 전에 조치 대상을 찾는 **정적 화면 시안**입니다. 가상 데이터이며
운영·납품 실적이나 연결된 제품이 아닙니다. 실제 조치·저장·로그인·API 연결은 없습니다.

![현장 안전점검 UI 시연 화면 — 가상 데이터](docs/assets/demo/safety-field-inspection.png)

[라이브 데모](https://khakisketch.github.io/KSI-Opencode-Harness/demo-safety/) ·
[화면 소스](docs/demo-safety/index.html)

## 원본 정리와 배포 경계

과거 역할 설치기, 운영 매뉴얼, 계획/상태 정본, 외부 디자인 통합과 전용 스크립트는 현재
트리에서 제거했습니다. 과거 내용은 Git 기록으로 확인하며 운영 경로로 다시 적용하지 않습니다.
미커밋 원본은 제거 전에 저장소 밖에 백업했습니다.

현재 원본은 설치기 배포본이 아니며 `package.json`의 `private: true`로 발행을 막았습니다.
기존 발행 버전·사용자 설치 파일은 변경하지 않았습니다. 이전 CLI가 필요한 기존 사용자는
이미 사용하던 정확한 배포 버전 또는 해당 Git 리비전을 사용해야 하며, 현재 원본에는 CLI가 없습니다.
GitHub의 검토 브랜치 게시와 기본 브랜치 병합, Pages 배포, npm 발행은 별도입니다.

## 만드는 곳

**주식회사 케이에스아이** · 043-288-4860

AI 개발 도구와 현장 업무 화면을 실제로 사용할 수 있는 기능과 인터페이스로 구체화합니다.
도입·커스터마이징 문의는 전화로 연락 주세요.

## 라이선스

[MIT](LICENSE) — Copyright (c) 2026 KSI
