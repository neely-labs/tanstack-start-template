import { createRouter as createTanStackRouter } from "@tanstack/react-router";

import { RouteError } from "./components/error-fallback.tsx";
import { NotFound } from "./components/not-found.tsx";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    // Router-wide recovery pages. A route's own `errorComponent` covers only
    // that route, and without a default the server renders the router's
    // built-in error box when a child route fails.
    defaultErrorComponent: RouteError,

    defaultNotFoundComponent: NotFound,

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
