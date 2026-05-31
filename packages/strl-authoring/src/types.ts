// STRL: shared types for the headless authoring engine.
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

/**
 * An in-memory Excalidraw scene the engine builds/edits and (de)serializes.
 * Shape mirrors what serializeAsJSON / the app's save produces.
 */
export interface AuthoringScene {
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

/** Predicate for locating elements in edit/delete operations. */
export interface ElementQuery {
  /** exact element id */
  id?: string;
  /** exact element type, e.g. "rectangle" | "text" | "arrow" */
  type?: ExcalidrawElement["type"];
  /** case-insensitive substring match against a text element's content */
  text?: string;
}

/** Compact projection of a scene so an LLM can reason about what to edit. */
export interface ElementSummary {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  boundElementIds?: string[];
}
