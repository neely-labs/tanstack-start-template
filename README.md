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

1. Copy or create a repository from this template.
2. Rename the package in `package.json`.
3. Replace the placeholder metadata in `src/lib/site-config.ts` and `public/manifest.json`.
4. Replace `public/social-card.png` and `public/favicon.ico`.
5. Update `public/robots.txt` with the production origin.
6. Replace the example routes and write product-specific `PRODUCT.md`, `DESIGN.md`, and `AGENTS.md` guidance.
7. Run the full validation gate.

```bash
pnpm install
pnpm validate
pnpm dev
```

Open `http://localhost:3000`.

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
- `src/lib/seo.ts` builds consistent page metadata and JSON-LD.
- `src/lib/public-routes.ts` is the prerender and sitemap inventory.
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

## Vercel

Import the repository into Vercel and keep the detected TanStack Start settings. Nitro is registered in `vite.config.ts`; no custom build command, output directory, or `vercel.json` is needed. Run `pnpm validate` before the first deployment and after changing public route metadata.

Before publishing this repository as a GitHub template, complete the [template publishing checklist](docs/template-publishing.md).

## Deliberate omissions

The starter does not choose authentication, persistence, analytics, state management beyond React and TanStack Router, or an environment-schema library. Add each only when the product requires it.

## License

Original template code is available under the [MIT License](LICENSE). Vendored source remains under the upstream licenses recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
