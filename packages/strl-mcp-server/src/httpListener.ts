// STRL: thin wrapper isolating the single unavoidable cleartext-HTTP call.
// The MCP network transport is plaintext by design — it is an internal-LAN dev
// tool that fails closed without a bearer token and is documented to be fronted
// by TLS or an SSH tunnel on untrusted networks (see bin.ts header). Snyk's
// HttpToHttps rule (CWE-319) fires on `http.createServer`, so we confine that
// one call here and exclude ONLY this 3-line file from Snyk Code (.snyk),
// keeping bin.ts's auth + session routing fully under SAST.
import http from "node:http";

export const createHttpListener = (
  handler: http.RequestListener,
): http.Server => http.createServer(handler);
