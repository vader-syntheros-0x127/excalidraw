// STRL: @strl/authoring — DOM-free engine to build/edit Excalidraw scenes in Node.
// See docs/STRL-CUSTOMIZATIONS.md for the headless-metrics design.
export { registerNodeTextMetrics } from "./textMetrics";
export {
  createScene,
  addShapes,
  addImage,
  editElements,
  deleteElements,
  getSceneSummary,
} from "./scene";
export { serializeScene, parseSceneFile } from "./io";
export { binaryFileFromDataURL } from "./files";

export type { AuthoringScene, ElementQuery, ElementSummary } from "./types";

// Re-export the skeleton type so consumers (the MCP server) author against the
// same contract the library uses.
export type { ExcalidrawElementSkeleton } from "@excalidraw/element/transform";
