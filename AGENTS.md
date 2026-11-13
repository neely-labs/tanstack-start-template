# Agent index

This file points to where each rule lives. A rule is stated once, in the doc that owns it; follow the link instead of restating it. The Quality list is owned here.

## Always read

- [Product Purpose](PRODUCT.md#product-purpose) and [Cross-cutting invariants](PRODUCT.md#cross-cutting-invariants): what the product is for and what every change must preserve.

## Read when

| When you | Read |
| --- | --- |
| Choose, claim, or link work to an issue, or change its state label | [Issue tracker](docs/agents/issue-tracker.md) and [triage labels](docs/agents/triage-labels.md) |
| Review a change, write PR evidence, or decide it is ready to merge | [Delivery](docs/agents/delivery.md) |
| Need the file that owns a change and the check that proves it | [Find the right files](docs/development.md#find-the-right-files) |
| Run, check, or debug the app, or work beside other checkouts | [Development guide](docs/development.md) |
| Cross the server/browser boundary, or change identity, metadata, or route visibility | [Architecture](docs/architecture.md) |
| Change anything visible | [DESIGN.md](DESIGN.md) |
| Consider authentication, persistence, analytics, or other choices left to the product | [Capabilities and Constraints](PRODUCT.md#capabilities-and-constraints) |
| Add a database, find checks slow, test the date, or test code that runs Git | The matching [recipe](docs/recipes/README.md), only once its trigger applies |
| Need a project term or the reason for a past decision | [Domain docs](docs/agents/domain.md) |
| Deploy, or adopt the template as a new project | [Deployment](docs/deployment.md) and [template setup](docs/template-setup.md) |

## Quality

- Before handoff, run the checks in [Check your changes](docs/development.md#check-your-changes) and report them as [Delivery](docs/agents/delivery.md#evidence) describes.
- Green means it ran: zero selected tests, or a required suite that skipped, is not verification.
- A measured number in a doc carries its host, load and date, or links the PR that measured it. Budgets and limits are exempt.
- Agent-facing docs are written for agents; human guides stay short; dated history goes in PRs and issues.
- Write temporary files outside the repository.

## Skills in this repo

Repo policy wins over shared or global skills. When a skill's wording conflicts with a rule here or in a linked doc, map that conflict below once: the skill, its wording, and the rule that applies instead.

No conflicts are mapped yet.
