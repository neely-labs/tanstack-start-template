import { z } from "zod";

/** Upper bound applied before the server does any work on submitted text. */
export const maxTextLength = 2000;

const wordsPerMinute = 220;

/** What the analyzer tells a person whose input it rejects. Tests read it here. */
export const textInputErrors = {
  blank: "Enter some text to analyze.",
  tooLong: `Enter at most ${maxTextLength} characters.`,
} as const;

export interface TextStats {
  characters: number;
  readingMinutes: number;
  words: number;
}

export function summarizeText(text: string): TextStats {
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/u).length;

  return {
    characters: trimmed.length,
    readingMinutes:
      words === 0 ? 0 : Math.max(1, Math.round(words / wordsPerMinute)),
    words,
  };
}

/**
 * The validator for the `analyzeText` server function, and the template's one
 * way to parse untrusted input.
 *
 * TanStack Start runs it before the handler, so the handler sees only text that
 * passed. Zod is the default; another Standard Schema library can replace it
 * here without touching the handler.
 */
export const textInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, textInputErrors.blank)
    .max(maxTextLength, textInputErrors.tooLong),
});

export type TextInput = z.input<typeof textInputSchema>;

/** What the analyzer shows for a failure that is not a rejected input. */
export const analyzerFailure = "The request could not be completed.";

const rejectionMessages = new Set<string>(Object.values(textInputErrors));

const schemaIssues = z.array(z.object({ message: z.string() }));

/**
 * The `textInputErrors` message behind a failed analysis, or `undefined` when
 * the failure is anything else.
 *
 * Start sends a schema failure to the client as an `Error` whose message is the
 * JSON list of the schema's issues. Only messages from `textInputErrors` come
 * back, so other server text, such as a driver error, never reaches the page.
 */
export function inputRejection(error: Error): string | undefined {
  let issues: unknown;
  try {
    issues = JSON.parse(error.message);
  } catch {
    return undefined;
  }
  const parsed = schemaIssues.safeParse(issues);
  return parsed.success
    ? parsed.data
        .map((issue) => issue.message)
        .find((message) => rejectionMessages.has(message))
    : undefined;
}
