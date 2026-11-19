// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  rootRouteId,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { recoveryTitles } from "@/lib/seo.ts";
import { getRouter } from "@/router.tsx";

import { NotFound } from "./not-found.tsx";

describe(NotFound, () => {
  afterEach(() => {
    cleanup();
  });

  it("names the missing page and links home", async () => {
    const router = createRouter({
      defaultNotFoundComponent: NotFound,
      history: createMemoryHistory({ initialEntries: ["/missing"] }),
      routeTree: createRootRoute(),
    });

    render(<RouterProvider router={router} />);

    await expect(
      screen.findByRole("heading", { level: 1, name: recoveryTitles.notFound })
    ).resolves.toBeDefined();
    // The root shell renders the one main landmark around this page.
    expect(screen.queryByRole("main")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Return home" }).getAttribute("href")
    ).toBe("/");
  });

  it("catches a root-targeted notFound() thrown while a page renders", async () => {
    const appRouter = getRouter();

    const rootRoute = createRootRoute({
      notFoundComponent: appRouter.options.routeTree?.options.notFoundComponent,
    });

    const page = createRoute({
      component: () => {
        // Every route has an error boundary from the router's default, which
        // claims a bare notFound() for its own route, so this one names root.
        // oxlint-disable-next-line only-throw-error -- the router's own signal.
        throw notFound({ routeId: rootRouteId });
      },
      getParentRoute: () => rootRoute,
      path: "/page",
    });

    const router = createRouter({
      defaultErrorComponent: appRouter.options.defaultErrorComponent,
      defaultNotFoundComponent: appRouter.options.defaultNotFoundComponent,
      history: createMemoryHistory({ initialEntries: ["/page"] }),
      routeTree: rootRoute.addChildren([page]),
    });

    render(<RouterProvider router={router} />);

    await expect(
      screen.findByRole("heading", { level: 1, name: recoveryTitles.notFound })
    ).resolves.toBeDefined();
  });
});
