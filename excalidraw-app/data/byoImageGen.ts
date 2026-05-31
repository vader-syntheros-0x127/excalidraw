// STRL: BYO AI image generation for the in-app panel. Calls the user-configured
// OpenAI-Images-compatible endpoint (gpt-image-1 / dall-e-3 / a local proxy),
// gets a base64 PNG back, and inserts it as a real, editable image element.
//
// Local-first stays the default: this only runs when the user has configured an
// image endpoint+model in AI settings, and on desktop the strict CSP only allows
// the configured image origin (see aiAllowedOrigins / setAiOrigins). The key is
// stored locally and sent only to that endpoint; the image is embedded as a data
// URL in the scene (no external references that would phone home on reopen).
import { convertToExcalidrawElements } from "@excalidraw/element/transform";
import { RequestError } from "@excalidraw/excalidraw/errors";

import type { FileId } from "@excalidraw/element/types";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

export interface ByoImageOptions {
  endpoint: string;
  apiKey?: string;
  model: string;
  prompt: string;
  /** OpenAI image size, e.g. "1024x1024"; endpoint-dependent. */
  size?: string;
  signal?: AbortSignal;
}

export interface GeneratedImage {
  dataURL: string;
  mimeType: "image/png";
}

/** Request a base64 PNG from an OpenAI-Images-compatible endpoint. */
export const generateImage = async ({
  endpoint,
  apiKey,
  model,
  prompt,
  size,
  signal,
}: ByoImageOptions): Promise<GeneratedImage> => {
  // STRL: only ever fetch an http(s) endpoint — never file:/data:/etc.
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new RequestError({
      message: "Image endpoint must be an http(s) URL.",
      status: 0,
    });
  }
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: size || "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new RequestError({
      message: detail || `Image request failed (${response.status})`,
      status: response.status,
    });
  }

  const json = await response.json().catch(() => null);
  const b64: string | undefined = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new RequestError({
      message:
        "Image endpoint returned no base64 image. Use a model that returns " +
        "b64_json (e.g. gpt-image-1 / dall-e-3 with response_format=b64_json).",
      status: 502,
    });
  }
  return { dataURL: `data:image/png;base64,${b64}`, mimeType: "image/png" };
};

// Decode the data URL just far enough to read its natural pixel dimensions, so
// the inserted element keeps the image's aspect ratio.
const naturalSize = (
  dataURL: string,
): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || 512,
        height: img.naturalHeight || 512,
      });
    img.onerror = () => resolve({ width: 512, height: 512 });
    img.src = dataURL;
  });

const MAX_INSERT_SIZE = 480; // longest side, in scene units

/**
 * Insert a generated image into the live scene as a real, editable image
 * element: registers the binary file, appends the element via the same skeleton
 * path the MCP engine uses, selects it, and scrolls it into view.
 */
export const insertGeneratedImage = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  image: GeneratedImage,
): Promise<void> => {
  const { width: natW, height: natH } = await naturalSize(image.dataURL);
  const scale = Math.min(1, MAX_INSERT_SIZE / Math.max(natW, natH));
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));

  const fileId = `strl-ai-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}` as FileId;
  const file: BinaryFileData = {
    id: fileId,
    mimeType: image.mimeType,
    dataURL: image.dataURL as BinaryFileData["dataURL"],
    created: Date.now(),
  };
  excalidrawAPI.addFiles([file]);

  // Center on the current viewport so the image lands where the user is looking.
  const appState = excalidrawAPI.getAppState();
  const zoom = appState.zoom?.value || 1;
  const centerX = appState.width / 2 / zoom - appState.scrollX;
  const centerY = appState.height / 2 / zoom - appState.scrollY;

  const elements = convertToExcalidrawElements(
    [
      {
        type: "image",
        x: centerX - width / 2,
        y: centerY - height / 2,
        width,
        height,
        fileId,
        status: "saved",
      },
    ],
    { regenerateIds: true },
  );

  const existing = excalidrawAPI.getSceneElementsIncludingDeleted();
  const selectedElementIds: Record<string, true> = {};
  for (const el of elements) {
    selectedElementIds[el.id] = true;
  }
  excalidrawAPI.updateScene({
    elements: [...existing, ...elements],
    appState: { selectedElementIds },
  });
  excalidrawAPI.scrollToContent(elements, {
    fitToContent: true,
    animate: false,
  });
};
