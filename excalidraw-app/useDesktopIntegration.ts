// STRL: wires the Electron native File menu and file-open events to the
// editor, and tracks unsaved-changes ("dirty") state so main can show a file
// title and guard against losing work. No-op on the web (guarded on
// window.strlDesktop), so the web build is unaffected.
import { serializeAsJSON } from "@excalidraw/excalidraw";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { getSceneVersion } from "@excalidraw/element";
import { useEffect } from "react";

import type { ExcalidrawElement } from "@excalidraw/element/types";
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

    // ── dirty tracking ──────────────────────────────────────────────────────
    // Scene version is a hash of element versions — it only changes on real
    // content edits (not selection/scroll), so it's the right dirty signal.
    let lastSavedVersion: number | null = null;
    let lastSentDirty = false;

    const reportDirty = (dirty: boolean) => {
      if (dirty !== lastSentDirty) {
        lastSentDirty = dirty;
        desktop.setDirty(dirty);
      }
    };
    // Treat the given elements as the on-disk baseline → clean.
    const markSaved = (elements: readonly ExcalidrawElement[]) => {
      lastSavedVersion = getSceneVersion(elements);
      reportDirty(false);
    };

    const offChange = excalidrawAPI.onChange((elements) => {
      const version = getSceneVersion(elements);
      if (lastSavedVersion === null) {
        lastSavedVersion = version; // baseline from the initial (autoloaded) scene
        return;
      }
      reportDirty(version !== lastSavedVersion);
    });

    // ── save / export ───────────────────────────────────────────────────────
    const saveScene = async (saveAs: boolean) => {
      const json = serializeAsJSON(
        excalidrawAPI.getSceneElements(),
        excalidrawAPI.getAppState(),
        excalidrawAPI.getFiles(),
        "local",
      );
      const result = await desktop.saveFile({
        data: json,
        suggestedName: excalidrawAPI.getName() || "strl-ideate",
        extension: "excalidraw",
        saveAs,
      });
      if (result.ok) {
        markSaved(excalidrawAPI.getSceneElements());
      }
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
          markSaved(excalidrawAPI.getSceneElements()); // fresh scene → clean
          break;
        case "save":
          void saveScene(false);
          break;
        case "save-as":
          void saveScene(true);
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

    const handleOpenFile = async (file: {
      name: string;
      contents: string;
      path: string;
    }) => {
      try {
        const blob = new Blob([file.contents], { type: "application/json" });
        const restored = await loadFromBlob(blob, null, null);
        excalidrawAPI.updateScene(restored);
        if (restored.files) {
          excalidrawAPI.addFiles(Object.values(restored.files));
        }
        markSaved(restored.elements ?? []); // just-loaded scene matches disk
        desktop.confirmOpened(file.path); // main adopts it as the active document
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
    // Now that the open handler is registered, tell main it can deliver any
    // file requested at launch (file association / CLI). This closes the race
    // where a launch-time open would otherwise be dropped.
    desktop.ready();

    return () => {
      offMenu();
      offOpen();
      offChange();
    };
  }, [excalidrawAPI]);
};
