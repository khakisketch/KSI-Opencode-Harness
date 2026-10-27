import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keepInstalledBinary } from "../scripts/install-ai-memory.mjs";

describe("ai-memory installer version preservation", () => {
  for (const version of ["3.2.8", "3.2.9", "3.2.10", "3.10.0", "4.0.0"]) {
    it(`preserves stable ${version} without reinstalling the baseline`, () => {
      assert.equal(keepInstalledBinary(`ai-memory ${version}\n`), true);
    });
  }

  for (const version of ["3.2.5", "3.2.7", "3.1.99", "2.99.99"]) {
    it(`requires the official upgrade for ${version}`, () => {
      assert.equal(keepInstalledBinary(`ai-memory ${version}`), false);
    });
  }

  for (const output of ["", "ai-memory 3.2.8-rc.1", "ai-memory 3.2.80-dev", "other 3.2.8", "warning\nai-memory 3.2.8"]) {
    it(`refuses to overwrite an unrecognized version (${JSON.stringify(output)})`, () => {
      assert.throws(() => keepInstalledBinary(output), /leaving the existing binary untouched/);
    });
  }
});
