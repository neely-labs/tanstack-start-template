// Startup check from docs/recipes/environment.md.
import { definePlugin } from "nitro";

import "./env.server.ts";
import "./env.ts";

/**
 * Nitro runs each plugin when the server starts, including the server the
 * build starts to prerender pages, so a bad value stops `pnpm build` and
 * `pnpm start` instead of failing a later request.
 */
export default definePlugin(() => {
  // The imports above parse every variable; nothing is left to set up.
});
