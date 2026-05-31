#!/usr/bin/env node
// STRL: stdio entry point for the @strl/mcp-server. Register in a client's
// mcpServers config:
//   { "command": "node",
//     "args": ["/abs/path/packages/strl-mcp-server/dist/bin.js"],
//     "env": { "STRL_MCP_WORKDIR": "/abs/path/to/sketches",
//              "STRL_MCP_ACTIVE_FILE": "scene.excalidraw" } }
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createStrlServer } from "./server";

const main = async (): Promise<void> => {
  const server = createStrlServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the JSON-RPC channel — log readiness to stderr only.
  process.stderr.write("strl-mcp-server ready (stdio)\n");
};

main().catch((error) => {
  process.stderr.write(
    `strl-mcp-server failed to start: ${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`,
  );
  process.exit(1);
});
