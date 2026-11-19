# Awaiting qualification

Use this guide for an `awaiting-qualification` issue, or when a delivery leaves checks that can run only after merge. [The qualification workflow](tooling.md#qualification-workflow) says how merging moves an issue to this label.

## When to use it

Use the label when the change is merged but a check can only run later, such as observing production, running a rehearsal, or waiting for a scheduled job. The issue's Current acceptance starts with a status line and a marker naming the delivering PR, then one checkbox per remaining check that names who runs it and when it is due:

```markdown
## Current acceptance

Status: delivered in #57; open for 2 later checks.

<!-- qualification: pr=57 -->

- [ ] Owner confirms the weekly digest sends on 2026-12-01.
- [ ] A fresh agent repeats the setup rehearsal after #60 merges.
```

## Run the checks

An `awaiting-qualification` issue is already delivered. Do not reimplement it. Its Current acceptance names each remaining check, who runs it, and when it is due.

- If a check is due and its runner is you or a role you fill, such as an agent, run it, tick its box, and comment with the evidence.
- If a check is due but you cannot run it, because its runner is the owner or someone else, or it needs access or approval you do not have, tell the person which check is due and why you cannot run it.
- If a check fails, comment with the evidence, open a `bug` issue for the failure that says `Introduced by: #N`, and keep this one open. It keeps `awaiting-qualification` while it stays open.
- When every box is ticked, close the issue with a comment that links the evidence. Closing removes `awaiting-qualification`, as [triage labels](agents/triage-labels.md#triage-labels) says.
- If it has no Current acceptance, ask the owner which checks remain.
- Otherwise leave it alone and pick other work.
