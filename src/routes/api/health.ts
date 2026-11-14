import { createFileRoute } from "@tanstack/react-router";

/**
 * A server route: an HTTP endpoint that shares the router's file-based paths
 * but renders no component. It is classified `private` in
 * `src/lib/public-routes.ts`, so it is never prerendered or listed in the
 * sitemap.
 *
 * Start answers HEAD with the GET handler. Any other method falls through to
 * page rendering, which answers 200 with an empty page, unless the route
 * defines `ANY`; here `ANY` refuses it with 405 and the methods that work.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          status: "ok",
          time: new Date().toISOString(),
        }),
      ANY: () =>
        new Response(null, { headers: { Allow: "GET, HEAD" }, status: 405 }),
    },
  },
});
