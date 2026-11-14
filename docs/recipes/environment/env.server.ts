// Server variables from docs/recipes/environment.md.
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * Every server variable the app reads, parsed once. The `.server.ts` suffix
 * makes TanStack Start fail the build when browser code imports this file.
 */
export const serverEnv = createEnv({
  // No client variables here. The prefix makes a `VITE_` name in `server` a
  // type error, since Vite hands every `VITE_` value to browser code.
  client: {},
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(10),
    DATABASE_URL: z.url(),
  },
});
