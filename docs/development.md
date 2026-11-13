# Working on the app

Use this guide for local development, route changes, checks, and debugging. Run commands from the repository root. For code ownership and server/browser boundaries, see [how the app fits together](architecture.md); for hosting, use [the deployment guide](deployment.md).

## Commands

```bash
pnpm dev        # Start the app on port 3000
pnpm dev:local  # Start the app on this checkout's own port
pnpm fix        # Apply lint and formatting fixes
pnpm check      # Check lint, formatting, and type-aware rules
pnpm docs:budget # Check the size of the docs agents always read
pnpm typecheck  # Check TypeScript
pnpm test       # Run unit tests once
pnpm test:changed [base] # Run the unit tests affected since base
pnpm build      # Build the production app and prerender public pages
pnpm seo:verify # Check metadata in the built files
pnpm start      # Run an existing production build
pnpm validate   # Run the core checks, build, and metadata verification
pnpm test:e2e   # Check the production app in desktop and mobile Chromium
pnpm local:status  # Show this checkout's branch, ports, and server
pnpm local:retire  # Stop this checkout's server and remove its local state
```

To serve the app beside other checkouts, or to call these commands from worktree hooks, see [concurrent checkouts](concurrent-checkouts.md).

## Find the right files

Each row names the files that own an area and the focused check that proves a change there. The full checks in [Check your changes](#check-your-changes) still apply before handoff. `pnpm test:e2e` serves the last build, so build first.

| Change | Owner | Check |
| --- | --- | --- |
| Name, description, or public origin | `src/lib/site-config.ts` | `pnpm test src/lib/site-config.test.ts src/lib/site-files.test.ts`, then `pnpm build && pnpm seo:verify` |
| Add or remove a public route | `src/routes/`, `src/lib/public-routes.ts`, `navigation` in `src/lib/site-config.ts`; steps in [Change a route](#change-a-route) | `pnpm test src/lib/public-routes.test.ts src/lib/site-files.test.ts`, `pnpm validate` for prerender and metadata, then `pnpm test:e2e` |
| Change a server function | `src/lib/server-runtime.ts`, its input parser `src/lib/text-stats.ts`, and the route that calls it; model in [Server and browser](architecture.md#server-and-browser) | `pnpm test src/lib/text-stats.test.ts` for accepted and rejected input, then `pnpm test:e2e tests/e2e/examples.spec.ts` for the real request |
| Page metadata or structured data | `src/lib/seo.ts` | `pnpm test src/lib/seo.test.ts`, then `pnpm build && pnpm seo:verify` |
| Theme or design tokens | `src/styles.css`, `src/lib/theme.ts`, [DESIGN.md](../DESIGN.md) | `pnpm test src/lib/theme.test.ts`, then `pnpm test:e2e tests/e2e/smoke.spec.ts` |
| Headers, middleware, or production serving | `src/start.ts`, `src/server.ts`, `src/lib/security-headers.ts`, `vite.config.ts` | `pnpm build`, then `pnpm test:e2e tests/e2e/smoke.spec.ts` |
| Per-checkout ports and server ownership | `scripts/local.ts` | `pnpm test scripts/local.test.ts` |
| Always-read docs and their size limits | `BUDGET` in `scripts/verify-doc-budget.ts` | `pnpm docs:budget`; `pnpm test scripts/verify-doc-budget.test.ts` for the script itself |
| Add or change a form | The component that renders it; rule in [Forms before hydration](architecture.md#forms-before-hydration) | The browser test in [the forms recipe](recipes/forms.md), then `pnpm test:e2e` |
| Which changes CI treats as documentation-only | The `scope` step in `.github/workflows/ci.yml` | `pnpm test scripts/ci-docs-scope.test.ts` |

A row holds only pointers: owner paths, a guide section, and the check command. Explanation of how an area works belongs in the owning module's header comment, so it stays next to the code it describes. Add a row when the app gains its own module, and remove rows for example files the project deletes.

## Change a route

1. Add or remove the route source, update its entry in `src/lib/public-routes.ts`, and reconcile metadata, navigation, links to the page, and affected browser tests.
2. Let Vite regenerate `src/routeTree.gen.ts`. A development server for this checkout does that while running; from a stopped checkout, run `pnpm build`. The generated file stays generator-owned.
3. Run the checks below. The refreshed tree lets TypeScript catch missing classification and links to removed routes before handoff.

## Check your changes

While editing, run the focused test, such as `pnpm test src/lib/text-stats.test.ts`. To look for regressions beyond it, run `git fetch` and then `pnpm test:changed origin/main`: it runs the tests that import, directly or indirectly, a file changed since the merge base, including uncommitted files. With no base it reads only uncommitted changes.

Affected selection is a shortcut, not proof:

- It misses files read at runtime instead of imported, such as assets and fixtures, and changes to the lockfile or `tsconfig.json`. A change to `package.json` or the Vite or Vitest config runs every test.
- Selecting zero tests fails, as on a clean tree with no base or a change to files no test imports. Run `pnpm test` instead.
- When pre-push regularly takes more than about two minutes, [verification at scale](recipes/verification-at-scale.md) moves the hook to lint, types and `pnpm test:changed`, skips the tests for a push of only docs, stylesheets, and images, and keeps CI as the full gate.

Before pushing, run `pnpm fix` and `pnpm validate`. Refresh route types first when route files changed: the lint and type checks consume them before the build stage runs.

For page or server changes, check the production build in the browser too. Install Chromium once:

```bash
pnpm exec playwright install chromium
```

After `pnpm validate` has built the current app, run `pnpm test:e2e`. The browser suite exercises served files, hydration, keyboard behavior, server requests, and recovery. `tests/e2e/smoke.spec.ts` covers shared infrastructure; `tests/e2e/examples.spec.ts` goes with the optional example pages. Missing expected behavior fails a check.

Before handoff, inspect the changed route or action and report what you actually checked, with useful evidence and any remaining uncertainty. Unit checks, production browser checks, and manual review each answer different questions.

- For interface changes, operate the changed controls with the keyboard alone and walk their recovery paths, such as a failed request or invalid input.
- When public pages change, confirm that their metadata, navigation, and entries in `src/lib/public-routes.ts` still agree.
- Update any product, design, architecture, or operating guidance the change makes stale.

Record each result in the Verification table of the [pull request template](../.github/pull_request_template.md).

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

## Flaky tests

Browser tests do not retry, in CI or locally, so a [flaky](agents/triage-labels.md#category-labels) test shows as a failure instead of a clean pass. When a rerun of the same code passes, open a `flaky` issue that names the test, quotes the failure text, and states the cause, or what is known of it. Each pull request that hit the flake says `Refs #N` for that issue in its description, never `Closes`.

## Formatting and hooks

Ultracite runs the quality tools: Oxlint checks code, and Oxfmt handles formatting and Tailwind class order. Lefthook formats/lints staged files before commit and runs `pnpm validate` before push. Claude Code and Cursor also format/lint the edited file after each edit; the full gates still apply.

Agent tooling and vendored plugin source are excluded from application quality gates. Manually review content, accessibility, architecture, and edge cases alongside the automated checks.

## Optional skills

The template commits no skills. To run a [flow walk](agents/delivery.md#flow-walk) with the full procedure, install the [`flow-walk`](https://github.com/nick-neely/agent-skills/tree/main/skills/flow-walk) skill into this checkout:

```bash
npx skills add nick-neely/agent-skills --skill flow-walk
```

It writes `.agents/skills/flow-walk/`, a `.claude/skills/flow-walk` link, and `skills-lock.json`, which `.gitignore` keeps local. Remove it with `npx skills remove flow-walk`. Choosing extra agents during install can write other agent directories that Git will show.
