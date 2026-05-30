// STRL: types for the desktop preload bridge (window.strlDesktop). Present
// only when running inside the Electron shell; undefined on the web.
type StrlMenuAction =
  | "new"
  | "save"
  | "save-as"
  | "export-png"
  | "export-svg"
  | "export-pdf";

interface StrlDesktopApi {
  isDesktop: true;
  platform: string;
  onMenu: (handler: (action: StrlMenuAction) => void) => () => void;
  onOpenFile: (
    handler: (file: { name: string; contents: string; path: string }) => void,
  ) => () => void;
  ready: () => void;
  confirmOpened: (filePath: string) => void;
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
  setDirty: (dirty: boolean) => void;
  getRecentFiles: () => Promise<string[]>;
  onRecentFiles: (handler: (files: string[]) => void) => () => void;
  openRecent: (filePath: string) => void;
  onSaveAndReport: (
    handler: (req: { token: string; saveAs: boolean }) => void,
  ) => () => void;
  reportSaveDone: (token: string, result: { ok: boolean }) => void;
}

interface Window {
  strlDesktop?: StrlDesktopApi;
  // STRL desktop: synchronous unsaved-changes flag the main process reads at
  // window-close time (set by useDesktopIntegration on every dirty change).
  __strlIsDirty?: boolean;
}
