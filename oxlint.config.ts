import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import jsPlugins from "ultracite/oxlint/js-plugins";
import landmines from "ultracite/oxlint/landmines";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import vitest from "ultracite/oxlint/vitest";

import { agentToolingIgnorePatterns } from "./agent-tooling.ts";

const selectedPluginNames = new Set(["react-doctor"]);

const selectedJsPlugins = {
  ...jsPlugins,
  jsPlugins: jsPlugins.jsPlugins?.filter((plugin) =>
    selectedPluginNames.has(plugin.name)
  ),
  overrides: jsPlugins.overrides?.map((override) => ({
    ...override,
    rules: Object.fromEntries(
      Object.entries(override.rules ?? {}).filter(([ruleName]) =>
        selectedPluginNames.has(ruleName.split("/")[0] ?? ruleName)
      )
    ),
  })),
  rules: Object.fromEntries(
    Object.entries(jsPlugins.rules ?? {}).filter(([ruleName]) =>
      selectedPluginNames.has(ruleName.split("/")[0] ?? ruleName)
    )
  ),
};

// Playwright uses its own test globals and asynchronous assertions.
const unitTestRules = {
  ...vitest,
  overrides: vitest.overrides?.map((override) => ({
    ...override,
    files: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  })),
};

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    unitTestRules,
    tanstackJsPlugins,
    selectedJsPlugins,
    antiSlop,
    shadcn,
    landmines,
  ],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ...agentToolingIgnorePatterns,
  ],
  options: { typeAware: true },
  overrides: [
    {
      files: ["src/routes/**/*.tsx"],
      rules: {
        "no-use-before-define": "off",
        "react-doctor/only-export-components": "off",
      },
    },
    {
      // Browser tests exercise the whole app, so no one module owns them.
      files: ["test/e2e/**"],
      rules: { "landmines-structure/colocated-tests": "off" },
    },
    {
      files: ["src/components/ui/**/*.tsx"],
      rules: { "react-doctor/only-export-components": "off" },
    },
    {
      // TanStack Start middleware awaits `next()` to obtain the downstream
      // result and then modifies it. It is a chain continuation, not a Node
      // error-first callback that must be returned immediately.
      files: ["src/start.ts"],
      rules: { "node/callback-return": "off" },
    },
  ],
  rules: {
    // Agents lean on comments to explain away shortcuts, but this rule also
    // bans the SAFETY comments anti-slop requires on type assertions.
    "landmines-style/no-comments": "off",
    "func-style": "off",
    "react/function-component-definition": "off",
    // Its autofix adds `async` to any function that returns a promise. The
    // result fails `require-await` until a second `pnpm fix` adds `return
    // await`. In an array callback such as `.map((x) => load(x))` whose array
    // is not passed to `Promise.all`, it then fails
    // `react-doctor/async-await-in-loop`, so no fixed form passes. Oxlint
    // cannot turn off one rule's fix, so the rule is off instead.
    "typescript/promise-function-async": "off",
  },
});
