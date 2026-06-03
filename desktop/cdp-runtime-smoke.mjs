// STRL: runtime verification of the desktop AI-authoring features against the
// REAL packaged app (no install). Drives the unpacked Electron build over the
// Chrome DevTools Protocol (CDP) — zero deps, uses Node's global WebSocket/fetch.
//
// Closes the runtime gap the unit smokes can't reach:
//   1. live-reload (clean): an external atomic rewrite of the active file is
//      reflected on the canvas (verified by sampling rendered pixels).
//   2. dirty no-clobber: with unsaved edits, an external rewrite does NOT replace
//      the scene (the native conflict prompt guards it).
//   3. external-removed: deleting the active file surfaces the recover toast.
//   4. settings-driven CSP: connect-src blocks a foreign origin until the user
//      allowlists it via setAiOrigins(), then permits exactly that origin.
//
// Requires: a built ./dist-installers/linux-unpacked binary and an X display
// (run under Xvfb). Run:  DISPLAY=:99 node cdp-runtime-smoke.mjs
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BIN = path.resolve("dist-installers/linux-unpacked/strl-ideate-desktop");
const PORT = 9223;
const CSP_ORIGIN_PORT = 9911;
const CSP_ORIGIN = `http://127.0.0.1:${CSP_ORIGIN_PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log("[cdp]", ...a);

// ── scene authoring ─────────────────────────────────────────────────────────
const sceneWith = (color, id) =>
  JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "strl-cdp-smoke",
    elements: [
      {
        id,
        type: "rectangle",
        x: 100,
        y: 120,
        width: 520,
        height: 380,
        angle: 0,
        strokeColor: color,
        backgroundColor: color,
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        seed: 1,
        version: 2,
        versionNonce: 1,
        isDeleted: false,
        boundElements: null,
        updated: 1,
        link: null,
        locked: false,
      },
    ],
    appState: {
      viewBackgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
    },
    files: {},
  });

// Atomic external write (temp + rename) — mirrors how the MCP server writes, so
// the watcher only ever sees a complete file.
const atomicWrite = (file, contents) => {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, contents);
  fs.renameSync(tmp, file);
};

// Page-side snippet: count pixels close to an {r,g,b} across all 2D canvases.
const countColorExpr = (r, g, b, tol = 48) => `(() => {
  let hits = 0, n = 0;
  for (const c of document.querySelectorAll('canvas')) {
    if (!c.width || !c.height) continue;
    let ctx; try { ctx = c.getContext('2d'); } catch (e) { continue; }
    if (!ctx) continue;
    let img; try { img = ctx.getImageData(0,0,c.width,c.height); } catch (e) { continue; }
    const d = img.data; n++;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i]-${r})<${tol} && Math.abs(d[i+1]-${g})<${tol} && Math.abs(d[i+2]-${b})<${tol} && d[i+3]>200) hits++;
    }
  }
  return { hits, canvases: n };
})()`;

// ── minimal CDP client over the page target's websocket ─────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error
          ? reject(new Error(JSON.stringify(msg.error)))
          : resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 15000);
    });
  }
  // Evaluate, auto-awaiting promises, returning the JS value by value.
  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        `eval exception: ${JSON.stringify(res.exceptionDetails)}`,
      );
    }
    return res.result.value;
  }
  async key(type, key, code, vk, modifiers = 0) {
    await this.send("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      modifiers,
    });
  }
  async tap(key, code, vk, modifiers = 0) {
    await this.key("rawKeyDown", key, code, vk, modifiers);
    await this.key("keyUp", key, code, vk, modifiers);
  }
  async click(x, y) {
    const base = { x, y, button: "left", clickCount: 1 };
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      ...base,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      ...base,
    });
  }
  // Press-drag-release with the left button held (buttons:1) through intermediate
  // moves — needed for Excalidraw to register a pointer drag (move an element).
  async drag(x1, y1, x2, y2, steps = 8) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: x1,
      y: y1,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
    for (let i = 1; i <= steps; i++) {
      const x = x1 + ((x2 - x1) * i) / steps;
      const y = y1 + ((y2 - y1) * i) / steps;
      await this.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x,
        y,
        button: "left",
        buttons: 1,
      });
      await sleep(25);
    }
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: x2,
      y: y2,
      button: "left",
      buttons: 1,
      clickCount: 1,
    });
  }
}

async function connect() {
  // Discover the page target's websocket url.
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find(
        (t) => t.type === "page" && t.webSocketDebuggerUrl,
      );
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          ws.onopen = resolve;
          ws.onerror = (e) => reject(new Error("ws error"));
        });
        const cdp = new CDP(ws);
        await cdp.send("Runtime.enable");
        await cdp.send("Page.enable");
        await cdp.send("Log.enable");
        return cdp;
      }
    } catch {
      /* not ready yet */
    }
    await sleep(500);
  }
  throw new Error("could not connect to CDP page target");
}

function launch(scenePath, logFile) {
  const env = { ...process.env, DISPLAY: process.env.DISPLAY || ":99" };
  delete env.ELECTRON_RUN_AS_NODE; // we want the GUI, not node mode
  const out = fs.openSync(logFile, "w");
  const proc = spawn(
    BIN,
    [
      `--remote-debugging-port=${PORT}`,
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      scenePath,
    ],
    { stdio: ["ignore", out, out], env },
  );
  return proc;
}

const kill = (proc) => {
  try {
    proc.kill("SIGKILL");
  } catch {
    /* already gone */
  }
};

// Poll an evaluate() until predicate(value) is true or timeout.
async function until(cdp, expr, pred, ms = 5000, step = 250) {
  const deadline = Date.now() + ms;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await cdp.evaluate(expr);
      if (pred(last)) return { ok: true, value: last };
    } catch (e) {
      last = String(e);
    }
    await sleep(step);
  }
  return { ok: false, value: last };
}

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  log(`${ok ? "PASS" : "FAIL"} — ${name}: ${detail}`);
};

async function waitEditor(cdp) {
  const r = await until(
    cdp,
    "!!document.querySelector('.excalidraw')",
    (v) => v === true,
    20000,
  );
  if (!r.ok) throw new Error("editor never mounted");
}

// ── Launch A: live-reload (clean) + dirty no-clobber ────────────────────────
async function launchA(dir) {
  const file = path.join(dir, "live.excalidraw");
  atomicWrite(file, sceneWith("#00ffff", "rect-cyan")); // initial: cyan
  const proc = launch(file, path.join(dir, "appA.log"));
  let cdp;
  try {
    cdp = await connect();
    await waitEditor(cdp);

    // STRL: the app correctly defaults to DARK, but Excalidraw renders dark mode
    // via a render-time canvas filter (DARK_THEME_FILTER in renderElement.ts),
    // which inverts the raw pixels getImageData() reads — so the literal
    // marker-color assertions below only hold in LIGHT theme. Pin light via the
    // app's own toggle (Alt+Shift+D; it boots dark) and confirm it took. (Before
    // the desktop theme-preserve fix, opening a file buggily flipped to light,
    // which is what made these literal-color samples pass by accident.)
    await cdp.tap("D", "KeyD", 68, 9); // Alt(1)+Shift(8)
    const light = await until(
      cdp,
      "(() => { const e = document.querySelector('.excalidraw'); return e ? !e.classList.contains('theme--dark') : false; })()",
      (v) => v === true,
      4000,
    );
    if (!light.ok) {
      throw new Error("could not switch to light theme for color sampling");
    }

    // The opened scene should render cyan.
    const cyan0 = await until(
      cdp,
      countColorExpr(0, 255, 255),
      (v) => v.hits > 100,
      8000,
    );
    record(
      "open file renders on canvas",
      cyan0.ok,
      `cyan hits=${JSON.stringify(cyan0.value)}`,
    );

    // 1) Live-reload clean: external atomic rewrite to magenta → canvas updates.
    atomicWrite(file, sceneWith("#ff00ff", "rect-magenta"));
    const magenta = await until(
      cdp,
      countColorExpr(255, 0, 255),
      (v) => v.hits > 100,
      6000,
    );
    const cyanGone = await cdp.evaluate(countColorExpr(0, 255, 255));
    record(
      "live-reload (clean) reflects external change",
      magenta.ok && cyanGone.hits < 50,
      `magenta=${JSON.stringify(magenta.value)} cyanLeft=${cyanGone.hits}`,
    );

    // 2) Dirty no-clobber: make a durable edit, then external rewrite to green.
    // Drag-move the magenta rect (center ~360,310 → 480,360) = a durable edit.
    await cdp.drag(360, 310, 480, 360);
    await sleep(500);
    let dirty = await cdp.evaluate("window.__strlIsDirty === true");
    if (!dirty) {
      // fallback: keyboard select-all + nudge
      await cdp.click(900, 700);
      await cdp.tap("a", "KeyA", 65, 2);
      for (let i = 0; i < 8; i++) await cdp.tap("ArrowRight", "ArrowRight", 39);
      await sleep(500);
      dirty = await cdp.evaluate("window.__strlIsDirty === true");
    }

    atomicWrite(file, sceneWith("#00ff00", "rect-green")); // external change while dirty
    await sleep(1800); // give the watcher its debounce + the (non-blocking) prompt time
    const green = await cdp.evaluate(countColorExpr(0, 255, 0));
    const magentaStill = await cdp.evaluate(countColorExpr(255, 0, 255));
    const stillDirty = await cdp.evaluate("window.__strlIsDirty === true");
    record(
      "dirty scene is NOT clobbered by external change",
      dirty && green.hits < 50 && magentaStill.hits > 100 && stillDirty,
      `dirtyBefore=${dirty} greenHits=${green.hits} magentaKept=${magentaStill.hits} stillDirty=${stillDirty}`,
    );

    // 3) SECURITY: a compromised renderer must NOT be able to redirect the
    // in-place Save target to an arbitrary path it picks. Attempt the exploit:
    // claim an existing non-issued file as "opened", then in-place-save attacker
    // bytes. With the strl:opened allowlist, confirmOpened() is ignored, the
    // active file stays = the legitimately-opened scene, and the sentinel is
    // never written. (Pre-fix, this overwrote the sentinel with 'PWNED-STRL'.)
    const sentinel = path.join(dir, "sentinel.secret");
    fs.writeFileSync(sentinel, "SENTINEL");
    await cdp.evaluate(
      `window.strlDesktop.confirmOpened(${JSON.stringify(sentinel)})`,
    );
    await sleep(400);
    await cdp.evaluate(
      `window.strlDesktop.saveFile({data:'PWNED-STRL',suggestedName:'x',extension:'excalidraw',saveAs:false})`,
    );
    await sleep(700);
    const sentinelAfter = fs.readFileSync(sentinel, "utf8");
    record(
      "renderer canNOT redirect Save target to an arbitrary path (strl:opened allowlist)",
      sentinelAfter === "SENTINEL",
      sentinelAfter === "SENTINEL"
        ? "sentinel intact (exploit blocked)"
        : `SENTINEL OVERWRITTEN -> ${JSON.stringify(
            sentinelAfter.slice(0, 24),
          )}`,
    );
  } finally {
    if (cdp)
      try {
        cdp.ws.close();
      } catch {}
    kill(proc);
    await sleep(800);
  }
}

// ── Launch B: external-removed toast + settings-driven CSP ───────────────────
async function launchB(dir) {
  const file = path.join(dir, "scene.excalidraw");
  atomicWrite(file, sceneWith("#3366ff", "rect-blue"));
  const proc = launch(file, path.join(dir, "appB.log"));

  // Local origin the renderer will try to reach; CSP must gate it.
  let serverHits = 0;
  const server = http.createServer((req, res) => {
    serverHits++;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end("pong");
  });
  await new Promise((r) => server.listen(CSP_ORIGIN_PORT, "127.0.0.1", r));

  let cdp;
  try {
    cdp = await connect();
    await waitEditor(cdp);

    // 3) external-removed toast.
    fs.rmSync(file);
    const toast = await until(
      cdp,
      "document.body.innerText",
      (v) => typeof v === "string" && /removed on disk/i.test(v),
      6000,
    );
    record(
      "external-removed surfaces recover toast",
      toast.ok,
      toast.ok ? "toast shown" : "no toast",
    );

    // 4a) CSP blocks a foreign origin by default.
    const fetchExpr = `(async()=>{try{const r=await fetch('${CSP_ORIGIN}/ping',{cache:'no-store'});return 'OK:'+r.status;}catch(e){return 'ERR:'+(e&&e.message);}})()`;
    const hitsBefore = serverHits;
    const blocked = await cdp.evaluate(fetchExpr);
    await sleep(300);
    const reachedWhileBlocked = serverHits > hitsBefore;
    record(
      "CSP blocks un-allowlisted origin (default strict)",
      blocked.startsWith("ERR") && !reachedWhileBlocked,
      `result=${blocked} serverReached=${reachedWhileBlocked}`,
    );

    // 4b) Allowlist the origin via settings → window reloads with new CSP → permitted.
    await cdp.evaluate(`window.strlDesktop.setAiOrigins(['${CSP_ORIGIN}'])`);
    await sleep(2500); // window reload
    await waitEditor(cdp);
    const hitsBefore2 = serverHits;
    const allowed = await until(
      cdp,
      fetchExpr,
      (v) => v.startsWith("OK"),
      6000,
    );
    await sleep(300);
    const reachedWhenAllowed = serverHits > hitsBefore2;
    record(
      "CSP permits exactly the allowlisted origin after setAiOrigins",
      allowed.ok && reachedWhenAllowed,
      `result=${allowed.value} serverReached=${reachedWhenAllowed}`,
    );

    // cleanup: reset the persisted allowlist to strict.
    await cdp.evaluate("window.strlDesktop.setAiOrigins([])");
    await sleep(1000);
  } finally {
    if (cdp)
      try {
        cdp.ws.close();
      } catch {}
    kill(proc);
    server.close();
    await sleep(500);
  }
}

async function main() {
  if (!fs.existsSync(BIN)) {
    console.error(
      `missing packaged binary: ${BIN}\nrun: pnpm dist:linux (or electron-builder --linux AppImage)`,
    );
    process.exit(2);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strl-cdp-"));
  log("workdir", dir);
  try {
    await launchA(dir);
    await launchB(dir);
  } finally {
    // preserve electron logs for diagnosis, then clean the scene workdir
    for (const f of ["appA.log", "appB.log"]) {
      try {
        fs.copyFileSync(
          path.join(dir, f),
          path.join(os.tmpdir(), `strl-cdp-${f}`),
        );
      } catch {}
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n[cdp] ${passed}/${results.length} checks passed`);
  console.log(
    JSON.stringify({ ok: passed === results.length, results }, null, 2),
  );
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("[cdp] harness error:", e);
  process.exit(3);
});
