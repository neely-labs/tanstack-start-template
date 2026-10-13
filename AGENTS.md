# Project Agent Notes

Read the code for how this repository works; `README.md` documents the layout, commands, and replacement seams. This file records only what the code cannot tell you.

## Project-specific guidance

- Ultracite is the quality entry point; Oxlint and Oxfmt own mechanical linting and formatting. Run `pnpm fix` after edits.
- `pnpm validate` is the core gate (lint, types, unit tests, Nitro build, prerender, rendered SEO). Run it freely rather than guessing which stage a change affects.
- CI also runs `pnpm test:e2e` against the production build. For runtime or UI changes, install Chromium with `pnpm exec playwright install chromium` and run the browser suite when the environment supports it. It covers desktop and mobile navigation, hydration, server functions, security headers, and static assets.

## Decisions, not omissions

- Authentication, persistence, analytics, state management beyond React and TanStack Router, and an environment-schema library are deliberately undecided. The application built on this template picks them.

## When Oxlint + Oxfmt cannot help

Manually verify domain and editorial correctness, source quality, user experience, accessibility, architecture, and edge cases.

## Learned workspace facts

- None yet.

## Learned user preferences

- None yet.
