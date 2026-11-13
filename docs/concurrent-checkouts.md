# Concurrent checkouts

Use this guide to serve the app from a worktree while other checkouts run, or to call the per-checkout commands from a harness's worktree hooks. For the commands and checks every change needs, see [the development guide](development.md).

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

## Call it from worktree hooks

Harnesses that create a worktree per task usually offer setup and cleanup hooks. Point them at these commands instead of harness-specific scripts:

- **Setup:** run `pnpm install`, then start `pnpm dev:local` in the background if the task needs a running app. Read the URL from `appUrl` in `pnpm local:status --json`.
- **Cleanup:** before removing the worktree, run `pnpm --dir <an up-to-date checkout> local:retire --checkout <absolute worktree path>`. A refusal means the worktree holds uncommitted work; keep it and report it rather than forcing removal.

## Add a local resource

A project that adds a database, local cookies, or fixtures registers it in the `resources` list in `scripts/local.ts`, before the dev server, whose setup keeps running until the server exits. Each resource has `setup`, `status`, and `teardown`: `dev:local` sets resources up in order, `local:status` reports each one, and `local:retire` tears them down in reverse, so retirement stays one command. Keep per-checkout state under `.local/`.

The app currently needs no account, database, or environment file for local work. When adding persistence or an external service, include local fixtures, local credentials kept separate from production ones, reset/cleanup instructions, and recovery checks with that feature. [The recipes](recipes/README.md) cover a per-checkout database and its safeguards, slow checks, date-dependent tests, and tests that run Git.
