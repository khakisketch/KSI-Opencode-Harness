import type { Plugin } from "@opencode/plugin";
import { setupNativeDecision } from "./runtime.mjs";

export default { id: "ksi.native-decision", setup: setupNativeDecision } satisfies Plugin.Plugin;
