// STRL: build BinaryFileData (an embeddable image payload) from a data URL.
// Pure — no Node I/O. Reading files/URLs from disk or the network is the server
// layer's job (keeps the engine DOM-free AND node-free, so it typechecks under the
// root config like any other internal package).
import type { FileId } from "@excalidraw/element/types";
import type { BinaryFileData, DataURL } from "@excalidraw/excalidraw/types";

let fileCounter = 0;

const newFileId = (): FileId =>
  `strl-${Date.now().toString(36)}-${(fileCounter++).toString(36)}` as FileId;

/** Wrap a `data:<mime>;base64,...` URL into a BinaryFileData (with a fresh id). */
export const binaryFileFromDataURL = (
  dataURL: string,
  opts?: { mimeType?: string },
): BinaryFileData => {
  const match = /^data:([^;,]+)?(?:;[^,]*)?,/.exec(dataURL);
  const mimeType = opts?.mimeType ?? match?.[1] ?? "image/png";
  return {
    id: newFileId(),
    mimeType: mimeType as BinaryFileData["mimeType"],
    dataURL: dataURL as DataURL,
    created: Date.now(),
  };
};
