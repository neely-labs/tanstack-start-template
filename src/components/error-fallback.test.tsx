// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { ErrorFallback, RouteError } from "./error-fallback.tsx";

describe(ErrorFallback, () => {
  afterEach(cleanup);

  it("focuses the alert and invokes recovery", () => {
    let retryCount = 0;

    render(
      <ErrorFallback
        error={new Error("Loader failed")}
        onRetry={() => {
          retryCount += 1;
        }}
      />
    );

    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(screen.queryByText("Loader failed")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retryCount).toBe(1);
  });

  it("shows safe technical detail only when requested", () => {
    render(
      <ErrorFallback
        error={new Error("Loader failed")}
        onRetry={() => {}}
        showDetails
      />
    );

    expect(screen.getByText("Loader failed")).toBeDefined();
  });

  it.each([null, undefined, false, "Failure", { message: "Unsafe detail" }])(
    "handles a non-Error thrown value (%j) without exposing it",
    (thrownValue) => {
      render(
        <ErrorFallback error={thrownValue} onRetry={() => {}} showDetails />
      );

      expect(screen.getByRole("alert")).toBeDefined();
      expect(screen.getByText("An unexpected error occurred.")).toBeDefined();
      expect(screen.queryByText("Unsafe detail")).toBeNull();
      expect(screen.queryByText("Failure")).toBeNull();
    }
  );
});

/** A router at `/broken` whose page uses the app's default error component. */
function renderBrokenRoute(
  options: Pick<Parameters<typeof createRoute>[0], "component" | "loader">
) {
  const rootRoute = createRootRoute();
  const brokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/broken",
    ...options,
  });
  const router = createRouter({
    defaultErrorComponent: RouteError,
    history: createMemoryHistory({ initialEntries: ["/broken"] }),
    routeTree: rootRoute.addChildren([brokenRoute]),
  });
  render(<RouterProvider router={router} />);
}

const reportLine = "Caught by the route boundary at /broken";

/** The lines the app's reporter logged, without React's own logging. */
function reports(consoleError: MockInstance<typeof console.error>) {
  return consoleError.mock.calls.filter((call) => call[0] === reportLine);
}

describe(RouteError, () => {
  let consoleError: MockInstance<typeof console.error>;
  beforeEach(() => {
    // React also logs every error a boundary catches; these are expected.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reports a failed loader once, with where it was caught", async () => {
    const failure = new Error("Loader failed");
    renderBrokenRoute({
      component: () => <h1>Loaded</h1>,
      loader: () => {
        throw failure;
      },
    });

    await expect(screen.findByRole("alert")).resolves.toBeDefined();
    expect(reports(consoleError)).toStrictEqual([[reportLine, failure]]);
  });

  it("recovers from a render error when the visitor tries again", async () => {
    let failRender = true;
    function FlakyPage() {
      if (failRender) {
        throw new Error("Render failed");
      }
      return <h1>Recovered</h1>;
    }
    renderBrokenRoute({ component: FlakyPage });

    await expect(screen.findByRole("alert")).resolves.toBeDefined();
    expect(reports(consoleError)).toHaveLength(1);

    failRender = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await expect(
      screen.findByRole("heading", { name: "Recovered" })
    ).resolves.toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
