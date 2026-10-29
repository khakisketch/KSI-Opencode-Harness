// KSI managed session evidence; Native V2 plugin entrypoint.
import type { Plugin } from "@opencode/plugin";
import { setupSessionEvidence } from "./runtime.mjs";

// No session writes, hooks, model calls, or bundled skills.
export default {
  id: "ksi.session-evidence",
  setup: setupSessionEvidence,
} satisfies Plugin.Plugin;
