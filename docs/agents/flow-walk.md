# Flow-walk notes

Settings for a [flow walk](delivery.md#flow-walk) in this project. Builder and tester read this file first. Where a row speaks, it replaces the `flow-walk` skill's default for that item; every other item keeps the skill's default. A project adds its own user states and differences from production here as it grows.

| Item | This template |
| --- | --- |
| Open the app | Run `pnpm dev:local` in the background; take `appUrl` and `commit` from `pnpm local:status --json`; finish with [`pnpm local:stop`](../concurrent-checkouts.md) |
| User states | One: no account. The app has no sign-in. |
| Differences from production | The dev server adds a TanStack devtools button at the bottom right; production has none. It also hydrates much more slowly, most on a page's first load, so wait for the page to settle before judging a control that ignores input. |
| Drive the browser | An agent tester uses Playwright from this checkout's dependencies, and the Chromium that `pnpm exec playwright install chromium` installs. Keep its script and screenshots outside the repository. |
| Walk notes | Under Decisions in the PR: one list for each part of the tester's report in [flow walk step 2](delivery.md#flow-walk), each item naming its screen. |
| Record | The Verification table in the PR. |
| Bugs | Per [the issue tracker guide](issue-tracker.md). |
