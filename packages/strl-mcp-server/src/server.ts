// STRL: the MCP server. Low-level Server API (no zod authoring) exposing the
// authoring engine's operations as tools over stdio. Each mutating tool loads the
// target scene, applies an engine op, writes atomically, and returns a fresh
// summary so the LLM can see the result.
import path from "node:path";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  addImage,
  addShapes,
  binaryFileFromDataURL,
  createScene,
  deleteElements,
  editElements,
  getSceneSummary,
} from "@strl/authoring";

import type {
  AuthoringScene,
  ElementQuery,
  ExcalidrawElementSkeleton,
} from "@strl/authoring";

import {
  loadExisting,
  loadOrEmpty,
  resolveTarget,
  writeSceneAtomic,
} from "./fileStore";
import { generateImageDataURL } from "./generateImage";
import { loadImageDataURL } from "./image";
import { TOOL_DEFS } from "./tools";

type Args = Record<string, unknown>;

const textResult = (payload: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
});

const summarize = (
  target: string,
  scene: AuthoringScene,
  extra: Record<string, unknown> = {},
) =>
  textResult({
    file: path.basename(target),
    elementCount: scene.elements.length,
    ...extra,
    elements: getSceneSummary(scene),
  });

const placement = (args: Args) => ({
  x: Number(args.x),
  y: Number(args.y),
  width: args.width === undefined ? undefined : Number(args.width),
  height: args.height === undefined ? undefined : Number(args.height),
});

const dispatch = async (name: string, args: Args) => {
  const target = resolveTarget(args.file as string | undefined);

  switch (name) {
    case "create_scene": {
      const scene = createScene({
        skeleton: (args.skeleton ?? []) as ExcalidrawElementSkeleton[],
      });
      const { bytes } = writeSceneAtomic(target, scene);
      return summarize(target, scene, { created: true, bytes });
    }

    case "add_shapes": {
      const scene = addShapes(
        loadOrEmpty(target),
        (args.skeleton ?? []) as ExcalidrawElementSkeleton[],
      );
      writeSceneAtomic(target, scene);
      return summarize(target, scene, { added: true });
    }

    case "add_image": {
      const dataURL = loadImageDataURL({
        path: args.path as string | undefined,
        dataURL: args.dataURL as string | undefined,
        mimeType: args.mimeType as string | undefined,
      });
      const file = binaryFileFromDataURL(dataURL);
      const scene = addImage(loadOrEmpty(target), file, placement(args));
      writeSceneAtomic(target, scene);
      return summarize(target, scene, { imageAdded: file.id });
    }

    case "edit_elements": {
      const set = (args.set ?? {}) as Record<string, unknown>;
      const { scene, matched } = editElements(
        loadExisting(target),
        (args.query ?? {}) as ElementQuery,
        () => set as never,
      );
      writeSceneAtomic(target, scene);
      return summarize(target, scene, { matched });
    }

    case "delete_elements": {
      const { scene, deleted } = deleteElements(
        loadExisting(target),
        (args.query ?? {}) as ElementQuery,
      );
      writeSceneAtomic(target, scene);
      return summarize(target, scene, { deleted });
    }

    case "get_scene": {
      return summarize(target, loadExisting(target));
    }

    case "generate_image": {
      const dataURL = await generateImageDataURL(String(args.prompt ?? ""));
      const file = binaryFileFromDataURL(dataURL);
      const scene = addImage(loadOrEmpty(target), file, placement(args));
      writeSceneAtomic(target, scene);
      return summarize(target, scene, { imageGenerated: file.id });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

export const createStrlServer = (): Server => {
  const server = new Server(
    { name: "strl-ideate", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFS as unknown as Array<{
      name: string;
      description: string;
      inputSchema: object;
    }>,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      return await dispatch(name, (args ?? {}) as Args);
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  return server;
};
