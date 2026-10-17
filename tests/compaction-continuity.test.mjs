/**
 * compaction-continuity.test.mjs — pure helper tests for the compaction
 * continuity probe (no model, no network). Mock messages use the real Native
 * v2.0.32 message schema observed during development: assistant content parts
 * (text / reasoning / tool with state.input), top-level `compaction` messages
 * with id/status/reason/summary/recent, and `idle` markers.
 *
 * Run: `node --test tests/compaction-continuity.test.mjs` from the repo root.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  lastTurn,
  compactionRecord,
  compactionSettled,
  compactionCompleted,
  retentionFlags,
  unconfirmedConfusion,
  gradeStateCheck,
  stateCheckPass,
  rereadCalls,
  gradeReturn,
  variantVerdict,
  fillerText,
  sideText,
  permissionsFor,
  PROMPTS,
  FIXTURE_FILES,
} from "./compaction-continuity-live.mjs";

const tool = (name, input, status = "completed", error = null) => ({
  type: "tool",
  id: `call_${name}`,
  name,
  state: { status, input, ...(error ? { error: { message: error } } : {}) },
});
const assistant = (texts = [], tools = [], extra = {}) => ({
  type: "assistant",
  ...extra,
  content: [...texts.map((text) => ({ type: "text", text })), ...tools],
});
const reasoning = (text) => ({ type: "assistant", content: [{ type: "reasoning", text }] });
const user = (text) => ({ type: "user", text });
const idle = () => ({ type: "idle" });
const compaction = (id, status, { summary = null, recent = null, error = null } = {}) => ({
  type: "compaction",
  id,
  status,
  reason: "manual",
  ...(summary !== null ? { summary } : {}),
  ...(recent !== null ? { recent } : {}),
  ...(error ? { error: { message: error } } : {}),
});

describe("lastTurn", () => {
  it("returns the visible text and tool calls after the LAST user message only", () => {
    const msgs = [
      user("goal"),
      assistant(["first reply"]),
      idle(),
      user("check1"),
      reasoning("hidden chain"),
      assistant(["answer text"], [tool("read", { filePath: "m1.py" })]),
      idle(),
    ];
    const t = lastTurn(msgs);
    assert.equal(t.text, "answer text");
    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0].name, "read");
    assert.equal(t.calls[0].args.filePath, "m1.py");
  });
  it("returns empty text/calls when no user message exists", () => {
    const t = lastTurn([idle(), reasoning("x")]);
    assert.equal(t.text, "");
    assert.deepEqual(t.calls, []);
  });
});

describe("compaction records", () => {
  const running = compaction("msg_1", "running");
  const completed = compaction("msg_1", "completed", { summary: "## Objective", recent: "[User]: hi" });
  const failed = compaction("msg_1", "failed", { error: "Nothing to compact yet" });
  it("finds the record by exact id and reports its status", () => {
    assert.equal(compactionRecord([running], "msg_1").status, "running");
    assert.equal(compactionRecord([running], "msg_other"), null);
  });
  it("settles only when no longer running", () => {
    assert.equal(compactionSettled(running), false);
    assert.equal(compactionSettled(completed), true);
    assert.equal(compactionSettled(failed), true);
    assert.equal(compactionSettled(null), false);
  });
  it("treats only completed as completed", () => {
    assert.equal(compactionCompleted(completed), true);
    assert.equal(compactionCompleted(failed), false);
    assert.equal(compactionCompleted(running), false);
  });
  it("exposes summary, recent, and error text", () => {
    const rec = compactionRecord([failed], "msg_1");
    assert.equal(rec.error, "Nothing to compact yet");
    assert.equal(rec.summary, null);
    assert.equal(compactionRecord([completed], "msg_1").summary, "## Objective");
  });
});

describe("retentionFlags", () => {
  it("detects an English summary retaining goal, file decision, plan decision, and unconfirmed candidate", () => {
    const summary =
      "## Objective\n- Add a sales CSV export feature.\n\n## Decisions\n- Filename orders-YYYYMMDD.csv confirmed.\n" +
      "- Shipping fee column left unconfirmed.\n- Local module approach (no global refactor).";
    const f = retentionFlags(summary, "");
    assert.equal(f.goalInSummary, true);
    assert.equal(f.fileDecisionInSummary, true);
    assert.equal(f.planDecisionInSummary, true);
    assert.equal(f.unconfirmedInSummary, true);
  });
  it("detects the goal turn kept verbatim in the retained tail", () => {
    const recent = "[User]: 개발 목표: 판매 데이터를 CSV로 내보내는 기능...\\norders-YYYYMMDD.csv";
    const f = retentionFlags("", recent);
    assert.equal(f.goalInRecent, true);
    assert.equal(f.fileDecisionInRecent, true);
  });
  it("reports false when neither summary nor tail carries the facts", () => {
    const f = retentionFlags("Unrelated maintenance notes.", "[Assistant]: 확인");
    assert.equal(f.goalInSummary, false);
    assert.equal(f.fileDecisionInSummary, false);
    assert.equal(f.goalInRecent, false);
    assert.equal(f.fileDecisionInRecent, false);
  });
});

describe("unconfirmedConfusion", () => {
  it("flags a sentence that presents the unconfirmed candidate as decided", () => {
    assert.equal(unconfirmedConfusion("배송비 열도 확정되었습니다."), true);
    assert.equal(unconfirmedConfusion("배송비 컬럼을 포함하기로 결정했습니다."), true);
  });
  it("does not flag explicit unconfirmed/undecided framing", () => {
    assert.equal(unconfirmedConfusion("배송비 컬럼 포함 여부 — 찬반 어느 쪽으로도 확정되지 않음."), false);
    assert.equal(unconfirmedConfusion("Shipping fee column is an undecided candidate — do not treat as settled either way."), false);
  });
  it("does not flag answers that never mention the candidate", () => {
    assert.equal(unconfirmedConfusion("완료: m1, m2. 다음: m3."), false);
  });
});

describe("gradeStateCheck", () => {
  const full =
    "**(1) 원래 목표** 판매 CSV 내보내기 기능 추가.\n" +
    "**(2) 확정** 파일명 orders-YYYYMMDD.csv, 표준 라이브러리만, 국소 모듈 방식(m1.py 수정 금지).\n" +
    "**(3) 미확정** 배송비 열 — 확정되지 않음.\n" +
    "**(4) 완료: m1, m2. 미완료: m3.**\n" +
    "**(5) 다음** m3 구현.";
  it("passes a faithful answer", () => {
    const g = gradeStateCheck(full);
    assert.equal(stateCheckPass(g), true);
  });
  it("fails when the confirmed filename decision is lost", () => {
    const g = gradeStateCheck(full.replaceAll("orders-YYYYMMDD.csv", "내보내기 파일"));
    assert.equal(g.fileDecision, false);
    assert.equal(stateCheckPass(g), false);
  });
  it("fails when the Plan-confirmed direction is lost", () => {
    const g = gradeStateCheck(full.replace("국소 모듈 방식", "진행 방식"));
    assert.equal(g.planDecision, false);
    assert.equal(stateCheckPass(g), false);
  });
  it("fails when the unconfirmed candidate is presented as decided", () => {
    const g = gradeStateCheck(full.replace("**(3) 미확정** 배송비 열 — 확정되지 않음.", "**(3)** 배송비 열도 확정되었습니다."));
    assert.equal(g.unconfirmedOk, false);
    assert.equal(stateCheckPass(g), false);
  });
});

describe("rereadCalls", () => {
  it("flags read/glob/grep but not shell check runs", () => {
    const calls = [
      { name: "read", args: { filePath: "m1.py" } },
      { name: "shell", args: { command: "python3 check.py" } },
      { name: "grep", args: { pattern: "m3" } },
    ];
    assert.deepEqual(rereadCalls(calls).map((c) => c.name), ["read", "grep"]);
  });
});

describe("gradeReturn", () => {
  it("counts a completed shell check run as resumption by action", () => {
    const r = gradeReturn("복귀합니다.", [tool("shell", { command: "python3 check.py" })].map((p) => ({ name: p.name, args: p.state.input, status: p.state.status })));
    assert.equal(r.resumedByAction, true);
    assert.equal(r.resumed, true);
  });
  it("counts an explicit check mention in text", () => {
    const r = gradeReturn("원래 작업으로 복귀합니다. 다음 단계로 check.py를 실행하겠습니다.", []);
    assert.equal(r.resumedByText, true);
    assert.equal(r.resumed, true);
  });
  it("flags re-edits of already-done modules", () => {
    const r = gradeReturn("복귀", [
      { name: "edit", args: { filePath: "m2.py" }, status: "completed" },
      { name: "edit", args: { filePath: "export_notes.md" }, status: "completed" },
    ]);
    assert.deepEqual(r.redoEdits, ["m2.py"]);
  });
  it("does not count an unrelated answer as resumed", () => {
    const r = gradeReturn("곁작업 로그는 ERROR 3건이었습니다.", []);
    assert.equal(r.resumed, false);
  });
});

describe("variantVerdict", () => {
  const ok = { infra: null, readsOk: true, modelOk: true, compact1Completed: true, stateCheckOk: true, compact2Completed: true, returnOk: true };
  it("passes when everything holds", () => assert.equal(variantVerdict(ok), "pass"));
  it("reports partial when the second compaction did not complete", () =>
    assert.equal(variantVerdict({ ...ok, compact2Completed: false }), "partial"));
  it("fails on a lost state check", () =>
    assert.equal(variantVerdict({ ...ok, stateCheckOk: false }), "fail"));
  it("fails when the model identity does not match", () =>
    assert.equal(variantVerdict({ ...ok, modelOk: false }), "fail"));
  it("fails when the first compaction did not complete", () =>
    assert.equal(variantVerdict({ ...ok, compact1Completed: false }), "fail"));
  it("separates harness errors and infra blocks", () => {
    assert.equal(variantVerdict({ ...ok, readsOk: false }), "harness-error");
    assert.equal(variantVerdict({ ...ok, infra: "rate limit" }), "infra-blocked");
  });
});

describe("frozen scenario sanity", () => {
  it("filler is a single large log message with the max line", () => {
    const f = fillerText();
    assert.ok(f.startsWith(PROMPTS.fillerHeader));
    assert.ok(f.split("\n").length > 300);
    assert.ok(f.includes("batch 319"));
  });
  it("side task contains exactly three ERROR lines", () => {
    const s = sideText();
    assert.equal(s.split("\n").filter((l) => l.includes("level=ERROR")).length, 3);
  });
  it("goal prompt carries the graded facts exactly once each", () => {
    assert.ok(PROMPTS.goal.includes("orders-YYYYMMDD.csv"));
    assert.ok(PROMPTS.goal.includes("배송비"));
    assert.ok(PROMPTS.goal.includes("국소 모듈 방식"));
    assert.ok(PROMPTS.check1.includes("세션 기억만으로"));
  });
  it("fixture files never contain the graded conversation facts", () => {
    const all = Object.values(FIXTURE_FILES).join("\n");
    assert.ok(!/orders-?yyyymmdd/i.test(all));
    assert.ok(!/배송비|shipping/i.test(all));
    assert.ok(!/csv|내보내기/i.test(all));
  });
  it("session permissions default-deny with the exact needed allows", () => {
    const p = permissionsFor();
    assert.deepEqual(p[0], { action: "*", resource: "*", effect: "deny" });
    assert.ok(p.some((r) => r.action === "edit" && r.effect === "allow"));
    assert.ok(p.some((r) => r.action === "shell" && r.resource === "python3 check.py" && r.effect === "allow"));
    assert.ok(!p.some((r) => r.effect === "ask"));
  });
});
