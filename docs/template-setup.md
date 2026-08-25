# Template setup

The procedure for turning a fresh copy of this template into a project. It is written so a coding agent can execute it, and reads as a checklist for anyone working by hand.

Work the steps in order. Each one states the result that ends it.

## 1. Collect the answers

Ask all six questions in one message, then wait for the reply. Every later step depends on the answers, and one batch costs the person a single response.

1. **Project name** as it should appear in the interface, and the package name for `package.json`.
2. **One sentence** describing the product. It becomes the meta description and the manifest description.
3. **Production origin**, such as `https://app.example.com`. "Not decided yet" is a valid answer that keeps `https://example.com` until it is.
4. **Host**: Vercel, Cloudflare Workers, or undecided.
5. **The example surface**: keep `/about`, `/runtime`, and `/api/health` as working references, or remove them.
6. **Brand assets**: paths to a logo, favicon source, and social image, or keep the placeholders for now.

Ends when every question has an answer or an explicit deferral.

## 2. Apply the identity

`src/lib/site-config.ts` is the single seam for public identity. `src/lib/seo.ts` derives every page title, canonical URL, and JSON-LD graph from it, and `src/lib/site-files.ts` generates `robots.txt` and `manifest.json` from it at build time. Editing that one file renames the project everywhere.

| File | Values |
| --- | --- |
| `src/lib/site-config.ts` | `name`, `shortName`, `description`, `origin`, `themeColor`, `socialImage.alt` |
| `package.json` | `name` |

Ends when `pnpm build` writes the new name and origin into `.output/public/robots.txt`, `.output/public/manifest.json`, and the rendered `<title>` of every page.

## 3. Choose the surface

Keeping the examples is the safe default while the product is still being shaped; they demonstrate the SEO helpers, the server-function seams, and the recovery states against real routes.

To remove them, delete the route file and its supporting modules together:

- `/about`: `src/routes/about.tsx`
- `/runtime`: `src/routes/runtime.tsx`, `src/lib/server-runtime.ts`, `src/lib/text-stats.ts`, `src/lib/text-stats.test.ts`
- `/api/health`: `src/routes/api/health.ts`

Then drop the matching entries from `routeVisibility` in `src/lib/public-routes.ts` and from `navigation` in `src/lib/site-config.ts`. Keep `src/start.ts` and `src/server.ts`: they carry the security headers and the Node response optimization, not the examples.

Ends when `pnpm typecheck` passes, which is the compiler confirming every remaining route is classified.

## 4. Replace the brand assets

Replace `public/tanstack.svg` (header logo and SVG favicon), `public/favicon.ico`, and `public/social-card.png`. The social card is verified at 1200x630 PNG, so keep those dimensions or update `socialImage` in `src/lib/site-config.ts` to match the new asset.

Replacing the logo also retires the TanStack trademark entry at the end of `THIRD_PARTY_NOTICES.md`.

Ends when `pnpm build && pnpm seo:verify` passes, which checks the rendered social image rather than the source file.

## 5. Set the host preset

Vercel needs no change. For Cloudflare Workers, set the preset on the Nitro plugin in `vite.config.ts`, as the Hosting section of `README.md` describes.

Ends when `pnpm build` succeeds under the chosen preset.

## 6. Rewrite the guidance documents

`PRODUCT.md`, `DESIGN.md`, and `AGENTS.md` describe the template. Rewrite them to describe the product, using the answers from step 1.

`AGENTS.md` loads into every agent's context on every turn. Keep it to what the code cannot reveal on its own: decisions, constraints, and the reasons behind them.

Replace `README.md` with the project's own README.

Ends when no guidance document still describes a template rather than the product.

## 7. Remove the template-only files

`docs/template-publishing.md` and this file describe publishing and adopting the template. Delete both once the project has its own history.

Ends when `docs/` holds only documents about the product.

## 8. Verify

```bash
pnpm validate
pnpm dev
```

Open `http://localhost:3000` and confirm the header, the page titles, and the footer show the new identity.

Ends when `pnpm validate` passes and the running application shows no placeholder text.
