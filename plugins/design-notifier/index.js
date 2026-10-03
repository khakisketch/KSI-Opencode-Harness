// OpenCode V2 plugin: deliver OpenDesign run completion to the originating
// session.
//
// The plugin never starts, retries or cancels a design run. It records which
// session asked for a run, watches the run on the local OpenDesign daemon, and
// admits one advisory notification into that session when the run reaches a
// terminal state. Result interpretation and any implementation stay with the
// receiving agent and the user.
//
// Load with a global plugins entry, e.g.:
//   { "plugins": ["/absolute/path/to/plugins/design-notifier"] }
// Options: { stateDir, daemonUrl, pollMs }.

import { createDaemon } from "./lib/daemon.js";
import { createNotifier } from "./lib/notifier.js";
import { createStore, defaultStateDir } from "./lib/state.js";

const PLUGIN_ID = "ksi.design-notifier";

const DESIGN_RUNS_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["list", "watch", "pause", "resume"],
      description:
        "list: show tracked runs and pause state. watch: deliver this run's completion to the calling session (recovery when the automatic binding was lost). pause: admit completions without waking sessions. resume: restore automatic wake.",
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

    const notifier = createNotifier({ store, daemon, deliver, pollMs, quickPollMs, initialDelayMs, log });
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
      location: ctx.location?.directory ?? null,
      stateDir,
      daemonUrl,
      pollMs,
    });

    return async () => {
      stop();
      for (const registration of registrations) {
        try {
          await registration?.dispose?.();
        } catch {}
      }
    };
  },
};
