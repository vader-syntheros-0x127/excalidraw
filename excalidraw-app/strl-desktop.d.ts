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
    handler: (file: { name: string; contents: string }) => void,
  ) => () => void;
  saveFile: (payload: {
    data: string | Uint8Array;
    suggestedName: string;
    extension: string;
  }) => Promise<{
    ok: boolean;
    canceled?: boolean;
    filePath?: string;
    error?: string;
  }>;
}

interface Window {
  strlDesktop?: StrlDesktopApi;
}
