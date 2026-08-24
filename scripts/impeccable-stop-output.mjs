/**
 * Adapts Impeccable's Claude-style Stop envelope to Codex's Stop contract.
 * Unknown output is preserved so the hook runtime can report it as invalid.
 *
 * @param {string} stdout Raw Impeccable hook stdout.
 * @returns {string} Codex-compatible Stop hook stdout.
 */
export function adaptImpeccableStopOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return "";
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return trimmed;
  }

  if (!isRecord(parsed)) {
    return trimmed;
  }
  const { hookSpecificOutput } = parsed;
  if (!isRecord(hookSpecificOutput)) {
    return trimmed;
  }
  const context = hookSpecificOutput.additionalContext;
  if (typeof context !== "string" || !context.trim()) {
    return trimmed;
  }

  return JSON.stringify({ decision: "block", reason: context });
}

/**
 * @param {unknown} value Candidate object.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}
