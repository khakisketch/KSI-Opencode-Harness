#!/usr/bin/env node
import process from "node:process"

const base = process.env.BASE_URL ?? "http://127.0.0.1:8666/v1"
const model = process.env.MODEL ?? "qwen3.6-35b-a3b"
const port = new URL(base).port ?? 8666

async function chat(prompt, { maxTokens = 256, stream = true, reasoning = false } = {}) {
  const t0 = performance.now()
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      stream,
      ...(reasoning ? {} : { extra_body: { chat_template_kwargs: { enable_thinking: false } } }),
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  if (!stream) {
    const body = await res.json()
    const dt = (performance.now() - t0) / 1000
    const tokens = body.usage?.completion_tokens ?? 0
    return { dt, tokens, tokps: tokens / dt, ttft: dt, body }
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ""
  let ttft = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data:")) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === "[DONE]") continue
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta ?? {}
        const piece = delta.content ?? delta.reasoning ?? ""
        if (piece && ttft === null) ttft = (performance.now() - t0) / 1000
        text += piece
      } catch {}
    }
  }
  const dt = (performance.now() - t0) / 1000
  const tokens = await estimateTokens(text.length)
  return { dt, tokens, tokps: tokens / dt, ttft }
}

let cachedRate = null
async function estimateTokens(chars) {
  if (cachedRate === null) {
    const res = await fetch(`${base}/models`)
    const body = await res.json()
    const meta = body.data?.[0]
    cachedRate = meta?.id === model ? 0.3 : 0.3
  }
  return Math.round(chars * cachedRate)
}

async function report(name, fn) {
  const { dt, tokens, tokps, ttft } = await fn()
  const parts = [`[${name}] total=${dt.toFixed(2)}s tokens=${tokens}`]
  if (ttft !== null) parts.push(`ttft=${ttft.toFixed(3)}s`)
  if (tokps) parts.push(`decode=${tokps.toFixed(2)} tok/s`)
  console.log(parts.join(" "))
}

const rounds = Number(process.env.ROUNDS ?? 1)
const prompt128 = "Describe the lifecycle of a star in five sentences."
const prompt1k = "Qwen".repeat(200) + " Summarize: neural network quantization tradeoffs."
const prompt8k = "The history of computing: ".repeat(400) + "\nNow summarize in three bullet points."

console.log(`bench port=${port} model=${model} rounds=${rounds}`)

await report("smoke", () => chat(prompt128, { maxTokens: 32, stream: false }))
await report("decode-256", () => chat(prompt128, { maxTokens: 256 }))
await report("prefill-1k", () => chat(prompt1k, { maxTokens: 64, stream: false }))
await report("prefill-8k", () => chat(prompt8k, { maxTokens: 64, stream: false }))
for (let i = 0; i < rounds; i++) {
  await report(`round${i}-decode-256`, () => chat(prompt128, { maxTokens: 256 }))
}
