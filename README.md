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

TanStack Start is on the stable v1 line. Nitro's Vite integration is still a pre-release, so its exact beta version is pinned.

## Start a project

Requirements: Node.js 24.15 or newer in the 24.x LTS line and pnpm 12.15.0.

If pnpm is not installed yet, use [pnpm's documented npm installer](https://pnpm.io/installation#using-npm) with the repository's exact pinned version:

```bash
npx get-pnpm 12.15.0
```

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

Then work through [the setup guide](docs/template-setup.md). It lists every value to replace, in order, and ends at a running application with no placeholder text.

After GitHub creates a repository from this template, open its **Actions** tab. If GitHub says workflows are not being run, click **Enable Actions on this repository** before expecting the tracked CI workflow to appear on pull requests. GitHub does not replay earlier repository events, so run CI manually or push another commit after enabling it. The template does not enable GitHub Code Security or CodeQL; private projects need no paid security add-on.

GitHub does not copy repository settings from a template. This repository ships importable branch rulesets under `.github/rulesets`; apply them after the new repository exists and you have decided which deployment, if any, should gate merges.

### Set up with a coding agent

The setup guide is written to be executed. Send this to your agent:

```text
Set up this repository as my new project by following docs/template-setup.md. Start with the questions in step 1.
```

<details>
<summary>What the agent will do</summary>

1. Ask seven questions in one batch: project and package name, a one-sentence description, the production origin, the host, whether to keep the example routes, whether brand assets are ready, and whether to apply the GitHub branch ruleset (including an optional deployment gate).
2. Apply that identity to `package.json` and `src/lib/site-config.ts`; manifest, robots, and sitemap files are generated.
3. Keep or remove `/setup` and `/runtime`, then reconcile route generation, inventory, inbound links, navigation, and example tests. Keep `/api/health` for readiness.
4. Replace the logo, favicon, and social card, and retire the trademark notice.
5. Set the Nitro preset when the host is not Vercel.
6. If explicitly authorized, apply `.github/rulesets/default-branch.json`; if the host is Vercel, apply `.github/rulesets/vercel-preview.json` only after a successful preview deployment and an exact environment-name check.
7. Rewrite `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`, and this README for the product, retaining the development workflow and quality gates.
8. Delete the template-only documents while keeping any adopted repository policy files.
9. Run `pnpm validate` and the applicable production browser suite, inspect the new identity, and confirm any selected repository ruleset reports correctly.

Each step ends on a stated result, and most are checked by a command rather than by inspection, so the work is verifiable as it goes.

</details>

## Commands

```bash
pnpm dev        # Start the development server
pnpm fix        # Apply safe Oxlint and Oxfmt fixes
pnpm check      # Check lint, formatting, and type-aware rules
pnpm typecheck  # Run TypeScript without emitting files
pnpm test       # Run the Vitest suite once
pnpm test:e2e   # Smoke test an existing production build in desktop/mobile Chromium
pnpm build      # Build the Nitro production output and prerender public routes
pnpm seo:verify # Inspect built metadata, schema, sitemap, robots, and SSR headings
pnpm start      # Run an existing production build locally
pnpm validate   # Run core quality, build, and pre-push gates
```

The browser suite verifies the built server, navigation, hydration, server-function validation and CSRF protection, static assets, and 404 recovery. Install Chromium once with `pnpm exec playwright install chromium`, then run `pnpm build && pnpm test:e2e`. CI installs the browser and runs this suite after `pnpm validate`.

## Development workflow

Keep this section when adopting the template. Read `PRODUCT.md` for product intent and `DESIGN.md` for interface constraints; update those decisions alongside the feature that changes them.

### Find the smallest change

| Task | Start here | Observable check |
| --- | --- | --- |
| Public identity or origin | `src/lib/site-config.ts`; generated files in `src/lib/site-files.ts` | Unit tests, built manifest/robots/sitemap, rendered page metadata |
| Add or remove a page | `src/routes`, `src/lib/public-routes.ts`, navigation and inbound links | Regenerate routes, `pnpm validate`, affected browser journey |
| Server action | Input parser/calculation, server function, page calling it | Unit acceptance/rejection plus a real browser-to-server request |
| Headers or production serving | `src/start.ts`, `src/lib/security-headers.ts`, `vite.config.ts` | Production build and served page/API/static-response checks |

Route types are generated when Vite runs. After changing route files and their visibility entries, reuse this checkout's running development server, or run `pnpm build` from a stopped checkout before `pnpm validate`. That refreshes `src/routeTree.gen.ts` before lint and TypeScript consume it. Reconcile navigation, inbound links, metadata, and affected browser tests too. Edit route sources rather than the generated tree.

Use focused tests while editing, for example `pnpm test src/lib/text-stats.test.ts`, then run `pnpm fix` and `pnpm validate` for handoff. For runtime or interface changes, run `pnpm test:e2e` against that build as a separate gate. `tests/e2e/smoke.spec.ts` covers retained infrastructure; `tests/e2e/examples.spec.ts` belongs to the removable example pages. Missing expected behavior fails a test rather than conditionally skipping it.

### Concurrent checkouts

Worktrees isolate source and build output, but share network ports. Reuse a development server only after checking that its process belongs to this checkout and its rendered identity is correct. A healthy response alone does not identify a checkout.

`pnpm dev` binds port 3000 strictly. For another task, choose an unused port explicitly:

```bash
pnpm exec vite dev --port 3101 --strictPort
E2E_PORT=4181 pnpm test:e2e
```

`E2E_PORT` defaults to 4173 and controls the browser URL, Nitro listener, and readiness probe together. Each browser run starts its own production server and refuses an occupied port. Give simultaneous checkouts different E2E ports, and stop only the processes your task started. The current application needs no accounts, database, or environment file for local work.

### Inspect and recover

Use `/api/health` to check that the server responds. The browser console, network panel, and development-only TanStack devtools expose navigation, hydration, and server requests. Check the terminal for build/prerender failures and `pnpm seo:verify` for the exact route or artifact whose metadata failed.

Browser failures leave screenshots, error context, and traces under `test-results/`. CI uploads them as `browser-failure-evidence` for seven days when the browser step fails. Download the artifact and open its trace locally:

```bash
pnpm exec playwright show-trace path/to/trace.zip
```

The example retry test injects a failed loader request inside its browser, then retries the real server. No production fault endpoint is needed. Keep traces local until reviewed when a product adds authenticated or sensitive workflows.

For a failed approach, inspect `git diff` and revert only the task's changes; retain unrelated edits and other tasks' processes. In a handoff, name the route/action exercised, actual check results, and any unavailable prerequisite. When adding persistence or an external integration, supply its local fixtures, reset and cleanup procedure, credential separation, and failure/recovery checks with the feature. Keep those instructions next to the owning module or in this operating section until their size warrants a separate document.

## Project shape

- `src/routes` owns file-based routes and route-level metadata.
- `src/components/ui` contains shadcn primitives. Add more with `pnpm dlx shadcn@latest add <component>`.
- `src/lib/site-config.ts` is the single seam for public identity and canonical origin.
- `src/lib/seo.ts` builds consistent page metadata and JSON-LD from that config.
- `src/lib/site-files.ts` generates `robots.txt`, `manifest.json`, and `sitemap.xml` from the same config and public route inventory, so no file under `public/` restates the project's identity.
- `src/lib/public-routes.ts` classifies every route as `public` or `private`. It is the prerender and sitemap inventory, and it is checked against the generated route tree at compile time.
- `src/lib/server-runtime.ts` holds the example server functions and the isomorphic environment helper.
- `src/start.ts` registers global request middleware through `createStart`. `src/lib/security-headers.ts` shares the same headers with Nitro, so prerendered and static responses retain them too.
- `src/server.ts` is the server entry. It uses srvx's `FastResponse` on Node and the platform `Response` on runtimes where srvx exports it.
- `src/routes/api/health.ts` is the retained JSON readiness route, including after optional example pages are removed.
- `scripts/verify-seo-output.mjs` verifies the rendered production artifacts instead of trusting source configuration alone.
- `docs/template-publishing.md` records the repository settings and rehearsal steps that cannot live in application code.
- `tools/oxlint/anti-slop` is vendored lint plug-in source from [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop).

TanStack Router generates `src/routeTree.gen.ts`. Do not edit it by hand.

## Quality and hooks

Ultracite is the quality entry point. Oxlint owns linting and Oxfmt owns formatting and Tailwind class ordering. ESLint and Prettier are intentionally absent.

Lefthook formats and lints staged files before commit, then runs `pnpm validate` before push. Claude Code and Cursor format and lint the edited file after each edit. Agent tooling and vendored plug-in source are excluded from application quality gates.

Agent skills are optional and chosen by each project. Add the skills that fit your team's workflow; for example, [Impeccable](https://github.com/pbakaus/impeccable) provides UI/UX design guidance. This template ships without design skills or their hooks.

## GitHub repository protection

The files in `.github/rulesets` are policy artifacts, not active settings. A repository created from this template must import them separately. The baseline protects the default branch from deletion and force pushes, requires pull requests with resolved review conversations, allows squash and rebase merges, and requires the `validate` check. It starts with zero required approvals so a solo maintainer can use it; add an approval and code-owner review when the project has a review team.

With GitHub CLI authenticated as a repository administrator, run this once in the new repository:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  "repos/$repo/rulesets" \
  --input .github/rulesets/default-branch.json
```

The optional Vercel ruleset requires a successful deployment in the exact `Preview` environment. Apply it only after Vercel has produced that deployment; for a project-suffixed or custom environment, edit the environment name first. Other hosts should keep the baseline until their integration emits a stable GitHub deployment environment. See [the ruleset notes](.github/rulesets/README.md) for the full procedure and caveats.

## SEO and public routes

The example uses `https://example.com` so a fresh clone builds successfully without pretending to own a production domain. Replace it in `src/lib/site-config.ts` before deployment. Manifest, robots, and sitemap files are generated; their emitted copies belong in build output.

Add each public route to `src/lib/public-routes.ts`. The site-files Vite plugin emits `sitemap.xml` from that inventory before Nitro builds its static-asset manifest, and Nitro prerenders the same routes; `pnpm seo:verify` checks the finished HTML for unique titles, descriptions, canonical URLs, social metadata, JSON-LD, and server-rendered headings.

## Execution model

`/runtime` demonstrates the server/browser boundary instead of describing it:

- **Server functions** in `src/lib/server-runtime.ts`. `getRenderSnapshot` is a `GET` function called from a route loader. `analyzeText` is a `POST` function whose `.validator` stage rejects input before the handler runs. Handler bodies never reach the client bundle.
- **Isomorphic code**. `createIsomorphicFn` keeps a server branch and a client branch behind one call, and each branch is stripped from the bundle it does not belong to.
- **Request middleware** in `src/start.ts`, which runs for every request the server handles, including server routes and server functions. It sets conservative security headers and rejects cross-site requests to server functions. A Content-Security-Policy is deliberately absent because a useful one depends on the application.
- **Server routes** in `src/routes/api/health.ts`, which answer with JSON rather than a document and are classified `private`.

`public` and `private` in this inventory control prerendering, sitemap inclusion, and SEO checks. They do not enforce authentication or authorize requests.

Two behaviors are worth knowing before copying the pattern:

- A prerendered route's loader runs at build time to produce the shipped HTML and again on the server when the router revalidates after hydration. Loader output is not frozen at build time.
- `.validator` is the input boundary for a server function. This template ships no schema library, so the example validator is a plain function; a Standard Schema validator drops into the same seam.

A route that depends on browser APIs can opt out of server rendering with `ssr: false` or `ssr: "data-only"`. No example route needs it, so the template does not use it.

## Hosting

Nitro is the deployment-agnostic layer, so a different host is a preset rather than a different build. It is registered once in `vite.config.ts` and every target shares the same `pnpm build` output. Nitro documents [the full preset list](https://nitro.build/deploy).

Run `pnpm validate` before the first deployment and after changing public route metadata.

### Vercel

Import the repository and set **Framework Preset** to **TanStack Start**. The `nitro()` plugin is the server build layer underneath that preset and detects Vercel automatically. Keep the generated build command and output directory, leave the root directory at `./` for a root-level application, and confirm the project uses Node.js 24. No `vercel.json` is needed.

Vercel creates Preview deployments for pull requests. If merging should wait for that deployment, import the optional ruleset described in [GitHub repository protection](#github-repository-protection) after the first preview succeeds. Confirm the deployment environment name in GitHub first; multi-project and custom-environment setups may use a different name.

### Cloudflare Workers

Add the preset to the existing Nitro configuration in `vite.config.ts`, keeping its route rules and prerender options:

```diff
     nitro({
+      preset: "cloudflare-module",
       routeRules: { "/**": { headers: securityHeaders } },
```

`pnpm build` prerenders through Wrangler and writes `.output/server/wrangler.json` with `nodejs_compat` and the static-asset binding already configured, so no Cloudflare config is tracked here. Deploy the build output:

```bash
cd .output/server && npx wrangler deploy
```

Cloudflare is also a TanStack Start official partner with a [dedicated path](https://tanstack.com/start/latest/docs/framework/react/guide/hosting) that replaces Nitro with `@cloudflare/vite-plugin` and a tracked `wrangler.jsonc`. That is a different build layer rather than an addition to this one, so the template stays on Nitro and keeps one build path for every host.

Cloudflare does not provide a template-wide deployment check name. Keep the baseline ruleset and add a required deployment only after the selected Cloudflare integration emits a stable GitHub deployment environment.

Before publishing this repository as a GitHub template, complete the [template publishing checklist](docs/template-publishing.md).

## Deliberate omissions

The starter does not choose authentication, persistence, analytics, state management beyond React and TanStack Router, or an environment-schema library. Add each only when the product requires it.

## License

Original template code is available under the [MIT License](LICENSE). Vendored source remains under the upstream licenses recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
