// STRL-Ideate desktop — preload bridge.
// Exposes a minimal, typed API to the renderer via contextBridge. No Node
// internals leak to the page (contextIsolation + sandbox stay on).
import { contextBridge, ipcRenderer } from "electron";

type MenuAction =
  | "new"
  | "save"
  | "save-as"
  | "export-png"
  | "export-svg"
  | "export-pdf";

export type StrlDesktopApi = {
  isDesktop: true;
  platform: NodeJS.Platform;
  /** Subscribe to native menu actions. Returns an unsubscribe fn. */
  onMenu: (handler: (action: MenuAction) => void) => () => void;
  /** Subscribe to "open this file" events (CLI / file association / Open…). */
  onOpenFile: (
    handler: (file: { name: string; contents: string; path: string }) => void,
  ) => () => void;
  /** Tell main the renderer is mounted and ready to receive file-opens. */
  ready: () => void;
  /** Confirm a file was loaded OK so main can adopt it as the active document. */
  confirmOpened: (filePath: string) => void;
  /**
   * Save data to disk. For a scene ("excalidraw") with an already-open file and
   * saveAs !== true, main writes in place silently; otherwise a native Save
   * dialog is shown. Exports always prompt.
   */
  saveFile: (payload: {
    data: string | Uint8Array;
    suggestedName: string;
    extension: string;
    saveAs?: boolean;
  }) => Promise<{
    ok: boolean;
    canceled?: boolean;
    filePath?: string;
    error?: string;
  }>;
  /** Report whether the scene has unsaved changes (title marker + close guard). */
  setDirty: (dirty: boolean) => void;
  /** Fetch the recent-files list (absolute paths, newest first). */
  getRecentFiles: () => Promise<string[]>;
  /** Subscribe to recent-files updates (drives the welcome-screen list). */
  onRecentFiles: (handler: (files: string[]) => void) => () => void;
  /** Open a file from the recents list. */
  openRecent: (filePath: string) => void;
  /** main asks the renderer to save and report the result back by token. */
  onSaveAndReport: (
    handler: (req: { token: string; saveAs: boolean }) => void,
  ) => () => void;
  /** Report a requested save's result back to main (resolves requestSaveScene). */
  reportSaveDone: (token: string, result: { ok: boolean }) => void;
  /**
   * Subscribe to live external changes to the active file (e.g. an AI/MCP tool
   * rewrote it on disk). main only sends this when it's safe to apply: the scene
   * is clean, or the user chose "Reload" at the conflict prompt.
   */
  onExternalChange: (
    handler: (file: { name: string; contents: string; path: string }) => void,
  ) => () => void;
  /** Subscribe to the active file being deleted/renamed away on disk. */
  onExternalRemoved: (handler: (info: { name: string }) => void) => () => void;
  /** Set the http(s) origins the CSP should allow for AI endpoints (empty = strict). */
  setAiOrigins: (origins: string[]) => void;
};

const api: StrlDesktopApi = {
  isDesktop: true,
  platform: process.platform,
  onMenu: (handler) => {
    const listener = (_e: unknown, action: MenuAction) => handler(action);
    ipcRenderer.on("strl:menu", listener);
    return () => ipcRenderer.removeListener("strl:menu", listener);
  },
  onOpenFile: (handler) => {
    const listener = (
      _e: unknown,
      file: { name: string; contents: string; path: string },
    ) => handler(file);
    ipcRenderer.on("strl:open-file", listener);
    return () => ipcRenderer.removeListener("strl:open-file", listener);
  },
  saveFile: (payload) => ipcRenderer.invoke("strl:save-file", payload),
  setDirty: (dirty) => ipcRenderer.send("strl:set-dirty", dirty),
  ready: () => ipcRenderer.send("strl:renderer-ready"),
  confirmOpened: (filePath) => ipcRenderer.send("strl:opened", filePath),
  getRecentFiles: () => ipcRenderer.invoke("strl:get-recent"),
  onRecentFiles: (handler) => {
    const listener = (_e: unknown, files: string[]) => handler(files);
    ipcRenderer.on("strl:recent-files", listener);
    return () => ipcRenderer.removeListener("strl:recent-files", listener);
  },
  openRecent: (filePath) => ipcRenderer.send("strl:open-recent", filePath),
  onSaveAndReport: (handler) => {
    const listener = (_e: unknown, req: { token: string; saveAs: boolean }) =>
      handler(req);
    ipcRenderer.on("strl:save-and-report", listener);
    return () => ipcRenderer.removeListener("strl:save-and-report", listener);
  },
  reportSaveDone: (token, result) =>
    ipcRenderer.send(`strl:save-done:${token}`, result),
  onExternalChange: (handler) => {
    const listener = (
      _e: unknown,
      file: { name: string; contents: string; path: string },
    ) => handler(file);
    ipcRenderer.on("strl:external-change", listener);
    return () => ipcRenderer.removeListener("strl:external-change", listener);
  },
  onExternalRemoved: (handler) => {
    const listener = (_e: unknown, info: { name: string }) => handler(info);
    ipcRenderer.on("strl:external-removed", listener);
    return () => ipcRenderer.removeListener("strl:external-removed", listener);
  },
  setAiOrigins: (origins) => ipcRenderer.send("strl:set-ai-origins", origins),
};

contextBridge.exposeInMainWorld("strlDesktop", api);
