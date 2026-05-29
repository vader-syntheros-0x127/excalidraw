// STRL: shared export helpers used by both the on-canvas export button and
// the desktop app's native File ▸ Export menu. PNG/SVG reuse the library's
// own export utilities; PDF is rendered on top via jsPDF (raster).
import {
  exportToBlob,
  exportToSvg,
  exportToCanvas,
} from "@excalidraw/excalidraw";
import { jsPDF } from "jspdf";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export type StrlScene = {
  elements: ReturnType<ExcalidrawImperativeAPI["getSceneElements"]>;
  appState: ReturnType<ExcalidrawImperativeAPI["getAppState"]>;
  files: ReturnType<ExcalidrawImperativeAPI["getFiles"]>;
  name: string;
};

/** Pull the current scene from the editor; null (with a toast) if empty. */
export const resolveScene = (
  api: ExcalidrawImperativeAPI,
): StrlScene | null => {
  const elements = api.getSceneElements();
  if (!elements.length) {
    api.setToast({ message: "Nothing to export", duration: 2000 });
    return null;
  }
  return {
    elements,
    appState: api.getAppState(),
    files: api.getFiles(),
    name: api.getName() || "strl-ideate",
  };
};

export const sceneToPngBlob = (scene: StrlScene): Promise<Blob> =>
  exportToBlob({
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files,
    mimeType: "image/png",
  });

export const sceneToSvgString = async (scene: StrlScene): Promise<string> => {
  const svg = await exportToSvg({
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files,
  });
  return new XMLSerializer().serializeToString(svg);
};

export const sceneToPdfBytes = async (
  scene: StrlScene,
): Promise<Uint8Array> => {
  const canvas = await exportToCanvas({
    elements: scene.elements,
    appState: scene.appState,
    files: scene.files,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
    hotfixes: ["px_scaling"],
  });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  return new Uint8Array(pdf.output("arraybuffer"));
};

/** Browser download (used by the web/on-canvas export button). */
export const triggerDownload = (
  data: Blob | string | Uint8Array,
  filename: string,
  mimeType: string,
) => {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
