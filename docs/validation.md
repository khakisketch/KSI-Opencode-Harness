# 검증과 한계

> **현재 (2026-10-26):** 전역 5개 역할·공통 지침 적용 완료. 회귀 **134/134**, 설치본 **146/146**, 격리 Native **362/362** 통과. Sol Build trial 1건 완료. 모델 우위와 실제 제품 완주는 아직 미입증입니다.

이 문서는 **현재 검증의 범위와 한계**만 요약합니다. 2026-10-26 이전의 상세 역할·모델·스킬·배포 이력은 [문서 이력](archive/2026-10-26/README.md)에 보존했습니다.

## 지금 확인한 것

| 검사 | 결과 | 의미 |
| --- | --- | --- |
| 단위·소스 계약 회귀 | **134/134** | 지침 구조·완료 판정·세션 감사·권한 프로브·압축 연속성 등 |
| 전역 설치본 검사 | **146/146** | 5개 역할 등록, 모델·모드·권한, Lead 본문, retired 역할 제외 |
| 격리 Native 통합 | **362/362** | 깊이 3 위임, 복구, 병렬, 세션 제한 상속, 지침 전달 |
| Sol Build trial | **211 suites / 2,140 tests** | 실제 Site viewer-first 과업 1건, 4개 폭 28개 렌더 장면, 조작·axe 확인 |

```sh
# 단위·소스 계약 회귀
node --test tests/completion-guidance.test.mjs tests/capabilities.test.mjs \
  tests/session-audit.test.mjs tests/prompt-boundaries.test.mjs \
  tests/permission-probe.test.mjs tests/delegation-errors.test.mjs \
  tests/compaction-continuity.test.mjs

# 설치본 5개 역할·모델·권한·본문 검사 (모델 호출 없음)
node tests/agent-routing-native.mjs

# 격리 Native 위임·복구·병렬·세션 제한 통합 검사 (로컬 fixture 모델)
node tests/delegation-native-integration.mjs
```

## Sol Build trial에서 배운 것

Sol High Build는 실제 로컬 앱에서 다음을 스스로 찾아 고쳤습니다.

- 자료 캔버스가 화면 높이를 넘어 복구 버튼이 밀리는 문제
- 관측 미선택 공간 화면의 문서형 fallback
- 패널 포커스 때 캔버스가 7px 스크롤되는 문제

반면 다음은 남겼습니다.

- 홈·현장 목록의 비주얼 퍼스트 부재
- 1440px에서 자료 목록 패널이 “준비 기록을 불러오지 못했습니다 / 준비 상태 다시 확인” 복구 카드를 덮어, 목록을 닫기 전에는 복구 동작을 누를 수 없는 문제
- 1024px에서 복구 카드가 치수 라벨을 가리는 문제

이 사례의 핵심은 **테스트·스크린샷·계약 검사가 통과해도 제품 수용은 별개**라는 점입니다. Build는 첫 화면, 핵심 행동, 로딩/빈/오류 상태의 조합을 실제 렌더로 판정해야 하며, UI 독립 검토도 코드·계약만 보지 않고 실제 화면과 제품·시각 질문을 포함해야 합니다. 자세한 판정 기준은 [README의 제품 수용](../README.md#완료를-어떻게-판정하나)을 따릅니다.

## 검증이 보장하지 않는 것

- 모델 간 일반 우위: Sol High Build가 DeepSeek Build보다 항상 낫다는 결론이 아닙니다.
- 실제 제품 완주: trial은 합성 미봉인 자료와 제한된 환경에서 수행됐고, 실제 픽셀·자료 준비·분석 실행·운영/고객 인수는 미검증입니다.
- 장기 개발·비용·추가 교정 부담의 개선: 비교 1건만으로 일반화하지 않습니다.
- 디자인 판단력: 검사는 라우팅·권한·지침 전달 메커니즘을 확인할 뿐, 모델의 취향·제품 판단을 인증하지 않습니다.
- 시각적 완성도: axe·렌더 캡처·키보드 검사는 특정 범위의 증거이며 전체 접근성·사용성 인증이 아닙니다.

## 역사 기록

- [2026-10-26 문서 이력](archive/2026-10-26/README.md): 이전 설치 안내, 2026-10-17~26 검증 이력, OpenSpec·스킬 검토, Sol trial 상세
- [퇴역 OpenSpec](archive/openspec-2026-10-26/README.md)
- [Architect 원본](archive/agents/architect.md)

과거 기록은 당시 근거를 보존하지만 현재 실행 의무나 최신 결론을 대신하지 않습니다.
