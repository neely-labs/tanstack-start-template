# Working on the app

Use this guide for local development, route changes, checks, and debugging. Run commands from the repository root. For code ownership and server/browser boundaries, see [how the app fits together](architecture.md); for hosting, use [the deployment guide](deployment.md).

## Commands

```bash
pnpm dev        # Start the app on port 3000
pnpm dev:local  # Start the app on this checkout's own port (see below)
pnpm fix        # Apply lint and formatting fixes
pnpm check      # Check lint, formatting, and type-aware rules
pnpm typecheck  # Check TypeScript
pnpm test       # Run unit tests once
pnpm build      # Build the production app and prerender public pages
pnpm seo:verify # Check metadata in the built files
pnpm start      # Run an existing production build
pnpm validate   # Run the core checks, build, and metadata verification
pnpm test:e2e   # Check the production app in desktop and mobile Chromium
pnpm local:status  # Show this checkout's branch, ports, and server
pnpm local:retire  # Stop this checkout's server and remove its local state
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

- For interface changes, operate the changed controls with the keyboard alone and walk their recovery paths, such as a failed request or invalid input.
- When public pages change, confirm that their metadata, navigation, and entries in `src/lib/public-routes.ts` still agree.
- Update any product, design, architecture, or operating guidance the change makes stale.

Record each result in the Verification table of the [pull request template](../.github/pull_request_template.md).

## Use concurrent checkouts

Separate worktrees have their own source and build output but share network ports. `scripts/local.ts` gives each checkout its own ports and records what it started, so several agents or people can work side by side without choosing ports or stopping each other's servers.

```bash
pnpm dev:local           # Serve this checkout on its own port
pnpm local:status        # Checkout, branch, commit, dirty state, URL, server state
pnpm local:status --json # The same report for scripts
pnpm local:retire        # Stop this checkout's server, remove .output/, .tanstack/, and .local/
```

- **Ports.** Each checkout derives a stable app port (20000-24999) and browser-test port (5000 higher) from its path, so the same worktree always gets the same URL. `pnpm test:e2e` uses the browser-test port unless `E2E_PORT` is set. Browser checks start their own production server and reject an occupied port, so they cannot quietly test another checkout or an old build.
- **Ownership.** `pnpm dev:local` writes the ignored `.local/owner.json` with the checkout path, port, server process id and start time, and the commit it started from. It refuses to start when this checkout is already serving, or when another worktree's live server owns the same port. Two paths rarely share a port; if they do, retire one or start Vite with an explicit `--port`. Starting and retiring briefly hold `.local/lock` so they cannot overlap; if a crash leaves it behind, the error names it for removal.
- **Status.** The dev server reports `running`, `stopped`, or `stale`. `stale` means the recorded process id now belongs to a different process, which nothing here will stop.
- **Retirement.** `pnpm local:retire` refuses while the checkout has uncommitted or untracked files, and then changes nothing. Otherwise it stops only the process it recorded, removes the build output and ownership file, and lists what it removed. To retire an older worktree whose script may be out of date, run it from an up-to-date checkout: `pnpm local:retire --checkout <absolute path>`.

`pnpm dev` still serves port 3000 for a single checkout. The commands rely on `git`, plus `/proc` on Linux and WSL or `ps` on macOS.

### Call it from worktree hooks

Harnesses that create a worktree per task usually offer setup and cleanup hooks. Point them at these commands instead of harness-specific scripts:

- **Setup:** run `pnpm install`, then start `pnpm dev:local` in the background if the task needs a running app. Read the URL from `appUrl` in `pnpm local:status --json`.
- **Cleanup:** before removing the worktree, run `pnpm --dir <an up-to-date checkout> local:retire --checkout <absolute worktree path>`. A refusal means the worktree holds uncommitted work; keep it and report it rather than forcing removal.

### Add a local resource

A project that adds a database, local cookies, or fixtures registers it in the `resources` list in `scripts/local.ts`, before the dev server, whose setup keeps running until the server exits. Each resource has `setup`, `status`, and `teardown`: `dev:local` sets resources up in order, `local:status` reports each one, and `local:retire` tears them down in reverse, so retirement stays one command. Keep per-checkout state under `.local/`.

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
