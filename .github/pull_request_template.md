<!-- Terms and rules: docs/agents/delivery.md and docs/agents/issue-tracker.md -->

## Summary

<!-- What changed and why, in a few sentences. Then `Closes #N`, or `Refs #N` when part of the issue or a later check remains. -->

Closes #

## UI evidence

<!-- Screenshots or a recording of the final head. If you cannot upload, describe each screenshot with its local path and note that reviewers cannot open it. Delete this section when nothing visible changed. -->

## Merge danger

<!-- One short phrase per value, never a sentence. Reasons go under Decisions; each review round goes under Verification. -->

**Door:** <!-- clean two-way, two-way, one-way, or uncertain --> · **Risk tier:** <!-- 0, 1, or 2 --> · **Rounds used:** <!-- N of M, such as 2 of 3 -->

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

<!-- Choices you made on the owner's behalf, each with its reason. -->
