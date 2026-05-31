// STRL: MCP tool definitions (JSON Schema input). Kept declarative; dispatch lives
// in server.ts. Skeletons are typed loosely (array of objects) because the full
// ExcalidrawElementSkeleton union is large — convertToExcalidrawElements validates.
const fileProp = {
  file: {
    type: "string",
    description:
      "Target .excalidraw file, relative to the workspace. Defaults to the active file.",
  },
} as const;

const skeletonProp = {
  type: "array",
  description:
    "Excalidraw element skeletons. Each item has `type` (rectangle|diamond|ellipse|text|arrow|line|image|frame) and x,y. Shapes accept `label:{text}`; arrows accept `start`/`end` bindings (by element id or inline shape); text needs `text`.",
  items: { type: "object" },
} as const;

const query = {
  type: "object",
  description: "Match elements by id, type, and/or text substring.",
  properties: {
    id: { type: "string" },
    type: { type: "string" },
    text: { type: "string" },
  },
} as const;

export const TOOL_DEFS = [
  {
    name: "create_scene",
    description:
      "Create a NEW Excalidraw scene, overwriting the target file. Provide elements as a skeleton array.",
    inputSchema: {
      type: "object",
      properties: { skeleton: skeletonProp, ...fileProp },
    },
  },
  {
    name: "add_shapes",
    description: "Append shapes (a skeleton array) to the scene.",
    inputSchema: {
      type: "object",
      properties: { skeleton: skeletonProp, ...fileProp },
      required: ["skeleton"],
    },
  },
  {
    name: "add_image",
    description:
      "Embed an image at (x,y) from a local file under the workspace, or a data URL.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "image path under the workspace" },
        dataURL: { type: "string", description: "data:<mime>;base64,... URL" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        ...fileProp,
      },
      required: ["x", "y"],
    },
  },
  {
    name: "edit_elements",
    description:
      "Assign properties to every element matching a query (e.g. set backgroundColor/strokeColor/x/y).",
    inputSchema: {
      type: "object",
      properties: {
        query,
        set: {
          type: "object",
          description: "Properties to assign to matched elements.",
        },
        ...fileProp,
      },
      required: ["query", "set"],
    },
  },
  {
    name: "delete_elements",
    description: "Delete every element matching a query.",
    inputSchema: {
      type: "object",
      properties: { query, ...fileProp },
      required: ["query"],
    },
  },
  {
    name: "get_scene",
    description:
      "Return a compact summary (id, type, text, position, size) of the scene's elements.",
    inputSchema: { type: "object", properties: { ...fileProp } },
  },
  {
    name: "generate_image",
    description:
      "Generate an image from a text prompt via the configured image endpoint and embed it at (x,y). Disabled unless STRL_MCP_IMAGE_ENDPOINT is set.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        ...fileProp,
      },
      required: ["prompt", "x", "y"],
    },
  },
] as const;
