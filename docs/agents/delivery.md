# Delivery

This guide sets the review, merge danger and evidence every pull request needs, whoever wrote it. [The issue tracker guide](issue-tracker.md) covers choosing work and linking pull requests.

## Review tiers

Classify a change by the behavior it can affect, not its size or file type. When parts fall in different tiers, or you are unsure, take the higher tier.

| Tier | The change can affect | Review it needs | Round budget |
| --- | --- | --- | --- |
| 0 | Nothing at runtime: docs, comments, tests, and tooling with no runtime effect | The author reads the final diff and runs the checks; no independent review | 1 |
| 1 | What people see, with nothing stored or sent: copy, presentation, isolated UI | An independent review by a fresh agent or a different model, repeated after substantive fixes | 2 |
| 2 | Stored state, auth, payments or balances, external effects, or agent authority | Tier 1's review in every round, until one finds nothing substantive | 5 |

- **External effects** reach beyond the app: email, payments, webhooks, third-party API calls, and published content.
- **Agent authority** is what an agent may do without asking, such as merge, delete, spend, publish, or change these rules. A docs-only change that widens it is tier 2.
- **Examples:** fixing a typo in a guide is tier 0. A calculator that shows amounts but stores and sends nothing is tier 1. Saving a new field with each record is tier 2, even in one line.

A round is one review and the fixes it prompts; at tier 0 the review is the author's own read of the diff. A review bot's finding, checked against the current head, joins the current round. Wait for no optional bot; none replaces the tier's independent review. A finding is substantive when leaving it would break behavior or mislead a reader; style preferences are not. When the budget runs out before the tier's review is satisfied, stop, even if the last round fixed everything and only a recheck remains. Report the open findings, what each round fixed, and whether they are shrinking, then ask the owner whether to continue, narrow, or split the change. If a change grows into a higher tier, review it at that tier.

## Flow walk

Before code review of a change to what a user sees or decides, a fresh tester walks the flow: a new agent or a person who has seen neither the diff nor the conversation behind it.

1. Commit the change, use its main path yourself, and stop your server. Brief the tester with the commit and three lines from the issue: the user's goal, their user state, and where they start. Share nothing else: no diff, changed files, rationale, or suspected problems.
2. The tester opens the app as [the flow-walk notes](flow-walk.md) say, walks toward the goal using only what the screens show, and reports where they hesitated, what they could not recover from, and what they could not judge.
3. Fix a blocker and walk again with a new tester. For a finding on a screen this change altered, fix it or decline it with a reason, unless it needs a new owner decision. A bug you reproduce in merged code becomes an issue, per [the issue tracker guide](issue-tracker.md). Everything else is a note under the PR's Decisions.
4. If review then changes the visible flow beyond wording, walk it once more with a new tester.

The `flow-walk` skill carries the full procedure; installing it is [optional](../development.md#optional-skills).

## Merge danger

State these in the pull request description before merge.

- **Door:** one for the whole change, set by its least reversible part.
  - _Clean two-way:_ a revert restores everything; nothing outside the code changed.
  - _Two-way:_ a revert restores behavior but leaves known cleanup, such as data in a new shape, a setting, or a cache.
  - _One-way:_ a revert cannot undo it, as with deleted or rewritten data, a sent message, a charge, or a published release.
  - _Uncertain:_ treat it as one-way until you can tell.
- **Rollback:** only for a door that is not clean two-way, how to undo or contain the change, such as a revert's cleanup or a one-way step's forward fix.
- **Blast radius:** what breaks if the change is wrong, such as docs only, one page, every page, stored data, or people outside the project.
- **Risk tier:** the review tier from the table above.

## Evidence

- Name the commit each result came from, and whether the tree was dirty. A dirty-tree result proves that tree, not the commit; once that exact tree is committed unedited, it names the new commit.
- Report how many tests or checks ran and were skipped, naming each skip's reason.
- Label each result local, preview, or production, and keep them apart.
- Open the pull request with a short summary; complete the description once, before merge, for the final head.
- After pushing, confirm the remote branch points at the commit you tested: `git ls-remote origin <branch>` prints the same SHA as `git rev-parse HEAD`.

## Merge gate

A pull request is ready to merge when all of these hold on its current head:

- It reports as mergeable: no conflicts, and nothing the branch rules still require, such as an update from the default branch.
- Required checks are green on that head.
- Review at its tier is complete, each finding is fixed or answered with a written reason, and the author resolves each thread once answered.
- The merge danger is stated, and the evidence names that head.

Squash-merge, pinned to that head: `gh pr merge <n> --squash --match-head-commit <sha>`.

## After merge

First confirm the pull request merged and that the branch's tip, both locally and on GitHub, matches the merged head that `gh pr view <n> --json headRefOid --jq .headRefOid` prints. If either tip differs, keep the branch and report it. Otherwise retire the task's checkout as [concurrent checkouts](../concurrent-checkouts.md) describes, then remove its worktree, or switch the main checkout back to the default branch if the task used it. Then delete the branch on GitHub, and locally with `git branch -D`, since a squash merge leaves it looking unmerged.

## Guards

Before trusting a new check or regression test, show it failing once, per behavior or acceptance criterion rather than per test case. Break the behavior it guards, or run it on the base commit that has the problem, and record the failing run in the evidence. Then restore the code and show it passing. A guard that has never failed may not test anything.

## Real devices

Check touch and gesture changes, such as swipes, drags, pinch zoom, long presses, and on-screen keyboard behavior, on a real phone before merge; desktop emulation and mobile browser tests do not count. Native input hints (`inputMode`, `type`, `enterkeyhint`, `autocomplete`) are exempt: the browser handles them and they degrade safely. Without a phone, keep the behavior rather than removing it to dodge the check, say so in the pull request, and leave the merge to the owner.
