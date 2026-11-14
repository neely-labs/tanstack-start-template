# Tooling

Use this guide when a commit or push hook runs, when `pnpm install` asks to approve skills, or when you update a committed skill. For the checks every change needs, see [the development guide](development.md).

## Formatting and hooks

Ultracite runs the quality tools: Oxlint checks code, and Oxfmt handles formatting and Tailwind class order. Lefthook formats/lints staged files before commit and runs `pnpm validate` before push. Claude Code and Cursor also format/lint the edited file after each edit; the full gates still apply.

Agent tooling and vendored plugin source are excluded from application quality gates. Review content, accessibility, architecture, and edge cases by hand as well.

## Skills

The template commits the [`flow-walk`](https://github.com/nick-neely/agent-skills/tree/main/skills/flow-walk) skill for [flow walks](agents/delivery.md#flow-walk). The skills CLI owns `.agents/skills/flow-walk/`, its copy for Claude Code in `.claude/skills/`, and `skills-lock.json`, which records the source. `npx skills update flow-walk -p` rewrites both copies; review and commit the diff. `scripts/skills.test.ts` checks they match. Remove it with `npx skills remove flow-walk`.

Leave the dependency skills that `pnpm install` lists as awaiting approval unapproved. Approving commits a grant to `pnpm-workspace.yaml` that links their unreviewed skills into every checkout's skill folders.

The optional `ui-evidence` skill publishes screenshots to a pull request and needs tools the template does not install. Install it globally to keep this checkout unchanged:

```bash
npx skills add nick-neely/agent-skills --skill ui-evidence -g
```
