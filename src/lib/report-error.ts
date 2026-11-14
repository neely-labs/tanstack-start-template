/**
 * The one place the app reports an error it caught and recovered from. Connect
 * an error-reporting service here; every caller passes the thrown value and
 * where it was caught, so a service sees each caught error once.
 *
 * The route error component calls it from the browser, including after a
 * server-rendered failure hydrates. The server prints its own stack for a
 * render error, but not for a failed loader, so this browser report is the only
 * record of that failure.
 */
export interface CaughtError {
  /** The boundary that caught the error. */
  boundary: "route";
  /** The thrown value, which need not be an `Error`. */
  error: unknown;
  /** The path the visitor was on, without query or hash. */
  path: string;
}

export function reportCaughtError({ boundary, error, path }: CaughtError) {
  console.error(`Caught by the ${boundary} boundary at ${path}`, error);
}
