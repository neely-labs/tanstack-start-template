// @vitest-environment jsdom

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { recoveryTitles } from "@/lib/seo.ts";

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
});
