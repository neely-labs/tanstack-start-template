# Test clock: when the first test depends on the date

**Trigger:** the first test whose result depends on the current date or time, such as an expiry, a "3 days ago" label, or a schedule.

A test that reads the real clock passes today and fails at midnight, at month end, or in another time zone. Code that needs the time takes a clock instead, and tests pass a fixed one.

## Add

**A small injectable clock**, in `src/lib/clock.ts`:

```ts
export interface Clock {
  now: () => Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock that stays at `start` until the test advances it. */
export function fixedClock(start: string) {
  let time = new Date(start).getTime();
  return {
    advance: (milliseconds: number) => {
      time += milliseconds;
    },
    now: () => new Date(time),
  };
}
```

Code that reads the time takes a `clock: Clock = systemClock` parameter, and tests pass `fixedClock("2026-03-31T23:59:00Z")`. Use explicit UTC offsets in test times so the result does not depend on the machine's time zone.

**A lint rule against raw clock reads in tests.** Add this to `overrides` in `oxlint.config.ts`:

```ts
{
  files: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,mjs}"],
  rules: {
    "no-restricted-properties": [
      "error",
      { message: "Pass a fixedClock from src/lib/clock.ts.", object: "Date", property: "now" },
    ],
  },
},
```

**Allowed exceptions.** To time a real process, such as a polling deadline, use `performance.now()`, which the rule allows. Anything else needs `// oxlint-disable-next-line no-restricted-properties -- <reason>`, so review sees it.

The rule does not see `new Date()` without arguments; review catches those, or a custom rule beside `tools/oxlint/anti-slop` can once they recur. Vitest's `vi.setSystemTime` suits a one-off test, but it changes the clock for the whole file and hides the dependency, so prefer the injected clock in code you own.

## Prove

- A test of `fixedClock` passes: `now()` returns the start, and `advance(60_000)` moves it one minute.
- Add `Date.now()` to any test file: `pnpm check` fails with the rule's message. Remove it and the check passes.

## Remove

Once no code takes a `Clock`, delete `src/lib/clock.ts`, its test, and the override.
