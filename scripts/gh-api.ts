// The one way the issue workflows' scripts call GitHub: `gh api`, which their
// tests replace with a fake on PATH. Uses no dependencies, so a workflow runs it
// on plain Node without an install.
import { execFileSync } from "node:child_process";

export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly status: number | undefined;

  constructor(message: string, status: number | undefined) {
    super(message);
    this.status = status;
  }
}

/** Runs `gh api` and returns its output; a failed request throws an ApiError with its HTTP status. */
export function api(
  endpoint: string,
  options: {
    method?: string;
    /** Sent as the JSON request body. */
    input?: object;
    paginate?: boolean;
  } = {}
) {
  const args = ["api", endpoint];

  if (options.method !== undefined) {
    args.push("--method", options.method);
  }

  if (options.input !== undefined) {
    args.push("--input", "-");
  }

  if (options.paginate === true) {
    args.push("--paginate", "--slurp");
  }

  try {
    return execFileSync("gh", args, {
      encoding: "utf-8",
      input: options.input === undefined ? "" : JSON.stringify(options.input),
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String(error.stderr).trim()
        : String(error);

    const status = /\(HTTP (?<code>\d{3})\)/u.exec(stderr)?.groups?.code;
    throw new ApiError(
      `${options.method ?? "GET"} ${endpoint} failed: ${stderr}`,
      status === undefined ? undefined : Number(status)
    );
  }
}
