import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";

import { securityHeaders } from "./lib/security-headers.ts";

/**
 * Request middleware runs for every request the server handles: document
 * requests, server routes, and server functions alike.
 */
const securityHeadersMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next();

    for (const [header, value] of Object.entries(securityHeaders)) {
      result.response.headers.set(header, value);
    }

    return result;
  }
);

/**
 * Server functions are same-origin RPC endpoints, so a cross-site request that
 * carries the visitor's cookies has to be rejected before the handler runs.
 *
 * The filter matches the framework's own default, which Start applies only when
 * an application defines no `createStart` instance at all. Defining one here to
 * set security headers opts out of that default, so the template restores it.
 * Server routes stay out of the check on purpose: they are ordinary HTTP
 * endpoints, and a non-browser caller such as an uptime check for
 * `/api/health` sends neither `Sec-Fetch-Site` nor `Origin`, which this
 * middleware rejects by default.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware],
}));
