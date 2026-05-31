// STRL: turn an image source into a data URL for embedding. Local-first: only a
// local file (under the workdir) or an already-formed data URL. Network image
// generation is a separate, opt-in tool (generateImage).
import fs from "node:fs";
import path from "node:path";

import { resolveUnderWorkdir } from "./fileStore";

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

export interface ImageSource {
  /** a complete `data:<mime>;base64,...` URL */
  dataURL?: string;
  /** path to a local image, resolved under STRL_MCP_WORKDIR */
  path?: string;
  /** override the detected mime type */
  mimeType?: string;
}

/** Resolve an image source to a data URL string. */
export const loadImageDataURL = (source: ImageSource): string => {
  if (source.dataURL) {
    return source.dataURL;
  }
  if (source.path) {
    const resolved = resolveUnderWorkdir(source.path);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`Image not found under workdir: ${source.path}`);
    }
    const mime =
      source.mimeType ??
      EXT_TO_MIME[path.extname(resolved).toLowerCase()] ??
      "image/png";
    const base64 = fs.readFileSync(resolved).toString("base64");
    return `data:${mime};base64,${base64}`;
  }
  throw new Error("Image source requires one of: dataURL, path");
};
