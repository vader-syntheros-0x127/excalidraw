#!/usr/bin/env node
// STRL: entry point for the @strl/mcp-server. Two transports:
//
//   stdio (default) — a local client (Claude Code, etc.) spawns this process
//   and talks over stdin/stdout. Register with:
//     { "command": "node",
//       "args": ["/abs/path/packages/strl-mcp-server/dist/bin.js"],
//       "env": { "STRL_MCP_WORKDIR": "/abs/path/to/sketches",
//                "STRL_MCP_ACTIVE_FILE": "scene.excalidraw" } }
//
//   http (network) — ONE server on this host that remote dev machines connect
//   to as clients over Streamable HTTP. Enable with STRL_MCP_TRANSPORT=http
//   (or by setting STRL_MCP_HTTP_PORT). Hardened for an internal LAN:
//     STRL_MCP_HTTP_HOST   bind interface (default 127.0.0.1; set 0.0.0.0 for LAN)
//     STRL_MCP_HTTP_PORT   listen port (default 7337)
//     STRL_MCP_HTTP_PATH   endpoint path (default /mcp)
//     STRL_MCP_HTTP_TOKEN  bearer token; REQUIRED to bind a non-loopback host
//     STRL_MCP_HTTP_ALLOWED_HOSTS  comma list of Host: values for DNS-rebinding
//                                  protection (e.g. 192.168.12.222:7337,localhost:7337)
//   Transport is plaintext HTTP — token + payloads travel in clear on the LAN.
//   For untrusted networks, front it with TLS (reverse proxy) or an SSH tunnel.
import { randomUUID } from "node:crypto";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createHttpListener } from "./httpListener";
import { createStrlServer } from "./server";

import type http from "node:http";

const startStdio = async (): Promise<void> => {
  const server = createStrlServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the JSON-RPC channel — log readiness to stderr only.
  process.stderr.write("strl-mcp-server ready (stdio)\n");
};

// Read a JSON request body with a hard size cap (image dataURLs can be large,
// but we still bound it so a single request can't exhaust memory).
const BODY_LIMIT = 16 * 1024 * 1024;
const readJsonBody = (req: http.IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const startHttp = async (): Promise<void> => {
  const host = process.env.STRL_MCP_HTTP_HOST ?? "127.0.0.1";
  const port = Number(process.env.STRL_MCP_HTTP_PORT ?? 7337);
  const endpoint = process.env.STRL_MCP_HTTP_PATH ?? "/mcp";
  const token = process.env.STRL_MCP_HTTP_TOKEN ?? "";
  const allowedHosts = (process.env.STRL_MCP_HTTP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const isLoopback =
    host === "127.0.0.1" || host === "::1" || host === "localhost";

  // Fail closed: never expose the engine on a network interface without auth.
  if (!isLoopback && !token) {
    process.stderr.write(
      `strl-mcp-server REFUSING to bind non-loopback host ${host} without STRL_MCP_HTTP_TOKEN — network exposure requires a bearer token.\n`,
    );
    process.exit(1);
  }

  // One Streamable-HTTP transport per MCP session, keyed by the session id the
  // SDK assigns on initialize.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Plaintext HTTP is intentional (see header) — the one createServer call is
  // isolated in ./httpListener so only that 3-line file is excluded from SAST.
  const httpServer = createHttpListener((req, res) => {
    void (async () => {
      try {
        const url = new URL(
          req.url ?? "/",
          `http://${req.headers.host ?? `${host}:${port}`}`,
        );
        if (url.pathname !== endpoint) {
          res.writeHead(404).end("not found");
          return;
        }

        // Bearer auth on every request whenever a token is configured.
        if (token && req.headers.authorization !== `Bearer ${token}`) {
          res
            .writeHead(401, { "WWW-Authenticate": "Bearer" })
            .end("unauthorized");
          return;
        }

        const sessionIdHeader = req.headers["mcp-session-id"];
        const sessionKey = Array.isArray(sessionIdHeader)
          ? sessionIdHeader[0]
          : sessionIdHeader;
        const existing = sessionKey ? transports.get(sessionKey) : undefined;

        if (req.method === "POST") {
          const body = await readJsonBody(req);
          let transport = existing;
          if (!transport) {
            // A new session must begin with an `initialize` request.
            if (!isInitializeRequest(body)) {
              res.writeHead(400, { "content-type": "application/json" }).end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32000,
                    message: "No active session — send initialize first.",
                  },
                  id: null,
                }),
              );
              return;
            }
            const created: StreamableHTTPServerTransport =
              new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                enableDnsRebindingProtection: allowedHosts.length > 0,
                allowedHosts:
                  allowedHosts.length > 0 ? allowedHosts : undefined,
                onsessioninitialized: (sid) => {
                  transports.set(sid, created);
                },
                onsessionclosed: (sid) => {
                  transports.delete(sid);
                },
              });
            created.onclose = () => {
              if (created.sessionId) {
                transports.delete(created.sessionId);
              }
            };
            const server = createStrlServer();
            await server.connect(created);
            transport = created;
          }
          await transport.handleRequest(req, res, body);
          return;
        }

        // GET opens the server->client SSE stream; DELETE terminates a session.
        if (req.method === "GET" || req.method === "DELETE") {
          if (!existing) {
            res.writeHead(400).end("unknown or missing session");
            return;
          }
          await existing.handleRequest(req, res);
          return;
        }

        res.writeHead(405).end("method not allowed");
      } catch (error) {
        process.stderr.write(
          `strl-mcp-server http error: ${
            error instanceof Error
              ? error.stack ?? error.message
              : String(error)
          }\n`,
        );
        if (!res.headersSent) {
          res.writeHead(500).end("internal error");
        }
      }
    })();
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, resolve);
  });
  process.stderr.write(
    `strl-mcp-server ready (http) on http://${host}:${port}${endpoint} ` +
      `[auth: ${token ? "bearer" : "none"}, dns-rebinding-guard: ${
        allowedHosts.length > 0 ? "on" : "off"
      }]\n`,
  );
};

const main = async (): Promise<void> => {
  const mode = (process.env.STRL_MCP_TRANSPORT ?? "stdio").toLowerCase();
  if (mode === "http" || process.env.STRL_MCP_HTTP_PORT) {
    await startHttp();
  } else {
    await startStdio();
  }
};

main().catch((error) => {
  process.stderr.write(
    `strl-mcp-server failed to start: ${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
