# Working on the app

Use this guide for local development and checks. To find the files that own a change, or to change a route, see [the code map](code-map.md); to debug a failure, see [investigate a failure](debugging.md). Run commands from the repository root. For code ownership and server/browser boundaries, see [how the app fits together](architecture.md); for hosting, use [the deployment guide](deployment.md).

## Commands

```bash
pnpm dev        # Start the app on port 3000
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
pnpm validate:docs # Run check and docs:budget, as CI does for docs-only changes
pnpm test:e2e   # Check the production app in desktop and mobile Chromium
pnpm pr:verify <file | -> [--head <sha>] # Check a pull request description against the template
```

For `pnpm dev:local` and the other per-checkout commands, see [concurrent checkouts](concurrent-checkouts.md). For the formatter, Git hooks, committed agent skills, and the skills that `pnpm install` asks to approve, see [tooling](tooling.md).

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

Before handoff, inspect the changed route or action and report what you actually checked, with useful evidence and any remaining uncertainty.

- For interface changes, operate the changed controls with the keyboard alone and walk their recovery paths, such as a failed request or invalid input.
- When public pages change, confirm that their metadata, navigation, and entries in `src/lib/public-routes.ts` still agree.
- Update any product, design, architecture, or operating guidance the change makes stale.

Record each result in the Verification table of the [pull request template](../.github/pull_request_template.md).
