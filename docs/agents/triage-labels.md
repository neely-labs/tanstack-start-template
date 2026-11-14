# Triage labels

An open issue carries exactly one state label. Change it by removing the old label in the same edit that adds the new one. Labels are repository settings that a template does not copy, so a new repository creates them once with the commands in [tooling](../tooling.md#create-the-labels).

## State labels

| Role | Label in this tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on the reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, with acceptance criteria an agent can work from |
| `ready-for-human` | `ready-for-human` | Requires human implementation or judgment |
| `awaiting-qualification` | `awaiting-qualification` | Delivered; open only for the checks its Current acceptance lists |
| `wontfix` | `wontfix` | Will not be actioned |

The roles `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` match the public `mattpocock/skills` pack, so its skills work unchanged. If a project renames a label, change the second column and the matching command in [tooling](../tooling.md#create-the-labels).

A new issue starts at `needs-triage`. One the person asked for starts at `ready-for-agent`, because their request is its triage; a follow-up you file for later still starts at `needs-triage`. Until the labels exist, file requested work without a state label. Triage moves it to `needs-info`, `ready-for-agent`, `ready-for-human`, or `wontfix`; `needs-info` returns to `needs-triage` when the reporter answers. When a PR that completes an issue's implementation merges while later checks remain, the person or agent who merged it moves the issue to `awaiting-qualification`.

## Awaiting qualification

Use this label when the change is merged but a check can only run later, such as observing production, running a rehearsal, or waiting for a scheduled job. The issue's Current acceptance starts with a status line, then one checkbox per remaining check that names who runs it and when it is due:

```markdown
## Current acceptance

Status: delivered in #57; open for two production checks.

- [ ] Owner confirms the weekly digest sends on 2026-12-01.
- [ ] A fresh agent repeats the setup rehearsal after #60 merges.
```

[The issue tracker guide](issue-tracker.md#awaiting-qualification) says how to run the checks and when to close the issue.

## Category labels

Category labels describe the kind of work and sit alongside the state label.

| Label | Meaning |
| --- | --- |
| `bug` | Something isn't working; the body carries one `Introduced by:` line |
| `flaky` | A test that fails and then passes on the same code |
