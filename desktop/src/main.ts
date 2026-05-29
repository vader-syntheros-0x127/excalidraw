// STRL-Ideate desktop — Electron main process.
// Wraps the built excalidraw-app SPA in a desktop window, served over a
// custom `app://` protocol so the app keeps its absolute (`/`) asset paths.
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
    return { ...DEFAULT_STATE, ...JSON.parse(fs.readFileSync(stateFilePath(), "utf8")) };
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

const registerAppProtocol = () => {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    let relative = decodeURIComponent(pathname);
    if (relative === "/" || relative === "") {
      relative = "/index.html";
    }
    // Resolve inside BUILD_DIR and guard against path traversal.
    const resolved = path.join(BUILD_DIR, relative);
    if (!resolved.startsWith(BUILD_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }
    // SPA fallback: unknown, extension-less path -> index.html
    const target =
      fs.existsSync(resolved) && fs.statSync(resolved).isFile()
        ? resolved
        : path.extname(resolved) === ""
        ? path.join(BUILD_DIR, "index.html")
        : resolved;
    return net.fetch(pathToFileURL(target).toString());
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

  // Persist size/position.
  const persist = () => mainWindow && saveWindowState(mainWindow);
  mainWindow.on("resize", persist);
  mainWindow.on("move", persist);
  mainWindow.on("close", persist);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Once the renderer is ready, deliver any file requested at launch.
  mainWindow.webContents.on("did-finish-load", async () => {
    console.log(`[strl-desktop] renderer loaded (electron ${process.versions.electron})`);
    flushPendingOpen();
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
    ...(isMac
      ? ([{ role: "appMenu" }] as MenuItemConstructorOptions[])
      : []),
    {
      label: "File",
      submenu: [
        { label: "New", accelerator: "CmdOrCtrl+N", click: () => sendMenu("new") },
        {
          label: "Open…",
          accelerator: "CmdOrCtrl+O",
          click: () => openFileViaDialog(),
        },
        { type: "separator" },
        { label: "Save", accelerator: "CmdOrCtrl+S", click: () => sendMenu("save") },
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
              detail: `Version ${app.getVersion()}\nElectron ${process.versions.electron}`,
            }),
        },
        {
          label: "Learn More",
          click: () => shell.openExternal("https://github.com/excalidraw/excalidraw"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

const openFilePath = (filePath: string) => {
  try {
    const contents = fs.readFileSync(filePath, "utf8");
    mainWindow?.webContents.send("strl:open-file", {
      name: path.basename(filePath, ".excalidraw"),
      contents,
    });
  } catch (error) {
    dialog.showErrorBox("Open failed", String(error));
  }
};

const flushPendingOpen = () => {
  if (pendingOpenPath) {
    openFilePath(pendingOpenPath);
    pendingOpenPath = null;
  }
};

// Renderer asks main to write a file (Save / Save As / Export).
ipcMain.handle(
  "strl:save-file",
  async (
    _event,
    payload: { data: string | Uint8Array; suggestedName: string; extension: string },
  ) => {
    if (!mainWindow) {
      return { ok: false, canceled: true };
    }
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${payload.suggestedName}.${payload.extension}`,
      filters: [
        { name: payload.extension.toUpperCase(), extensions: [payload.extension] },
      ],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }
    try {
      const data =
        typeof payload.data === "string"
          ? payload.data
          : Buffer.from(payload.data);
      fs.writeFileSync(result.filePath, data);
      return { ok: true, filePath: result.filePath };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  },
);

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
  if (mainWindow) {
    openFilePath(filePath);
  } else {
    pendingOpenPath = filePath;
  }
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
    buildMenu();
    createWindow();

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
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(`${APP_SCHEME}://`);
    if (!allowed) {
      event.preventDefault();
    }
  });
});
