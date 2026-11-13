# Template setup

The procedure for turning a fresh copy of this template into a project. It is written so a coding agent can execute it, and reads as a checklist for anyone working by hand.

Work the steps in order. Each one states the result that ends it.

Setup lands as one pull request, and the person's request to set up the project is its work item, so it needs no issue. Commit steps 2 to 6, 9 and 10 on a branch. Steps 7 and 8 change GitHub settings rather than files: apply them once approved, before opening the pull request, so setup merges through the protected path it creates. In the pull request, replace the `Closes #` line with `Setup per docs/template-setup.md`. The change alters what users see, so [the delivery guide](agents/delivery.md) gives it a flow walk and tier 1 review.

## 1. Collect the answers

Ask all nine questions in one message, then wait for the reply. Every later step depends on the answers, and one batch costs the person a single response. You may suggest an answer drawn from what the person has already said; only their reply settles it.

1. **Project name** as it should appear in the interface, and the package name for `package.json`.
2. **One sentence** describing the product. It becomes the meta description and the manifest description.
3. **Production origin**, such as `https://app.example.com`. "Not decided yet" is a valid answer that keeps `https://example.com` until it is.
4. **Host**: Vercel, Cloudflare Workers, or undecided.
5. **The example pages**: keep `/setup` and `/runtime` as working references, or remove them. `/api/health` remains as browser-test readiness infrastructure.
6. **Brand assets**: paths to a logo, favicon source, and social image, or keep the placeholders for now.
7. **Repository protection**: apply the baseline GitHub ruleset after the repository exists, and should merges also require a successful deployment? For Vercel, the standard answer is the `Preview` environment after the first preview succeeds. For another host, provide its exact GitHub deployment environment or defer the deployment gate.
8. **Issue labels**: create the issue labels in the GitHub repository? Agents and the public `mattpocock/skills` pack read an issue's state from them.
9. **Rules every change must keep**, such as "every amount is in integer cents", or none yet. They become the Cross-cutting invariants in step 9.

Ends when every question has an answer or an explicit deferral.

## 2. Record the template origin

A copy made with GitHub's **Use this template** starts an unrelated history, so nothing in it says which template revision it came from. Record that revision now, so the project can later review what changed upstream and tell its deliberate differences from drift.

Do this before committing any setup change. Fetching upstream only reads it. The revision is the upstream `main` commit whose files match this copy's latest commit exactly:

```bash
upstream=https://github.com/neely-labs/tanstack-start-template
copy=HEAD
git fetch --quiet "$upstream" main
git log --format='%T %H %cs' FETCH_HEAD | awk -v tree="$(git rev-parse "$copy^{tree}")" '$1 == tree { print $2, $3; exit }'
```

It prints the revision and its commit date. If it prints nothing, the copy already has commits of its own or did not come from upstream `main`. For a copy made with **Use this template**, change the `copy=` line to `copy=$(git rev-list --max-parents=0 HEAD)`, its first commit, and run the block again. Otherwise ask the person which revision they copied; never record a guess.

Write `docs/template-origin.md` from this outline, filling the angle brackets. Under **Intentional departures**, list the differences the step 1 answers already settle, such as removed example pages or a host other than Vercel, and leave out the renaming, branding, and guidance rewrites every project makes. An undecided host is not a departure, because upstream sets no preset either. Product decisions belong in `PRODUCT.md`, not here.

````markdown
# Template origin

This project started as a copy of the TanStack Start Template.

- Upstream: https://github.com/neely-labs/tanstack-start-template
- Revision: `<revision>`, committed <commit date>
- Adopted: <today's date>

## Intentional departures

- <One line per deliberate difference from upstream, such as "Removed the /setup and /runtime example pages.">

## Pull later improvements

```bash
upstream=$(sed -n 's/^- Upstream: //p' docs/template-origin.md)
rev=$(sed -n 's/^- Revision: `\([0-9a-f]*\)`.*/\1/p' docs/template-origin.md)
git fetch --quiet "$upstream" main
git log --oneline "$rev"..FETCH_HEAD
git diff --stat "$rev" FETCH_HEAD
```

The log lists upstream commits since the recorded revision, and the stat lists the files they changed; `git diff "$rev" FETCH_HEAD -- <path>` shows one file's change. Port by hand what applies, skipping what a departure above rules out. Then set the revision to the commit you reviewed through, which `git log -1 --format='%H %cs' FETCH_HEAD` prints with its date, and add any new departure.
````

Ends when `docs/template-origin.md` names a revision that the command above printed, or one the person confirmed.

## 3. Apply the identity

`src/lib/site-config.ts` is the single seam for public identity. `src/lib/seo.ts` derives every page title, canonical URL, and JSON-LD graph from it, and `src/lib/site-files.ts` generates `robots.txt` and `manifest.json` from it at build time. Editing that one file renames the project everywhere.

| File | Values |
| --- | --- |
| `src/lib/site-config.ts` | `name`, `shortName`, `description`, `origin`, `themeColor`, `categories`, `socialImage.alt` |
| `package.json` | `name` |

`socialImage.alt` describes the image actually served. While the placeholder social card stays, keep its alt text, and change both together in step 5.

Ends when `pnpm build` writes the new name and origin into `.output/public/robots.txt`, `.output/public/manifest.json`, and the rendered `<title>` of every page.

## 4. Choose the surface

Keeping the examples is the safe default while the product is still being shaped; they demonstrate the SEO helpers, the server-function seams, and the recovery states against real routes.

To remove both example pages, delete their routes, supporting modules, and example-only browser tests together:

- `/setup`: `src/routes/setup.tsx`
- `/runtime`: `src/routes/runtime.tsx`, `src/lib/server-runtime.ts`, `src/lib/text-stats.ts`, `src/lib/text-stats.test.ts`
- Example journeys: `tests/e2e/examples.spec.ts`

Drop `/setup` and `/runtime` from `routeVisibility` in `src/lib/public-routes.ts` and from `navigation` in `src/lib/site-config.ts`. Replace the home page's links to those routes with the product's destinations, including the setup badge and runtime call to action. When the product's first feature comes after setup, the home page holds only the name and description until that feature lands; it claims nothing that is not built yet. Once the home page no longer uses it, delete `src/components/copy-command.tsx` and its test too. Search for remaining inbound links with `rg '/setup|/runtime' src --glob '!routeTree.gen.ts'`. If retaining one example page, retain and adapt the journeys that exercise it instead of deleting their coverage indiscriminately.

Keep `/api/health`, `tests/e2e/smoke.spec.ts`, `src/start.ts`, and `src/server.ts`: they provide readiness, reusable browser coverage, security headers, CSRF protection, and the server entry.

With route sources, inventory, and links reconciled, run `pnpm build` to regenerate `src/routeTree.gen.ts` before `pnpm validate`. A running development server for this checkout also regenerates routes. The generator owns that file; editing it by hand only hides a stale-tree failure until the next generation.

Ends when the generated tree reflects the remaining routes, `pnpm validate` passes, and `pnpm test:e2e` passes against that build with Chromium installed. The reusable smoke suite must still run after both examples are removed.

## 5. Replace the brand assets

Replace `public/tanstack.svg` (header logo and SVG favicon), `public/favicon.ico`, and `public/social-card.png`. The social card is verified at 1200x630 PNG, so keep those dimensions or update `socialImage` in `src/lib/site-config.ts` to match the new asset.

Replacing the logo also retires the TanStack trademark entry at the end of `THIRD_PARTY_NOTICES.md`.

If the person keeps the placeholders, change none of these files or their notices, and keep the deferral visible in step 11.

Ends when `pnpm build && pnpm seo:verify` passes, which checks the rendered social image rather than the source file.

## 6. Set the host preset

For Vercel, make no code change. During import, set Vercel's **Framework Preset** to **TanStack Start** and keep its generated build and output settings. The `nitro()` plugin in `vite.config.ts` produces the Vercel server output.

For Cloudflare Workers, set the preset on the Nitro plugin in `vite.config.ts`, following [the deployment guide](deployment.md#cloudflare-workers).

For an undecided host, make no code change. The deployment gate in step 7 stays deferred until a host is chosen.

Ends when `pnpm build` succeeds under the chosen preset, or with no preset for an undecided host.

## 7. Apply repository protection

Repository rulesets are GitHub settings, so they do not travel through the template flow. Applying one changes external repository state and requires an explicit yes from the person setting up the project. If the answer is no or deferred, leave the JSON files in `.github/rulesets` as documented options and continue.

### Baseline branch ruleset

After the new repository has a GitHub remote, confirm that the authenticated account has repository administration permission, then run:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  "repos/$repo/rulesets" \
  --input .github/rulesets/default-branch.json
gh ruleset check --default --repo "$repo"
```

The baseline protects the default branch from deletion and force pushes, requires pull requests with resolved review conversations, allows squash and rebase merges, and requires the `validate` check emitted by `.github/workflows/ci.yml` without requiring branches to be up to date first ([why](../.github/rulesets/README.md#up-to-date-branches-are-not-required)). It starts with zero required approvals so a solo maintainer is not locked out; the project can add approval and code-owner requirements when a review team exists. Repository admins can bypass it for [break-glass recovery](../.github/rulesets/README.md); an ordinary merge never uses that bypass.

If `gh auth status`, `gh repo view`, or the API call fails, report the exact failure and stop this step. Do not retry by changing permissions or modifying the repository through another account.

### Optional deployment gate

Do not add a deployment rule until the provider has created a successful deployment for a pull request. A required deployment with no matching environment blocks every merge.

For Vercel, inspect the deployments after the first preview has completed:

```bash
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api "repos/$repo/deployments?per_page=20" --jq '.[].environment' | sort -u
```

If the output includes exactly `Preview`, apply the optional ruleset:

```bash
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  "repos/$repo/rulesets" \
  --input .github/rulesets/vercel-preview.json
```

If Vercel reports a project-suffixed or custom environment, copy the JSON to a temporary file, change `required_deployment_environments` to that exact name, and import the copy. Keep the tracked file as the standard single-project example. Vercel's preview deployment may also be absent when a project is not connected to the repository yet, which is a reason to defer this gate rather than guess.

Cloudflare Workers and other hosts have no template-wide environment name. Do not apply the Vercel file for them. Add a separate required-deployment rule only when the chosen integration emits a stable GitHub deployment environment, using the same import command with that exact value. Otherwise the baseline `validate` check is the complete default.

Ends when the selected ruleset is visible in `gh ruleset check --default` and, when selected, the deployment rule names an environment that exists in the repository's deployment history.

## 8. Create the issue labels

Labels are GitHub settings and do not travel with a template either. Creating them changes external repository state, so it needs the same explicit yes as step 7. If the answer is no or deferred, skip this step and keep the deferral visible to the owner. Until the labels exist, agents following [the issue tracker guide](agents/issue-tracker.md) find no `ready-for-agent` issues and work only on issues the person names.

Run the commands under [Create the labels](agents/triage-labels.md#create-the-labels) from the repository root. If a command fails, report the exact failure and stop this step.

Ends when `gh label list` shows the six state labels and two category labels. GitHub's default labels can stay beside them.

## 9. Rewrite the guidance documents

`PRODUCT.md`, `DESIGN.md`, and `AGENTS.md` describe the template. Rewrite them to describe the product, using the answers from step 1. Describe what exists now, and mark behavior that is not built yet as planned, so no doc sends an agent looking for code that is not there.

Fill **Cross-cutting invariants** in `PRODUCT.md` with the rules the person gave in answer 9, one line each, linking the doc or module that enforces it. When that code does not exist yet, link the issue that will build it instead, and replace the link when it lands. Agents read this section on every task, together with Product Purpose, so keep it short; an empty section is better than a guessed rule.

Keep `AGENTS.md` an index under 4 KB: its always-read pointers, the table of conditional links including `docs/agents/`, and the Quality list. State each new rule once, in the doc that owns it, and link it from the index rather than copying it. Add a row that sends agents pulling template improvements to `docs/template-origin.md`. Record any conflict between a shared skill and repository policy under **Skills in this repo**.

`pnpm docs:budget`, part of `pnpm validate`, caps the docs agents read on every task: each file and their total. When the rewrite moves the always-read set or needs different limits, edit `BUDGET` at the top of `scripts/verify-doc-budget.ts`.

Keep `README.md` as the project's short entry point. Retain `docs/development.md` for local work, `docs/architecture.md` for runtime boundaries, the relevant host instructions in `docs/deployment.md`, and `docs/recipes/` for safeguards the product has not needed yet. Update their task maps, examples, and links for the new product, removing references to any example files or tests deleted in step 4. `docs/architecture.md` and `docs/development.md` use the example pages as worked examples; keep each rule and drop or replace its example. Preserve route generation, checks, concurrent ports, debugging, and recovery guidance.

Ends when product guidance describes the new application and a fresh agent can still discover how to run, change, verify, and recover it.

## 10. Remove the template-only files

`docs/template-publishing.md` and this file describe publishing and adopting the template. Delete both once the project has its own history. Keep `docs/template-origin.md`: it is the project's record of the template, not part of it. Keep `.github/rulesets` if the project wants its repository policy to remain reviewable and repeatable.

Then search the whole repository, hidden directories included, for text that still describes the template or links a deleted file:

```bash
rg -n -i --hidden -g '!.git' 'this template|the template|template-(setup|publishing)'
```

Keep only deliberate mentions, such as the template origin, the footer credit, license notices, and placeholders the person chose to keep.

Ends when `docs/` holds only documents about the product and its template origin, and the search finds no stale mention.

## 11. Verify

```bash
pnpm validate
pnpm exec playwright install chromium
pnpm test:e2e
pnpm dev:local
```

Open the `appUrl` that `pnpm local:status --json` prints and confirm the header, the page titles, and the footer show the new identity. `pnpm dev:local` serves this checkout on its own port, so another project already on port 3000 does not get in the way; [concurrent checkouts](concurrent-checkouts.md) covers the other per-checkout commands. Commit, then stop it with `pnpm local:retire`, which refuses while files are uncommitted. A failed browser run retains screenshots and traces under `test-results/`; [the development guide](development.md#investigate-a-failure) explains local inspection and CI artifacts.

For a repository created through GitHub's **Use this template** flow, open the repository's **Actions** tab. If GitHub says workflows are not being run, click **Enable Actions on this repository**. Run CI manually against the working branch or push another commit so GitHub receives a new event after Actions is enabled. GitHub Code Security and CodeQL are not required or enabled by this template.

Confirm `docs/template-origin.md` lists each departure setup made, such as removed example pages or a host preset. If issue labels were selected, confirm `gh label list` shows the labels from step 8. If repository protection was selected, run `gh ruleset check --default` and confirm the active ruleset requires `validate`. If a deployment gate was selected, confirm its environment name matches the provider's deployment history.

Ends when `pnpm validate` and the applicable production browser suite pass, the running application shows the agreed identity and no unapproved placeholder text, and GitHub lists the CI workflow. The footer's "Built from" credit is an attribution, not placeholder text. Keep it, or drop it from `src/components/site-footer.tsx` together with `templateUrl` in `src/lib/site-config.ts`. Keep explicitly deferred assets or origin visible to the owner. If protection was deferred, leave that deferral visible rather than claiming it was configured.
