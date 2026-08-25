import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { FastResponse } from "srvx";

/**
 * srvx resolves `FastResponse` per runtime. On Node it is a Response with a
 * faster path to the underlying Node response, worth roughly 5% throughput. On
 * workerd and other runtimes srvx exports the platform `Response`, so this
 * assignment is a no-op and the optimization stays specific to Node hosts
 * without forking the entry point per preset.
 */
globalThis.Response = FastResponse;

export default createServerEntry({
  fetch(request: Request): Promise<Response> | Response {
    return handler.fetch(request);
  },
});
