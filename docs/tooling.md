# Tooling

Use this guide when a commit or push hook runs, when `pnpm install` asks to approve skills, when you update a committed skill, when you create or rename the issue labels, or when a Qualification or Closed issue labels run fails. For the checks every change needs, see [the development guide](development.md).

## Formatting and hooks

Ultracite runs the quality tools: Oxlint checks code, and Oxfmt handles formatting and Tailwind class order. Lefthook formats/lints staged files before commit and runs `pnpm validate` before push. Claude Code and Cursor also format/lint the edited file after each edit; the full gates still apply.

`oxlint.config.ts` extends Ultracite's opt-in presets alongside its framework presets:

- **anti-slop** rejects unchecked type assertions, `unknown` in signatures, and module mocks.
- **shadcn** keeps classes on the design system's tokens and component variants.
- **landmines** catches test shortcuts such as test doubles, fixed sleeps, polling, and retries, enforces test file names and placement, and bans annotated return types.

Landmines' `no-comments` rule is off as a gate: it matches comment syntax, not the shortcut a comment excuses. `pnpm comments:changed` turns it on for one run to list a branch's comments for the [comment check](agents/delivery.md#comment-check).

Agent tooling is excluded from application quality gates. `agent-tooling.ts` lists it; `tsconfig.json` and `lefthook.yml` restate that list, which `scripts/agent-tooling.test.ts` checks. Review content, accessibility, architecture, and edge cases by hand as well.

## Local Fallow reports

After `pnpm install`, run these advisory reports from the repository root:

- **Review a change.** Run `git fetch origin main`, then `pnpm fallow:review` for a local Markdown brief against `origin/main`. Investigate introduced findings against the diff. Inherited findings already existed on the base. A completed brief exits 0 even when it flags new findings. Check the changed-file count before interpreting an empty report.
- **Plan maintenance.** Run `pnpm fallow:summary` for whole-project dead code, duplication and health totals, including development files. These totals can include long-standing findings. Exit 1 can mean the analysis completed with findings. Read the report even on exit 0 because clones alone can produce a successful exit. Investigate tool errors separately.

For a finding that warrants a closer look, use the pinned CLI directly. The optional globally installed `fallow` skill can guide deeper investigations. Use `--no-production` for the full scope or `--production` to drop recognized tests and development entries. Each analysis applies its own filters.

```sh
pnpm exec fallow health --no-production --format json --quiet --explain
pnpm exec fallow dupes --no-production --format json --quiet --explain
pnpm exec fallow dead-code --no-production --format json --quiet --explain
pnpm exec fallow list --entry-points --production
```

- **Health and clones.** The router imports `src/routeTree.gen.ts`. Keep it in the import graph and exclude it from health and clone reports. Clone detection skips common test paths by default, even in full scope. These commands use estimated coverage for complexity risk. Compare findings within the same scope and coverage model.

## Skills

The template commits the [`flow-walk`](https://github.com/nick-neely/agent-skills/tree/main/skills/flow-walk) skill for [flow walks](agents/delivery.md#flow-walk). The skills CLI owns `.agents/skills/flow-walk/`, its copy for Claude Code in `.claude/skills/`, and `skills-lock.json`, which records the source. `npx skills update flow-walk -p` rewrites both copies; review and commit the diff. `scripts/skills.test.ts` checks that both folders hold exactly the locked skills and that the copies match. Remove it with `npx skills remove flow-walk`.

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

`--force` updates a label that already exists instead of failing, so the commands are safe to repeat. It also resets that label's color and description to these values. A renamed state label also changes `STATE_LABELS` in `scripts/state-labels.ts`, which `scripts/state-labels.test.ts` keeps equal to these commands.

## Qualification workflow

When a pull request merges, `.github/workflows/qualification.yml` moves each issue its Qualification section declares to `awaiting-qualification`; `scripts/apply-qualification.ts` says how. It applies the description as merged, never a later edit. It works through every declared issue and fails at the end if any failed:

- A closed issue stays closed; it gets a comment with the checks, and the run still passes.
- An issue that already has a Current acceptance from another delivery or an edit, or whose body ends inside an unclosed code fence or comment, stays unchanged; it gets a comment with the checks to add, and the run fails.
- A number that names a pull request fails the run.
- When the `awaiting-qualification` label is missing, it writes the Current acceptance and clears the assignees, leaves the labels, and fails. Create the labels as above.

Re-run the job once a transient or setup cause, such as a missing label, is fixed: a re-run never changes an issue it already moved and never repeats a comment. A wrong declaration cannot be fixed by editing the description, so move that issue by hand: append the Current acceptance that [qualification](qualification.md#when-to-use-it) shows, swap its state label for `awaiting-qualification`, and clear its assignees.

## Closed issue labels

When an issue closes, for any reason, `.github/workflows/closed-issue-labels.yml` removes its state labels except `wontfix` and keeps every other label; `scripts/clear-closed-labels.ts` says how. An issue reopened before the run keeps its labels. The run shares the Qualification workflow's concurrency group, so it never reads an issue while a merge is moving it.

GitHub starts no workflow for a close made with a workflow's own `GITHUB_TOKEN`, such as a `Closes #N` in a pull request that a workflow merged with that token, so such an issue keeps its labels. A failed run leaves them too. Re-run the job, or run the script with `REPO` and `NUMBER` set, as its header shows; a re-run never fails over a label already gone.
