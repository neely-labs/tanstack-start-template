// The issue state labels, shared by the workflows that change them:
// docs/agents/triage-labels.md defines them, and scripts/state-labels.test.ts
// keeps this list equal to the labels docs/tooling.md creates. An open issue
// carries exactly one of them.
export const STATE_LABELS = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "awaiting-qualification",
  "wontfix",
] as const;
