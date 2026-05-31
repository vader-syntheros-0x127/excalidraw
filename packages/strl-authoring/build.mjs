// STRL: bundle the engine into a single self-contained Node ESM (platform:node),
// inlining the @excalidraw/* SOURCE via the shared alias plugin. No DOM, no
// browser-targeted dist, no external runtime deps.
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
  entryPoints: [path.join(here, "src/index.ts")],
  outfile: path.join(here, "dist/index.js"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  // platform:node keeps node built-ins external; everything else (incl. the
  // @excalidraw source resolved by the alias plugin) is inlined.
  plugins: [strlAliasPlugin],
  define: nodeDefine,
  banner: nodeBanner,
  loader: assetLoaders,
  logLevel: "info",
});

console.log("built @strl/authoring -> dist/index.js");
