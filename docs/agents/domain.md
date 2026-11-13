# Domain docs

Use this guide when you need a project term or the reason for a past decision, or when you are about to record one.

## Where they live

- `GLOSSARY.md` at the repository root defines the project's terms: what each one means in this product, and the words it replaces.
- `docs/adr/` holds architecture decision records, one file per decision, numbered in order, such as `0001-postgres-for-orders.md`.
- A repository with several contexts adds `GLOSSARY-MAP.md` at the root, linking each context's own glossary and decisions.

The template ships none of these. Each is created when the project first has something to write in it, so its absence is not an error, and an agent that finds none continues without it.

## Use them

- Before naming a module, route, field, or issue after a domain concept, read its glossary entry and use that term.
- When a reader would ask why the code works this way, look for an ADR before changing it.
- Add a term when one is settled. Keep implementation detail out of the glossary.
- Add an ADR only for a decision that is hard to reverse, would surprise a reader without context, and was chosen over a real alternative.
- To change a recorded decision, write a new ADR that supersedes the old one, and leave the old one in place.
