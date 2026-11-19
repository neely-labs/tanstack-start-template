# Design System

The starter uses shadcn/ui on Base UI with the Rhea style, Mist neutral tokens, Inter, and Tabler outline icons.

## Baseline

- Semantic colors live in `src/styles.css`; product themes may replace their values without changing component interfaces.
- One accent, `--brand`, carries emphasis: focus rings, icon tiles, step numbers, and link underlines. Change its light and dark values to rebrand; keep it at 4.5:1 or better against the background so it stays readable as text.
- Light and dark themes share every token name. The visitor's choice is stored in `localStorage` and applied before paint by `src/lib/theme.ts`; without a stored choice the system preference wins.
- Shared UI primitives live in `src/components/ui` and remain compatible with the shadcn CLI.
- `pnpm check` runs shadcn's design-system lint, which flags raw palette colors, off-scale arbitrary values and classes that restyle a component's color, spacing, shape or typography. When it flags a class, add the missing token or `@utility` to `src/styles.css`, or a variant to the component's `src/components/ui` file, rather than silencing it. The home page's `tracking-display` and `dot-grid` are examples.
- Layout uses clear reading widths, restrained borders, and one elevation level for contained operational surfaces.
- Focus states, keyboard navigation, reduced-motion behavior, and responsive composition are requirements.
- Global not-found and error states preserve the shared shell and provide an obvious recovery action.
- The root shell renders the one `<main>`, the skip link's target, around every page; a page or recovery state renders a plain wrapper inside it, never its own `<main>`.
- A link that looks like a button is a `Link` or `<a>` styled with `buttonVariants`. Base UI's `Button` rendering an `<a>` gives it `role="button"`, so assistive technology announces a button.
- A link's accessible name is its visible text. Put extra context, such as "opens in a new tab", in visually hidden text after it rather than in `aria-label`.
- Product-specific visual direction belongs in this document after the starter is adopted. Do not treat the example landing page as a brand.
