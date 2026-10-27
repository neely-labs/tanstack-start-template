# Working on the app

Use this guide for local development, route changes, checks, and debugging. Run commands from the repository root. For code ownership and server/browser boundaries, see [how the app fits together](architecture.md); for hosting, use [the deployment guide](deployment.md).

## Commands

```bash
pnpm dev        # Start the app on port 3000
pnpm fix        # Apply lint and formatting fixes
pnpm check      # Check lint, formatting, and type-aware rules
pnpm typecheck  # Check TypeScript
pnpm test       # Run unit tests once
pnpm build      # Build the production app and prerender public pages
pnpm seo:verify # Check metadata in the built files
pnpm start      # Run an existing production build
pnpm validate   # Run the core checks, build, and metadata verification
pnpm test:e2e   # Check the production app in desktop and mobile Chromium
```

## Find the right files

| Change | Start here | Check the result |
| --- | --- | --- |
| Name, description, or public origin | `src/lib/site-config.ts` | Unit tests, generated identity files, rendered page metadata |
| Add or remove a page | `src/routes`, `src/lib/public-routes.ts`, navigation and links to the page | Route generation, core validation, affected browser journey |
| Server action | Input parser/calculation, server function, page calling it | Accepted/rejected input in unit tests and a real browser-to-server request |
| Headers or production serving | `src/start.ts`, `src/lib/security-headers.ts`, `vite.config.ts` | Build and served page/API/static-response checks |

Update this map as the app gains its own modules.

## Change a route

1. Add or remove the route source, update its entry in `src/lib/public-routes.ts`, and reconcile metadata, navigation, links to the page, and affected browser tests.
2. Let Vite regenerate `src/routeTree.gen.ts`. A development server for this checkout does that while running; from a stopped checkout, run `pnpm build`. The generated file stays generator-owned.
3. Run the checks below. The refreshed tree lets TypeScript catch missing classification and links to removed routes before handoff.

## Check your changes

Use a focused test while editing, such as `pnpm test src/lib/text-stats.test.ts` while working on that example. Then run `pnpm fix` and `pnpm validate`. Refresh route types first when route files changed: the lint and type checks consume them before the build stage runs.

For page or server changes, check the production build in the browser too. Install Chromium once:

```bash
pnpm exec playwright install chromium
```

After `pnpm validate` has built the current app, run `pnpm test:e2e`. The browser suite exercises served files, hydration, keyboard behavior, server requests, and recovery. `tests/e2e/smoke.spec.ts` covers shared infrastructure; `tests/e2e/examples.spec.ts` goes with the optional example pages. Missing expected behavior fails a check.

Before handoff, inspect the changed route or action and report what you actually checked, with useful evidence and any remaining uncertainty. Unit checks, production browser checks, and manual review each answer different questions.

## Use concurrent checkouts

Separate worktrees have their own source and build output, but share network ports. Reuse a development server after confirming its process belongs to this checkout and it serves the expected app.

`pnpm dev` uses port 3000 and exits if it is occupied. Choose other ports explicitly for a second task:

```bash
pnpm exec vite dev --port 3101 --strictPort
E2E_PORT=4181 pnpm test:e2e
```

`E2E_PORT` defaults to 4173 and sets the browser URL, production-server port, and readiness probe together. Browser checks start their own server and reject an occupied port, so they cannot quietly test another checkout or an old build. Give concurrent runs different ports and stop only processes your task started.

The app currently needs no account, database, or environment file for local work. When adding persistence or an external service, include local fixtures, credentials, reset/cleanup instructions, and recovery checks with that feature.

## Investigate a failure

- Check `/api/health` to see whether the server responds. A successful response alone does not identify the checkout.
- Read the terminal for build and prerender errors. `pnpm seo:verify` names the route or built file whose metadata failed.
- Use the browser console, network panel, and development-only TanStack devtools to inspect navigation, hydration, and server requests.
- For a browser-check failure, open the screenshot and error context under `test-results/`, then inspect the trace:

```bash
pnpm exec playwright show-trace path/to/trace.zip
```

CI uploads those files as `browser-failure-evidence` for seven days when browser checks fail. Download the artifact and use the same trace command locally. Review captured data before publishing a trace from an app with private or authenticated content.

The example loader-retry test simulates a failed request inside its browser, then retries the real server. It provides a pattern for failure testing without a production fault endpoint. If an approach fails, inspect the diff and undo only the task's changes, preserving unrelated edits and other tasks' processes.

## Formatting and hooks

Ultracite runs the quality tools: Oxlint checks code, and Oxfmt handles formatting and Tailwind class order. Lefthook formats/lints staged files before commit and runs `pnpm validate` before push. Claude Code and Cursor also format/lint the edited file after each edit; the full gates still apply.

Agent tooling and vendored plugin source are excluded from application quality gates. Project skills are optional. Manually review content, accessibility, architecture, and edge cases alongside the automated checks.
