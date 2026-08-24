/**
 * SvelteKit registry entry.
 *
 * Detection and the apply/remove pair are the existing adapter's
 * (`../sveltekit-adapter.mjs`); this file only declares them to the registry
 * and names the artifacts the journal has to be able to heal.
 */

import {
  SVELTE_LAYOUT_MARKER_OPEN,
  SVELTE_LIVE_ROOT_COMPONENT,
  applySvelteKitLiveAdapter,
  detectSvelteKitProject,
  removeSvelteKitLiveAdapter,
  unpatchSvelteLayout,
} from "../sveltekit-adapter.mjs";

export const sveltekit = {
  detect(cwd, config) {
    return detectSvelteKitProject(cwd, config);
  },

  inject: {
    kind: "adapter",

    apply({ cwd, port, token, config }) {
      return applySvelteKitLiveAdapter({ config, cwd, port, token });
    },

    remove({ cwd, config }) {
      return removeSvelteKitLiveAdapter({ config, cwd });
    },

    // The generated root component and the `src/lib/impeccable/` runtime paths
    // are already in the static LIVE_IGNORE_PATTERNS list, so nothing extra.
    ignorePatterns() {
      return [];
    },

    artifacts({ project }) {
      return [
        {
          kind: "created",
          marker: "impeccable-live-root",
          path: SVELTE_LIVE_ROOT_COMPONENT,
          pruneTo: "src",
        },
        {
          kind: "patched",
          markers: [SVELTE_LAYOUT_MARKER_OPEN],
          patch: "sveltekit-layout",
          path: project?.layoutFile || "src/routes/+layout.svelte",
        },
      ];
    },

    unpatch: {
      "sveltekit-layout": unpatchSvelteLayout,
    },
  },

  name: "sveltekit",

  source: {
    extensions: [".svelte"],
    // Svelte resets component-local state on markup HMR updates, so variants
    // are mounted from generated components rather than written into the route.
    preview: "component",
    commentSyntax: "html",
  },
};
