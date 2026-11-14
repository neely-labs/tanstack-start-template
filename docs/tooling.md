# Tooling

Use this guide when a commit or push hook runs, when `pnpm install` asks to approve skills, when you update a committed skill, or when you create or rename the issue labels. For the checks every change needs, see [the development guide](development.md).

## Formatting and hooks

Ultracite runs the quality tools: Oxlint checks code, and Oxfmt handles formatting and Tailwind class order. Lefthook formats/lints staged files before commit and runs `pnpm validate` before push. Claude Code and Cursor also format/lint the edited file after each edit; the full gates still apply.

Agent tooling and vendored plugin source are excluded from application quality gates. Review content, accessibility, architecture, and edge cases by hand as well.

## Skills

The template commits the [`flow-walk`](https://github.com/nick-neely/agent-skills/tree/main/skills/flow-walk) skill for [flow walks](agents/delivery.md#flow-walk). The skills CLI owns `.agents/skills/flow-walk/`, its copy for Claude Code in `.claude/skills/`, and `skills-lock.json`, which records the source. `npx skills update flow-walk -p` rewrites both copies; review and commit the diff. `scripts/skills.test.ts` checks they match. Remove it with `npx skills remove flow-walk`.

Leave the dependency skills that `pnpm install` lists as awaiting approval unapproved. Approving commits a grant to `pnpm-workspace.yaml` that links their unreviewed skills into every checkout's skill folders. `scripts/skills.test.ts` fails on any grant. To undo one, revert that change or set `skills: false` for the package under `permissions`, then run `pnpm install` to unlink the skills and delete the `.gitignore` pnpm left in each skill folder; `pnpm approve '!<package>'` also works but denies the package's build scripts too. A project that decides to adopt a dependency's skills reviews them and adds the package to `approvedSkills` in that test.

The optional `ui-evidence` skill publishes screenshots to a pull request and needs tools the template does not install. Install it globally to keep this checkout unchanged:

```bash
npx skills add nick-neely/agent-skills --skill ui-evidence -g
```

## Create the labels

These commands change repository settings, so run them only with the owner's yes. Run them from the repository root with an account that can manage the repository's labels:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh label create needs-triage --repo "$repo" --force --color D4C5F9 --description "Maintainer needs to evaluate this issue"
gh label create needs-info --repo "$repo" --force --color FEF2C0 --description "Waiting for more information"
gh label create ready-for-agent --repo "$repo" --force --color 0E8A16 --description "Fully specified and ready for agent implementation"
gh label create ready-for-human --repo "$repo" --force --color 1D76DB --description "Requires human implementation or judgment"
gh label create awaiting-qualification --repo "$repo" --force --color FBCA04 --description "Delivered; open only for the checks its Current acceptance lists"
gh label create wontfix --repo "$repo" --force --color FFFFFF --description "This will not be worked on"
gh label create bug --repo "$repo" --force --color D73A4A --description "Something isn't working"
gh label create flaky --repo "$repo" --force --color D93F0B --description "A test that fails and then passes on the same code"
gh label list --repo "$repo" --limit 100
```

`--force` updates a label that already exists instead of failing, so the commands are safe to repeat. It also resets that label's color and description to these values.
