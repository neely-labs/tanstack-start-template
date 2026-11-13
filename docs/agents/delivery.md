# Delivery

Use this guide to decide how much review a change needs, how risky its merge is, and what counts as evidence. It applies to every pull request, whoever wrote it. [The issue tracker guide](issue-tracker.md) covers choosing work and linking pull requests.

## Review tiers

Classify a change by the behavior it can affect, not by its size or file type. When parts of a change fall in different tiers, the highest tier wins. When you are unsure between two tiers, take the higher one.

| Tier | The change can affect | Review it needs | Round budget |
| --- | --- | --- | --- |
| 0 | Nothing at runtime: docs, comments, tests, and tooling with no runtime effect | The author reads the final diff and runs the checks; no independent review | 1 |
| 1 | What people see, with nothing stored or sent: copy, presentation, isolated UI | An independent review by a fresh agent or a different model, repeated after substantive fixes | 2 |
| 2 | Stored state, auth, money, external effects, or agent authority | An independent review by a fresh agent or a different model in every round, until a round finds nothing substantive | 5 |

- **External effects** reach beyond the app: email, payments, webhooks, third-party API calls, and published content.
- **Agent authority** is what an agent may do without asking, such as merge, delete, spend, publish, or change these rules. A docs-only change that widens it is tier 2.
- **Examples:** fixing a typo in a guide is tier 0. Changing a button label is tier 1. Adding a field that is saved with each record is tier 2, even as a one-line change.

A round is one review and the fixes it prompts; at tier 0 the review is the author's own read of the diff. A finding is substantive when leaving it would break behavior or mislead a reader; style preferences are not. When the budget runs out before the tier's review is satisfied, stop, even if the last round fixed everything and only a recheck remains. Report the open findings, what each round fixed, and whether the findings are shrinking, then ask the owner whether to continue, narrow the change, or split it. If a change grows into a higher tier, review it at that tier.

## Flow walk

Before code review of a change to what a user sees or decides, someone with fresh context walks the flow: a new agent or a person who has seen neither the diff nor the conversation that built it.

1. Commit the change, use its main path yourself, and stop your server. Brief the tester with the commit and three lines from the issue: the user's goal, their user state, and where they start. Share nothing else about the change, such as the diff, changed files, rationale, or suspected problems.
2. The tester opens the app as [the flow-walk notes](flow-walk.md) say, walks toward the goal using only what the screens show, and reports where they hesitated, what they could not recover from, and what they could not judge.
3. Fix a blocker and walk again with a new tester. For a finding on a screen this change altered, fix it or decline it with a reason, unless it needs a new owner decision. A bug you reproduce yourself at that commit becomes an issue, per [the issue tracker guide](issue-tracker.md). Everything else is a note under the PR's Decisions.
4. If review then changes the visible flow beyond wording, walk it once more with a new tester.

The `flow-walk` skill carries the full procedure; installing it is [optional](../development.md#optional-skills).

## Merge danger

State these in the pull request description before merge.

- **Door:** one for the whole change, set by its least reversible part.
  - _Clean two-way:_ reverting the merge restores everything, because nothing outside the code changed.
  - _Two-way:_ reverting restores the behavior, but something left behind needs known cleanup, such as data written in a new shape, a setting, or a cache.
  - _One-way:_ a revert cannot undo it, as with deleted or rewritten data, a sent message, a charge, or a published release.
  - _Uncertain:_ you cannot tell. Treat it as one-way until you can.
- **Rollback:** only when the door is not clean two-way, how to undo or contain the change, such as the cleanup a revert leaves or the forward fix for a one-way step.
- **Blast radius:** what breaks if the change is wrong, such as docs only, one page, every page, stored data, or people outside the project.
- **Risk tier:** the review tier from the table above.

## Evidence

- Name the commit each result came from, and say whether the working tree had uncommitted changes when it ran. A result from a dirty tree proves that tree, not the commit. If that exact tree is then committed with no further edits, the result names the new commit.
- Report how many tests or checks ran and how many were skipped, and name each skip with its reason.
- Keep local, preview, and production results apart, and label each with where it ran.
- Open the pull request with a short summary. Complete the description once, before merge, so it describes the final head. Do not rewrite it after each fix.
- After pushing, confirm the remote branch points at the commit you tested: `git ls-remote origin <branch>` prints the same SHA as `git rev-parse HEAD`.

## Merge gate

A pull request is ready to merge when all of these hold on its current head:

- It is up to date, meaning it reports as mergeable: no conflicts, and nothing the branch rules still require, such as an update from the default branch where the rules require one.
- Required checks are green on that head, not on an earlier commit.
- Review at its tier is complete, each finding is fixed or answered with a written reason, and its review threads are resolved.
- The merge danger is stated, and the evidence names that head.

## After merge

First confirm the pull request merged and that the branch's tip, both locally and on GitHub, matches the merged head that `gh pr view <n> --json headRefOid --jq .headRefOid` prints. If either tip differs, keep the branch and report it. Otherwise retire the task's checkout as [concurrent checkouts](../concurrent-checkouts.md) describes, then remove its worktree, or switch the main checkout back to the default branch if the task used it. Then delete the branch on GitHub, and locally with `git branch -D`, since a squash merge leaves it looking unmerged.

## Guards

Before trusting a new check or regression test, show it failing once. Break the behavior it guards, or run it on the base commit where the problem exists, and record the failing run with the evidence. Then restore the code and show it passing. A guard that has never failed may not test anything.

## Real devices

Check touch and gesture changes, such as swipes, drags, pinch zoom, long presses, and on-screen keyboard behavior, on a real phone before merge. Desktop emulation and mobile browser tests do not count. If no phone is available, say so in the pull request and leave the merge to the owner.
