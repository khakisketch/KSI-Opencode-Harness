# 증거팩 (UI 반복 개선용 최소 기록)

UI 루프 1회분의 증거를 다음 5항으로만 남긴다. 화려한 보고서가 목적이 아니라 Design이 다음 수정을 정확히 지시할 수 있는 증거다.

| 항목 | 내용 |
| --- | --- |
| 목표 | 어떤 사용자 경험을 개선하려 했는가 (1~2문장) |
| 화면 | 수정 전·후 실제 렌더 캡처 (파일 경로) |
| 조건 | 화면 크기·화면 상태·코드 버전(디렉터리+mtime 또는 커밋) |
| 검증 | 실제 조작 결과와 재현 방법 (도구·뷰포트·조작 순서) |
| Design 의견 | 문제 위치·원인·수정 방향·남은 결함 (형식: 만족 / 결함 목록 / 미확인) |

## 만들기 (기존 도구만)

1. Build가 대상 디렉터리를 격리 포트로 서브한다: `python3 -m http.server <port>` (제품 서버 변경 없음).
2. agent-browser 세션 1개로 렌더한다: `open → snapshot → 조작 → 재스냅샷 → screenshot`. 기본 비교 조건은 1280px·390px이며, 실제 제품은 대상 기기·사용 환경에 맞게 선택한다.
3. `compare.html` 패턴(전후·뷰포트별 캡처를 한 화면에, base64 내장)으로 묶는다. 생성 스니펫:

```sh
python3 - <<'PY'
import base64
shots = ["before-1280","after-1280","before-390","after-390"]  # results/screenshots/ 아래 실파일명으로 교체
parts = []
for s in shots:
    b64 = base64.b64encode(open(f"results/screenshots/{s}.png",'rb').read()).decode()
    parts.append(f'<figure><figcaption>{s}</figcaption><img src="data:image/png;base64,{b64}"></figure>')
open('results/pack.html','w').write("<body>" + "".join(parts) + "</body>")
PY
```

## Design 렌더 절차 (표준)

- Build가 위 http 주소를 Design에 전달한다. Design은 브라우저 도구로 직접 열어 탐색·조작하고, 다른 상태(빈 결과·상세·반응형)를 확인한다. 코드 수정·위임 금지는 유지한다.
- 자식은 부모의 이미지를 자동 상속하지 않는다. Design은 자기 권한으로 이미지를 읽거나 캡처한다. 표준 실행 환경은 agent-browser(직접 실행·관찰·조작·캡처), 회귀·E2E는 Playwright다.
- 브라우저 연결 실패 시 코드만 읽고 시각 검증을 완료했다고 판단하지 않는다. `미확인`으로 반환한다.
- Antigravity 동등성 주의: http 접근+증거팩은 필요조건이지 동등 환경이 아니다. 브라우저 조작·영역 지정 피드백·자동 재검증까지 이어지는지는 루프마다 확인한다.
