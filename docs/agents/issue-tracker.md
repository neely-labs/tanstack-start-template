# Issue tracker: GitHub

Work for this repository lives in GitHub Issues. Use the `gh` CLI. Issues own order, status, and blockers; no file in the repository tracks them. Replace this file as a whole if the project moves to another tracker.

## Pick up work

1. Work on the issue the person names, or on other specific work they name, such as a work map.
2. When they name nothing, first list open `awaiting-qualification` issues and handle each due check in them as [qualification](../qualification.md#run-the-checks) says, leaving checks that are not yet due. Then take the first open issue labelled `ready-for-agent` with no assignee and no open blocker, in the order its work map lists, or oldest first when no map orders it.
3. An issue without acceptance criteria is not ready, even a named one: ask for them, or move it to `needs-triage` and pick another.
4. Check blockers before starting, including on a named issue. `gh issue view <n> --json blockedBy --jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'` must print `0`, and no `Waits for` or `Blocked by` line in the issue body or in its entry on the work map may name an open issue.
5. Claim it with `gh issue edit <n> --add-assignee @me` before editing code.

When the person asks for work that has no issue yet, file one with acceptance criteria and claim it; [triage labels](triage-labels.md#state-labels) gives its label. [Template setup](../template-setup.md) is the exception and lands without an issue.

State labels and their transitions are in [triage labels](triage-labels.md).

## Issue shape

- A task starts as an issue with checkbox acceptance criteria that a reviewer can verify.
- When a decision changes the criteria, add one `## Current acceptance` section that supersedes them, as the body's last section. Keep the originals as history in plain Markdown, in a collapsed `<details>` block closed above that section, or in a comment, never in an HTML comment. That shape lets [the qualification workflow](../tooling.md#qualification-workflow) add its later checks to the section on merge.
- A user-visible change names the user's goal, the state they are in, and where they start.
- A change to stored state names each pause between reading that state and applying a result, so the work covers what can change in between.
- A `bug` issue is for merged work; fix a defect in unmerged work within its task. It carries exactly one line, `Introduced by: #N`, `Introduced by: before #N`, or `Introduced by: unknown`, where #N is a merged pull request.

## Link pull requests

- A delivery PR that completes an issue says `Closes #N`.
- A PR that delivers only part of an issue, or delivers all of it while later checks remain, says `Refs #N`. In the second case its Qualification section lists those checks, and [a workflow](../tooling.md#qualification-workflow) moves the issue to `awaiting-qualification` on merge; a partial delivery keeps its current label.
- Whoever reverts a delivery moves its issue back by hand.
- Write one keyword per issue, only in the PR description. Keep `Closes`, `Refs`, and other issue keywords out of commit messages: a squash merge can carry them onto the default branch and close an issue early.
- Refer to a work map as `Part of #N`, which is not a closing keyword.
- Record status in the issue with labels, comments, and checkboxes, never with a commit.

## Work maps

A map is one issue that coordinates related work. Its body states a **Goal** and a **Finish**, then holds **Notes**, **Decisions so far**, and **Fog** (the open questions). Its children are sub-issues listed in working order.

- Add a child with `gh issue create --parent <map>` or `gh issue edit <map> --add-sub-issue <n>`.
- Record a blocker with `gh issue edit <n> --add-blocked-by <blocker>`, and mirror it as a `Waits for #N` line in the map's list.
- When a child resolves a question, add a one-line pointer to the map's Decisions so far.
- Close the map by hand when every child is closed. No PR closes a map.

## Common commands

| Task | Command |
| --- | --- |
| Read an issue | `gh issue view <n> --comments` |
| List issues awaiting qualification | `gh issue list --label awaiting-qualification --state open` |
| List ready, unclaimed work | `gh issue list --label ready-for-agent --search "no:assignee sort:created-asc"` |
| List a map's children | `gh issue view <map> --json subIssues --jq '.subIssues.nodes[] \| {number, state, title}'` |
| Change state | `gh issue edit <n> --remove-label <old> --add-label <new>` |
| Comment | `gh issue comment <n> --body-file <file>` |
