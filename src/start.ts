import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Response headers that are safe for any application built from this template.
 *
 * A Content-Security-Policy is deliberately absent: a useful one depends on the
 * scripts, styles, and third-party origins the adopting application chooses.
 */
const securityHeaders = [
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
] as const;

/**
 * Request middleware runs for every request the server handles: document
 * requests, server routes, and server functions alike.
 */
const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();

    for (const [header, value] of securityHeaders) {
      result.response.headers.set(header, value);
    }

    return result;
  }
);

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware],
}));
