# Triage labels

An open issue carries exactly one state label. Change it by removing the old label in the same edit that adds the new one. Labels are repository settings that a template does not copy, so a new repository creates them once with the commands below.

## State labels

| Role | Label in this tracker | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | A maintainer needs to evaluate this issue |
| `needs-info` | `needs-info` | Waiting on the reporter for more information |
| `ready-for-agent` | `ready-for-agent` | Fully specified, with acceptance criteria an agent can work from |
| `ready-for-human` | `ready-for-human` | Requires human implementation or judgment |
| `awaiting-qualification` | `awaiting-qualification` | Delivered; open only for the checks its Current acceptance lists |
| `wontfix` | `wontfix` | Will not be actioned |

The roles `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix` match the public `mattpocock/skills` pack, so its skills work unchanged. If a project renames a label, change the second column and the matching command below.

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
