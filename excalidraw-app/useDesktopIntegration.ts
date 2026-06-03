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

    // Load a serialized scene onto the canvas and reset the dirty baseline so the
    // reload doesn't register as an unsaved edit. `onApplied` runs right after the
    // scene is on screen (used by open to confirm the active document before
    // addFiles), so a later failure can't leave main pointing at the wrong file.
    const applyScene = async (contents: string, onApplied?: () => void) => {
      const blob = new Blob([contents], { type: "application/json" });
      // STRL: theme is a per-VIEWER setting (appState `export: false`), so it is
      // never stored in a .excalidraw file. loadFromBlob therefore falls back to
      // the package default (light), and updateScene would apply it — flipping
      // the editor from the app's dark default to light on every open/reload.
      // Preserve the editor's current theme so opening a scene keeps it.
      const currentTheme = excalidrawAPI.getAppState().theme;
      const restored = await loadFromBlob(blob, null, null);
      restored.appState.theme = currentTheme;
      excalidrawAPI.updateScene(restored);
      onApplied?.();
      if (restored.files) {
        excalidrawAPI.addFiles(Object.values(restored.files));
      }
      markSaved(excalidrawAPI.getSceneElementsIncludingDeleted()); // just-loaded → clean
    };

    const handleOpenFile = async (file: {
      name: string;
      contents: string;
      path: string;
    }) => {
      try {
        await applyScene(file.contents, () => desktop.confirmOpened(file.path));
      } catch (error) {
        excalidrawAPI.setToast({
          message: "Failed to open file",
          duration: 3000,
        });

        console.error("STRL desktop open failed", error);
      }
    };

    // STRL: live reload when an external tool (e.g. the MCP server) rewrites the
    // active file. main only sends this when it's safe (scene clean, or the user
    // chose "Reload" at the conflict prompt) — so we apply it without re-confirming
    // the active document (it's unchanged).
    const handleExternalChange = async (file: {
      name: string;
      contents: string;
      path: string;
    }) => {
      try {
        await applyScene(file.contents);
      } catch (error) {
        excalidrawAPI.setToast({
          message: "Failed to reload external change",
          duration: 3000,
        });

        console.error("STRL desktop external reload failed", error);
      }
    };

    const handleExternalRemoved = (info: { name: string }) => {
      excalidrawAPI.setToast({
        message: `"${info.name}" was removed on disk — Save to recreate it`,
        duration: 4000,
      });
    };

    const offMenu = desktop.onMenu(handleMenu);
    const offOpen = desktop.onOpenFile(handleOpenFile);
    // Awaitable save round-trip: main asks us to save and we report the result
    // back by token, so close/new can `await` a real save instead of relying on
    // a fire-and-forget flag handshake.
    const offSaveReq = desktop.onSaveAndReport(async ({ token, saveAs }) => {
      desktop.reportSaveDone(token, await saveScene(saveAs));
    });
    const offExternalChange = desktop.onExternalChange(handleExternalChange);
    const offExternalRemoved = desktop.onExternalRemoved(handleExternalRemoved);
    // Now that handlers are registered, tell main it can deliver any file
    // requested at launch (file association / CLI) — closes the dropped-IPC race.
    desktop.ready();

    return () => {
      offMenu();
      offOpen();
      offSaveReq();
      offExternalChange();
      offExternalRemoved();
      offIncrement();
      window.__strlIsDirty = false;
    };
  }, [excalidrawAPI]);
};
