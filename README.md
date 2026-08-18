# KSI OpenCode Harness

OpenCode에 장기 작업을 맡길 때 모델 비용, 판단 위험, 구현 권한, 검증 책임을 분리하는 공유 하네스입니다.

## 철학

1. **Solo first**: 분리 이득이 분명할 때만 서브에이전트를 사용합니다.
2. **OpenAI 티어와 effort 분리**: 높은 effort가 더 높은 모델 티어를 대신하지 않습니다.
3. **비 OpenAI는 상속**: Risk Analyst는 메인 모델을 상속하며 별도 승인 없이는 Sol 동급을 주장하지 않습니다.
4. **중요 분석은 상위 모델**: 종합, 설계, 로드맵, 수용 기준과 최종 판단은 역할에 맞는 상위 모델이 담당합니다.
5. **Explore는 탐색 전용**: 파일, 심볼, 사용처, 제한된 인벤토리만 담당합니다.
6. **green != operation**: 테스트 통과만으로 실제 작동을 주장하지 않습니다.

## 자동 라우팅

| 에이전트 | OpenAI 메인 | 비 OpenAI 메인 | 역할 |
|---|---|---|---|
| `explore` | GPT-5.4 Mini / medium | GPT-5.4 Mini / medium | 제한된 탐색 |
| `test-runner` | GPT-5.3 Codex Spark / medium | GPT-5.3 Codex Spark / medium | 테스트 실행, 로그 수집, 실패 분류 |
| `developer` | Qwen3.8 27B quality profile | Qwen3.8 27B quality profile | 승인된 범위의 구현, targeted verification, 실패 수정 |
| `reviewer` | GPT-5.6 Terra / high | 메인 모델 상속 | 선택적 보조 코드 리뷰 |
| `risk-analyst` | GPT-5.6 Sol / xhigh | 메인 모델 그대로 상속 | 고위험 판단 |

Plan과 Build는 사용자가 선택한 모델을 그대로 유지합니다. Explore는 GPT-5.4 Mini/medium, Test Runner는 독립 검증을 위해 GPT-5.3 Codex Spark/medium을 사용합니다. `developer`만 상시 실행되는 로컬 Qwen3.8 quality profile을 사용합니다. OpenAI 메인에서는 Reviewer에 Terra/high, Risk Analyst에 Sol/xhigh를 사용하고, 그 외 provider에서는 두 역할 모두 메인 모델을 상속합니다.

명시적 표식은 선택된 provider가 해당 능력을 실제로 제공할 때만 적용됩니다. OpenAI 고위험 판단은 `risk-analyst + Sol`로 승격하며, 비 OpenAI 고위험 판단은 Risk Analyst 역할로 전환하되 메인 모델을 유지합니다.

## DGX Spark 로컬 서빙 (vLLM)

로컬 구현 서브에이전트는 DGX Spark(GB10, UMA 128GB)에서 하나의 Qwen3.8 27B Dense vLLM 서버를 공유합니다. 서빙 모델 이름은 라우터의 `modelID`와 1:1로 일치해야 합니다.

Qwen3.6 35B-A3B는 빠른 수동 fallback과 실험용으로만 남깁니다. 두 모델을 동시에 상주시키지 않으며 정상 운영에서는 Qwen3.8이 8667 포트에 상주합니다.

메인 에이전트는 사용자가 선택한 provider와 모델을 유지합니다. `explore`와 `test-runner`는 역할별 OpenAI 모델로 고정되고 `developer`만 Qwen3.8 서버로 고정 라우팅됩니다. Reviewer는 OpenAI 메인에서 Terra/high, 그 외에는 메인 모델을 상속합니다. Risk Analyst는 OpenAI에서 Sol/xhigh를 사용하고 비 OpenAI에서 메인 모델을 상속합니다.

`reviewer`는 필수 승인자가 아니라 선택적 advisory second pass입니다. 여러 파일의 동작, 비동기·수명주기, API·영속성 계약, 테스트가 약한 구현처럼 새 컨텍스트의 이득이 분명할 때만 호출합니다. 조사, 문서·포맷 변경, 단순 저위험 수정, 충분히 독립 검증된 동작에는 호출하지 않습니다. Reviewer 결과는 `Approved`가 아니며 메인 에이전트가 근거를 재검증합니다.

| 엔진 | 모델 | served-model-name | 포트 | 용도 |
|---|---|---|---|---|
| Developer (상시) | `unsloth/Qwen3.8-27B-NVFP4` | `qwen3.8-27b` | 8667 | developer |
| Fast fallback (수동) | `nvidia/Qwen3.6-35B-A3B-NVFP4` | `qwen3.6-35b-a3b` | 8666 | 운영자 실험 전용 |

DHX10은 대역폭 바운드(273 GB/s) 장비라 토큰 속도는 **활성 파라미터**로 결정됩니다. 35B-A3B(활성 3B ≈ 1.5GB/token)는 120 tok/s를 내는 이 장비의 최적점이며, 같은 이유로 Llama-3.3-70B dense(활성 70B ≈ 36GB/token, ~15-20 tok/s)나 Nemotron-120B-A12B(활성 12B, ~28 tok/s) 같은 후보들은 느리거나 동시 서빙이 불가합니다. 모델 MoE 아키텍처:

- 엔진 A(`nvidia/Qwen3.6-35B-A3B-NVFP4`)는 MIXED_PRECISION per-layer 명세라 vLLM v0.19 이하에서 `KeyError: w2_input_scale`로 실패하며, **v0.24.0+와 `--moe-backend marlin`이 필수**입니다.
- 두 active vLLM 모델의 동시 상주는 금지합니다. 반복 실험에서 NVIDIA 드라이버의 `NV_ERR_NO_MEMORY`와 호스트 전체 메모리 압력을 유발했습니다. Qwen3.6 fallback은 Qwen3.8을 완전히 종료한 뒤에만 시작합니다.

기본 Qwen3.8 엔진은 반드시 안전 시작 스크립트로 실행합니다:

```bash
./scripts/vllm-start-safe.sh
```

수동 fallback이 필요할 때는 활성 로컬 요청이 없는지 확인한 뒤 다음 명령으로 전환합니다.

```bash
./scripts/vllm-profile-safe.sh fast
```

기본 Developer profile로 돌아가려면 `./scripts/vllm-profile-safe.sh developer`를 사용합니다. 이 전환기는 양쪽 managed vLLM 컨테이너를 종료하고 NVIDIA compute PID가 사라지며 MemAvailable이 70GiB 이상, memory PSI avg10이 0.10 이하인지 확인한 뒤 정확히 하나의 profile만 시작합니다. 자동 재시작은 사용하지 않습니다.

Build는 프로필을 전환하지 않습니다. Qwen3.8 상시 서버에 foreground Developer 작업을 할당하며, 현재 단계의 하드 상한은 두 개입니다. 같은 Build session의 동일 profile Task 두 개는 하나의 host lease를 공유하고, lease가 유지되는 동안 수동 profile 전환과 다른 session의 local wave는 거부됩니다. Build는 dependency graph에서 바로 실행 가능한 독립 단위 두 개를 먼저 찾아 같은 assistant turn에 호출하며, 안전하고 유용한 분할이 없을 때만 한 개를 사용합니다. Test Runner는 구현 wave가 끝난 뒤 실행합니다.

Developer Task에는 목표, 허용 write 경로, 금지 shared file, acceptance criteria, targeted verification, 시작에 필요한 경로·줄 번호만 전달합니다. Build나 Explore가 이미 확인한 소스 전체와 긴 로그를 다시 붙이지 않으며, Developer는 막힌 사실만 좁게 검색하고 전체 테스트는 기본적으로 Test Runner에 맡깁니다. 실패 수정 시에는 기존 `task_id`에 실패 명령, 핵심 오류, 관련 evidence pointer만 전달합니다.

OpenCode가 긴 foreground Task를 내부적으로 detach하면 child session이 idle이 될 때까지 lease와 slot을 유지합니다. 기본 Developer profile 복구가 실패하면 이후 local 호출은 fail-closed로 차단되며, 운영자가 엔진을 복구한 뒤 OpenCode를 재시작해야 합니다.

모든 Developer는 같은 worktree를 직접 수정합니다. 병렬 호출 전에 Build는 각 작업의 허용 write 경로와 금지된 shared file을 지정해야 하며, 같은 파일·schema·lockfile·generated output을 건드리는 작업은 다른 wave로 분리합니다. 테스트 실패가 특정 작업에 귀속되면 기존 `task_id`를 재사용합니다.

2-way 우선은 슬롯을 채우기 위한 중복 조사를 뜻하지 않습니다. 두 작업은 각각 독립적인 완료 기준과 충분한 구현량이 있어야 하며, tightly coupled edit, 동일 파일 수정, 전체 테스트 전담, shared integration 변경은 두 번째 Developer를 만들지 않습니다. 공통 schema·lockfile·generated output·integration file은 후속 single-owner wave에서 처리합니다.

스크립트는 여유 UMA가 70GiB 미만이거나 memory PSI가 높은 경우 콜드 시작을 거부하고, 다른 vLLM 컨테이너 또는 NVIDIA compute 프로세스가 있으면 중단해 두 번째 복제본이 생기지 않도록 합니다. 안전 임계값은 환경변수로 완화할 수 없습니다. 기본 API는 `127.0.0.1:8667`에만 바인딩합니다. Qwen3.8은 Triton attention, `max-num-seqs=2`, MTP/async scheduling/prefix cache 비활성화로 시작하며 Docker 자동 재시작은 사용하지 않습니다.

### GB10 실측 결과 (2026-08-08, 이전 MTP 구성)

| 엔진 | decode (MTP on) | TTFT (워밍) | prefill-1k | prefill-8k | 콜드 로드 |
|---|---|---|---|---|---|
| A: qwen3.6-35b-a3b (NVFP4, v0.24, 단독) | 116~121 tok/s | 0.09 s | 62 tok/s | 64 tok/s | ~2-3 min |
| 구 B: qwen3.5-122b-a10b (NVFP4, 참고) | 27.4~29.1 tok/s | 0.31~0.42 s | 21.6 tok/s | 16.5 tok/s | ~9 min |

엔진 A는 v0.24.0의 `marlin` NVFP4 커널로 FP8 백엔드(0.19, ~68 tok/s) 대비 약 1.8배 빠릅니다. 참고: A의 이전 실측(FP8)은 decode 65~71 tok/s, TTFT 0.14 s였습니다.

**안정성 판정 (2026-08-09):** 두 모델 복제본의 동시 상주는 실패했습니다. 커널 로그에 NVIDIA `_memdescAllocInternal`의 `NV_ERR_NO_MEMORY`와 호스트 메모리 압력이 기록됐습니다. 이후 FlashInfer attention 경로의 두 장문 시퀀스에서도 CUDA illegal memory access가 발생했습니다. 현재는 복제본 없이 하나의 Qwen3.8 엔진만 사용하고 Triton attention으로 제한한 상태에서 `max-num-seqs=2`를 단계적으로 검증합니다. 3~4는 후속 실측 전까지 허용하지 않습니다.

`opencode.jsonc` 예시 (저장소의 `opencode.jsonc.example` 참조):

```jsonc
"provider": {
  "local": {
    "npm": "@ai-sdk/openai-compatible",
    "options": { "apiKey": "vllm", "baseURL": "http://localhost:8666/v1" },
    "models": {
      "qwen3.6-35b-a3b": { "limit": { "context": 28672, "output": 4096 } }
    }
  }
}
```

OpenCode에는 fast 로컬 모델의 `context`를 28,672, `output`을 4,096으로 등록합니다. Developer는 text-only Qwen3.8의 131,072 서버 창에 대해 `context` 122,880, `output` 32,768을 등록합니다. 8,192 토큰의 서버 여유는 tool schema와 chat template 변동을 흡수합니다. Qwen variant는 thinking을 끄는 `fast`, 4K thinking budget의 `balanced`, 16K thinking budget의 `quality`를 제공하며 Developer는 `quality`로 라우팅됩니다. MTP, async scheduling, prefix cache는 끈 품질 baseline입니다.

장기 작업의 반복 prefill을 줄이기 위해 tool output은 600줄 또는 24KiB에서 잘라 별도 파일로 보존하고, 자동 compaction은 오래된 tool 결과를 pruning합니다. 최근 4개 user turn에서 최대 32K 토큰을 보존하고 16K 토큰을 compaction 여유로 예약합니다. 이는 Qwen의 120K context 상한을 낮추지 않고 불필요한 누적만 줄입니다.

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

사용자 정책에 따라 하네스는 Build와 모든 서브에이전트의 OpenCode tool permission을 `allow`로 설정해 권한 확인 팝업을 제거합니다. 프로젝트가 별도 deny/ask를 선언해도 하네스가 로드되면 Build와 서브에이전트는 `allow`로 정규화됩니다. Test subprocess를 포함한 repository command는 별도 sandbox가 아닙니다.

Plan은 예외입니다. Plan은 read-only 계획 경계를 hard permission으로 유지하며 source edit와 shell command를 실행할 수 없고 `.opencode/working-state.md`만 수정할 수 있습니다. Plan의 민감 파일 접근은 `deny`라서 확인 팝업 없이 차단됩니다.

Explore, Test Runner, Reviewer, Risk Analyst의 역할 경계와 Developer의 write ownership은 프롬프트 계약으로 유지됩니다. Tool이 사용 가능하다는 사실은 task scope를 확장하지 않습니다. Force push, 대량 삭제, production deploy, secret rotation 같은 비가역 작업은 사용자가 해당 작업을 명시적으로 요청해야 합니다.

권장 전역 설정은 다음과 같으며 `opencode.jsonc.example`에도 포함됩니다.

```json
{
  "permission": {
    "*": "allow",
    "read": "allow",
    "edit": "allow",
    "bash": "allow",
    "task": "allow",
    "external_directory": "allow",
    "doom_loop": "allow"
  }
}
```

이 정책은 `.env`, credential, key, 외부 디렉터리, 네트워크, container, cloud 명령에 대한 tool-level 보호를 제거합니다. 신뢰할 수 있는 repository와 attended session에서만 사용하세요.

## 명시적 승격 요청

서브에이전트 프롬프트에 다음 표식을 넣을 수 있습니다.

```text
[route:terra]
[route:sol]
[effort:xhigh]
[effort:max]
```

선택된 provider에 요청한 tier나 effort가 정의되지 않았다면 현재 모델을 허위 승격하지 않고 기존 능력으로 유지합니다.

Explore와 Test Runner의 고정 OpenAI 경로, Developer의 고정 Qwen3.8 경로는 표식으로 변경되지 않습니다. Reviewer는 복잡한 검토에서 `[effort:xhigh]`로 승격할 수 있고 Risk Analyst의 명시적 표식은 정책 하한보다 위로만 승격합니다. 비 OpenAI에서는 존재하지 않는 tier나 variant를 만들지 않습니다.

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
- GPT-5.4 Mini Explore, GPT-5.3 Codex Spark Test Runner, Qwen3.8 Developer, Terra Reviewer, Sol Risk Analyst 샘플 호출 확인
- 비 OpenAI 부모에서도 Explore/Test Runner의 고정 OpenAI 경로와 Reviewer/Risk Analyst의 메인 모델 상속 확인
- 독립 write ownership을 가진 Developer 두 개가 동일 Qwen3.8 서버에서 실제로 중첩 실행되는지 확인
- 읽기 전용 에이전트가 수정 도구를 사용할 수 없는지 확인
- OpenAI 고위험 판단은 Sol인지, 비 OpenAI 고위험 판단은 메인 모델을 정확히 상속하는지 확인
