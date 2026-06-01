// STRL: runtime verification of the in-app BYO image-generation client
// (data/byoImageGen.ts → generateImage) against a MOCK OpenAI-Images endpoint.
// Exercises the request shape ({model,prompt,n,size,response_format:b64_json}),
// the b64 → data-URL result, and the error contracts (HTTP error, missing b64,
// abort). The insert half (insertGeneratedImage) needs a live editor/DOM and is
// covered by the desktop CDP smoke instead.
//
// Run:  node excalidraw-app/byo-image-smoke.mjs
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import esbuild from "esbuild";

import {
  strlAliasPlugin,
  assetLoaders,
  nodeBanner,
  nodeDefine,
  ROOT,
} from "../scripts/strl-esbuild-node.mjs";

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? `: ${detail}` : ""}`);
};

// bundle byoImageGen.ts for node (only generateImage is exercised; the insert
// path's DOM/API code is bundled but never called here).
const outfile = path.join(os.tmpdir(), `byo-image-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(ROOT, "excalidraw-app/data/byoImageGen.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  plugins: [strlAliasPlugin],
  loader: assetLoaders,
  banner: nodeBanner,
  define: nodeDefine,
  logLevel: "warning",
});
const { generateImage } = await import(pathToFileURL(outfile).href);

const B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
let lastBody = null;
const server = http.createServer((req, res) => {
  const mode = new URL(req.url, "http://x").searchParams.get("mode");
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", async () => {
    try {
      lastBody = JSON.parse(raw);
    } catch {
      lastBody = null;
    }
    if (mode === "error") {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("quota exceeded");
      return;
    }
    if (mode === "nob64") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ url: "http://example/img.png" }] }));
      return;
    }
    if (mode === "abort") {
      await new Promise((r) => setTimeout(r, 4000)); // never answers in time
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: B64 }] }));
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

try {
  // happy path
  {
    const img = await generateImage({
      endpoint: `${base}/v1/images/generations?mode=ok`,
      apiKey: "sk-test",
      model: "gpt-image-1",
      prompt: "a teal mountain logo",
    });
    const shape =
      lastBody?.model === "gpt-image-1" &&
      lastBody?.prompt === "a teal mountain logo" &&
      lastBody?.n === 1 &&
      lastBody?.response_format === "b64_json";
    check(
      "image request uses OpenAI-Images shape (model/prompt/n/response_format)",
      shape,
      `n=${lastBody?.n} rf=${lastBody?.response_format}`,
    );
    check(
      "happy path returns a PNG data URL from b64_json",
      img.mimeType === "image/png" && img.dataURL === `data:image/png;base64,${B64}`,
      `dataURL=${img.dataURL.slice(0, 32)}…`,
    );
  }

  // HTTP error
  {
    const err = await generateImage({
      endpoint: `${base}/v1/images/generations?mode=error`,
      model: "m",
      prompt: "x",
    }).catch((e) => e);
    check(
      "HTTP 500 throws RequestError with status + detail",
      err?.name === "RequestError" && err.status === 500 && /quota exceeded/.test(err.message),
      `status=${err?.status} msg=${err?.message}`,
    );
  }

  // missing b64
  {
    const err = await generateImage({
      endpoint: `${base}/v1/images/generations?mode=nob64`,
      model: "m",
      prompt: "x",
    }).catch((e) => e);
    check(
      "missing b64_json throws a helpful RequestError(502)",
      err?.name === "RequestError" && err.status === 502 && /b64_json/.test(err.message),
      `status=${err?.status}`,
    );
  }

  // abort
  {
    const controller = new AbortController();
    const p = generateImage({
      endpoint: `${base}/v1/images/generations?mode=abort`,
      model: "m",
      prompt: "x",
      signal: controller.signal,
    }).catch((e) => e);
    setTimeout(() => controller.abort(), 200);
    const err = await p;
    check(
      "abort surfaces an AbortError (dialog ignores it)",
      err?.name === "AbortError",
      `name=${err?.name}`,
    );
  }
} finally {
  server.close();
  try {
    fs.rmSync(outfile);
  } catch {}
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n[byo-image] ${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
