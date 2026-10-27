# Project Agent Notes

Read `PRODUCT.md` for intent and `DESIGN.md` for interface changes. For local work and verification, use `docs/development.md`; it links the runtime and deployment references. This file records decisions and constraints that survive template adoption.

## Project-specific guidance

- Ultracite is the quality entry point; Oxlint and Oxfmt own mechanical linting and formatting. Run `pnpm fix` after edits.
- `pnpm validate` is the core gate (lint, types, unit tests, Nitro build, prerender, rendered SEO). Run it freely rather than guessing which stage a change affects.
- CI also runs `pnpm test:e2e` against the production build. For runtime or UI changes, install Chromium with `pnpm exec playwright install chromium` and run the browser suite when the environment supports it. It covers desktop and mobile navigation, hydration, server functions, security headers, and static assets.
- Run the route generator through Vite before checking route additions or removals, as the development guide describes. Keep the inventory, metadata, navigation, inbound links, and browser journeys aligned; `src/routeTree.gen.ts` stays generator-owned.
- Reuse a development server only after confirming it belongs to this checkout. Give concurrent tasks separate app and E2E ports and stop only processes the task owns. Browser tests start their own production server to avoid exercising another checkout or an old build.

## Decisions, not omissions

- Authentication, persistence, analytics, state management beyond React and TanStack Router, and an environment-schema library are deliberately undecided. The application built on this template picks them.
- Keep one-off template assessments and delivery logs in the PR; committed guidance should be reusable by a new project.
- Route visibility controls prerendering and SEO discovery, not access control. `/api/health` stays available as infrastructure for browser-test readiness when example pages are removed.
- Adoption replaces product identity and examples while preserving the development workflow, quality gates, and generated-file ownership. Add local fixtures, reset/cleanup instructions, credential separation, and recovery checks alongside any new persistence or external integration.

## When Oxlint + Oxfmt cannot help

Manually verify domain and editorial correctness, source quality, user experience, accessibility, architecture, and edge cases.

For handoff, name the affected route or action, the checks actually run, and any remaining uncertainty. Core validation and production browser verification are separate results; attach useful evidence through the existing PR template.
