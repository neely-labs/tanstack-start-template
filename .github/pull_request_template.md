<!-- Terms and rules: docs/agents/delivery.md and docs/agents/issue-tracker.md -->

## Summary

<!-- What changed and why, in a few sentences. Then, when they make the change easier to see, at most one sketch (a diff, tree or call tree) and at most one before/after table. Then `Closes #N`, or `Refs #N` when part of the issue or a later check remains; for a later check, also fill Qualification. -->

Closes #

## Qualification

<!-- Only when this delivers all of an issue and checks remain after merge, such as watching production. Per issue, a `For #N:` line, then each remaining check as an unticked box naming who runs it and when it is due. On merge, a workflow moves the issue to awaiting-qualification with these checks as its Current acceptance. Otherwise delete this section. -->

For #

- [ ]

## UI evidence

<!-- Screenshots or a recording of the final head, between the two markers below, where the ui-evidence publisher writes. If you cannot upload, describe each screenshot there with its local path and note that reviewers cannot open it. When nothing visible changed, delete this section, markers included. -->

<!-- ui-evidence:start -->
<!-- ui-evidence:end -->

## Merge danger

<!-- One short phrase per value, never a sentence. Reasons go under Decisions; each review round goes under Verification. -->

- **Door:** <!-- clean two-way, two-way, one-way, or uncertain -->
- **Risk tier:** <!-- 0, 1, or 2 -->
- **Rounds used:** <!-- N of M, such as 2 of 3 -->
- **Blast radius:** <!-- What breaks if this is wrong, such as "docs only" or "CI; a runner outage blocks merges" -->
- **Rollback:** <!-- Only when the door is not clean two-way, such as "revert, then clear the cache". Otherwise delete this line. -->

## Verification

<!-- Commit: its SHA, plus "dirty" if the tree had uncommitted changes. Result: ran and skipped counts. Limits: where it ran (local, preview, production) and what it does not show. Reviews: one row per round; at tier 0 the reviewer is the author. -->

<details>
<summary>Outcome in one line, naming the head commit and the last review</summary>

**Checks**

| Commit | Command | Result | Limits |
| ------ | ------- | ------ | ------ |
|        |         |        |        |

**Reviews**

| Round | Reviewer | Head | Outcome |
| ----- | -------- | ---- | ------- |
|       |          |      |         |

</details>

## Decisions

<!-- First, each item that needs the owner's decision or a person's eye, opening with **Owner decision:** or **Needs your eye:**. That includes a walk note marked `owner decision`, a behavior this change made worse and left that way, and each check a person still has to make before merge; one after merge goes under Qualification. Then the choices you made on the owner's behalf, one short line each. A line states what you chose, and over what when that is not obvious, so a reader can disagree without opening the block; a topic such as "Checked some extra cases" is not a choice. The collapsed block holds each choice's reason, each review or walk finding you declined with why, and the other walk notes. Delete whatever stays empty, the whole block included. -->

- <!-- One choice, such as "Kept the old route as a redirect instead of deleting it" -->

<details>
<summary>Reasons, declined findings and walk notes</summary>

**Reasons**

**Declined findings**

**Walk notes**

</details>
