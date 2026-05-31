// STRL: shared esbuild config for the headless Node tools (@strl/authoring,
// @strl/mcp-server). It bundles the relevant @excalidraw/* SOURCE (not the
// browser-targeted dist) into a single platform:node ESM, so the authoring
// engine runs under bare `node` with no DOM. See docs/STRL-CUSTOMIZATIONS.md.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// @excalidraw/<pkg> roots -> on-disk source dirs (mirrors vitest.config.mts).
const PKG_SRC = {
  common: "packages/common/src",
  element: "packages/element/src",
  math: "packages/math/src",
  utils: "packages/utils/src",
  excalidraw: "packages/excalidraw",
};

const EXT_ORDER = [".ts", ".tsx", ".js", ".mjs", ".json"];

const resolveFile = (base) => {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) {
    return base;
  }
  for (const ext of EXT_ORDER) {
    if (fs.existsSync(base + ext)) {
      return base + ext;
    }
  }
  for (const ext of EXT_ORDER) {
    const idx = path.join(base, `index${ext}`);
    if (fs.existsSync(idx)) {
      return idx;
    }
  }
  return null;
};

// Resolves `@excalidraw/<pkg>` and `@excalidraw/<pkg>/<sub>` to source files,
// and `@strl/authoring` to its own source (so the server bundles the engine in).
export const strlAliasPlugin = {
  name: "strl-excalidraw-alias",
  setup(build) {
    build.onResolve({ filter: /^@excalidraw\// }, (args) => {
      const rest = args.path.slice("@excalidraw/".length);
      const [pkg, ...sub] = rest.split("/");
      const srcBase = PKG_SRC[pkg];
      if (!srcBase) {
        return null;
      }
      const target =
        sub.length === 0
          ? resolveFile(path.join(ROOT, srcBase, "index"))
          : resolveFile(path.join(ROOT, srcBase, sub.join("/")));
      return target ? { path: target } : null;
    });

    build.onResolve({ filter: /^@strl\/authoring$/ }, () => {
      const target = resolveFile(
        path.join(ROOT, "packages/strl-authoring/src/index"),
      );
      return target ? { path: target } : null;
    });
  },
};

// Asset imports reachable through the @excalidraw/element barrel (fonts, css,
// images). The headless engine needs font METADATA (in @excalidraw/common), never
// the binaries — so these resolve to empty modules and never enter the bundle.
export const assetLoaders = {
  ".woff2": "empty",
  ".woff": "empty",
  ".ttf": "empty",
  ".otf": "empty",
  ".eot": "empty",
  ".png": "empty",
  ".jpg": "empty",
  ".jpeg": "empty",
  ".gif": "empty",
  ".webp": "empty",
  ".ico": "empty",
  ".svg": "empty",
  ".css": "empty",
  ".scss": "empty",
};

// A few imported @excalidraw modules read browser globals at module-eval time
// (not in any code path the engine executes — just top-level constants). We stub
// ONLY those narrow values. Deliberately leave `window`/`document` undefined so
// SSR-style `typeof window === "undefined"` guards take the headless branch.
export const nodeBanner = {
  js: [
    "globalThis.devicePixelRatio ??= 1;",
    "globalThis.EXCALIDRAW_ASSET_PATH ??= undefined;",
    // Declare `window` with an undefined VALUE so defensive `window?.x` guards in
    // the library don't ReferenceError (a bare undeclared `window` throws even
    // with `?.`). `typeof window` stays "undefined", so DOM branches stay off.
    'if (!("window" in globalThis)) { globalThis.window = undefined; }',
  ].join("\n"),
};

// Mirror of scripts/buildBase.js define, adapted for a Node runtime.
export const nodeDefine = {
  "import.meta.env": JSON.stringify({
    DEV: false,
    PROD: true,
    MODE: "production",
  }),
  "process.env.NODE_ENV": '"production"',
};
