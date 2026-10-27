# How the app fits together

Use this reference when finding a module, changing public identity or metadata, or working across the server/browser boundary. For the editing and verification sequence, see [the development guide](development.md).

## Where code lives

| Area | Responsibility |
| --- | --- |
| `src/routes` | Pages, HTTP routes, loaders, and page metadata |
| `src/routes/__root.tsx` | Shared document, navigation shell, not-found handling, and error recovery |
| `src/components` and `src/components/ui` | Shared app components and shadcn primitives |
| `src/lib/site-config.ts` | Public identity, navigation, asset paths, and canonical origin |
| `src/lib/seo.ts`, `src/lib/site-files.ts`, `src/lib/public-routes.ts` | Page metadata, generated identity files, and public route inventory |
| `src/lib/text-stats.ts` and `src/lib/server-runtime.ts` | Example input parsing/calculation and server-function adapters |
| `src/start.ts`, `src/server.ts`, `src/lib/security-headers.ts` | Request middleware, server entry, and headers shared with Nitro |
| `scripts/verify-seo-output.mjs` | Verification of rendered production metadata and assets |

TanStack Router generates `src/routeTree.gen.ts` from the route files. Work in the source routes and let Vite regenerate it.

## Public identity and metadata

Change identity and the canonical origin in `src/lib/site-config.ts`. The build generates `manifest.json`, `robots.txt`, and `sitemap.xml`; keep their emitted copies in build output. `public/` holds assets such as the logo and social image.

Every route has a `public` or `private` entry in `src/lib/public-routes.ts`. Public pages are prerendered, included in the sitemap, and checked by `pnpm seo:verify`. Private entries are excluded from those steps. This classification controls SEO and rendering, not authentication or request authorization.

Nitro prerenders the public inventory, while the site-files Vite plugin emits identity files before Nitro records static assets. The SEO check inspects the resulting HTML and files for page titles, descriptions, canonical URLs, social metadata, JSON-LD, and server-rendered headings.

## Server and browser

The `/runtime` example connects three parts: a parser/calculation in `src/lib/text-stats.ts`, server functions in `src/lib/server-runtime.ts`, and the page that calls them.

- `getRenderSnapshot` is a GET server function called by a route loader. A prerendered loader runs at build time for the shipped HTML and on the server again when the router revalidates after hydration.
- `analyzeText` is a POST server function. Its `.validator` rejects invalid input before the handler runs. A schema validator can use that same boundary when the product chooses one.
- `createIsomorphicFn` supplies separate server and browser implementations through one call. Each build keeps the implementation for its environment; server-function handler bodies stay out of the browser bundle.
- `/api/health` is an HTTP route that returns JSON. Browser checks retain it as their readiness endpoint when example pages are removed.

A route that needs browser APIs can choose `ssr: false` or `ssr: "data-only"`. The current examples use server rendering.

## Requests and headers

`src/start.ts` registers request middleware through `createStart`. It adds shared security headers and rejects cross-site server-function requests. Ordinary HTTP routes stay outside that RPC check so non-browser callers can reach endpoints such as health checks.

`src/lib/security-headers.ts` also supplies Nitro's route rules, keeping the same headers on prerendered and static responses. A Content-Security-Policy belongs to the application's requirements and is left for that project to choose.

For the current UI decisions and theme tokens, see [DESIGN.md](../DESIGN.md).
