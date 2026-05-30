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

import { resolveScene, sceneToExportBytes } from "./components/strlExport";

export const useDesktopIntegration = (
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) => {
  useEffect(() => {
    const desktop = window.strlDesktop;
    if (!desktop || !excalidrawAPI) {
      return;
    }

    // ── dirty tracking ──────────────────────────────────────────────────────
    // Subscribe to store *increments* and act only on DURABLE ones (real edits),
    // not ephemeral ones (pointer/selection/scroll) — so we don't recompute the
    // scene version on every mouse move. The baseline is computed over the SAME
    // element set the comparison uses: getSceneElementsIncludingDeleted (which
    // is what an increment reflects), so a scene that merely contains a deleted
    // element is not perpetually marked dirty.
    let lastSavedVersion: number | null = null;
    let lastSentDirty = false;

    const reportDirty = (dirty: boolean) => {
      // Synchronous authoritative flag read by main's window-close guard.
      window.__strlIsDirty = dirty;
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

    const offIncrement = excalidrawAPI.onIncrement((event) => {
      if (event.type !== "durable") {
        return; // ignore ephemeral changes (selection, pointer, scroll)
      }
      const version = getSceneVersion(
        excalidrawAPI.getSceneElementsIncludingDeleted(),
      );
      if (lastSavedVersion === null) {
        lastSavedVersion = version; // seed from the first durable change (autoload)
        return;
      }
      reportDirty(version !== lastSavedVersion);
    });

    // ── save / export ───────────────────────────────────────────────────────
    // Returns whether the save actually wrote (false on cancel/error) so the
    // close/new flow in main can await it.
    const saveScene = async (saveAs: boolean): Promise<{ ok: boolean }> => {
      // Snapshot the dirty baseline BEFORE the (async) save dialog so edits made
      // while the dialog is open aren't mistaken for already-saved content.
      const baseline = excalidrawAPI.getSceneElementsIncludingDeleted();
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
        markSaved(baseline);
      }
      return { ok: Boolean(result.ok) };
    };

    const exportScene = async (format: "png" | "svg" | "pdf") => {
      const scene = resolveScene(excalidrawAPI);
      if (!scene) {
        return;
      }
      const { data, extension } = await sceneToExportBytes(scene, format);
      await desktop.saveFile({ data, suggestedName: scene.name, extension });
    };

    const handleMenu = (action: StrlMenuAction) => {
      switch (action) {
        case "new":
          excalidrawAPI.resetScene();
          markSaved(excalidrawAPI.getSceneElementsIncludingDeleted()); // fresh → clean
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
        // Adopt the active document at the commit point — right after the scene
        // is on screen, BEFORE addFiles/markSaved — so a later failure can't
        // leave main pointing at the previous file (a Save would clobber it).
        desktop.confirmOpened(file.path);
        if (restored.files) {
          excalidrawAPI.addFiles(Object.values(restored.files));
        }
        markSaved(excalidrawAPI.getSceneElementsIncludingDeleted()); // just-loaded → clean
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
    // Awaitable save round-trip: main asks us to save and we report the result
    // back by token, so close/new can `await` a real save instead of relying on
    // a fire-and-forget flag handshake.
    const offSaveReq = desktop.onSaveAndReport(async ({ token, saveAs }) => {
      desktop.reportSaveDone(token, await saveScene(saveAs));
    });
    // Now that handlers are registered, tell main it can deliver any file
    // requested at launch (file association / CLI) — closes the dropped-IPC race.
    desktop.ready();

    return () => {
      offMenu();
      offOpen();
      offSaveReq();
      offIncrement();
      window.__strlIsDirty = false;
    };
  }, [excalidrawAPI]);
};
