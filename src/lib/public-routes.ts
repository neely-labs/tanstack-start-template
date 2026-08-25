import type { FileRouteTypes } from "../routeTree.gen.ts";

type RoutePath = FileRouteTypes["fullPaths"];

/**
 * Every file route, classified once.
 *
 * `public` routes are prerendered by `vite.config.ts`, listed in the generated
 * `sitemap.xml`, and checked by `pnpm seo:verify`. `private` routes are
 * deliberately excluded from all three.
 *
 * TanStack Router regenerates `RoutePath` from `src/routes`, so a route that is
 * added without being classified here fails `pnpm typecheck` instead of
 * silently shipping without prerendering, a sitemap entry, or SEO verification.
 */
const routeVisibility = {
  "/": "public",
  "/about": "public",
  // A server route renders no document, so there is nothing to prerender,
  // list in the sitemap, or verify with `pnpm seo:verify`.
  "/api/health": "private",
  "/runtime": "public",
} as const satisfies Record<RoutePath, "private" | "public">;

export const publicPaths = Object.entries(routeVisibility).flatMap(
  ([routePath, visibility]) => (visibility === "public" ? [routePath] : [])
);
