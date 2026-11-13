# How the app fits together

Use this reference when finding a module, changing public identity or metadata, working across the server/browser boundary, or adding a feature that touches a central list or shared rule. For the editing and verification sequence, see [the development guide](development.md).

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
| `scripts/local.ts` | Per-checkout ports, server ownership, status, and retirement for concurrent worktrees |
| `scripts/verify-doc-budget.ts` | Size caps on the docs agents read on every task |

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

## Forms before hydration

Until hydration the browser owns every field, and a visitor on a slow connection types into the server HTML; React leaves that text in the field but not in state. A form that React handles takes a function `action` and reads the submit from its `FormData`, as the `/runtime` analyzer does: React replays a submit made before hydration with that data, and with JavaScript off the submit does nothing, so data that must stay in the browser is never sent. Before hydration or with JavaScript off, a form with only `onSubmit` sends its fields as a GET query string, putting them in the URL. A controlled field copies the field's value into state when it mounts, or it reads as empty and its next render erases the text. A form meant to work without JavaScript, such as a search, keeps a real `action` URL. [The forms recipe](recipes/forms.md) has the code and the browser test.

## Requests and headers

`src/start.ts` registers request middleware through `createStart`. It adds shared security headers and rejects cross-site server-function requests. Ordinary HTTP routes stay outside that RPC check so non-browser callers can reach endpoints such as health checks.

`src/lib/security-headers.ts` also supplies Nitro's route rules, keeping the same headers on prerendered and static responses. A Content-Security-Policy belongs to the application's requirements and is left for that project to choose.

For the current UI decisions and theme tokens, see [DESIGN.md](../DESIGN.md).

## Keep features cheap to add

These rules lower the number of things a caller, or the next feature, must remember. They are guidance, not a framework: they add no directory convention, base class, or registry, and they do not promise a file count per feature.

**Check a registration before inventing a manifest.** When a feature must be added to a central list, derive the list where you can. Where you cannot, add a type or test that fails and names the list to change. `src/lib/public-routes.ts` does both: `RoutePath` comes from the generated route tree, so a route missing from `routeVisibility` fails `pnpm typecheck` at that map, and `publicPaths` is derived from the map for prerendering, the sitemap, and `pnpm seo:verify`.

**Keep shared rules behind thin adapters.** Routes, server functions, and any later protocol call one shared operation. Validation and policy live in that operation, not in each caller. `src/lib/text-stats.ts` owns the input rules in `parseTextInput` and `maxTextLength`; `analyzeText` in `src/lib/server-runtime.ts` only connects them to a POST, and `src/routes/runtime.tsx` imports `maxTextLength` instead of restating the limit.

**Give copy one home.** User-facing wording lives in one module per surface. Tests read it from that module, and assert exact wording only where the wording states a commitment, such as a limit. `textInputErrors` in `src/lib/text-stats.ts` holds the analyzer's rejection messages; `src/lib/text-stats.test.ts` and `tests/e2e/examples.spec.ts` read them from there, and only the unit test checks that the length message states `maxTextLength`. Site identity follows the same rule in `src/lib/site-config.ts`.

**Test ordering bugs at each pause.** For anything asynchronous that writes state, name each pause between reading the state and applying the result, as [issues do](agents/issue-tracker.md#issue-shape). Test the interleaving at each pause, and assert that the test's setup took effect so the test can fail. Starting a dev server in `scripts/local.ts` reads the ownership file, spawns Vite, then writes the file, so a second start or retire could land in between; both hold `withLock`. `scripts/local.test.ts` puts a second operation in that pause by taking the lock first, and expects the lock's own error rather than any rejection, so the test fails if the lock was never held.
