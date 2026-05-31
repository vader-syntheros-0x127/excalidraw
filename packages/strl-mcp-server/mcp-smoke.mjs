// STRL: end-to-end MCP stdio smoke. Spawns dist/bin.js, performs the JSON-RPC
// handshake, exercises create/get/edit/add_image and a path-traversal rejection.
// Run: node mcp-smoke.mjs
import { spawn } from "node:child_process";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "strl-mcp-smoke-"));

const child = spawn("node", [path.join(here, "dist/bin.js")], {
  env: {
    ...process.env,
    STRL_MCP_WORKDIR: workdir,
    STRL_MCP_ACTIVE_FILE: "scene.excalidraw",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map();
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) {
      continue;
    }
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let nextId = 1;
const rpc = (method, params) => {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
};
const notify = (method, params) =>
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);

const callTool = async (name, args) => {
  const res = await rpc("tools/call", { name, arguments: args });
  return res.result;
};
const parsePayload = (result) => JSON.parse(result.content[0].text);

try {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "strl-smoke", version: "0" },
  });
  assert.ok(init.result?.serverInfo?.name === "strl-ideate", "initialize handshake");
  notify("notifications/initialized", {});

  const tools = await rpc("tools/list", {});
  const toolNames = tools.result.tools.map((t) => t.name).sort();
  assert.deepStrictEqual(
    toolNames,
    [
      "add_image",
      "add_shapes",
      "create_scene",
      "delete_elements",
      "edit_elements",
      "generate_image",
      "get_scene",
    ],
    "tools/list returns all 7 tools",
  );

  // create_scene
  const created = parsePayload(
    await callTool("create_scene", {
      skeleton: [
        { type: "rectangle", x: 40, y: 40, width: 200, height: 80, label: { text: "Plan" } },
        { type: "arrow", x: 240, y: 80, width: 120, height: 0 },
      ],
    }),
  );
  assert.ok(created.elementCount >= 3, "create_scene produced elements");
  assert.ok(fs.existsSync(path.join(workdir, "scene.excalidraw")), "file written");

  // get_scene
  const got = parsePayload(await callTool("get_scene", {}));
  assert.ok(Array.isArray(got.elements) && got.elements.length >= 3, "get_scene summary");

  // edit by text
  const edited = parsePayload(
    await callTool("edit_elements", {
      query: { text: "Plan" },
      set: { backgroundColor: "#ffec99" },
    }),
  );
  assert.strictEqual(edited.matched, 1, "edit matched the labelled box");

  // add_image (data URL)
  const withImage = parsePayload(
    await callTool("add_image", {
      dataURL:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      x: 40,
      y: 160,
      width: 48,
      height: 48,
    }),
  );
  assert.ok(withImage.imageAdded, "add_image embedded a file");

  // path-traversal rejection
  const escape = await callTool("get_scene", { file: "../escape.excalidraw" });
  assert.strictEqual(escape.isError, true, "path traversal rejected");
  assert.ok(/escapes/i.test(escape.content[0].text), "rejection mentions escape");

  // round-trip validity: the written file parses as excalidraw
  const onDisk = JSON.parse(fs.readFileSync(path.join(workdir, "scene.excalidraw"), "utf8"));
  assert.strictEqual(onDisk.type, "excalidraw", "on-disk file is a valid excalidraw scene");
  assert.ok(Object.keys(onDisk.files).length === 1, "image file embedded inline");

  console.log(
    JSON.stringify(
      {
        ok: true,
        tools: toolNames.length,
        created: created.elementCount,
        edited: edited.matched,
        imageEmbedded: Boolean(withImage.imageAdded),
        traversalRejected: escape.isError === true,
        onDiskType: onDisk.type,
        embeddedFiles: Object.keys(onDisk.files).length,
      },
      null,
      2,
    ),
  );
  child.kill();
  fs.rmSync(workdir, { recursive: true, force: true });
  process.exit(0);
} catch (error) {
  console.error("MCP smoke FAILED:", error.message);
  child.kill();
  fs.rmSync(workdir, { recursive: true, force: true });
  process.exit(1);
}
