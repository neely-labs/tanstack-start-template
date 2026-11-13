# Flow-walk notes

Settings for a [flow walk](delivery.md#flow-walk) in this project. Builder and tester read this file first. Where a row speaks, it replaces the `flow-walk` skill's default for that item; every other item keeps the skill's default. A project adds its own user states and differences from production here as it grows.

| Item | This template |
| --- | --- |
| Open the app | Run `pnpm dev:local` in the background; take the URL and commit from `pnpm local:status --json`; finish with `pnpm local:retire`, which [stops it and removes local state](../concurrent-checkouts.md) |
| User states | One: no account. The app has no sign-in. |
| Differences from production | The dev server adds a TanStack devtools button at the bottom right; production has none. |
| Walk notes | Under Decisions in the PR, in the skill's walk-notes shape. |
| Record | The Verification table in the PR. |
| Bugs | Per [the issue tracker guide](issue-tracker.md). |
