/** Paths owned by agent runtimes rather than this application. */
export const agentToolingIgnorePatterns = [
  "**/.agents",
  "**/.claude",
  "**/.codex",
  "**/.cursor",
  "**/.impeccable",
];

/** Vendored Oxlint plug-in source, loaded by Oxlint but not authored here. */
export const vendoredToolingIgnorePatterns = ["tools/oxlint/anti-slop/**"];
