import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";

import { parseTextInput, summarizeText } from "./text-stats.ts";
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
 * A POST server function. `.validator` parses the caller's input before the
 * handler runs, and the handler body never reaches the client bundle.
 */
export const analyzeText = createServerFn({ method: "POST" })
  .validator(parseTextInput)
  .handler(({ data }): TextAnalysis => ({
    computedAt: new Date().toISOString(),
    environment: describeEnvironment(),
    stats: summarizeText(data.text),
  }));
