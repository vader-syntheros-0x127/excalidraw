// STRL: DOM-free (de)serialization.
//
// We deliberately do NOT import @excalidraw/excalidraw/data/json: that module also
// re-exports loadFromBlob/fileOpen, which drag the entire browser render/export
// graph (scene/export -> staticScene -> hyperlink does `document.createElement` at
// module load) into a Node bundle. serializeAsJSON itself is tiny, so we reproduce
// it here from its lightweight parts. Output stays byte-shape-compatible with the
// app's save (excalidraw-app/useDesktopIntegration.ts).
//
// For reads we use restoreElements (NOT loadFromBlob, which is browser-only:
// FileReader/atob) — the DOM-free equivalent. It re-measures text via the Node
// metrics provider and repairs bindings/dimensions.
import { EXPORT_DATA_TYPES, VERSIONS } from "@excalidraw/common";
import { cleanAppStateForExport } from "@excalidraw/excalidraw/appState";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { registerNodeTextMetrics } from "./textMetrics";

import type { AuthoringScene } from "./types";

// Source tag for engine-authored files (avoids getExportSource()'s window ref).
const STRL_EXPORT_SOURCE = "strl-ideate:@strl/authoring";

// Mirror of json.ts:filterOutDeletedFiles — keep only files referenced by a live element.
const filterOutDeletedFiles = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): BinaryFiles => {
  const next: BinaryFiles = {};
  for (const element of elements) {
    const fileId = (element as { fileId?: string }).fileId;
    if (!element.isDeleted && fileId && files[fileId]) {
      next[fileId] = files[fileId];
    }
  }
  return next;
};

/** Serialize a scene to a `.excalidraw` JSON string (files embedded inline). */
export const serializeScene = (scene: AuthoringScene): string => {
  const data = {
    type: EXPORT_DATA_TYPES.excalidraw,
    version: VERSIONS.excalidraw,
    source: STRL_EXPORT_SOURCE,
    elements: scene.elements,
    appState: cleanAppStateForExport(scene.appState),
    files: filterOutDeletedFiles(scene.elements, scene.files),
  };
  return JSON.stringify(data, null, 2);
};

/** Parse a `.excalidraw` JSON string into a scene, repairing + re-measuring. */
export const parseSceneFile = (json: string): AuthoringScene => {
  registerNodeTextMetrics();
  const data = JSON.parse(json);
  if (
    data?.type !== EXPORT_DATA_TYPES.excalidraw ||
    (data.elements && !Array.isArray(data.elements))
  ) {
    throw new Error("Not a valid Excalidraw file (expected type 'excalidraw')");
  }
  const elements = restoreElements(
    (data.elements ?? null) as ExcalidrawElement[] | null,
    null,
    { refreshDimensions: true, repairBindings: true },
  );
  return {
    elements: [...elements] as ExcalidrawElement[],
    appState: (data.appState ?? {}) as Partial<AppState>,
    files: (data.files ?? {}) as BinaryFiles,
  };
};
