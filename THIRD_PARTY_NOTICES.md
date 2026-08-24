# Third-party source

The repository's MIT license applies to the original TanStack Start Template code. The source listed below remains under its upstream license.

- [`dmmulroy/anti-slop`](https://github.com/dmmulroy/anti-slop) supplies the vendored Oxlint plug-in source under `tools/oxlint/anti-slop`. It is distributed under the MIT license in `third_party/licenses/anti-slop-LICENSE`. The repository's installer skill is intentionally not included.

- [`pbakaus/impeccable`](https://github.com/pbakaus/impeccable) supplies the Impeccable skill under `.agents/skills/impeccable`, `.claude/skills/impeccable`, and `.cursor/skills/impeccable`, plus the companion Cursor agents under `.cursor/agents`. It is distributed under Apache License 2.0 in `third_party/licenses/impeccable-LICENSE`; its required attribution is preserved in `third_party/licenses/impeccable-NOTICE.md`. Keep the provider-native copies synchronized when upgrading it.

- [`qq15725/modern-screenshot`](https://github.com/qq15725/modern-screenshot) supplies the UMD browser capture bundle included within each Impeccable skill installation at `scripts/modern-screenshot.umd.js`. It is distributed under the MIT license in `third_party/licenses/modern-screenshot-LICENSE`.
