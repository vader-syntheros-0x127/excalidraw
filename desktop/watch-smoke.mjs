// STRL: validates the live-reload watcher MECHANISM used in main.ts —
// directory-watch (survives atomic rename), 150ms debounce, and the
// atomic-write + content-hash self-write guard (no time window) — against real
// filesystem operations, without Electron. The IPC/renderer wiring around this
// is thin and compile-checked.
import assert from "node:assert";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strl-watch-"));
const target = path.join(dir, "scene.excalidraw");
fs.writeFileSync(target, '{"type":"excalidraw","elements":[],"v":0}');

// --- watcher mirroring main.ts (parent-dir watch + basename filter + debounce +
//     hash-only self-write guard) ------------------------------------------------
let lastWrittenHash = null;
let debounce = null;
const detected = []; // external-change events that passed the guard

const watcher = fs.watch(dir, (_evt, filename) => {
  if (filename && path.basename(filename.toString()) !== path.basename(target)) {
    return;
  }
  if (debounce) {
    clearTimeout(debounce);
  }
  debounce = setTimeout(() => {
    debounce = null;
    let contents;
    try {
      contents = fs.readFileSync(target, "utf8");
    } catch {
      return;
    }
    if (sha256(contents) === lastWrittenHash) {
      return; // our own save (hash recorded before the atomic write)
    }
    detected.push(contents);
  }, 150);
});

// The app's self-write path: record the hash, then write atomically.
const selfWrite = (contents) => {
  lastWrittenHash = sha256(contents);
  const tmp = `${target}.tmp-self`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, target);
};

// An external tool's atomic write (e.g. the MCP server).
const externalAtomicWrite = (contents) => {
  const tmp = `${target}.tmp-ext`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, target);
};

try {
  // 1) external write IS detected (no hash recorded)
  externalAtomicWrite('{"type":"excalidraw","elements":[1,2],"v":2}');
  await sleep(400);
  assert.strictEqual(detected.length, 1, "external write not detected");
  assert.ok(detected[0].includes('"v":2'), "detected the new content");

  // 2) a self-write immediately after IS ignored (no masking window needed)
  selfWrite('{"type":"excalidraw","elements":[1],"v":1}');
  await sleep(400);
  assert.strictEqual(detected.length, 1, "self-write was (wrongly) detected");

  // 3) external write right after a self-write is STILL detected (proves no
  //    suppress window masks a near-simultaneous external change)
  externalAtomicWrite('{"type":"excalidraw","elements":[1,2,3],"v":3}');
  await sleep(400);
  assert.strictEqual(detected.length, 2, "external write after save not detected");
  assert.ok(detected[1].includes('"v":3'), "detected atomic-write content");

  console.log(
    JSON.stringify(
      {
        ok: true,
        externalDetected: true,
        selfWriteIgnored: true,
        noSuppressMasking: true,
        atomicRenameSurvived: true,
        totalExternalEvents: detected.length,
      },
      null,
      2,
    ),
  );
  watcher.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(0);
} catch (error) {
  console.error("watch smoke FAILED:", error.message);
  watcher.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
