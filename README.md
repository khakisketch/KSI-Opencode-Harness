# KSI OpenCode Harness

OpenCode에 장기 작업을 맡길 때 모델 비용, 판단 위험, 구현 권한, 검증 책임을 분리하는 공유 하네스입니다.

## 철학

1. **Solo first**: 분리 이득이 분명할 때만 서브에이전트를 사용합니다.
2. **티어 우선, effort 후순위**: Luna의 높은 effort가 Terra나 Sol을 대신하지 않습니다.
3. **고위험 판단은 Sol**: 보안, 권한, 개인정보, 출시, 배포, 마이그레이션, 결제, 규제, 의료, 비가역 아키텍처의 최종 판단은 Sol이 담당합니다.
4. **중요 분석은 Terra 이상**: 종합, 설계, 로드맵, 수용 기준, 일반 구현과 리뷰는 Terra가 하한입니다.
5. **Luna는 탐색 전용**: 파일, 심볼, 사용처, 제한된 인벤토리만 담당합니다.
6. **green != operation**: 테스트 통과만으로 실제 작동을 주장하지 않습니다.

## 자동 라우팅

| 에이전트 | OpenAI GPT 모델 | effort | 역할 |
|---|---|---|---|
| `explore` | GPT-5.6 Luna | high | 제한된 탐색 |
| `test-runner` | GPT-5.6 Luna | high | 테스트 실행, 로그 수집, 실패 분류 |
| `reviewer` | GPT-5.6 Terra | xhigh | 일반 코드 리뷰 |
| `risk-analyst` | GPT-5.6 Sol | xhigh | 고위험 최종 판단 |

라우터는 부모 모델의 `providerID`별로 서브에이전트 모델을 매핑합니다. OpenAI GPT 이외에도 alibaba, deepseek, local, local-reviewer 프로바이더에 동급 능력 모델이 설정되어 있습니다. 비 GPT에서 Sol 보장을 주장하지 않으며, 별도로 승인된 동급 티어가 없으면 비가역적 최종 판단을 상위 모델로 에스컬레이션합니다.

시장 표식을 통한 승격과 고위험 자동 승격 규칙은 유지됩니다. 고위험 영역의 최종 승인·판정·go/no-go는 `risk-analyst + Sol`로 자동 승격합니다.

## DGX Spark 로컬 서빙 (vLLM)

로컬 서브에이전트는 DGX Spark(GB10, UMA 128GB)에서 vLLM으로 서빙한 경량 MoE를 사용합니다. 서빙 모델 이름은 라우터의 `modelID`와 1:1로 일치해야 합니다.

| 엔진 | 모델 | served-model-name | 포트 | 용도 |
|---|---|---|---|---|
| A | `Qwen/Qwen3.6-35B-A3B-FP8` | `qwen3.6-35b-a3b` | 8000 | explore / test-runner (MoE, 빠름) |
| B | `nvidia/Qwen3.5-122B-A10B-NVFP4` | `qwen3.5-122b-a10b` | 8001 | reviewer 로컬 폴백 (122B MoE, 공식 Apache-2.0) |

직역: 두 엔진은 NVFP4를 쓰지만 두 모델의 포맷이 달라 vLLM 로더가 동일하게 처리하지 못합니다. 엔진 B는 global NVFP4(+exclude_modules)라 `modelopt_fp4`로 정상 로드되지만, 엔진 A(`nvidia/Qwen3.6-35B-A3B-NVFP4`)는 MIXED_PRECISION 층별 상세 명세라 모든 vLLM 버전에서 `KeyError: w2_input_scale`로 실패합니다. 그래서 엔진 A는 Qwen 공식 FP8 체크포인트 + `marlin` MoE backend를 사용합니다 (GB10 실측 검증 완료).

엔진 A (`vllm/vllm-openai:cu130-nightly`, FP8):

```bash
docker run -d --name vllm-engine-a \
  --device nvidia.com/gpu=all -p 8000:8000 \
  -v /home/ksi/.cache/huggingface:/root/.cache/huggingface \
  vllm/vllm-openai:cu130-nightly \
  --model Qwen/Qwen3.6-35B-A3B-FP8 \
  --host 0.0.0.0 --port 8000 \
  --tensor-parallel-size 1 --trust-remote-code \
  --kv-cache-dtype fp8 --attention-backend flashinfer \
  --moe-backend marlin \
  --gpu-memory-utilization 0.87 --max-model-len 131072 \
  --max-num-seqs 4 --max-num-batched-tokens 8192 \
  --enable-chunked-prefill --enable-prefix-caching \
  --speculative-config '{"method":"mtp","num_speculative_tokens":3,"moe_backend":"triton"}' \
  --reasoning-parser qwen3 --tool-call-parser qwen3_coder --enable-auto-tool-choice \
  --served-model-name qwen3.6-35b-a3b
```

엔진 B: `nvidia/Qwen3.5-122B-A10B-NVFP4`(NVIDIA ModelOpt 공식 퀀트, Apache-2.0, 122B/활성 10B)를 `-p 8001:8000`으로 띄웁니다 (NVIDIA 컨테이너는 내부 기본 포트가 8000). UMA 환경에서 모델이 78GiB를 차지하므로 `--gpu-memory-utilization 0.87`이 필요하며, Mamba 하이브리드 아키텍처는 `--max-num-batched-tokens 8192`가 필수입니다.

```bash
docker run -d --name vllm-engine-b \
  --device nvidia.com/gpu=all -p 8001:8000 \
  -v /home/ksi/models/hf-hub:/root/.cache/huggingface \
  nvcr.io/nvidia/vllm:26.04-py3 \
  vllm serve nvidia/Qwen3.5-122B-A10B-NVFP4 \
    --tensor-parallel-size 1 --trust-remote-code \
    --quantization modelopt_fp4 --kv-cache-dtype fp8 \
    --gpu-memory-utilization 0.87 \
    --max-num-batched-tokens 8192 \
    --max-model-len 262144 \
    --speculative-config '{"method":"mtp","num_speculative_tokens":2}' \
    --reasoning-parser qwen3 --tool-call-parser qwen3_coder --enable-auto-tool-choice \
    --enable-chunked-prefill --enable-prefix-caching \
    --served-model-name qwen3.5-122b-a10b
```

### GB10 실측 결과 (2026-08-08, vLLM 상)

| 엔진 | decode (MTP on) | TTFT (워밍) | prefill-1k | prefill-8k | 콜드 로드 |
|---|---|---|---|---|---|
| A: qwen3.6-35b-a3b (FP8) | 65~71 tok/s | 0.14 s | 33.9 tok/s | 44.2 tok/s | ~3.5 min |
| B: qwen3.5-122b-a10b (NVFP4) | 28.6~29.7 tok/s | 0.30 s | 22.7 tok/s | 19.3 tok/s | ~9 min |

주의: 두 모델(가중치 78+35GB)을 UMA 128GB에 동시 상주하면 KV 캐시가 0이 되어 엔진 초기화가 실패합니다. 동시 서빙이 아니라 **온디맨드 스왑**을 전제로 둔 설계입니다.

`opencode.jsonc` 예시 (저장소의 `opencode.jsonc.example` 참조):

```jsonc
"provider": {
  "local":          { "apiKey": "vllm", "baseURL": "http://localhost:8000/v1" },
  "local-reviewer": { "apiKey": "vllm", "baseURL": "http://localhost:8001/v1" }
},
"model": {
  "local":          "qwen3.6-35b-a3b",
  "local-reviewer": "qwen3.5-122b-a10b"
}
```

## 설치

저장소를 팀원 머신에 clone한 뒤 `~/.config/opencode/opencode.json` 또는 `opencode.jsonc`의 `plugin` 배열에 절대 경로를 추가합니다.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///home/USER/projects/KSI-Opencode-Harness/index.mjs"
  ]
}
```

npm에 배포한 뒤에는 경로 대신 다음 한 항목만 사용합니다.

```json
{
  "plugin": ["ksi-opencode-harness"]
}
```

설정은 시작할 때 한 번 로드됩니다. 설치 또는 업데이트 후 OpenCode를 완전히 종료하고 다시 실행해야 합니다.

## 권한

플러그인은 팀원의 전역 자동승인 설정이나 provider 설정을 덮어쓰지 않습니다. 대신 읽기 전용 에이전트의 수정·재위임 권한을 차단하고, reviewer에는 제한된 읽기 전용 Git 명령만 허용합니다.

`explore`, `test-runner`, `reviewer`, `risk-analyst`는 하네스 예약 이름입니다. 프로젝트 설정이 같은 이름을 정의해도 플러그인의 검증된 프롬프트와 deny-by-default 권한으로 교체됩니다. 읽기 전용 에이전트는 `.env`, credential 파일, 개인키, 인증서와 OpenCode `auth.json`을 읽을 수 없습니다.

전역 자동승인이 필요한 개인은 별도로 다음을 선택할 수 있습니다.

```json
{
  "permission": "allow"
}
```

이 설정은 편리하지만 주 에이전트의 모든 도구 호출을 자동승인하므로 팀 공통 기본값으로 배포하지 않습니다.

## 명시적 승격

서브에이전트 프롬프트에 다음 표식을 넣을 수 있습니다.

```text
[route:terra]
[route:sol]
[effort:xhigh]
[effort:max]
```

명시적 표식은 정책 하한보다 위로만 승격합니다. `[effort:max]`는 자동으로 Sol을 선택합니다.

## 검증

```bash
npm test
npm run check
npm run audit
npm pack --dry-run
```

`npm run audit -- --limit=100`은 최근 실제 서브세션의 assistant 메시지를 확인해 모델 티어와 effort 하한 위반을 보여줍니다. CI나 배포 전 점검에서 위반을 실패로 처리하려면 `npm run audit -- --strict`를 사용합니다. 기존 세션에는 예전 라우팅 기록이 남아 있을 수 있으므로 첫 도입 시에는 최신 실행만 해석해야 합니다.
세션 제목은 민감한 작업 설명을 포함할 수 있어 기본 출력에서 제외됩니다. 로컬 진단에서만 `--show-titles`를 추가하세요.

공유 설치에서는 npm의 고정 버전이나 검토한 Git 태그를 사용하세요. Desktop의 mutable checkout을 직접 연결하는 방식은 개발 머신에서만 권장합니다.

실제 모델 확인 시 서브세션의 요약 `session.model`보다 assistant 메시지의 `providerID`, `modelID`, `variant`를 기준으로 보세요. OpenCode는 플러그인이 메시지 모델을 바꾸기 전에 서브세션 메타데이터를 먼저 만들 수 있습니다.

디버그 로그가 필요하면 일시적으로 다음을 설정합니다.

```bash
KSI_HARNESS_DEBUG=1 opencode
```

프롬프트 내용은 로그에 남기지 않고 에이전트, 모델, effort, 승격 사유만 기록합니다.

## 배포 전 확인

- `npm run check` 통과
- OpenAI GPT에서 Luna, Terra, Sol 샘플 호출 확인
- 비 GPT 부모에서 모델 상속 유지 확인
- 읽기 전용 에이전트가 수정 도구를 사용할 수 없는지 확인
- 고위험 최종 판단이 Sol 아래로 내려가지 않는지 확인
