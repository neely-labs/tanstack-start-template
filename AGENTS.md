# Project Agent Notes

Read the code for how this repository works; `README.md` documents the layout, commands, and replacement seams. This file records only what the code cannot tell you.

## Project-specific guidance

- Ultracite is the quality entry point; Oxlint and Oxfmt own mechanical linting and formatting. Run `pnpm fix` after edits.
- `pnpm validate` is the whole gate (lint, types, tests, Nitro build, prerender, rendered SEO) and takes about five seconds. Run it freely rather than guessing which stage a change affects; there is no faster subset worth substituting.

## Decisions, not omissions

- Authentication, persistence, analytics, state management beyond React and TanStack Router, and an environment-schema library are deliberately undecided. The application built on this template picks them.

## When Oxlint + Oxfmt cannot help

Manually verify domain and editorial correctness, source quality, user experience, accessibility, architecture, and edge cases.

## Learned workspace facts

- None yet.

## Learned user preferences

- None yet.
