# Template setup

The procedure for turning a fresh copy of this template into a project. It is written so a coding agent can execute it, and reads as a checklist for anyone working by hand.

Work the steps in order. Each one states the result that ends it.

## 1. Collect the answers

Ask all seven questions in one message, then wait for the reply. Every later step depends on the answers, and one batch costs the person a single response.

1. **Project name** as it should appear in the interface, and the package name for `package.json`.
2. **One sentence** describing the product. It becomes the meta description and the manifest description.
3. **Production origin**, such as `https://app.example.com`. "Not decided yet" is a valid answer that keeps `https://example.com` until it is.
4. **Host**: Vercel, Cloudflare Workers, or undecided.
5. **The example surface**: keep `/about`, `/runtime`, and `/api/health` as working references, or remove them.
6. **Brand assets**: paths to a logo, favicon source, and social image, or keep the placeholders for now.
7. **Repository protection**: apply the baseline GitHub ruleset after the repository exists, and should merges also require a successful deployment? For Vercel, the standard answer is the `Preview` environment after the first preview succeeds. For another host, provide its exact GitHub deployment environment or defer the deployment gate.

Ends when every question has an answer or an explicit deferral.

## 2. Apply the identity

`src/lib/site-config.ts` is the single seam for public identity. `src/lib/seo.ts` derives every page title, canonical URL, and JSON-LD graph from it, and `src/lib/site-files.ts` generates `robots.txt` and `manifest.json` from it at build time. Editing that one file renames the project everywhere.

| File | Values |
| --- | --- |
| `src/lib/site-config.ts` | `name`, `shortName`, `description`, `origin`, `themeColor`, `socialImage.alt` |
| `package.json` | `name` |

Ends when `pnpm build` writes the new name and origin into `.output/public/robots.txt`, `.output/public/manifest.json`, and the rendered `<title>` of every page.

## 3. Choose the surface

Keeping the examples is the safe default while the product is still being shaped; they demonstrate the SEO helpers, the server-function seams, and the recovery states against real routes.

To remove them, delete the route file and its supporting modules together:

- `/about`: `src/routes/about.tsx`
- `/runtime`: `src/routes/runtime.tsx`, `src/lib/server-runtime.ts`, `src/lib/text-stats.ts`, `src/lib/text-stats.test.ts`
- `/api/health`: `src/routes/api/health.ts`

Then drop the matching entries from `routeVisibility` in `src/lib/public-routes.ts` and from `navigation` in `src/lib/site-config.ts`. Keep `src/start.ts` and `src/server.ts`: they carry the security headers, the CSRF protection for server functions, and the Node response optimization, not the examples.

Ends when `pnpm typecheck` passes, which is the compiler confirming every remaining route is classified.

## 4. Replace the brand assets

Replace `public/tanstack.svg` (header logo and SVG favicon), `public/favicon.ico`, and `public/social-card.png`. The social card is verified at 1200x630 PNG, so keep those dimensions or update `socialImage` in `src/lib/site-config.ts` to match the new asset.

Replacing the logo also retires the TanStack trademark entry at the end of `THIRD_PARTY_NOTICES.md`.

Ends when `pnpm build && pnpm seo:verify` passes, which checks the rendered social image rather than the source file.

## 5. Set the host preset

For Vercel, make no code change. During import, set Vercel's **Framework Preset** to **TanStack Start** and keep its generated build and output settings. The `nitro()` plugin in `vite.config.ts` produces the Vercel server output.

For Cloudflare Workers, set the preset on the Nitro plugin in `vite.config.ts`, as the Hosting section of `README.md` describes.

Ends when `pnpm build` succeeds under the chosen preset.

## 6. Apply repository protection

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

The baseline protects the default branch from deletion and force pushes, requires pull requests with resolved review conversations, allows squash and rebase merges, and requires the `validate` check emitted by `.github/workflows/ci.yml`. It starts with zero required approvals so a solo maintainer is not locked out; the project can add approval and code-owner requirements when a review team exists.

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

## 7. Rewrite the guidance documents

`PRODUCT.md`, `DESIGN.md`, and `AGENTS.md` describe the template. Rewrite them to describe the product, using the answers from step 1.

`AGENTS.md` loads into every agent's context on every turn. Keep it to what the code cannot reveal on its own: decisions, constraints, and the reasons behind them.

Replace `README.md` with the project's own README.

Ends when no guidance document still describes a template rather than the product.

## 8. Remove the template-only files

`docs/template-publishing.md` and this file describe publishing and adopting the template. Delete both once the project has its own history. Keep `.github/rulesets` if the project wants its repository policy to remain reviewable and repeatable.

Ends when `docs/` holds only documents about the product.

## 9. Verify

```bash
pnpm validate
pnpm dev
```

Open `http://localhost:3000` and confirm the header, the page titles, and the footer show the new identity.

For a repository created through GitHub's **Use this template** flow, open the repository's **Actions** tab. If GitHub says workflows are not being run, click **Enable Actions on this repository**. Run CI and CodeQL manually against the working branch or push another commit so GitHub receives a new event after Actions is enabled.

If repository protection was selected, run `gh ruleset check --default` and confirm the active ruleset requires `validate`. If a deployment gate was selected, confirm its environment name matches the provider's deployment history.

Ends when `pnpm validate` passes, the running application shows no placeholder text, and GitHub lists the CI and CodeQL workflows. If protection was deferred, leave that deferral visible to the project owner rather than claiming it was configured.
