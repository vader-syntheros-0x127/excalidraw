// STRL: mirror the internal-package pattern so the @excalidraw source pulled in
// during typecheck sees the same ambient augmentations the root build provides
// (Window.EXCALIDRAW_*, Blob.name/handle, csstype custom props, vendor modules).
/// <reference types="vite/client" />
import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";
