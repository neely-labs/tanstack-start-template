# Agent-friendly template assessment and verification

Assessment and implementation date: 2026-10-26. This is a template-specific decision and verification record. Current operating instructions live in [the README](../README.md#development-workflow) and [AGENTS.md](../AGENTS.md). Remove this report during project adoption.

The original assessment used revision `4395da7`. Implementation was rebased onto `8f000cd`, which replaced `/about` with `/setup` and added the current theme and starter interface. Those changes were preserved. All six recommendations are implemented; local proof is recorded below, with CI artifact qualification recorded separately.

## Recommendations implemented

- [x] **1. Complete adoption, including identity and example removal.** [SEO helper tests](../src/lib/seo.test.ts) assert configured identity while keeping independent title-format and canonical-path expectations. [Social-image checks](../src/lib/site-config.test.ts) permit a replacement PNG's positive integer dimensions and path rather than requiring the template's asset name and size. [Reusable smoke tests](../tests/e2e/smoke.spec.ts) remain when [example journeys](../tests/e2e/examples.spec.ts) are removed with `/setup` and `/runtime`. `/api/health` is retained infrastructure. [The adoption guide](template-setup.md#3-choose-the-surface) reconciles links, inventory, generated types, and tests, and ends with both validation gates.
- [x] **2. Preserve a small operating guide.** [AGENTS.md](../AGENTS.md) points to intent, interface constraints, and the durable [development workflow](../README.md#development-workflow). It preserves generated-file ownership, process ownership, and integration/recovery expectations through adoption. The README task map identifies the first relevant files and observable checks. Stale instructions to edit generated public identity files and stale package-manager descriptions were corrected. Empty learned sections were removed.
- [x] **3. Make concurrent instances explicit.** [Playwright configuration](../playwright.config.ts) derives its loopback URL, Nitro port, and readiness probe from `E2E_PORT`, rejects invalid ports, and keeps exclusive server ownership. `pnpm dev` binds strictly; the README documents the existing Vite CLI for other ports. Two independently installed copies served different identities concurrently, and their browser suites ran on separate ports.
- [x] **4. Document route generation before validation.** [The workflow](../README.md#find-the-smallest-change) and adoption guide explain Vite's ownership of `src/routeTree.gen.ts`. A stopped checkout runs `pnpm build` before validation after adding/removing routes. No generator wrapper, additional CLI dependency, or manual generated-tree editing was introduced. A disposable route was rejected when unclassified, then validated and served after classification, and successfully removed using the same sequence.
- [x] **5. Preserve browser failure evidence.** [CI](../.github/workflows/ci.yml) uploads existing `test-results/` output when the browser step fails, using an immutable official action revision and seven-day retention. The README explains local trace viewing. [PR guidance](../.github/pull_request_template.md) asks for the actual route/action, check results, useful evidence, and remaining uncertainty. Qualification of a real CI upload is a delivery check below.
- [x] **6. Exercise independent keyboard and recovery behavior.** Browser tests cover keyboard skip/navigation/404 recovery, theme changes across reload, form rejection and correction, and a failed loader followed by retry against the real server. The skip test first reproduced missing focus; main-content targets now use `tabIndex={-1}`. Fault injection stays inside the test browser, with no production fault endpoint. Existing input-boundary, CSRF, and explicit header checks remain.

These changes keep the current module seams: calculation/parser, server adapter, page, identity, SEO, route inventory, and shared security headers. Authentication, persistence, analytics, and application-specific state remain product choices. When a product adds an integration, its fixtures, credentials, reset/cleanup procedure, and failure/recovery checks belong with that feature. Larger documentation or boundary-enforcement machinery should follow a concrete need.

## Observed proof

All checks below were observed locally with Node.js 24.18.0 and pnpm 12.15.0. Timings from the initial assessment were single runs, not performance benchmarks.

| Rehearsal | Observed result |
| --- | --- |
| Original identity change | Changing the name and origin caused 4 of 5 SEO helper tests to fail against literal template expectations |
| Original example removal | Core validation could pass while the browser journey still required the removed example link; a stale route tree also caused an unrelated-looking type error before regeneration |
| Rebased implementation: `pnpm validate` | Passed lint/format, TypeScript, 26 unit tests in 8 files, build, three prerendered public pages, and rendered SEO |
| Rebased implementation: `E2E_PORT=4341 pnpm test:e2e` | All 12 desktop/mobile checks passed |
| Keyboard regression before the focus fix | The new skip-link test failed because the main element remained inactive; loader retry already passed |
| Direct production browser inspection after the fix | Tab then Enter focused `MAIN#main-content`; the rendered state was inspected in the task's named browser session |
| Independently installed renamed copy, examples kept | Core validation passed and all 12 desktop/mobile browser checks passed, with generated identity files and canonical URLs using the new origin |
| Independently installed renamed copy, both examples removed | Route regeneration and core validation passed; all six retained desktop/mobile smoke checks passed with only the home page in the public inventory |
| Concurrent development instances | Ports 4411 and 4412 returned distinct page titles and manifest names, both with a responding health endpoint; concurrent browser suites used ports 4441 and 4442 |
| Occupied or invalid port | A second dev process exited with an occupied-port error; Playwright refused an already-owned production listener; invalid `E2E_PORT` failed before starting a server |
| Add a public route from a stopped copy | Vite regenerated the tree; TypeScript rejected missing `/rehearsal` classification. After classification and navigation were added, core validation and served-artifact browser verification passed for four public pages |
| Remove that route from a stopped copy | Removing source, classification, and navigation, then rebuilding and validating, restored the three-page inventory without hand-editing generated output |
| Process cleanup | Only task-owned browser/server sessions were closed; their listeners were verified released |

The initial sandbox could not bind localhost or write the temporary dependency-store operation lock; permitted local execution resolved those environment restrictions. They were not treated as template defects. Production-provider behavior and external repository settings were not changed or newly qualified.

### CI artifact qualification

The local failure reproduction produced a screenshot, error context, and a readable trace. The upload step's real GitHub execution will be checked using a deliberate browser failure on the draft PR, followed by removal of that temporary test and green checks on the final head. This section will record the observed result before delivery is complete.

## Representative evaluation tasks

Use disposable local copies and the same task wording when comparing future revisions. Record human clarifications, incorrect assumptions, files read/changed, time to first useful result and completion, verification time, model/token cost when available, and whether another task was disturbed. Current proof establishes working workflows, not a longitudinal agent-efficiency benchmark; model/token cost was not measured.

| Task | Successful observable result | What to measure |
| --- | --- | --- |
| Rename the template and canonical origin | Generated manifest/robots/sitemap and rendered titles use the new identity; unit and production browser checks pass | Wrong identity seams, stale guidance, interventions |
| Add then remove a public page from a stopped checkout | Vite regeneration, classification, metadata, navigation, and served output stay aligned; missing classification fails | Hidden generation dependencies and verification quality |
| Adopt with optional example pages removed | Shared infrastructure and readiness remain; core validation and reusable browser checks pass | Adoption/test coupling and loss of operating knowledge |
| Change the example server input limit | Parser acceptance/rejection and real RPC results agree; keyboard submission still works | Server/client boundary understanding and independent expectations |
| Run two tasks, trigger a failure, then recover | Each serves its own identity; port conflicts fail clearly; a failure produces inspectable evidence; cleanup leaves the other task running | Isolation, diagnostics, ownership, and recovery |

The first delivery covers adoption and operating guidance, followed by port isolation and failure evidence, plus the focused keyboard/retry coverage requested for this implementation. Keep future scope tied to these observable tasks rather than adding a general agent API or environment manager.
