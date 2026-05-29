// STRL: wires the Electron native File menu and file-open events to the
// editor. No-op on the web (guarded on window.strlDesktop), so the web build
// is unaffected.
import { serializeAsJSON } from "@excalidraw/excalidraw";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  resolveScene,
  sceneToPngBlob,
  sceneToSvgString,
  sceneToPdfBytes,
} from "./components/strlExport";

export const useDesktopIntegration = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  useEffect(() => {
    const desktop = window.strlDesktop;
    if (!desktop || !excalidrawAPI) {
      return;
    }

    const saveScene = async () => {
      const json = serializeAsJSON(
        excalidrawAPI.getSceneElements(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
        "local",
      );
      await desktop.saveFile({
        data: json,
        suggestedName: excalidrawAPI.getName() || "strl-ideate",
        extension: "excalidraw",
      });
    };

    const exportScene = async (format: "png" | "svg" | "pdf") => {
      const scene = resolveScene(excalidrawAPI);
      if (!scene) {
        return;
      }
      if (format === "png") {
        const bytes = new Uint8Array(
          await (await sceneToPngBlob(scene)).arrayBuffer(),
        );
        await desktop.saveFile({
          data: bytes,
          suggestedName: scene.name,
          extension: "png",
        });
      } else if (format === "svg") {
        await desktop.saveFile({
          data: await sceneToSvgString(scene),
          suggestedName: scene.name,
          extension: "svg",
        });
      } else {
        await desktop.saveFile({
          data: await sceneToPdfBytes(scene),
          suggestedName: scene.name,
          extension: "pdf",
        });
      }
    };

    const handleMenu = (action: StrlMenuAction) => {
      switch (action) {
        case "new":
          excalidrawAPI.resetScene();
          break;
        case "save":
        case "save-as":
          void saveScene();
          break;
        case "export-png":
          void exportScene("png");
          break;
        case "export-svg":
          void exportScene("svg");
          break;
        case "export-pdf":
          void exportScene("pdf");
          break;
        default:
          break;
      }
    };

    const handleOpenFile = async (file: { name: string; contents: string }) => {
      try {
        const blob = new Blob([file.contents], { type: "application/json" });
        const restored = await loadFromBlob(blob, null, null);
        excalidrawAPI.updateScene(restored);
        if (restored.files) {
          excalidrawAPI.addFiles(Object.values(restored.files));
        }
      } catch (error) {
        excalidrawAPI.setToast({
          message: "Failed to open file",
          duration: 3000,
        });
        // eslint-disable-next-line no-console
        console.error("STRL desktop open failed", error);
      }
    };

    const offMenu = desktop.onMenu(handleMenu);
    const offOpen = desktop.onOpenFile(handleOpenFile);

    return () => {
      offMenu();
      offOpen();
    };
  }, [excalidrawAPI]);
};
