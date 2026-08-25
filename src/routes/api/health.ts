import { createFileRoute } from "@tanstack/react-router";

/**
 * A server route: an HTTP endpoint that shares the router's file-based paths
 * but renders no component. It is classified `private` in
 * `src/lib/public-routes.ts`, so it is never prerendered or listed in the
 * sitemap.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          status: "ok",
          time: new Date().toISOString(),
        }),
    },
  },
});
