// The issue state labels docs/agents/triage-labels.md defines, shared by the
// workflows that change them. scripts/apply-qualification.test.ts keeps the list
// equal to the labels docs/tooling.md creates.

/** The labels of which an open issue carries exactly one: docs/agents/triage-labels.md. */
export const STATE_LABELS = [
  "needs-triage",
  "needs-info",
  "ready-for-agent",
  "ready-for-human",
  "awaiting-qualification",
  "wontfix",
] as const;
