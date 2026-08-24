import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

import {
  agentToolingIgnorePatterns,
  vendoredToolingIgnorePatterns,
} from "./agent-tooling.ts";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ...agentToolingIgnorePatterns,
    ...vendoredToolingIgnorePatterns,
  ],
  sortTailwindcss: {
    functions: ["clsx", "cva", "tw", "twMerge", "cn", "twJoin", "tv"],
    stylesheet: "./src/styles.css",
  },
});
