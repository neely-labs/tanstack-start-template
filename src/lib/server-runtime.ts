import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  summarizeText,
  textInputErrors,
  textInputSchema,
} from "./text-stats.ts";
import type { TextStats } from "./text-stats.ts";

export interface RenderSnapshot {
  environment: string;
  renderedAt: string;
}

export interface TextAnalysis {
  computedAt: string;
  environment: string;
  stats: TextStats;
}

/**
 * One call site, one implementation per environment. The unused branch is
 * removed from the bundle it does not belong in, so `process` never reaches the
 * client and `navigator` never reaches the server.
 */
export const describeEnvironment = createIsomorphicFn()
  .server(() => `server · Node ${process.version}`)
  .client(() => `client · ${navigator.userAgent}`);

/**
 * A GET server function. `/runtime` is prerendered, so this runs at build time
 * to produce the shipped HTML, and again on the server whenever the router
 * revalidates the loader.
 */
export const getRenderSnapshot = createServerFn().handler(
  (): RenderSnapshot => ({
    environment: describeEnvironment(),
    renderedAt: new Date().toISOString(),
  })
);

/**
 * A POST server function. `.validator` parses the caller's input with the Zod
 * schema before the handler runs, and the handler body never reaches the
 * client bundle.
 */
export const analyzeText = createServerFn({ method: "POST" })
  .validator(textInputSchema)
  .handler(({ data }): TextAnalysis => ({
    computedAt: new Date().toISOString(),
    environment: describeEnvironment(),
    stats: summarizeText(data.text),
  }));

const rejectionMessages = new Set<string>(Object.values(textInputErrors));

const issueListSchema = z.array(z.object({ message: z.string() }));

/**
 * The `textInputErrors` message behind a failed `analyzeText` call, or
 * `undefined` when the failure is anything else.
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
  const parsed = issueListSchema.safeParse(issues);
  return parsed.success
    ? parsed.data
        .map((issue) => issue.message)
        .find((message) => rejectionMessages.has(message))
    : undefined;
}
