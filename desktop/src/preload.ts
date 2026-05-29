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
    handler: (file: { name: string; contents: string }) => void,
  ) => () => void;
  /** Show a native Save dialog and write the data. */
  saveFile: (payload: {
    data: string | Uint8Array;
    suggestedName: string;
    extension: string;
  }) => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }>;
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
    const listener = (_e: unknown, file: { name: string; contents: string }) =>
      handler(file);
    ipcRenderer.on("strl:open-file", listener);
    return () => ipcRenderer.removeListener("strl:open-file", listener);
  },
  saveFile: (payload) => ipcRenderer.invoke("strl:save-file", payload),
};

contextBridge.exposeInMainWorld("strlDesktop", api);
