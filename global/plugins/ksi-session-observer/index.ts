// Optional project-local Native observer; no automatic execution or recovery.
import type { Plugin } from '@opencode/plugin';
import { setupSessionObserver } from './runtime.mjs';

export default { id: 'ksi.session-observer', setup: setupSessionObserver } satisfies Plugin.Plugin;
