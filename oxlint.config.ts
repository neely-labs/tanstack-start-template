import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import jsPlugins from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import vitest from "ultracite/oxlint/vitest";

import {
  agentToolingIgnorePatterns,
  vendoredToolingIgnorePatterns,
} from "./agent-tooling.ts";

const selectedPluginNames = new Set(["react-doctor"]);

type PluginEntry = NonNullable<typeof jsPlugins.jsPlugins>[number];

function isBarePluginName(plugin: PluginEntry): plugin is string {
  return typeof plugin === "string";
}

function pluginName(plugin: PluginEntry): string {
  return isBarePluginName(plugin) ? plugin : plugin.name;
}

const selectedJsPlugins = {
  ...jsPlugins,
  jsPlugins: jsPlugins.jsPlugins?.filter((plugin) =>
    selectedPluginNames.has(pluginName(plugin))
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

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    vitest,
    tanstackJsPlugins,
    selectedJsPlugins,
  ],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ...agentToolingIgnorePatterns,
    ...vendoredToolingIgnorePatterns,
  ],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
  ],
  overrides: [
    {
      files: ["src/routes/**/*.tsx"],
      rules: {
        "no-use-before-define": "off",
        "react-doctor/only-export-components": "off",
      },
    },
    {
      files: ["src/components/ui/**/*.tsx"],
      rules: { "react-doctor/only-export-components": "off" },
    },
    {
      files: ["scripts/**/*.mjs"],
      rules: { "anti-slop/no-runtime-typeof": "off" },
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
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": ["error", { allowInTypeGuards: true }],
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "func-style": "off",
    "react/function-component-definition": "off",
  },
});
