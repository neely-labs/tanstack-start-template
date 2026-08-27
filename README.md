# TanStack Start Template

A production-minded TanStack Start foundation for new applications. It supplies reusable infrastructure while leaving domain models, product copy, analytics, authentication, databases, and deployment credentials to the application built on top.

## Stack

- TanStack Start and React 19
- Nitro production output, ready for Vercel
- Tailwind CSS 4
- shadcn/ui on Base UI with Rhea, Mist, and Tabler icons
- TypeScript and Vitest
- Ultracite with type-aware Oxlint, Oxfmt, React Doctor, TanStack rules, and the vendored anti-slop Oxlint plug-in
- pnpm and Lefthook
- Impeccable skill support for Codex, Claude Code, and Cursor

## Start a project

Requirements: Node.js 24 and pnpm 12.0.0-rc.10. [pnpm documents the v12 release candidate and its installation separately](https://pnpm.io/installation#installing-the-pnpm-12-rc).

If pnpm is not installed yet, use [pnpm's documented npm installer](https://pnpm.io/installation#using-npm) with the repository's exact pinned version:

```bash
npx get-pnpm 12.0.0-rc.10
```

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Then work through [the setup guide](docs/template-setup.md). It lists every value to replace, in order, and ends at a running application with no placeholder text.

After GitHub creates a repository from this template, open its **Actions** tab. If GitHub says workflows are not being run, click **Enable Actions on this repository** before expecting the tracked CI and CodeQL workflows to appear on pull requests. GitHub does not replay earlier repository events, so run the workflows manually or push another commit after enabling them.

### Set up with a coding agent

The setup guide is written to be executed. Send this to your agent:

```text
Set up this repository as my new project by following docs/template-setup.md. Start with the questions in step 1.
```

<details>
<summary>What the agent will do</summary>

1. Ask six questions in one batch: project and package name, a one-sentence description, the production origin, the host, whether to keep the example routes, and whether brand assets are ready.
2. Apply that identity to `package.json`, `src/lib/site-config.ts`, `public/manifest.json`, and `public/robots.txt`.
3. Keep or remove the example routes, then reconcile the route inventory and navigation.
4. Replace the logo, favicon, and social card, and retire the trademark notice.
5. Set the Nitro preset when the host is not Vercel.
6. Rewrite `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, and this README for the product.
7. Delete the template-only documents.
8. Run `pnpm validate`, start the server, and confirm the new identity renders.

Each step ends on a stated result, and most are checked by a command rather than by inspection, so the work is verifiable as it goes.

</details>

## Commands

```bash
pnpm dev        # Start the development server
pnpm fix        # Apply safe Oxlint and Oxfmt fixes
pnpm check      # Check lint, formatting, and type-aware rules
pnpm typecheck  # Run TypeScript without emitting files
pnpm test       # Run the Vitest suite once
pnpm build      # Build the Nitro production output and prerender public routes
pnpm seo:verify # Inspect built metadata, schema, sitemap, robots, and SSR headings
pnpm start      # Run an existing production build locally
pnpm validate   # Run every CI and pre-push gate
```

## Project shape

- `src/routes` owns file-based routes and route-level metadata.
- `src/components/ui` contains shadcn primitives. Add more with `pnpm dlx shadcn@latest add <component>`.
- `src/lib/site-config.ts` is the single seam for public identity and canonical origin.
- `src/lib/seo.ts` builds consistent page metadata and JSON-LD from that config.
- `src/lib/site-files.ts` generates `robots.txt` and `manifest.json` from the same config, so no file under `public/` restates the project's identity.
- `src/lib/public-routes.ts` classifies every route as `public` or `private`. It is the prerender and sitemap inventory, and it is checked against the generated route tree at compile time.
- `src/lib/server-runtime.ts` holds the example server functions and the isomorphic environment helper.
- `src/start.ts` registers global request middleware through `createStart`.
- `src/server.ts` is the server entry. It swaps in srvx's `FastResponse`, which is roughly a 5% throughput gain on Node hosts and a no-op on runtimes where srvx exports the platform `Response`.
- `src/routes/api/health.ts` is an example server route that answers with JSON.
- `scripts/verify-seo-output.mjs` verifies the rendered production artifacts instead of trusting source configuration alone.
- `docs/template-publishing.md` records the repository settings and rehearsal steps that cannot live in application code.
- `tools/oxlint/anti-slop` is vendored lint plug-in source from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop).

TanStack Router generates `src/routeTree.gen.ts`. Do not edit it by hand.

## Quality and hooks

Ultracite is the quality entry point. Oxlint owns linting and Oxfmt owns formatting and Tailwind class ordering. ESLint and Prettier are intentionally absent.

Lefthook formats and lints staged files before commit, then runs `pnpm validate` before push. Claude Code and Cursor format and lint the edited file after each edit. The tracked Impeccable skill adds UI-specific guidance and hooks for Codex, Claude Code, and Cursor. Vendored skill and plug-in source are excluded from application quality gates.

## SEO and public routes

The example uses `https://example.com` so a fresh clone builds successfully without pretending to own a production domain. Replace it before deployment in:

- `src/lib/site-config.ts`
- `public/robots.txt`

Add each public route to `src/lib/public-routes.ts`. The Nitro build prerenders that inventory and generates `sitemap.xml`; `pnpm seo:verify` checks the finished HTML for unique titles, descriptions, canonical URLs, social metadata, JSON-LD, and server-rendered headings.

## Execution model

`/runtime` demonstrates the server/browser boundary instead of describing it:

- **Server functions** in `src/lib/server-runtime.ts`. `getRenderSnapshot` is a `GET` function called from a route loader. `analyzeText` is a `POST` function whose `.validator` stage rejects input before the handler runs. Handler bodies never reach the client bundle.
- **Isomorphic code**. `createIsomorphicFn` keeps a server branch and a client branch behind one call, and each branch is stripped from the bundle it does not belong to.
- **Request middleware** in `src/start.ts`, which runs for every request the server handles, including server routes and server functions. It sets conservative security headers and rejects cross-site requests to server functions. A Content-Security-Policy is deliberately absent because a useful one depends on the application.
- **Server routes** in `src/routes/api/health.ts`, which answer with JSON rather than a document and are classified `private`.

Two behaviors are worth knowing before copying the pattern:

- A prerendered route's loader runs at build time to produce the shipped HTML and again on the server when the router revalidates after hydration. Loader output is not frozen at build time.
- `.validator` is the input boundary for a server function. This template ships no schema library, so the example validator is a plain function; a Standard Schema validator drops into the same seam.

A route that depends on browser APIs can opt out of server rendering with `ssr: false` or `ssr: "data-only"`. No example route needs it, so the template does not use it.

## Hosting

Nitro is the deployment-agnostic layer, so a different host is a preset rather than a different build. It is registered once in `vite.config.ts` and every target shares the same `pnpm build` output. Nitro documents [the full preset list](https://nitro.build/deploy).

Run `pnpm validate` before the first deployment and after changing public route metadata.

### Vercel

Import the repository and set **Framework Preset** to **TanStack Start**. The `nitro()` plugin is the server build layer underneath that preset and detects Vercel automatically. Keep the generated build command and output directory, leave the root directory at `./` for a root-level application, and confirm the project uses Node.js 24. No `vercel.json` is needed.

### Cloudflare Workers

Set the preset on the Nitro plugin in `vite.config.ts`:

```diff
-    nitro(),
+    nitro({ preset: "cloudflare-module" }),
```

`pnpm build` prerenders through Wrangler and writes `.output/server/wrangler.json` with `nodejs_compat` and the static-asset binding already configured, so no Cloudflare config is tracked here. Deploy the build output:

```bash
cd .output/server && npx wrangler deploy
```

Cloudflare is also a TanStack Start official partner with a [dedicated path](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) that replaces Nitro with `@cloudflare/vite-plugin` and a tracked `wrangler.jsonc`. That is a different build layer rather than an addition to this one, so the template stays on Nitro and keeps one build path for every host.

Before publishing this repository as a GitHub template, complete the [template publishing checklist](docs/template-publishing.md).

## Deliberate omissions

The starter does not choose authentication, persistence, analytics, state management beyond React and TanStack Router, or an environment-schema library. Add each only when the product requires it.

## License

Original template code is available under the [MIT License](LICENSE). Vendored source remains under the upstream licenses recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
