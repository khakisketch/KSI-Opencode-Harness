// KSI managed visual workflow; Native V2 plugin entrypoint.
import type { Plugin } from "@opencode/plugin";
import { setupVisualWorkflow } from "./runtime.mjs";

// No copied skills, custom model loop, or replacement Native system prompt.
export default {
  id: "ksi.visual-workflow",
  setup: setupVisualWorkflow,
} satisfies Plugin.Plugin;
