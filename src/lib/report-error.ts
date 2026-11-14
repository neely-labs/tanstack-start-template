/**
 * The one place the app reports an error it caught and recovered from. Connect
 * an error-reporting service here; the route error page calls it each time it
 * shows an error, with the thrown value and the path it was caught on.
 *
 * The call runs in the browser, including after a server-rendered failure
 * hydrates. A production server prints a stack for a render error but nothing
 * for a failed loader, so this report is the only record of that failure.
 */
export interface CaughtError {
  /** The thrown value, which need not be an `Error`. */
  error: unknown;
  /** The path the visitor was on, without query or hash. */
  path: string;
}

export function reportCaughtError({ error, path }: CaughtError) {
  console.error(`Caught by the route error page at ${path}`, error);
}
