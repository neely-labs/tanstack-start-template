import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

import { agentToolingIgnorePatterns } from "./agent-tooling.ts";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ...agentToolingIgnorePatterns,
  ],
  sortTailwindcss: {
    functions: ["clsx", "cva", "tw", "twMerge", "cn", "twJoin", "tv"],
    stylesheet: "./src/styles.css",
  },
});
