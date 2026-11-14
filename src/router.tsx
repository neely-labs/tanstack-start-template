import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { RouteError } from "./components/error-fallback.tsx";
import { NotFound } from "./components/not-found.tsx";
import { routeTree } from "./routeTree.gen";

/**
 * Router-wide recovery pages. A route's own `errorComponent` applies only to
 * that route, and without a default the server renders the router's built-in
 * error box for a child route's failure, so these are set here once.
 */
export const recoveryComponents = {
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
} as const;

export function getRouter() {
  const router = createTanStackRouter({
    ...recoveryComponents,

    defaultPreload: "intent",

    defaultPreloadStaleTime: 0,

    routeTree,

    scrollRestoration: true,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
