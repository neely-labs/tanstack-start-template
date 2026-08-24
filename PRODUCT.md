# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary users are experienced TypeScript and React developers, working individually or in teams, who are starting a production web application with TanStack Start. They need a dependable baseline that removes repeated infrastructure setup so they can begin with the product's actual domain, workflows, and content.

## Product Purpose

TanStack Start Template is a reusable GitHub template for beginning production-minded applications. It preserves proven runtime, interface, validation, SEO, agent-assisted development, and deployment decisions while leaving product-specific choices to the application created from it.

Success means a developer can create a new repository, replace the documented identity and example surfaces, run one validation command, and continue building without first rebuilding the project's foundation.

## Positioning

The template combines a deliberately small application surface with a complete path from local editing through hooks, tests, production output, rendered SEO verification, CI, and Vercel deployment. Its replacement seams and deliberate omissions are documented so infrastructure is reusable without quietly imposing a product model.

## Operating Context

- Developers create a new repository from the GitHub template or copy it locally.
- Local work uses Node.js, pnpm, TanStack Start's Vite development server, and the repository's agent guidance and skills.
- `pnpm validate` is the shared handoff gate for local work, pre-push hooks, and CI.
- Public routes are inventoried for prerendering, sitemap generation, and rendered SEO verification.
- The production output is Vercel-ready through Nitro, but the template does not contain deployment credentials or a linked Vercel project.

## Capabilities and Constraints

- The baseline uses TanStack Start, React, Nitro, Tailwind CSS, shadcn/ui on Base UI, TypeScript, Vitest, Ultracite, Oxlint, Oxfmt, Lefthook, and pnpm.
- Node.js 24 and the pinned pnpm 12 release candidate are repository constraints until intentionally upgraded.
- The template supplies shared shell, example routes, accessible recovery states, SEO helpers, public-route inventory, production build output, CI, and agent-assisted development tooling.
- Authentication, persistence, analytics, domain models, product copy, deployment credentials, and application-specific state management are deliberately undecided.
- The canonical origin, manifest identity, social image, robots policy, example routes, and product guidance must be replaced by each adopted application.
- Original template code is distributed under the MIT License; vendored source remains under its upstream license.

## Brand Commitments

The source repository is named TanStack Start Template. Its voice is concise, candid, and production-minded. The example landing page demonstrates the baseline but is not a brand commitment for applications created from the template; adopted applications replace their public identity and product-specific guidance.

## Evidence on Hand

- `README.md` documents setup, replacement points, commands, deliberate omissions, and the production path.
- `src/routes` contains working example surfaces and global not-found and error recovery behavior.
- `scripts/verify-seo-output.mjs` checks rendered production metadata, structured data, public routes, and the social image.
- `.github/workflows/ci.yml` runs the same validation gate used locally.
- `public/social-card.png` and `assets/source/social-card-background.png` provide a finished example social asset and its recoverable source.
- No customers, testimonials, adoption metrics, performance benchmarks, or product-specific claims are established; future work must not fabricate them.

## Product Principles

- Reuse infrastructure while leaving product decisions to the product.
- Keep one observable validation path from local work through CI.
- Prefer explicit replacement seams and deliberate omissions over hidden assumptions.
- Verify production artifacts and user-visible behavior, not configuration alone.
- Keep the starting surface small, accessible, and straightforward to remove or extend.

## Accessibility & Inclusion

The baseline targets WCAG 2.2 Level AA. Shared surfaces must support semantic structure, keyboard operation, visible focus, appropriate focus management, reduced-motion preferences, readable contrast, and responsive layouts. Applications created from the template may add stricter or audience-specific requirements but must not weaken this baseline unintentionally.
