// OpenCode V2 plugin: deliver OpenDesign run completion to the originating
// session.
//
// The plugin never starts, retries or cancels a design run. It records which
// session asked for a run, watches the run on the local OpenDesign daemon, and
// admits one advisory notification into that session when the run reaches a
// terminal state. Result interpretation and any implementation stay with the
// receiving agent and the user.
//
// Load from the global OpenCode config directory
// (`~/.config/opencode/plugins/design-notifier`) or with a plugins entry.
// Install with `node scripts/install-design-notifier.mjs` so the runtime uses
// a pinned copy instead of the live development tree.
// Options: { stateDir, daemonUrl, pollMs, quickPollMs, initialDelayMs,
// toolNamePrefix, instanceLabel, renewEveryMs, leaseTtlMs }.

import { createDaemon } from "./lib/daemon.js";
import { createNotifier } from "./lib/notifier.js";
import { createStore, defaultStateDir } from "./lib/state.js";

const PLUGIN_ID = "ksi.design-notifier";
const PLUGIN_VERSION = "0.2.0";

const DESIGN_RUNS_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "watch", "pause", "resume"],
      description:
        "list: show tracked/held runs, pause state and poller leadership. watch: bind an existing run to the calling session (recovery when the automatic binding was lost). pause/resume: control automatic wake permission — paused completions are stored in notifier state and delivered when resumed.",
    },
    scope: {
      type: "string",
      enum: ["session", "all"],
      description: "pause/resume scope: this session (default) or every session.",
    },
    runId: {
      type: "string",
      description: "OpenDesign run id. Required for action=watch.",
    },
  },
  required: ["action"],
  additionalProperties: false,
};

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

function normalizeSyntheticError(error) {
  const status =
    error?.status ?? error?.data?.status ?? error?.response?.status ?? error?.cause?.status ?? null;
  const wrapped = new Error(
    `session synthetic delivery failed${status ? ` (${status})` : ""}: ${error?.message ?? String(error)}`,
  );
  if (status) wrapped.status = status;
  wrapped.cause = error;
  return wrapped;
}

export default {
  id: PLUGIN_ID,

  async setup(ctx) {
    const options = ctx?.options && typeof ctx.options === "object" ? ctx.options : {};
    const stateDir =
      pickString(options.stateDir, process.env.KSI_DESIGN_NOTIFIER_STATE_DIR) ?? defaultStateDir();
    const daemonUrl =
      pickString(options.daemonUrl, process.env.KSI_DESIGN_NOTIFIER_DAEMON_URL) ??
      "http://127.0.0.1:7456";
    const pollMs = clampInt(
      options.pollMs ?? process.env.KSI_DESIGN_NOTIFIER_POLL_MS ?? 60_000,
      5_000,
      60 * 60 * 1000,
      60_000,
    );
    const quickPollMs = clampInt(options.quickPollMs ?? 4_000, 250, 60_000, 4_000);
    const initialDelayMs = clampInt(options.initialDelayMs ?? 1_500, 0, 60_000, 1_500);
    const toolNamePrefix =
      pickString(options.toolNamePrefix, process.env.KSI_DESIGN_NOTIFIER_TOOL_PREFIX) ?? "opendesign";

    const store = createStore({ dir: stateDir });
    try {
      await store.init();
    } catch (error) {
      console.error(`[${PLUGIN_ID}] disabled: cannot use state dir ${stateDir}: ${error?.message ?? error}`);
      return () => {};
    }

    const daemon = createDaemon({ baseUrl: daemonUrl });
    const log = (event, fields) => {
      void store.log(event, fields);
    };
    const deliver = async ({ sessionID, message }) => {
      try {
        await ctx.session.synthetic({
          sessionID,
          id: message.id,
          text: message.text,
          description: message.description,
          metadata: message.metadata,
          delivery: message.delivery,
          resume: message.resume,
        });
      } catch (error) {
        throw normalizeSyntheticError(error);
      }
    };

    const notifier = createNotifier({
      store,
      daemon,
      deliver,
      pollMs,
      quickPollMs,
      initialDelayMs,
      toolNamePrefix,
      instanceLabel: ctx.location?.directory ?? null,
      log,
    });
    const registrations = [];
    try {
      registrations.push(await ctx.tool.hook("execute.before", (event) => notifier.handleToolBefore(event)));
      registrations.push(await ctx.tool.hook("execute.after", (event) => notifier.handleToolAfter(event)));
      registrations.push(
        await ctx.tool.transform((editor) => {
          editor.add({
            name: "design_runs",
            description:
              "Inspect and control the KSI design completion notifier: list tracked OpenDesign runs and pause state, watch an existing run so its completion reaches this session, or pause/resume automatic wake deliveries.",
            input: DESIGN_RUNS_SCHEMA,
            execute: (input, toolContext) => notifier.runTool(input, toolContext),
          });
        }),
      );
    } catch (error) {
      console.error(`[${PLUGIN_ID}] registration failed: ${error?.message ?? error}`);
      for (const registration of registrations) {
        try {
          await registration?.dispose?.();
        } catch {}
      }
      return () => {};
    }

    const stop = notifier.start();
    log("setup", {
      version: ctx.app?.version ?? null,
      pluginVersion: PLUGIN_VERSION,
      instanceId: String(notifier.instanceId).slice(0, 8),
      location: ctx.location?.directory ?? null,
      stateDir,
      daemonUrl,
      pollMs,
    });

    return async () => {
      stop();
      await notifier.release();
      for (const registration of registrations) {
        try {
          await registration?.dispose?.();
        } catch {}
      }
    };
  },
};
