import {
  createRootRoute,
  createRoute,
  createRouter,
  HeadContent,
} from "@tanstack/react-router";
import {
  createRequestHandler,
  defaultStreamHandler,
} from "@tanstack/react-router/ssr/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pageTitle, recoveryMeta, recoveryTitles } from "@/lib/seo.ts";

import { getRouter } from "./router.tsx";

const pageHead = () => ({
  meta: [{ title: "Failing page" }, { content: "index", name: "robots" }],
});

const appRouter = getRouter();

/**
 * Server-renders a URL against the app router's recovery components and the
 * root head's recovery title, with routes that fail on purpose. The routes exist only
 * in this test, so production has no fault endpoint.
 */
async function serverRender(path: string) {
  const rootRoute = createRootRoute({
    head: ({ matches }) => ({ meta: recoveryMeta(matches) }),
    shellComponent: ({ children }) => (
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>{children}</body>
      </html>
    ),
  });
  const loaderFailure = createRoute({
    component: () => <h1>Loaded</h1>,
    getParentRoute: () => rootRoute,
    head: pageHead,
    loader: () => {
      throw new Error("Loader failed");
    },
    path: "/loader-failure",
  });
  const renderFailure = createRoute({
    component: () => {
      throw new Error("Render failed");
    },
    getParentRoute: () => rootRoute,
    head: pageHead,
    path: "/render-failure",
  });
  const handle = createRequestHandler({
    createRouter: () =>
      createRouter({
        defaultErrorComponent: appRouter.options.defaultErrorComponent,
        defaultNotFoundComponent: appRouter.options.defaultNotFoundComponent,
        routeTree: rootRoute.addChildren([loaderFailure, renderFailure]),
      }),
    request: new Request(`http://localhost${path}`),
  });
  const response = await handle(defaultStreamHandler);
  const html = await response.text();

  return {
    heading: /<h1[^>]*>(?<text>[^<]*)<\/h1>/u.exec(html)?.groups?.text,
    robots: [
      ...html.matchAll(/<meta content="(?<value>[^"]*)" name="robots"/gu),
    ].map((match) => match.groups?.value),
    status: response.status,
    title: /<title>(?<text>[^<]*)<\/title>/u.exec(html)?.groups?.text,
  };
}

describe("server-rendered recovery pages", () => {
  beforeEach(() => {
    // The server logs the failures these routes cause on purpose.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers a missing URL with 404, a title, and noindex", async () => {
    await expect(serverRender("/missing")).resolves.toStrictEqual({
      heading: recoveryTitles.notFound,
      robots: ["noindex"],
      status: 404,
      title: pageTitle(recoveryTitles.notFound),
    });
  });

  it("answers a failed loader with 500 and the error page", async () => {
    // The failed route's own head still runs, so its title wins over the
    // root's and its robots tag sits beside the error page's stricter one.
    await expect(serverRender("/loader-failure")).resolves.toStrictEqual({
      heading: "This page couldn&#x27;t finish loading.",
      robots: ["index", "noindex"],
      status: 500,
      title: "Failing page",
    });
  });

  it("answers a render error with 200 and leaves the error page to the browser", async () => {
    // React streams a client-rendered fallback for the failed subtree, and the
    // router never records a failed match, so the status stays 200.
    await expect(serverRender("/render-failure")).resolves.toStrictEqual({
      heading: undefined,
      robots: ["index"],
      status: 200,
      title: "Failing page",
    });
  });
});
