# Issue tracker: GitHub

Work for this repository lives in GitHub Issues. Use the `gh` CLI, which infers the repository from `git remote -v`. Issues own order, status, and blockers; no file in the repository tracks them. Replace this file as a whole if the project moves to another tracker.

## Pick up work

1. Work on the issue the person names. Otherwise take the first open issue labelled `ready-for-agent` with no assignee and no open blocker, in the order its work map lists, or oldest first when no map orders it. An issue without acceptance criteria is not ready: ask for them, or move it to `needs-triage` and pick another.
2. Check blockers before starting, including on a named issue. `gh issue view <n> --json blockedBy --jq '[.blockedBy.nodes[] | select(.state == "OPEN")] | length'` must print `0`, and no `Waits for` or `Blocked by` line in the body may name an open issue.
3. Claim it with `gh issue edit <n> --add-assignee @me` before editing code.

State labels and their transitions are in [triage labels](triage-labels.md).

## Issue shape

- A task starts as an issue with checkbox acceptance criteria that a reviewer can verify.
- When a decision changes the criteria, add a **Current acceptance** section. It supersedes the original criteria, which stay in place as history.
- A user-visible change names the user's goal, the state they are in, and where they start.
- A change to stored state names each pause between reading that state and applying a result, so the work covers what can change in between.
- A `bug` issue carries exactly one line: `Introduced by: #N`, `Introduced by: before #N`, or `Introduced by: unknown`.

## Link pull requests

- A delivery PR that completes an issue says `Closes #N` in its description.
- A PR that delivers the change while later checks remain says `Refs #N`. Whoever merges it moves the issue to `awaiting-qualification` and writes its Current acceptance.
- Write one keyword per issue, only in the PR description. Keep `Closes`, `Refs`, and other issue keywords out of commit messages: a squash merge can carry them onto the default branch and close an issue early.
- Refer to a work map as `Part of #N`, which is not a closing keyword.
- Record status in the issue, with labels, comments, and checkboxes. Never push a commit only to record status.

## Awaiting qualification

An `awaiting-qualification` issue is already delivered. Do not reimplement it. Its Current acceptance names each remaining check, who runs it, and when it is due.

- If a check is due and its runner is you or a role you fill, such as an agent, run it, tick its box, and comment with the evidence.
- If a check fails, comment with the evidence, open a `bug` issue for the failure that says `Introduced by: #N`, and keep this one open.
- When every box is ticked, close the issue with a comment that links the evidence.
- If it has no Current acceptance, ask the owner which checks remain.
- Otherwise leave it alone and pick other work.

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
| List ready, unclaimed work | `gh issue list --label ready-for-agent --search "no:assignee sort:created-asc"` |
| List a map's children | `gh issue view <map> --json subIssues --jq '.subIssues.nodes[] \| {number, state, title}'` |
| Change state | `gh issue edit <n> --remove-label <old> --add-label <new>` |
| Comment | `gh issue comment <n> --body-file <file>` |
