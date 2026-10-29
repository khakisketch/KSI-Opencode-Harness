// KSI managed capabilities inventory; Native V2 plugin entrypoint.
import type { Plugin } from "@opencode/plugin";
import { setupCapabilitiesInventory } from "./runtime.mjs";

// No copied skills, custom model loop, or replacement Native system prompt.
export default {
  id: "ksi.capabilities-inventory",
  setup: setupCapabilitiesInventory,
} satisfies Plugin.Plugin;
