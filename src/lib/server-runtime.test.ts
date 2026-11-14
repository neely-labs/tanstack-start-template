import { describe, expect, it } from "vitest";

import { inputRejection } from "./server-runtime.ts";
import { textInputErrors, textInputSchema } from "./text-stats.ts";

/** The error TanStack Start throws when the schema rejects `{ text }`. */
async function schemaFailure(text: string | number) {
  const result = await textInputSchema["~standard"].validate({ text });
  if (result.issues === undefined) {
    throw new Error("Expected the schema to reject the input.");
  }
  return new Error(JSON.stringify(result.issues, undefined, 2));
}

describe(inputRejection, () => {
  it("returns the textInputErrors message from a schema failure", async () => {
    const blank = await schemaFailure(" ");

    expect(inputRejection(blank)).toBe(textInputErrors.blank);
  });

  it("returns nothing for a schema failure with no textInputErrors message", async () => {
    const malformed = await schemaFailure(5);

    expect(inputRejection(malformed)).toBeUndefined();
  });

  it.each([
    { label: "server text", message: "connection to db at 10.0.0.5 failed" },
    { label: "JSON that is not a list of issues", message: '{"message":"x"}' },
    {
      label: "an issue list naming other text",
      message: JSON.stringify([{ message: "Database unavailable" }]),
    },
  ])("returns nothing for $label", ({ message }) => {
    expect(inputRejection(new Error(message))).toBeUndefined();
  });
});
