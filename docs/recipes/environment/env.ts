// Browser variables from docs/recipes/environment.md.
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

/**
 * Every variable browser code reads. Vite bundles each `VITE_` value into
 * the page at build time, so none of them may be secret.
 */
export const publicEnv = createEnv({
  client: {
    VITE_SHOW_BANNER: z.stringbool().default(false),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv: import.meta.env,
});
