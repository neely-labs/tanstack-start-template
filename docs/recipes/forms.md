# Forms: when a form keeps a field in state

**Trigger:** the first form that keeps a field in React state, such as for a live character count, or whose data must not leave the browser. [The rule](../architecture.md#forms-before-hydration) applies to every form; this recipe adds the code and the test that proves it.

## Add

The code lives beside this file, where `pnpm check` and `pnpm typecheck` keep it passing on the pinned stack until you copy it:

- **[`greeting-form.tsx`](forms/greeting-form.tsx)**, into `src/components/`. Its field is controlled for the live count. One effect copies what the field holds into state when it mounts, and the action reads the submitted `FormData`, never state.
- **[`greeting.spec.ts`](forms/greeting.spec.ts)**, into `tests/e2e/`, with `/greeting` changed to the route that renders the form. It holds the page's scripts, types and submits into the server HTML, releases the scripts, and expects the greeting, the count, the field, and a URL without the name. A second test submits with JavaScript disabled and expects the URL unchanged.

Then rename the fields to yours. A real form keeps the same three parts: a function `action`, a submit read from `FormData`, and one adopting effect per controlled field.

## Prove

Run `pnpm build`, then `pnpm test:e2e` on the copied test: every test passes. Then break the form three ways, rebuilding each time, and watch the first test fail:

- Without the effect, the count stays at 0 and the next render erases the field.
- With the action reading the name from state, the greeting reads "Enter a name.".
- With `onSubmit` in place of `action`, the submit puts `?name=Ada` in the URL, and the no-JavaScript test fails too.

Restore the form. The test's setup asserts that the count still reads 0 after typing, so a route pattern that stops holding the scripts fails the test instead of passing it unheld.

## Remove

Delete the copied test with the last controlled form. The rule stays. Delete `docs/recipes/forms/` with this file when the project drops its recipes.
