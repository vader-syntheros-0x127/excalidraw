// STRL: runtime verification of the in-app BYO LLM streaming client
// (data/byoStreamFetch.ts) against a MOCK OpenAI-compatible SSE server. This is
// the piece the desktop/web smokes can't reach without a running model — it
// exercises the real streaming parse, mermaid-fence stripping, the OpenAI request
// shape (system prompt prepended + {model,stream,messages}), and the RequestError
// contract for HTTP errors and aborts.
//
// We bundle the TS source with the shared node esbuild config (resolves
// @excalidraw/excalidraw/errors to source), then drive it over a local server.
// Run:  node excalidraw-app/byo-stream-smoke.mjs
import esbuild from "esbuild";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

// ── 1. bundle byoStreamFetch.ts for node ────────────────────────────────────
const outfile = path.join(os.tmpdir(), `byo-stream-${process.pid}.mjs`);
await esbuild.build({
  entryPoints: [path.join(ROOT, "excalidraw-app/data/byoStreamFetch.ts")],
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
const { byoStreamFetch, MERMAID_SYSTEM_PROMPT } = await import(
  pathToFileURL(outfile).href
);

// ── 2. mock OpenAI-compatible server ────────────────────────────────────────
// Behaviour is selected per-request by the `mode` query param.
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
      res.end("model not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    const delta = (content) => sse({ choices: [{ delta: { content } }] });

    // A model that (annoyingly) wraps the diagram in a ```mermaid fence — the
    // client must strip it. Streamed across several chunks like a real model.
    const chunks =
      mode === "abort"
        ? ["```mermaid\n", "flowchart TD\n"] // never completes; client aborts
        : ["```mermaid\n", "flowchart TD\n", "  A[Start] --> B[End]\n", "```"];

    for (const c of chunks) {
      delta(c);
      if (mode === "abort") {
        await new Promise((r) => setTimeout(r, 400)); // slow → give time to abort
      }
    }
    if (mode === "abort") {
      // hang open so the only way the client returns is via its own abort
      await new Promise((r) => setTimeout(r, 5000));
      res.end();
      return;
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const EXPECTED = "flowchart TD\n  A[Start] --> B[End]";

try {
  // ── 3a. happy path ────────────────────────────────────────────────────────
  {
    const chunks = [];
    let streamCreated = false;
    const result = await byoStreamFetch({
      endpoint: `${base}/v1/chat/completions?mode=ok`,
      apiKey: "sk-test",
      model: "mock-model",
      messages: [{ role: "user", content: "flowchart from start to end" }],
      onChunk: (c) => chunks.push(c),
      onStreamCreated: () => (streamCreated = true),
    });
    const sentSystem =
      Array.isArray(lastBody?.messages) &&
      lastBody.messages[0]?.role === "system" &&
      lastBody.messages[0]?.content === MERMAID_SYSTEM_PROMPT;
    const sentShape =
      lastBody?.model === "mock-model" && lastBody?.stream === true;
    check(
      "request uses OpenAI shape (model+stream) with system prompt prepended",
      sentSystem && sentShape,
      `model=${lastBody?.model} stream=${lastBody?.stream} sys=${sentSystem}`,
    );
    check(
      "happy path strips ```mermaid fence and returns the diagram",
      result.error === null && result.generatedResponse === EXPECTED,
      `resp=${JSON.stringify(result.generatedResponse)}`,
    );
    check(
      "onStreamCreated + onChunk fired during streaming",
      streamCreated && chunks.length >= 3 && chunks.join("").includes("flowchart"),
      `streamCreated=${streamCreated} chunks=${chunks.length}`,
    );
  }

  // ── 3b. HTTP error → RequestError ─────────────────────────────────────────
  {
    const result = await byoStreamFetch({
      endpoint: `${base}/v1/chat/completions?mode=error`,
      model: "mock-model",
      messages: [{ role: "user", content: "x" }],
    });
    check(
      "HTTP 500 maps to RequestError with status + server detail",
      !!result.error &&
        result.error.name === "RequestError" &&
        result.error.status === 500 &&
        /model not found/.test(result.error.message),
      `status=${result.error?.status} msg=${result.error?.message}`,
    );
  }

  // ── 3c. abort → RequestError(499) ─────────────────────────────────────────
  {
    const controller = new AbortController();
    const p = byoStreamFetch({
      endpoint: `${base}/v1/chat/completions?mode=abort`,
      model: "mock-model",
      messages: [{ role: "user", content: "x" }],
      onChunk: () => controller.abort(), // abort as soon as the first chunk lands
      signal: controller.signal,
    });
    const result = await p;
    check(
      "abort mid-stream maps to RequestError(499, 'Aborted')",
      !!result.error &&
        result.error.name === "RequestError" &&
        result.error.status === 499,
      `status=${result.error?.status} msg=${result.error?.message}`,
    );
  }
} finally {
  server.close();
  try {
    fs.rmSync(outfile);
  } catch {}
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n[byo-stream] ${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
