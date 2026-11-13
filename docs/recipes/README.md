# Recipes

Each recipe covers a safeguard that only pays off after a later choice, such as adding a database. Read one when its trigger applies; until then, the template stays without it.

| Recipe | Trigger |
| --- | --- |
| [Persistence](persistence.md) | The first feature that reads or writes a database |
| [Verification at scale](verification-at-scale.md) | Checks or worktrees grow until a measurement says they cost too much |
| [Test clock](test-clock.md) | The first test whose result depends on the current date or time |
| [Git fixtures](git-fixtures.md) | A test that runs `git` |

Every recipe has the same shape: the trigger, what to add, how to prove it works, and how to remove it. Keep each under 60 lines with its trigger in the first two lines, and move longer material into the project's own docs once applied.
