/**
 * compaction-continuity-live.mjs — bounded opt-in live probe for long-session
 * continuity across manual Native compaction (POST /api/session/{id}/compact).
 *
 * Approved validation scope: this file (+ tests/compaction-continuity.test.mjs)
 * and uniquely-named fixtures/evidence under /tmp/opencode. It never touches
 * global files, services, credentials, other sessions, or product code.
 *
 * Method (identical scenario for both variants):
 *   - One disposable Native API session per variant, location set to a fresh
 *     /tmp/opencode fixture directory. Model opencode-go/deepseek-v4.1-flash#max,
 *     agent build (fixed). Model calls consume usage; not part of the default suite.
 *   - The only variable between variants is the fixture's project-level
 *     compaction.keep.tokens: `current` mirrors the installed global value
 *     (8192), `native` uses the Native default (15000). `buffer` stays the
 *     global value for both; manual compaction tail selection does not consult
 *     buffer, so this isolates keep.tokens on the manual path.
 *   - Scenario (one session): goal + confirmed decisions + unconfirmed
 *     candidate + milestone state → work (create m2.py) → ~11k-token filler log
 *     that pushes the goal turn out of the retained tail → manual compact #1 →
 *     memory-only state check → next work (create m3.py) → unrelated side task →
 *     manual compact #2 → return prompt to resume the original development.
 *   - Compaction is requested through the official manual API, not a plugin.
 *   - Bounded: 15 min per variant, 32 min overall. Prompts wait for Native idle
 *     via experimental.session.wait with finite timeouts; a wait timeout
 *     interrupts only this session and stops the variant. No second prompt is
 *     injected to continue a failed stage.
 *
 * Run: node tests/compaction-continuity-live.mjs --variant current|native|all [--label <text>]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CHECKER_VERSION = "cc-1";
export const EVIDENCE_PARENT = "/tmp/opencode";
export const MODEL_REF = { providerID: "opencode-go", id: "deepseek-v4.1-flash", variant: "max" };
export const AGENT = "build";
export const PER_VARIANT_MS = 15 * 60 * 1000;
export const OVERALL_MS = 32 * 60 * 1000;

export const VARIANTS = {
  current: { keepTokens: 8192, label: "installed current (keep.tokens 8192)" },
  native: { keepTokens: 15000, label: "Native default (keep.tokens 15000)" },
};

// ---------------------------------------------------------------- fixtures and frozen prompts

export const FIXTURE_FILES = {
  "m1.py": "def m1():\n    return 1\n",
  "check.py":
    'import sys, os\n' +
    "sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))\n" +
    "from m1 import m1\n" +
    "from m2 import m2\n" +
    "from m3 import m3\n" +
    'assert m1() == 1, "m1"\n' +
    'assert m2() == 2, "m2"\n' +
    'assert m3() == 3, "m3"\n' +
    'print("check: ok")\n',
};

// Graded facts exist ONLY in the conversation, never in fixture files, so a
// re-read cannot recover them (see reread flag in the evidence).
export const PROMPTS = {
  goal:
    "개발 목표: 판매 데이터를 CSV로 내보내는 기능을 이 프로젝트에 추가한다. 최종 완료 기준은 `python3 check.py` 통과다.\n\n" +
    "확정 사항(사용자 확인 완료):\n" +
    "- 내보내기 파일명 형식: orders-YYYYMMDD.csv\n" +
    "- 표준 라이브러리만 사용, 네트워크 호출 금지\n" +
    "- m1.py는 수정하지 않는다\n\n" +
    "미확정 후보(아직 결정 아님, 확정된 것처럼 다루지 마):\n" +
    "- 배송비(shipping fee) 열 추가 여부\n\n" +
    "현재 상태: M1 완료(m1.py 존재). M2 미완료. M3 미완료. 최종 검증(check.py 통과) 미완료.\n" +
    "Plan 자문 결과(확정): 전역 리팩터 대신 국소 모듈 방식으로 진행한다.\n\n" +
    "이번 단계: m2.py를 만들고 def m2(): return 2 를 구현해. 만든 뒤 한 줄로 보고해.",
  fillerHeader: "아래는 방금 받은 배치 처리 로그야. 분석하지 말고, 한 줄로 '확인'이라고만 답해.",
  check1:
    "세션 기억만으로 답해. 파일을 다시 읽거나 도구를 쓰지 마.\n" +
    "(1) 원래 개발 목표\n" +
    "(2) 확정된 결정·제약\n" +
    "(3) 아직 확정되지 않은 후보\n" +
    "(4) 완료된 것과 아직 안 된 것\n" +
    "(5) 다음 할 일\n" +
    "짧게 불릿으로만.",
  m3: "다음 단계 진행: m3.py를 만들고 def m3(): return 3 을 구현해. check.py 실행은 아직 하지 말고 다음 단계로 남겨둬. 한 줄로 보고해.",
  sideHeader: "곁작업(개발과 무관, 잠깐만): 아래 로그에서 ERROR 줄이 몇 개인지 세서 숫자만 답해.",
  ret: "곁작업 끝. 이제 원래 개발 작업으로 복귀한다. 다음 할 일을 진행해.",
};

// ~11k-token filler: a single user message long enough that the earlier goal
// turn falls outside an 8192-token retained tail but inside a 15000 one.
export function fillerText() {
  const lines = [];
  for (let i = 0; i < 320; i++) {
    const mm = String(Math.floor(i / 6)).padStart(2, "0");
    const ss = String((i * 7) % 60).padStart(2, "0");
    lines.push(
      `2026-10-17T09:${mm}:${ss}Z INFO worker-${i % 7} processed batch ${i} records=${100 + (i % 500)} status=ok latency=${(i % 90) + 10}ms`
    );
  }
  return `${PROMPTS.fillerHeader}\n\n${lines.join("\n")}`;
}

export function sideText() {
  const lines = [];
  for (let i = 0; i < 40; i++) {
    const level = i === 7 || i === 19 || i === 33 ? "ERROR" : "INFO";
    lines.push(`incident node-${i % 4} seq=${i} level=${level} code=${level === "ERROR" ? "E" + i : 200} detail=queue-drain-${i}`);
  }
  return `${PROMPTS.sideHeader}\n\n${lines.join("\n")}`;
}

export function permissionsFor() {
  // Fixture-only: default deny, then the exact capabilities this scenario
  // needs (read/edit/glob/grep, session-local planning tools, and the final
  // check command). No ask effects, no --auto, so a stall can only be a wait
  // timeout, never a silent prompt.
  return [
    { action: "*", resource: "*", effect: "deny" },
    { action: "read", resource: "*", effect: "allow" },
    { action: "edit", resource: "*", effect: "allow" },
    { action: "glob", resource: "*", effect: "allow" },
    { action: "grep", resource: "*", effect: "allow" },
    { action: "question", resource: "*", effect: "allow" },
    { action: "todowrite", resource: "*", effect: "allow" },
    { action: "todoread", resource: "*", effect: "allow" },
    { action: "shell", resource: "python3 check.py", effect: "allow" },
    { action: "shell", resource: "python3 ./check.py", effect: "allow" },
  ];
}

// ---------------------------------------------------------------- pure helpers (unit-tested)

export function assistantTexts(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (m?.type !== "assistant") continue;
    for (const part of Array.isArray(m?.content) ? m.content : []) {
      if (part?.type === "text" && typeof part?.text === "string" && part.text) out.push(part.text);
    }
  }
  return out;
}

export function toolCalls(messages) {
  const out = [];
  for (const m of messages ?? []) {
    if (m?.type !== "assistant") continue;
    for (const part of Array.isArray(m?.content) ? m.content : []) {
      if (part?.type !== "tool" || !part?.name) continue;
      out.push({
        name: part.name,
        args: part.state?.input ?? part.input ?? null,
        status: part.state?.status ?? part.status ?? null,
        error: part.state?.error?.message ?? "",
      });
    }
  }
  return out;
}

export function userMessageCount(messages) {
  return (messages ?? []).filter((m) => m?.type === "user").length;
}

// The current step's visible answer and tool calls: everything after the LAST
// user message (we always wait for idle before reading, so this is the step
// just finished). Reasoning and idle markers are ignored.
export function lastTurn(messages) {
  const list = messages ?? [];
  let idx = -1;
  for (let i = list.length - 1; i >= 0; i--) if (list[i]?.type === "user") { idx = i; break; }
  const texts = [];
  const calls = [];
  for (let i = idx + 1; i < list.length; i++) {
    const m = list[i];
    if (m?.type !== "assistant") continue;
    for (const part of Array.isArray(m?.content) ? m.content : []) {
      if (part?.type === "text" && part.text) texts.push(part.text);
      if (part?.type === "tool" && part.name) {
        calls.push({ name: part.name, args: part.state?.input ?? null, status: part.state?.status ?? null });
      }
    }
  }
  return { text: texts.join("\n"), calls };
}

export function compactionRecord(messages, id) {
  const m = (messages ?? []).find((x) => x?.type === "compaction" && x?.id === id);
  if (!m) return null;
  return {
    id: m.id,
    status: m.status ?? null,
    reason: m.reason ?? null,
    error: m.error?.message ?? null,
    summary: typeof m.summary === "string" ? m.summary : null,
    recent: typeof m.recent === "string" ? m.recent : null,
  };
}

export function compactionSettled(rec) {
  return !!rec && rec.status !== "running";
}

export function compactionCompleted(rec) {
  return !!rec && rec.status === "completed";
}

// Retention evidence: what the summary kept vs what the retained tail kept.
export function retentionFlags(summary, recent) {
  const s = String(summary ?? "");
  const r = String(recent ?? "");
  return {
    summaryLen: s.length,
    recentLen: r.length,
    goalInSummary: /csv/i.test(s) && /(export|내보내기)/i.test(s),
    fileDecisionInSummary: /orders-?yyyymmdd/i.test(s),
    planDecisionInSummary: /(refactor|리팩터|국소|scope)/i.test(s),
    unconfirmedInSummary: /(shipping|배송비)/i.test(s),
    goalInRecent: /개발 목표/i.test(r),
    fileDecisionInRecent: /orders-?yyyymmdd/i.test(r),
  };
}

// Strong phrases only: a heading like "확정 사항" or "미확정" must not decide
// the outcome; the sentence has to actually assert or deny a decision.
const UNCONFIRMED_RE = /미확정|미정|보류|확정되지|정해지지|아직 (결정|정해지)|unconfirmed|undecided|not\s+(yet\s+)?(confirmed|decided)|left\s+open|pending|후보/i;
const CONFIRMED_RE = /확정하기로|확정되었|확정됐|확정합니다|확정입니다|결정하기로|결정했|포함하기로|채택하기로|decided to|confirmed (to|as)|will include|include\s+(the\s+)?(shipping|fee)/i;

export function unconfirmedConfusion(text) {
  const sentences = String(text ?? "").split(/[.\n!?。;•]+/);
  return sentences.some((s) => {
    if (!/(배송비|shipping)/i.test(s)) return false;
    if (UNCONFIRMED_RE.test(s)) return false;
    return CONFIRMED_RE.test(s);
  });
}

export function gradeStateCheck(text) {
  const t = String(text ?? "");
  return {
    goal: /csv/i.test(t) && /(내보내기|export)/i.test(t),
    fileDecision: /orders-?yyyymmdd/i.test(t),
    planDecision: /(리팩터|refactor|국소)/i.test(t),
    stateDone: /m1/i.test(t) && /m2/i.test(t),
    nextStep: /m3/i.test(t),
    unconfirmedOk: !unconfirmedConfusion(t),
  };
}

export function stateCheckPass(g) {
  return !!g && g.goal && g.fileDecision && g.planDecision && g.stateDone && g.nextStep && g.unconfirmedOk;
}

export function rereadCalls(calls) {
  return (calls ?? []).filter((c) => c && (c.name === "read" || c.name === "glob" || c.name === "grep"));
}

export function gradeReturn(text, calls) {
  const t = String(text ?? "");
  const shellCheck = (calls ?? []).some(
    (c) => c.name === "shell" && c.status !== "error" &&
      /check\.py/.test(typeof c.args?.command === "string" ? c.args.command : "")
  );
  const mentionsCheck = /check\.py/i.test(t);
  const mentionsGoal = /csv/i.test(t) && /(내보내기|export)/i.test(t);
  const resumed = shellCheck || mentionsCheck || (mentionsGoal && /(다음|next|검증|verify|진행)/i.test(t));
  const redoEdits = (calls ?? [])
    .filter((c) => c.name === "edit" || c.name === "write" || c.name === "patch")
    .map((c) => String(c.args?.filePath ?? c.args?.path ?? ""))
    .filter((p) => /m[123]\.py$/.test(p));
  return { resumed, resumedByAction: shellCheck, resumedByText: mentionsCheck, mentionsGoal, redoEdits };
}

export function variantVerdict({ infra, readsOk, modelOk, compact1Completed, stateCheckOk, compact2Completed, returnOk }) {
  if (infra) return "infra-blocked";
  if (!readsOk) return "harness-error";
  if (!modelOk || !compact1Completed || !stateCheckOk || !returnOk) return "fail";
  if (!compact2Completed) return "partial";
  return "pass";
}

export function detectInfraBlock(messages) {
  const blob = [...assistantTexts(messages), ...toolCalls(messages).map((t) => t.error)].join("\n");
  const m = blob.match(/(rate.?limit|quota|unauthorized|unauthenticated|payment required|model (not found|unavailable)|provider .*fail|overloaded|insufficient.*credit)/i);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------- CLI plumbing (official `opencode api`)

function api(op, params = [], data = null, timeoutMs = 120_000) {
  const args = ["api", op, ...params.flatMap((p) => ["--param", p])];
  if (data !== null) args.push("-d", data);
  const r = spawnSync("opencode", args, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch {}
  return { status: r.status, signal: r.signal ?? null, stderr: (r.stderr ?? "").slice(0, 500), parsed };
}

function sha256String(s) {
  return crypto.createHash("sha256").update(String(s ?? ""), "utf8").digest("hex");
}

function listMessages(sessionID) {
  const r = api("session.message.list", [`sessionID=${sessionID}`, "limit=200", "order=asc"]);
  const ok = Array.isArray(r.parsed?.data);
  return { ok, raw: r.parsed, messages: ok ? r.parsed.data : [] };
}

function dumpMessages(root, variant, tag, sessionID) {
  const r = listMessages(sessionID);
  try {
    const dir = path.join(root, variant, "raw");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `messages-${tag}.json`), JSON.stringify(r.raw, null, 1));
  } catch {}
  return r;
}

function waitIdle(sessionID, boundS) {
  const r = spawnSync(
    "timeout",
    [`${boundS}s`, "opencode", "api", "experimental.session.wait", "--param", `sessionID=${sessionID}`],
    { encoding: "utf8", timeout: (boundS + 20) * 1000 }
  );
  return { status: r.status, timed_out: r.status === 124 };
}

function promptStep(sessionID, text, boundS) {
  const p = api("session.prompt", [`sessionID=${sessionID}`], JSON.stringify({ text }));
  if (p.status !== 0) return { ok: false, stage: "prompt", detail: `status=${p.status}` };
  const w = waitIdle(sessionID, boundS);
  if (w.timed_out || w.status !== 0) {
    api("session.interrupt", [`sessionID=${sessionID}`, "resume=false"]);
    return { ok: false, stage: "wait", detail: `status=${w.status} timed_out=${w.timed_out}` };
  }
  return { ok: true };
}

function requestCompact(sessionID) {
  const r = api("session.compact", [`sessionID=${sessionID}`], "{}");
  const id = r.parsed?.data?.id ?? null;
  return { ok: r.status === 0 && !!id, id, detail: r.status === 0 ? "" : `status=${r.status} stderr=${r.stderr}` };
}

function pollCompact(sessionID, id, boundS) {
  const deadline = Date.now() + boundS * 1000;
  for (;;) {
    const { messages } = listMessages(sessionID);
    const rec = compactionRecord(messages, id);
    if (compactionSettled(rec)) return { rec, timed_out: false };
    if (Date.now() >= deadline) return { rec, timed_out: true };
    spawnSync("sleep", ["2"]);
  }
}

// ---------------------------------------------------------------- scenario runner

function writeFixture(root, variant) {
  const dir = path.join(root, `fixture-${variant}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, content] of Object.entries(FIXTURE_FILES)) fs.writeFileSync(path.join(dir, f), content);
  fs.writeFileSync(
    path.join(dir, "opencode.json"),
    JSON.stringify({ $schema: "https://opencode.ai/config.json", compaction: { keep: { tokens: VARIANTS[variant].keepTokens } } }, null, 2)
  );
  return dir;
}

function configDocs(dir) {
  // Route-string form: `opencode api get "/api/config?location[directory]=..."`.
  const q = new URLSearchParams({ "location[directory]": dir });
  const r = spawnSync("opencode", ["api", "get", `/api/config?${q.toString()}`], {
    encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
  });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch {}
  const list = Array.isArray(parsed) ? parsed : parsed?.data;
  if (!Array.isArray(list)) return [];
  return list.map((e) => ({
    type: e?.type ?? null,
    path: e?.path ?? null,
    keepTokens: e?.info?.compaction?.keep?.tokens ?? null,
  }));
}

async function runVariant(root, variant, label, deadline) {
  const v = VARIANTS[variant];
  const dir = writeFixture(root, variant);
  const ev = {
    variant, label, checker_version: CHECKER_VERSION, model: MODEL_REF, agent: AGENT,
    keep_tokens: v.keepTokens, fixture_dir: dir,
    fixture_sha: Object.fromEntries(Object.entries(FIXTURE_FILES).map(([f, c]) => [f, sha256String(c)])),
    started_at: new Date().toISOString(),
  };
  const t0 = Date.now();

  // 0. config documents for this fixture location
  ev.config_docs = configDocs(dir);

  // 1. session
  const created = api("session.create", [], JSON.stringify({
    location: { directory: dir }, agent: AGENT, model: MODEL_REF, permissions: permissionsFor(),
  }));
  const sessionID = created.parsed?.data?.id ?? null;
  if (!sessionID) {
    ev.harness_error = `session.create failed status=${created.status}`;
    ev.verdict = "harness-error";
    return ev;
  }
  ev.session_id = sessionID;

  const readAll = (tag) => dumpMessages(root, variant, tag, sessionID);

  const finishTurn = (tag) => {
    const { ok, messages } = readAll(tag);
    if (!ok) return null;
    return { messages, turn: lastTurn(messages) };
  };

  try {
    // 2. goal + first work
    let step = promptStep(sessionID, PROMPTS.goal, 300);
    if (!step.ok) throw new Error(`goal step failed: ${step.stage} ${step.detail}`);
    let t1 = finishTurn("after-goal");
    if (!t1) throw new Error("message read failed after goal");
    ev.after_goal = { text: t1.turn.text.slice(0, 1200), calls: t1.turn.calls.map((c) => ({ name: c.name, status: c.status })) };

    // 3. filler
    step = promptStep(sessionID, fillerText(), 300);
    if (!step.ok) throw new Error(`filler step failed: ${step.stage} ${step.detail}`);

    // 4. manual compact #1
    const c1 = requestCompact(sessionID);
    ev.compact1_request = { ok: c1.ok, id: c1.id, detail: c1.detail };
    let rec1 = null;
    if (c1.ok) {
      const p1 = pollCompact(sessionID, c1.id, 240);
      rec1 = p1.rec;
      ev.compact1_timed_out = p1.timed_out;
    }
    ev.compact1 = rec1 ? {
      status: rec1.status, reason: rec1.reason, error: rec1.error,
      retention: retentionFlags(rec1.summary, rec1.recent),
    } : null;
    readAll("after-compact1");

    // 5. memory-only state check
    step = promptStep(sessionID, PROMPTS.check1, 240);
    if (!step.ok) throw new Error(`check1 step failed: ${step.stage} ${step.detail}`);
    const t2 = finishTurn("after-check1");
    if (!t2) throw new Error("message read failed after check1");
    // If the compaction had not settled during the poll (e.g. it ran just
    // before the next prompt was processed), pick the settled record up now.
    if (c1.ok && !compactionCompleted(rec1)) {
      const later = compactionRecord(t2.messages, c1.id);
      if (later && later.status !== "running") {
        rec1 = later;
        ev.compact1 = {
          status: rec1.status, reason: rec1.reason, error: rec1.error,
          retention: retentionFlags(rec1.summary, rec1.recent), settled_after_poll: true,
        };
      }
    }
    const grade = gradeStateCheck(t2.turn.text);
    const reread = rereadCalls(t2.turn.calls);
    ev.check1 = {
      text: t2.turn.text.slice(0, 2000), grade,
      pass: stateCheckPass(grade),
      reread: reread.map((c) => ({ name: c.name })),
    };

    // 6. next work (m3, verification left for later)
    step = promptStep(sessionID, PROMPTS.m3, 300);
    if (!step.ok) throw new Error(`m3 step failed: ${step.stage} ${step.detail}`);
    const t3 = finishTurn("after-m3");
    ev.after_m3 = t3 ? { text: t3.turn.text.slice(0, 600), calls: t3.turn.calls.map((c) => ({ name: c.name, status: c.status })) } : null;

    // 7. unrelated side task
    step = promptStep(sessionID, sideText(), 240);
    if (!step.ok) throw new Error(`side step failed: ${step.stage} ${step.detail}`);
    const t4 = finishTurn("after-side");
    ev.after_side = t4 ? { text: t4.turn.text.slice(0, 400) } : null;

    // 8. manual compact #2
    const c2 = requestCompact(sessionID);
    ev.compact2_request = { ok: c2.ok, id: c2.id, detail: c2.detail };
    let rec2 = null;
    if (c2.ok) {
      const p2 = pollCompact(sessionID, c2.id, 240);
      rec2 = p2.rec;
      ev.compact2_timed_out = p2.timed_out;
    }
    ev.compact2 = rec2 ? {
      status: rec2.status, reason: rec2.reason, error: rec2.error,
      retention: retentionFlags(rec2.summary, rec2.recent),
    } : null;
    readAll("after-compact2");

    // 9. return to the original development
    step = promptStep(sessionID, PROMPTS.ret, 300);
    if (!step.ok) throw new Error(`return step failed: ${step.stage} ${step.detail}`);
    const t5 = finishTurn("after-return");
    if (!t5) throw new Error("message read failed after return");
    if (c2.ok && !compactionCompleted(rec2)) {
      const later2 = compactionRecord(t5.messages, c2.id);
      if (later2 && later2.status !== "running") {
        rec2 = later2;
        ev.compact2 = {
          status: rec2.status, reason: rec2.reason, error: rec2.error,
          retention: retentionFlags(rec2.summary, rec2.recent), settled_after_poll: true,
        };
      }
    }
    const ret = gradeReturn(t5.turn.text, t5.turn.calls);
    ev.return = { text: t5.turn.text.slice(0, 2000), ...ret };

    // 10. final reads
    const final = readAll("final");
    const info = api("session.get", [`sessionID=${sessionID}`]);
    ev.messages_ok = !!final;
    ev.user_messages = final ? userMessageCount(final.messages) : null;
    ev.model_identity = info.parsed?.data?.model ?? null;
    ev.model_match = !!ev.model_identity &&
      ev.model_identity.providerID === MODEL_REF.providerID &&
      ev.model_identity.id === MODEL_REF.id &&
      (ev.model_identity.variant ?? null) === MODEL_REF.variant;
    ev.usage = info.parsed?.data?.tokens ?? null;
    ev.cost = info.parsed?.data?.cost ?? null;
    ev.infra_block = final ? detectInfraBlock(final.messages) : null;

    ev.verdict = variantVerdict({
      infra: ev.infra_block,
      readsOk: !!final && !!info.parsed?.data,
      modelOk: ev.model_match,
      compact1Completed: compactionCompleted(rec1),
      stateCheckOk: ev.check1.pass,
      compact2Completed: compactionCompleted(rec2),
      returnOk: ret.resumed,
    });
  } catch (e) {
    ev.harness_error = String(e?.message ?? e).slice(0, 500);
    ev.verdict = ev.verdict ?? "harness-error";
    try { api("session.interrupt", [`sessionID=${sessionID}`, "resume=false"]); } catch {}
  }
  ev.elapsed_ms = Date.now() - t0;
  ev.finished_at = new Date().toISOString();
  return ev;
}

function parseArgs(argv) {
  const o = { variant: "current", label: "", root: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--variant" && argv[i + 1]) o.variant = argv[++i];
    else if (argv[i] === "--label" && argv[i + 1]) o.label = argv[++i];
    else if (argv[i] === "--root" && argv[i + 1]) o.root = argv[++i];
  }
  if (o.variant !== "all" && !VARIANTS[o.variant]) throw new Error(`--variant must be all|${Object.keys(VARIANTS).join("|")}`);
  return o;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const names = opts.variant === "all" ? Object.keys(VARIANTS) : [opts.variant];
  fs.mkdirSync(EVIDENCE_PARENT, { recursive: true });
  const root = opts.root
    ? (fs.mkdirSync(opts.root, { recursive: true }), opts.root)
    : fs.mkdtempSync(path.join(EVIDENCE_PARENT, "ksi-compaction-"));
  const deadline = Date.now() + OVERALL_MS;
  console.log(`variant=${names.join(",")} root=${root}`);
  console.log(`model=${MODEL_REF.providerID}/${MODEL_REF.id}#${MODEL_REF.variant} agent=${AGENT}`);
  const results = [];
  for (const name of names) {
    if (Date.now() > deadline) {
      results.push({ variant: name, verdict: "skipped-overall-timeout" });
      continue;
    }
    console.log(`--- variant ${name} (${VARIANTS[name].label}) ---`);
    let ev;
    try {
      ev = await runVariant(root, name, opts.label, deadline);
    } catch (e) {
      ev = { variant: name, verdict: "harness-error", harness_error: String(e?.message ?? e).slice(0, 500) };
    }
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(path.join(root, name, "evidence.json"), JSON.stringify(ev, null, 1));
    results.push({
      variant: name, verdict: ev.verdict, session: ev.session_id ?? null,
      compact1: ev.compact1 ? { status: ev.compact1.status, retention: ev.compact1.retention } : null,
      check1: ev.check1 ? { pass: ev.check1.pass, grade: ev.check1.grade, reread: ev.check1.reread?.length ?? 0 } : null,
      compact2: ev.compact2 ? { status: ev.compact2.status, retention: ev.compact2.retention } : null,
      return: ev.return ? { resumed: ev.return.resumed, byAction: ev.return.resumedByAction, redoEdits: ev.return.redoEdits } : null,
      elapsed_ms: ev.elapsed_ms ?? null, cost: ev.cost ?? null,
    });
    console.log(`${String(ev.verdict).toUpperCase()} ${name} session=${ev.session_id ?? "-"} ${ev.harness_error ?? ""}`);
  }
  const summary = {
    label: opts.label, root, model: MODEL_REF, agent: AGENT, checker_version: CHECKER_VERSION,
    variant_keep_tokens: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.keepTokens])),
    results,
    note:
      "Single-session smoke scenario per variant. It observes manual Native compaction continuity " +
      "(goal/decision/unconfirmed/state/next-step retention, side-task return) on one bounded case; " +
      "it cannot prove general long-project behavior, auto-compaction paths, or overall cost reduction. " +
      "Model calls consume opencode-go usage.",
  };
  fs.writeFileSync(path.join(root, `summary-${names.join("_")}.json`), JSON.stringify(summary, null, 1));
  console.log(`Evidence: ${root}`);
  const failed = results.filter((r) => r.verdict !== "pass");
  if (results.some((r) => r.verdict === "harness-error")) process.exitCode = 2;
  else if (failed.length) process.exitCode = 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main().catch((e) => { console.error("HARNESS-ERROR", e?.stack ?? String(e)); process.exitCode = 2; });
