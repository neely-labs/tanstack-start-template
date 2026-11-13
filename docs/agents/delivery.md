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

A round is one review and the fixes it prompts; at tier 0 the review is the author's own read of the diff. When the budget runs out and substantive findings remain, stop. Report the open findings, what each round fixed, and whether the findings are shrinking, then ask the owner whether to continue, narrow the change, or split it. If a change grows into a higher tier, review it at that tier.

## Merge danger

State three things in the pull request description before merge.

- **Door:** one for the whole change, set by its least reversible part.
  - _Clean two-way:_ reverting the merge restores everything, because nothing outside the code changed.
  - _Two-way:_ reverting restores the behavior, but something left behind needs known cleanup, such as data written in a new shape, a setting, or a cache.
  - _One-way:_ a revert cannot undo it, as with deleted or rewritten data, a sent message, a charge, or a published release.
  - _Uncertain:_ you cannot tell. Treat it as one-way until you can.
- **Blast radius:** what breaks if the change is wrong, such as docs only, one page, every page, stored data, or people outside the project.
- **Tier:** from the table above.

## Evidence

- Name the commit each result came from, and say whether the working tree had uncommitted changes when it ran. A result from a dirty tree proves that tree, not the commit.
- Report how many tests or checks ran and how many were skipped, and name each skip with its reason. A suite that ran nothing has not passed.
- Keep local, preview, and production results apart, and label each with where it ran.
- Update the pull request description once, before merge, so it describes the final head. Do not rewrite it after each fix.
- After pushing, confirm the remote branch points at the commit you tested: `git ls-remote origin <branch>` prints the same SHA as `git rev-parse HEAD`.

## Merge gate

A pull request is ready to merge when all of these hold on its current head:

- It is up to date, meaning it reports as mergeable with no conflicts.
- Required checks are green on that head, not on an earlier commit.
- Review at its tier is complete, each finding is fixed or answered with a written reason, and its review threads are resolved.
- The merge danger is stated, and the evidence names that head.

## Guards

Before trusting a new check or regression test, show it failing once. Break the behavior it guards, or run it on the base commit where the problem exists, and record the failing run with the evidence. Then restore the code and show it passing. A guard that has never failed may not test anything.

## Real devices

Check touch and gesture changes, such as swipes, drags, pinch zoom, long presses, and on-screen keyboard behavior, on a real phone before merge. Desktop emulation and mobile browser tests do not count. If no phone is available, say so in the pull request and leave the merge to the owner.
