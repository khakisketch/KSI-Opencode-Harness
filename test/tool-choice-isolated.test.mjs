import test from "node:test";
import assert from "node:assert/strict";
import { verifyToolChoice } from "../scripts/verify-tool-choice-isolated.mjs";

// Narrow characterization of a native assumption that actually failed in use.
// Opt-in: requires an already installed OpenCode CLI, never installs one.
test("auto-only final-summary overlay preserves the native step limit", {
  skip: process.env.KSI_TOOL_CHOICE_INTEGRATION !== "1",
  timeout: 90000,
}, async () => {
  const result = await verifyToolChoice();
  assert.equal(result.ok, true, result.failures.join("; "));
  assert.equal(result.sharedSessionsTouched, false);
  assert.equal(result.realProviderCalls, 0);
});
