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
import { afterEach, describe, expect, it, vi } from "vitest";

import { recoveryTitles } from "@/lib/seo.ts";
import { getRouter } from "@/router.tsx";

import { NotFound } from "./not-found.tsx";

describe(NotFound, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("names the missing page and links home", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const router = createRouter({
      defaultNotFoundComponent: NotFound,
      history: createMemoryHistory({ initialEntries: ["/missing"] }),
      routeTree: createRootRoute(),
    });
    render(<RouterProvider router={router} />);

    await expect(
      screen.findByRole("heading", { level: 1, name: recoveryTitles.notFound })
    ).resolves.toBeDefined();
    expect(screen.getByRole("main").getAttribute("id")).toBe("main-content");
    expect(
      screen.getByRole("link", { name: "Return home" }).getAttribute("href")
    ).toBe("/");
  });

  it("catches a root-targeted notFound() thrown while a page renders", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
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
