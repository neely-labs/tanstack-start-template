# Code map

Use this guide to find the files that own a change and the focused check that proves it. The full checks in [Check your changes](development.md#check-your-changes) still apply before handoff.

## Find the right files

Each row names the files that own an area and the focused check that proves a change there. `pnpm test:e2e` serves the last build, so build first.

| Change | Owner | Check |
| --- | --- | --- |
| Name, description, or public origin | `src/lib/site-config.ts` | `pnpm test src/lib/site-config.test.ts src/lib/site-files.test.ts`, then `pnpm build && pnpm seo:verify` |
| Add or remove a public route | `src/routes/`, `src/lib/public-routes.ts`, `navigation` in `src/lib/site-config.ts`; steps in [Change a route](#change-a-route) | `pnpm test src/lib/public-routes.test.ts src/lib/site-files.test.ts`, `pnpm validate` for prerender and metadata, then `pnpm test:e2e` |
| Change a server function | `src/lib/server-runtime.ts`, its input schema `src/lib/text-stats.ts`, and the route that calls it; model in [Server and browser](architecture.md#server-and-browser) | `pnpm test src/lib/text-stats.test.ts src/lib/server-runtime.test.ts` for accepted and rejected input, then `pnpm test:e2e test/e2e/examples.test.ts` for the real request |
| Page metadata or structured data | `src/lib/seo.ts`, and the check in `scripts/verify-seo-output.ts` | `pnpm test src/lib/seo.test.ts scripts/verify-seo-output.test.ts`, then `pnpm build && pnpm seo:verify` |
| Theme or design tokens | `src/styles.css`, `src/lib/theme.ts`, [DESIGN.md](../DESIGN.md) | `pnpm test src/lib/theme.test.ts`, then `pnpm test:e2e test/e2e/smoke.test.ts` |
| Headers, middleware, or production serving | `src/start.ts`, `src/server.ts`, `src/lib/security-headers.ts`, `vite.config.ts` | `pnpm build`, then `pnpm test:e2e test/e2e/smoke.test.ts` |
| Per-checkout ports and server ownership | `scripts/local.ts` | `pnpm test scripts/local.test.ts` |
| Always-read docs and their size limits | `BUDGET` in `scripts/verify-doc-budget.ts` | `pnpm docs:budget`; `pnpm test scripts/verify-doc-budget.test.ts` for the script itself |
| Add or change a form | [Forms before hydration](architecture.md#forms-before-hydration) and [the forms recipe](recipes/forms.md) | `pnpm build && pnpm test:e2e` with the recipe's test copied into `test/e2e/` |
| Comments listed for the review's comment check | `scripts/list-comments.ts`, the `LIST_COMMENTS` switch in `oxlint.config.ts` | `pnpm test scripts/list-comments.test.ts` |
| Which changes CI treats as documentation-only | The `scope` step in `.github/workflows/ci.yml` | `pnpm test scripts/ci-docs-scope.test.ts` |
| Pull request description sections | `.github/pull_request_template.md`, `scripts/verify-pr-description.ts`, `scripts/qualification.ts`, `scripts/markdown-lines.ts`, `.github/workflows/pr-description.yml` | `pnpm test scripts/verify-pr-description.test.ts` |
| Moving an issue on merge | `scripts/apply-qualification.ts`, `.github/workflows/qualification.yml` | `pnpm test scripts/apply-qualification.test.ts scripts/qualification-workflow.test.ts` |

A row holds only pointers: owner paths, a guide section, and the check command. Explanation of how an area works belongs in the owning module's header comment, next to the code. Add a row when the app gains its own module, and remove rows for example files the project deletes.

## Change a route

1. Add or remove the route source, update its entry in `src/lib/public-routes.ts`, and reconcile metadata, navigation, links to the page, and affected browser tests.
2. Let Vite regenerate `src/routeTree.gen.ts`. A development server for this checkout does that while running; from a stopped checkout, run `pnpm build`. The generated file stays generator-owned.
3. Run [the checks](development.md#check-your-changes). The refreshed tree lets TypeScript catch missing classification and links to removed routes before handoff.
