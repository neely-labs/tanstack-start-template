import { describe, expect, it } from "vitest";

import { adaptImpeccableStopOutput } from "./impeccable-stop-output.mjs";

describe("adaptImpeccableStopOutput", () => {
  it("turns Impeccable additional context into a Codex continuation", () => {
    const output = adaptImpeccableStopOutput(
      JSON.stringify({
        hookSpecificOutput: {
          additionalContext: "Fix the remaining UI issue.",
          hookEventName: "Stop",
        },
      })
    );

    expect(JSON.parse(output)).toEqual({
      decision: "block",
      reason: "Fix the remaining UI issue.",
    });
  });

  it("keeps clean Stop output silent", () => {
    expect(adaptImpeccableStopOutput("  ")).toBe("");
  });

  it("preserves already-compatible Codex output", () => {
    const output = '{"decision":"block","reason":"Keep working."}';
    expect(adaptImpeccableStopOutput(output)).toBe(output);
  });
});
