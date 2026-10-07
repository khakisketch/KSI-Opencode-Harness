import test from "node:test";
import assert from "node:assert/strict";
import { verifyToolChoice } from "../scripts/verify-tool-choice-isolated.mjs";
import * as probe from "../scripts/verify-tool-choice-isolated.mjs";

test("a received second request cannot make the first completed assistant the final result", () => {
  assert.equal(typeof probe.selectFinalAssistant, "function");
  const first = { id: "first", time: { completed: 1 }, content: [{ type: "tool" }] };
  const streaming = { id: "second", time: { created: 2 }, content: [] };
  const final = { id: "second", time: { created: 2, completed: 3 }, content: [{ type: "text", text: "bounded-summary" }] };
  assert.equal(probe.selectFinalAssistant([first], 2), undefined);
  assert.equal(probe.selectFinalAssistant([first, streaming], 2), undefined);
  assert.equal(probe.selectFinalAssistant([first, final], 1), undefined);
  assert.equal(probe.selectFinalAssistant([first, final], 2), final);
});

// Narrow characterization of a native assumption that actually failed in use.
// Opt-in: requires an already installed OpenCode CLI, never installs one.
test("auto-only final-summary overlay preserves the native step limit", {
  skip: process.env.KSI_TOOL_CHOICE_INTEGRATION !== "1",
  timeout: 90000,
}, async () => {
  const result = await verifyToolChoice();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.sharedSessionsTouched, false);
  assert.equal(result.realProviderCalls, 0);
});
