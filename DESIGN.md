# Design System

The starter uses shadcn/ui on Base UI with the Rhea style, Mist neutral tokens, Inter, and Tabler outline icons.

## Baseline

- Semantic colors live in `src/styles.css`; product themes may replace their values without changing component interfaces.
- Shared UI primitives live in `src/components/ui` and remain compatible with the shadcn CLI.
- Layout uses clear reading widths, restrained borders, and one elevation level for contained operational surfaces.
- Focus states, keyboard navigation, reduced-motion behavior, and responsive composition are requirements.
- Global not-found and error states preserve the shared shell and provide an obvious recovery action.
- Product-specific visual direction belongs in this document after the starter is adopted. Do not treat the example landing page as a brand.
