// STRL-Ideate desktop — Electron main process.
// Wraps the built excalidraw-app SPA in a desktop window, served over a
// custom `app://` protocol so the app keeps its absolute (`/`) asset paths.
/* eslint-disable no-console -- Electron main process: stdout diagnostics are intentional */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  protocol,
  shell,
} from "electron";

import type { MenuItemConstructorOptions } from "electron";

const APP_NAME = "STRL-Ideate";
const APP_SCHEME = "app";

// STRL: strict Content-Security-Policy for the packaged app, served on the
// app:// HTML document. Everything loads from the app's own origin ('self') —
// the desktop build bundles its fonts locally (see woff2-vite-plugins.js /
// .env.desktop), so there are no remote origins to allow.
//  - 'wasm-unsafe-eval': pica/image-blob-reduce compile WASM for image resize.
//  - style 'unsafe-inline': excalidraw relies heavily on inline styles.
//  - the three script hashes are the inline <script>s in index.html
//    (dark-mode early paint, local asset-path, window.name). If those change,
//    recompute (sha256 base64 of each inline script body) or the CSP blocks them
//    — the STRL_SMOKE check (dark:true / hasEditor:true) will catch a mismatch.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "script-src 'self' 'wasm-unsafe-eval' 'sha256-iPtxE0n242JUcLKPr7D09tSIF4FKNSy5jqkeySXxfDY=' 'sha256-mXvmZWZG6iAZBw0OliHQaJOSMPc9DbQZJaxywImBlQo=' 'sha256-Kxm9zQ99NqYtDuNSdByEfyFAYVPAqWdmNFx5axumk1w='",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
// When set (dev), load the live Vite dev server instead of the built files.
const DEV_URL = process.env.STRL_DESKTOP_DEV_URL;
// Built SPA location:
//  - packaged: bundled next to dist/ as `renderer/` (see electron-builder.yml)
//  - dev:      the workspace build at excalidraw-app/build
const BUILD_DIR = app.isPackaged
  ? path.join(__dirname, "..", "renderer")
  : path.resolve(__dirname, "..", "..", "excalidraw-app", "build");

app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
// Path of a .excalidraw file passed on the command line / open-file event.
let pendingOpenPath: string | null = null;
// The renderer registers its file-open handler only after React mounts; until
// it signals readiness, open events are buffered (see openFilePath) so the
// launch / file-association IPC isn't dropped.
let rendererReady = false;

// ---------------------------------------------------------------------------
// Window-state persistence (tiny, dependency-free)
// ---------------------------------------------------------------------------
type WindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
};

const DEFAULT_STATE: WindowState = { width: 1400, height: 900 };

const stateFilePath = () =>
  path.join(app.getPath("userData"), "window-state.json");

const loadWindowState = (): WindowState => {
  try {
    return {
      ...DEFAULT_STATE,
      ...JSON.parse(fs.readFileSync(stateFilePath(), "utf8")),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
};

const saveWindowState = (win: BrowserWindow) => {
  if (win.isDestroyed()) {
    return;
  }
  const bounds = win.getNormalBounds();
  const state: WindowState = { ...bounds, isMaximized: win.isMaximized() };
  try {
    fs.writeFileSync(stateFilePath(), JSON.stringify(state));
  } catch {
    // best-effort only
  }
};

// ---------------------------------------------------------------------------
// app:// protocol — serves the built SPA with index.html fallback
// ---------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const isFile = (p: string) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

const registerAppProtocol = () => {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    let relative = decodeURIComponent(pathname);
    if (relative === "/" || relative === "") {
      relative = "/index.html";
    }
    // Resolve inside BUILD_DIR and guard against path traversal. A plain
    // `startsWith(BUILD_DIR)` prefix check is unsafe — it also matches sibling
    // dirs like `<BUILD_DIR>-evil` and is separator/-case fragile on Windows —
    // so compare via path.relative: anything escaping BUILD_DIR yields a
    // "../" prefix or an absolute (other-drive) relative path.
    const resolved = path.join(BUILD_DIR, relative);
    const relToBuild = path.relative(BUILD_DIR, resolved);
    if (
      relToBuild === ".." ||
      relToBuild.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relToBuild)
    ) {
      return new Response("Forbidden", { status: 403 });
    }
    // SPA fallback: unknown, extension-less path -> index.html.
    const indexHtml = path.join(BUILD_DIR, "index.html");
    const target = isFile(resolved)
      ? resolved
      : path.extname(resolved) === ""
      ? indexHtml
      : resolved;
    // Stream from disk via net.fetch (asar-aware: serves from app.asar when
    // packaged, off disk in dev). It sets the content-type and streams the body
    // — no readFileSync stall or whole-asset copy on the main process.
    const response = await net.fetch(pathToFileURL(target).toString());
    if (!response.ok) {
      return new Response("Not found", { status: 404 });
    }
    // Sub-resources pass straight through (their CSP comes from the document).
    if (target !== indexHtml) {
      return response;
    }
    // Inject the CSP onto the HTML document, keeping the streamed body.
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
};

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
const createWindow = () => {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 640,
    minHeight: 480,
    title: APP_NAME,
    backgroundColor: "#121212", // matches dark-by-default, avoids white flash
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(`${APP_SCHEME}://-/index.html`);
  }

  // We own the window title (filename + dirty marker); stop the page <title>
  // ("STRL-Ideate") from overriding it.
  mainWindow.webContents.on("page-title-updated", (event) => {
    event.preventDefault();
  });
  updateTitle();

  // Persist size/position.
  const persist = () => mainWindow && saveWindowState(mainWindow);
  mainWindow.on("resize", persist);
  mainWindow.on("move", persist);
  mainWindow.on("close", persist);

  // Prompt to save unsaved changes before the window closes. A 'close' handler
  // can't await before deciding, so we always defer: prevent the close, then
  // resolve asynchronously (querying the renderer's authoritative dirty flag).
  mainWindow.on("close", (event) => {
    if (allowClose || !mainWindow) {
      return; // decision already made → let it close
    }
    event.preventDefault();
    if (closeInProgress) {
      return; // a decision is already in flight (e.g. Cmd+W mashing)
    }
    closeInProgress = true;
    void (async () => {
      try {
        if (!(await currentDirty())) {
          allowClose = true;
          mainWindow?.close();
          return;
        }
        const decision = promptSaveBeforeClose();
        if (decision === "cancel") {
          return;
        }
        if (decision === "save" && !(await requestSaveScene(false)).ok) {
          return; // user canceled the save → stay open
        }
        allowClose = true;
        mainWindow?.close();
      } finally {
        closeInProgress = false;
      }
    })();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Once the renderer is ready, deliver any file requested at launch.
  mainWindow.webContents.on("did-finish-load", async () => {
    console.log(
      `[strl-desktop] renderer loaded (electron ${process.versions.electron})`,
    );
    // Pending file-opens are flushed when the renderer signals readiness
    // (strl:renderer-ready), not here — the open handler isn't registered yet.
    // Headless smoke check (STRL_SMOKE=1): poll for the editor to mount
    // (React mounts after load), capturing console errors for diagnosis.
    if (process.env.STRL_SMOKE === "1" && mainWindow) {
      const wc = mainWindow.webContents;
      wc.on("console-message", (_e, level, message) => {
        if (level >= 2) {
          console.log(`[strl-desktop] console[${level}]: ${message}`);
        }
      });
      let probe: any = null;
      try {
        for (let i = 0; i < 20; i++) {
          probe = await wc.executeJavaScript(
            `({ title: document.title, hasEditor: !!document.querySelector('.excalidraw'), dark: document.documentElement.classList.contains('dark'), scripts: document.querySelectorAll('script[type=module]').length })`,
          );
          if (probe.hasEditor) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        console.log(`[strl-desktop] smoke: ${JSON.stringify(probe)}`);
      } catch (error) {
        console.error(`[strl-desktop] smoke probe failed: ${String(error)}`);
      }
      app.quit();
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_e, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[strl-desktop] load failed ${errorCode} ${errorDescription} @ ${validatedURL}`,
      );
    },
  );
};

// ---------------------------------------------------------------------------
// Native menu
// ---------------------------------------------------------------------------
const sendMenu = (action: string) => {
  mainWindow?.webContents.send("strl:menu", action);
};

const buildMenu = () => {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? ([{ role: "appMenu" }] as MenuItemConstructorOptions[]) : []),
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => void doNew(),
        },
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          click: () => openFileViaDialog(),
        },
        {
          label: "Open Recent",
          submenu: buildRecentSubmenu(),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenu("save"),
        },
        {
          label: "Save As…",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenu("save-as"),
        },
        { type: "separator" },
        {
          label: "Export",
          submenu: [
            { label: "PNG image", click: () => sendMenu("export-png") },
            { label: "SVG vector", click: () => sendMenu("export-svg") },
            { label: "PDF document", click: () => sendMenu("export-pdf") },
          ],
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        ...(DEV_URL
          ? ([{ role: "toggleDevTools" }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: `About ${APP_NAME}`,
          click: () =>
            dialog.showMessageBox({
              type: "info",
              title: `About ${APP_NAME}`,
              message: APP_NAME,
              detail: `Version ${app.getVersion()}\nElectron ${
                process.versions.electron
              }`,
            }),
        },
        // STRL: removed "Learn More" (linked to upstream excalidraw GitHub)
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

// ---------------------------------------------------------------------------
// Document state — active file, dirty flag, recent files, window title
// ---------------------------------------------------------------------------
let activeFilePath: string | null = null;
// Mirror of the renderer's dirty state (fallback only; the renderer's
// window.__strlIsDirty is authoritative and is what the close guard reads).
let isDirty = false;
// Set once an unsaved-changes prompt has resolved so the next close goes through.
let allowClose = false;
// Re-entrancy guard so mashing Cmd+W can't stack overlapping close flows.
let closeInProgress = false;
let saveToken = 0;

// Ask the renderer to save the scene and resolve with whether it actually wrote
// (false on cancel/error). Token-correlated so concurrent requests don't cross.
const requestSaveScene = (saveAs: boolean): Promise<{ ok: boolean }> => {
  if (!mainWindow) {
    return Promise.resolve({ ok: false });
  }
  const token = String(++saveToken);
  return new Promise((resolve) => {
    ipcMain.once(`strl:save-done:${token}`, (_event, result) => {
      resolve(
        result && typeof result.ok === "boolean" ? result : { ok: false },
      );
    });
    mainWindow!.webContents.send("strl:save-and-report", { token, saveAs });
  });
};

const MAX_RECENT = 10;
let recentFiles: string[] = [];

const recentFilePath = () =>
  path.join(app.getPath("userData"), "recent-files.json");

const loadRecentFiles = () => {
  try {
    const parsed = JSON.parse(fs.readFileSync(recentFilePath(), "utf8"));
    recentFiles = Array.isArray(parsed)
      ? parsed
          .filter((p): p is string => typeof p === "string")
          .slice(0, MAX_RECENT)
      : [];
  } catch {
    recentFiles = [];
  }
};

const persistRecentFiles = () => {
  try {
    fs.writeFileSync(recentFilePath(), JSON.stringify(recentFiles));
  } catch {
    // best-effort only
  }
};

// Push the recent-files list to the renderer (drives the welcome-screen list).
const broadcastRecent = () => {
  mainWindow?.webContents.send("strl:recent-files", recentFiles);
};

const updateTitle = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const name = activeFilePath
    ? path.basename(activeFilePath, ".excalidraw")
    : "Untitled";
  mainWindow.setTitle(`${isDirty ? "● " : ""}${name} — ${APP_NAME}`);
};

const addRecentFile = (filePath: string) => {
  const resolved = path.resolve(filePath);
  recentFiles = [resolved, ...recentFiles.filter((p) => p !== resolved)].slice(
    0,
    MAX_RECENT,
  );
  persistRecentFiles();
  buildMenu(); // refresh the "Open Recent" submenu
  broadcastRecent();
};

// Point the document at a saved/opened scene file (null = a fresh, unsaved scene).
const setActiveFile = (filePath: string | null) => {
  activeFilePath = filePath ? path.resolve(filePath) : null;
  isDirty = false;
  if (activeFilePath) {
    addRecentFile(activeFilePath); // also rebuilds the menu
  }
  updateTitle();
};

const buildRecentSubmenu = (): MenuItemConstructorOptions[] => {
  if (recentFiles.length === 0) {
    return [{ label: "No recent files", enabled: false }];
  }
  return [
    ...recentFiles.map((p) => ({
      label: path.basename(p),
      toolTip: p,
      click: () => openFilePath(p),
    })),
    { type: "separator" },
    {
      label: "Clear Recent",
      click: () => {
        recentFiles = [];
        persistRecentFiles();
        buildMenu();
        broadcastRecent();
      },
    },
  ];
};

const promptSaveBeforeClose = (): "save" | "discard" | "cancel" => {
  if (!mainWindow) {
    return "discard";
  }
  const choice = dialog.showMessageBoxSync(mainWindow, {
    type: "question",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved changes",
    message: `Do you want to save the changes you made${
      activeFilePath ? ` to "${path.basename(activeFilePath)}"` : ""
    }?`,
    detail: "Your changes will be lost if you don't save them.",
  });
  return choice === 0 ? "save" : choice === 1 ? "discard" : "cancel";
};

// Authoritative unsaved-changes check: ask the renderer (it sets
// window.__strlIsDirty synchronously on every edit), falling back to main's
// mirror if the renderer is unreachable (e.g. mid-teardown).
const currentDirty = async (): Promise<boolean> => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return isDirty;
  }
  return mainWindow.webContents
    .executeJavaScript("window.__strlIsDirty === true")
    .catch(() => isDirty);
};

// New scene, prompting to save first if there are unsaved changes.
const doNew = async () => {
  if (await currentDirty()) {
    const decision = promptSaveBeforeClose();
    if (decision === "cancel") {
      return;
    }
    if (decision === "save" && !(await requestSaveScene(false)).ok) {
      return; // user canceled the save → abort New
    }
  }
  setActiveFile(null);
  sendMenu("new");
};

// ---------------------------------------------------------------------------
// Native file open/save (Phase 2)
// ---------------------------------------------------------------------------
const EXCALIDRAW_FILTER = {
  name: "STRL-Ideate scene",
  extensions: ["excalidraw"],
};

const openFileViaDialog = async () => {
  if (!mainWindow) {
    return;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [EXCALIDRAW_FILTER, { name: "All files", extensions: ["*"] }],
  });
  if (result.canceled || !result.filePaths[0]) {
    return;
  }
  openFilePath(result.filePaths[0]);
};

// Max size for an opened scene file (defensive cap).
const MAX_SCENE_BYTES = 50 * 1024 * 1024;

const openFilePath = (filePath: string) => {
  const resolved = path.resolve(filePath);
  // Buffer until the renderer has registered its open handler, otherwise the
  // IPC is silently dropped (launch / file-association race).
  if (!rendererReady || !mainWindow) {
    pendingOpenPath = resolved;
    return;
  }
  try {
    // STRL: validate the path before reading (defense-in-depth against
    // path traversal — we only ever open real .excalidraw files).
    if (path.extname(resolved).toLowerCase() !== ".excalidraw") {
      return;
    }
    const stats = fs.statSync(resolved);
    if (!stats.isFile() || stats.size > MAX_SCENE_BYTES) {
      return;
    }
    const contents = fs.readFileSync(resolved, "utf8");
    // NOTE: the active file is set only after the renderer confirms a
    // successful load (see the "strl:opened" handler), so a failed/corrupt
    // open can never make the next Save overwrite a good file with an empty
    // scene.
    mainWindow.webContents.send("strl:open-file", {
      name: path.basename(resolved, ".excalidraw"),
      contents,
      path: resolved,
    });
  } catch (error) {
    dialog.showErrorBox("Open failed", String(error));
  }
};

const flushPendingOpen = () => {
  if (pendingOpenPath) {
    const next = pendingOpenPath;
    pendingOpenPath = null;
    openFilePath(next);
  }
};

// Renderer asks main to write a file (Save / Save As / Export).
//  - scene "Save" with an active file writes in place (no dialog);
//  - "Save As", a first save, or any export shows the native Save dialog.
ipcMain.handle(
  "strl:save-file",
  async (
    _event,
    payload: {
      data: string | Uint8Array;
      suggestedName: string;
      extension: string;
      saveAs?: boolean;
    },
  ) => {
    if (!mainWindow) {
      return { ok: false, canceled: true };
    }
    const isScene = payload.extension === "excalidraw";

    // Write in place only when the active scene file still exists on disk —
    // otherwise fall through to a Save dialog instead of silently recreating a
    // file the user deleted/renamed externally.
    let targetPath: string | undefined =
      isScene &&
      !payload.saveAs &&
      activeFilePath &&
      fs.existsSync(activeFilePath)
        ? activeFilePath
        : undefined;

    if (!targetPath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `${payload.suggestedName}.${payload.extension}`,
        filters: [
          {
            name: payload.extension.toUpperCase(),
            extensions: [payload.extension],
          },
        ],
      });
      if (result.canceled || !result.filePath) {
        return { ok: false, canceled: true };
      }
      targetPath = result.filePath;
    }

    try {
      const data =
        typeof payload.data === "string"
          ? payload.data
          : Buffer.from(payload.data);
      fs.writeFileSync(targetPath, data);
      // Only scene saves change the active document; exports don't. The save is
      // side-effect-free beyond this — close/new continuations ride their own
      // requestSaveScene promise, not this handler.
      if (isScene) {
        setActiveFile(targetPath);
      }
      return { ok: true, filePath: targetPath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },
);

// Renderer reports whether the scene has unsaved changes — drives the title's
// dirty marker and the close / new prompts.
ipcMain.on("strl:set-dirty", (_event, dirty: boolean) => {
  isDirty = Boolean(dirty);
  updateTitle();
});

// Renderer has registered its handlers and is ready to receive file-opens.
ipcMain.on("strl:renderer-ready", () => {
  rendererReady = true;
  flushPendingOpen();
  broadcastRecent(); // seed the welcome-screen recents list
});

// Welcome screen asks for the recent-files list.
ipcMain.handle("strl:get-recent", () => recentFiles);

// Welcome screen asks to open a recent file. Only paths already in the recents
// list (which main itself recorded) are honoured — the renderer can't open
// arbitrary paths this way.
ipcMain.on("strl:open-recent", (_event, filePath: string) => {
  if (
    typeof filePath === "string" &&
    recentFiles.includes(path.resolve(filePath))
  ) {
    openFilePath(filePath);
  }
});

// Renderer confirms it successfully loaded an opened file → adopt it as the
// active document (title + Save target + recent files).
ipcMain.on("strl:opened", (_event, openedPath: string) => {
  if (typeof openedPath === "string") {
    setActiveFile(openedPath);
  }
});

// ---------------------------------------------------------------------------
// File-association / CLI handling
// ---------------------------------------------------------------------------
const takeFileFromArgv = (argv: string[]) => {
  const fileArg = argv.find((arg) => arg.endsWith(".excalidraw"));
  if (fileArg && fs.existsSync(fileArg)) {
    pendingOpenPath = path.resolve(fileArg);
  }
};

// macOS delivers file-open via this event.
app.on("open-file", (event, filePath) => {
  event.preventDefault();
  openFilePath(filePath); // buffers itself until the renderer is ready
});

// Single-instance: focus existing window and open the file there.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    takeFileFromArgv(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
      flushPendingOpen();
    }
  });

  takeFileFromArgv(process.argv);

  app.whenReady().then(() => {
    registerAppProtocol();
    loadRecentFiles();
    buildMenu();
    createWindow();

    // Autosave: every 20s, silently write the active file if it has unsaved
    // changes. Untitled scenes are skipped (no path → would pop a dialog), and
    // so is an active file that no longer exists on disk (don't pop a dialog or
    // resurrect a deleted file from a background timer).
    setInterval(() => {
      if (
        rendererReady &&
        isDirty &&
        activeFilePath &&
        fs.existsSync(activeFilePath) &&
        mainWindow &&
        !mainWindow.isDestroyed()
      ) {
        sendMenu("save");
      }
    }, 20_000);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}

// Harden: block navigation to remote origins and external window opens.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http:") || url.startsWith("https:")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  contents.on("will-navigate", (event, url) => {
    const allowed = DEV_URL
      ? url.startsWith(DEV_URL)
      : url.startsWith(`${APP_SCHEME}://`);
    if (!allowed) {
      event.preventDefault();
    }
  });
});
