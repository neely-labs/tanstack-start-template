import { describe, expect, it } from "vitest";

import {
  inputRejection,
  maxTextLength,
  summarizeText,
  textInputErrors,
  textInputSchema,
} from "./text-stats.ts";

/** The error TanStack Start throws when the schema rejects `{ text }`. */
async function schemaFailure(text: string | number) {
  const result = await textInputSchema["~standard"].validate({ text });
  if (result.issues === undefined) {
    throw new Error("Expected the schema to reject the input.");
  }
  return new Error(JSON.stringify(result.issues, undefined, 2));
}

describe(summarizeText, () => {
  it("counts words across collapsed whitespace", () => {
    expect(summarizeText("  one   two\nthree\t four ")).toStrictEqual({
      characters: 21,
      readingMinutes: 1,
      words: 4,
    });
  });

  it("reports zero reading time for empty text", () => {
    expect(summarizeText("   ")).toStrictEqual({
      characters: 0,
      readingMinutes: 0,
      words: 0,
    });
  });
});

describe("the text input schema", () => {
  it("trims accepted input", () => {
    expect(textInputSchema.parse({ text: "  hello  " })).toStrictEqual({
      text: "hello",
    });
  });

  // Each case is the JSON a caller could send in place of `{ "text": "..." }`.
  it.each([
    { json: "null", label: "null" },
    { json: "5", label: "a primitive" },
    { json: "[]", label: "an array" },
    { json: "{}", label: "an object without text" },
    { json: '{ "text": 5 }', label: "a non-string text" },
  ])("rejects $label as a validation error", ({ json }) => {
    const result = textInputSchema.safeParse(JSON.parse(json));

    expect(result.success).toBeFalsy();
    expect(result.error?.issues[0]?.code).toBe("invalid_type");
  });

  it("rejects blank input", () => {
    const issues = textInputSchema.safeParse({ text: "   " }).error?.issues;

    expect(issues?.map((issue) => issue.message)).toStrictEqual([
      textInputErrors.blank,
    ]);
  });

  it("accepts text at the length bound and rejects one character more", () => {
    const atBound = "a".repeat(maxTextLength);

    expect(textInputSchema.parse({ text: atBound })).toStrictEqual({
      text: atBound,
    });
    const issues = textInputSchema.safeParse({ text: `${atBound}a` }).error
      ?.issues;
    expect(issues?.map((issue) => issue.message)).toStrictEqual([
      textInputErrors.tooLong,
    ]);
  });

  it("checks the length after trimming", () => {
    const padded = ` ${"a".repeat(maxTextLength)} `;

    expect(textInputSchema.safeParse({ text: padded }).success).toBeTruthy();
  });

  it("states the length bound it enforces", () => {
    // The message promises a limit, so its wording is a commitment worth checking.
    expect(textInputErrors.tooLong).toContain(`${maxTextLength} characters`);
  });
});

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
