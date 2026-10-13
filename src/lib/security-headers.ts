/**
 * Shared by Start requests and Nitro-served prerendered/static responses.
 * A useful Content-Security-Policy depends on each application's scripts,
 * styles, and third-party origins, so the template deliberately omits one.
 */
export const securityHeaders = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;
