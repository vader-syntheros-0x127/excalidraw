// STRL: bundle the MCP server (+ the engine, inlined via the @strl/authoring
// alias) into a single Node ESM. @modelcontextprotocol/sdk stays external and is
// resolved from node_modules at runtime (hoisted workspace install).
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

import {
  assetLoaders,
  nodeBanner,
  nodeDefine,
  strlAliasPlugin,
} from "../../scripts/strl-esbuild-node.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "src/bin.ts")],
  outfile: path.join(here, "dist/bin.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*"],
  plugins: [strlAliasPlugin],
  define: nodeDefine,
  // esbuild preserves bin.ts's own shebang at line 1; banner (the headless
  // globals) is inserted right after it.
  banner: nodeBanner,
  loader: assetLoaders,
  logLevel: "info",
});

console.log("built @strl/mcp-server -> dist/bin.js");
