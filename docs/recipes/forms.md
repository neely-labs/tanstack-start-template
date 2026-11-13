# Forms: when a form keeps a field in state

**Trigger:** the first form that keeps a field in React state, such as for a live character count, or whose data must not leave the browser. [The rule](../architecture.md#forms-before-hydration) applies to every form; this recipe adds the code and the test that proves it.

## Add

The code lives in [`forms/`](forms/), beside this file. Copy it, then rename the fields to yours:

- **[`greeting-form.tsx`](forms/greeting-form.tsx)**, into `src/components/`, rendered on a route. It follows the rule with a controlled field for the live count.
- **[`greeting.spec.ts`](forms/greeting.spec.ts)**, into `tests/e2e/`, with `/greeting` changed to that route. The first test holds the page's scripts, types and submits into the server HTML, releases the scripts, and expects the greeting, the count, the field, and a URL without the name. The second submits with JavaScript disabled and expects no request at all.

## Prove

Run `pnpm build`, then `pnpm test:e2e` on the copied test: both tests pass. Then break the form three ways, rebuilding each time, and watch the first test fail:

- Without the effect, the count stays at 0 and the next render erases the field.
- With the action reading the name from state, the greeting reads "Enter a name.".
- With `onSubmit` in place of `action`, the submit reloads the page with `?name=Ada` in the URL, so no greeting appears, and the second test sees that request.

Restore the form. The first test asserts that the count still reads 0 after typing, which holds only before hydration, so a route pattern that stops holding the scripts fails the test instead of letting it type into a hydrated page.

## Remove

Delete the copied test with the last form it covers. The rule stays.
