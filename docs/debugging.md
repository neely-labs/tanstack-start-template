# Investigate a failure

Use this guide when a check, page, or request fails. For the checks themselves, see [Check your changes](development.md#check-your-changes).

- Check `/api/health` to see whether the server responds. A successful response alone does not identify the checkout.
- Read the terminal for build and prerender errors. `pnpm seo:verify` names the route or built file whose metadata failed.
- Use the browser console, network panel, and development-only TanStack devtools to inspect navigation, hydration, and server requests.
- For a browser-check failure, open the screenshot and error context under `test-results/`, then inspect the trace:

```bash
pnpm exec playwright show-trace path/to/trace.zip
```

CI uploads those files as `browser-failure-evidence` for seven days when browser checks fail. Download the artifact and run the same trace command. Review captured data before publishing a trace from an app with private or authenticated content.

The example loader-retry test simulates a failed request inside its browser, then retries the real server. It is a pattern for failure testing without a production fault endpoint. If an approach fails, inspect the diff and undo only the task's changes, preserving unrelated edits and other tasks' processes.

## Flaky tests

Browser tests do not retry, in CI or locally, so a [flaky](agents/triage-labels.md#category-labels) test shows as a failure instead of a clean pass. When a rerun of the same code passes, open a `flaky` issue that names the test, quotes the failure text, and states the cause, or what is known of it. Each pull request that hit the flake says `Refs #N` for that issue in its description, never `Closes`.
