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
  "/api/health": "private",
  "/runtime": "public",
  "/setup": "public",
} as const satisfies Record<RoutePath, "private" | "public">;

/**
 * A route path classified `public` above. Page metadata takes this type, so a
 * canonical URL or schema path can only name a page that is prerendered and
 * verified. Which public page it names is checked by `pnpm seo:verify`.
 */
export type PublicPath = {
  [P in RoutePath]: (typeof routeVisibility)[P] extends "public" ? P : never;
}[RoutePath];

// `Object.keys` widens keys to `string`; this guard narrows them back.
function isPublicPath(routePath: string): routePath is PublicPath {
  return Object.entries(routeVisibility).some(
    ([candidate, visibility]) =>
      candidate === routePath && visibility === "public"
  );
}

export const publicPaths = Object.keys(routeVisibility).filter(isPublicPath);
