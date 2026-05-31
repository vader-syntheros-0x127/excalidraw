// STRL: deterministic, DOM-free scene builder/editor. Reuses the library's
// convertToExcalidrawElements (skeleton -> full elements with bindings/labels)
// so engine output is byte-compatible with what the app authors.
import { convertToExcalidrawElements } from "@excalidraw/element/transform";

import type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
import type {
  ExcalidrawElement,
  ExcalidrawImageElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { registerNodeTextMetrics } from "./textMetrics";

import type { AuthoringScene, ElementQuery, ElementSummary } from "./types";

const DEFAULT_APP_STATE: Partial<AppState> = {
  viewBackgroundColor: "#ffffff",
};

const emptyScene = (): AuthoringScene => ({
  elements: [],
  appState: { ...DEFAULT_APP_STATE },
  files: {},
});

/** Create a new scene, optionally seeded from a skeleton. */
export const createScene = (opts?: {
  skeleton?: ExcalidrawElementSkeleton[];
  appState?: Partial<AppState>;
  files?: BinaryFiles;
}): AuthoringScene => {
  registerNodeTextMetrics();
  const scene = emptyScene();
  if (opts?.appState) {
    scene.appState = { ...DEFAULT_APP_STATE, ...opts.appState };
  }
  if (opts?.files) {
    scene.files = { ...opts.files };
  }
  if (opts?.skeleton?.length) {
    scene.elements = [
      ...convertToExcalidrawElements(opts.skeleton, { regenerateIds: true }),
    ];
  }
  return scene;
};

/** Append shapes (from a skeleton) to an existing scene. */
export const addShapes = (
  scene: AuthoringScene,
  skeleton: ExcalidrawElementSkeleton[],
): AuthoringScene => {
  registerNodeTextMetrics();
  const added = convertToExcalidrawElements(skeleton, { regenerateIds: true });
  return { ...scene, elements: [...scene.elements, ...added] };
};

/** Embed an image file and place it on the canvas. */
export const addImage = (
  scene: AuthoringScene,
  file: BinaryFileData,
  placement: { x: number; y: number; width?: number; height?: number },
): AuthoringScene => {
  registerNodeTextMetrics();
  const skeleton: ExcalidrawElementSkeleton[] = [
    {
      type: "image",
      fileId: file.id,
      status: "saved",
      x: placement.x,
      y: placement.y,
      width: placement.width ?? 200,
      height: placement.height ?? 200,
    } as Partial<ExcalidrawImageElement> & {
      type: "image";
      fileId: typeof file.id;
      x: number;
      y: number;
    },
  ];
  const [imageElement] = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  });
  return {
    ...scene,
    elements: [...scene.elements, imageElement],
    files: { ...scene.files, [file.id]: file },
  };
};

const matchesQuery = (
  element: ExcalidrawElement,
  query: ElementQuery,
): boolean => {
  if (query.id !== undefined && element.id !== query.id) {
    return false;
  }
  if (query.type !== undefined && element.type !== query.type) {
    return false;
  }
  if (query.text !== undefined) {
    const text = (element as ExcalidrawTextElement).text;
    if (
      typeof text !== "string" ||
      !text.toLowerCase().includes(query.text.toLowerCase())
    ) {
      return false;
    }
  }
  return true;
};

// Bump version metadata so the app treats a mutated element as changed on load.
const touch = (element: ExcalidrawElement): ExcalidrawElement => ({
  ...element,
  version: (element.version ?? 1) + 1,
  versionNonce: Math.floor(Math.random() * 2 ** 31),
  updated: Date.now(),
});

/** Mutate every element matching the query; returns a new scene. */
export const editElements = (
  scene: AuthoringScene,
  query: ElementQuery,
  mutate: (element: ExcalidrawElement) => Partial<ExcalidrawElement>,
): { scene: AuthoringScene; matched: number } => {
  let matched = 0;
  const elements = scene.elements.map((element) => {
    if (!matchesQuery(element, query)) {
      return element;
    }
    matched += 1;
    return touch({ ...element, ...mutate(element) } as ExcalidrawElement);
  });
  return { scene: { ...scene, elements }, matched };
};

/** Remove every element matching the query (hard delete); returns a new scene. */
export const deleteElements = (
  scene: AuthoringScene,
  query: ElementQuery,
): { scene: AuthoringScene; deleted: number } => {
  const kept: ExcalidrawElement[] = [];
  let deleted = 0;
  for (const element of scene.elements) {
    if (matchesQuery(element, query)) {
      deleted += 1;
    } else {
      kept.push(element);
    }
  }
  return { scene: { ...scene, elements: kept }, deleted };
};

/** Compact projection of the scene for an LLM to reason about before editing. */
export const getSceneSummary = (scene: AuthoringScene): ElementSummary[] =>
  scene.elements
    .filter((element) => !element.isDeleted)
    .map((element) => {
      const boundElementIds = (element.boundElements ?? []).map((b) => b.id);
      const text = (element as ExcalidrawTextElement).text;
      return {
        id: element.id,
        type: element.type,
        ...(typeof text === "string" && text ? { text } : {}),
        x: Math.round(element.x),
        y: Math.round(element.y),
        width: Math.round(element.width),
        height: Math.round(element.height),
        ...(boundElementIds.length ? { boundElementIds } : {}),
      };
    });
