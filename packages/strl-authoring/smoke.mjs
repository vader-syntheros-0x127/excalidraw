// STRL: headless smoke — proves the engine builds full scenes under bare `node`
// with NO DOM (no document/canvas/jsdom). Run: node smoke.mjs
import assert from "node:assert";

import {
  addImage,
  addShapes,
  binaryFileFromDataURL,
  createScene,
  deleteElements,
  editElements,
  getSceneSummary,
  parseSceneFile,
  serializeScene,
} from "./dist/index.js";

// Hard proof of no-DOM: if any imported module touched the DOM at eval time we'd
// already have crashed above. Assert the globals really are absent.
assert.strictEqual(typeof globalThis.document, "undefined", "document leaked");
assert.strictEqual(typeof globalThis.window, "undefined", "window leaked");

// 1) create a scene with a labelled box, an arrow, free text, and an image.
const file = binaryFileFromDataURL(
  // 1x1 transparent PNG
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
);

let scene = createScene({
  skeleton: [
    {
      type: "rectangle",
      id: "box1",
      x: 100,
      y: 100,
      width: 220,
      height: 90,
      label: { text: "Start here" },
    },
    {
      type: "text",
      x: 100,
      y: 240,
      text: "A free text label",
    },
    {
      type: "arrow",
      x: 320,
      y: 145,
      width: 160,
      height: 0,
      start: { id: "box1" },
    },
  ],
});

scene = addShapes(scene, [
  { type: "ellipse", id: "node2", x: 500, y: 110, width: 140, height: 80, label: { text: "End" } },
]);

scene = addImage(scene, file, { x: 100, y: 320, width: 64, height: 64 });

assert.ok(scene.elements.length >= 5, "expected >=5 elements");
const imageEls = scene.elements.filter((e) => e.type === "image");
assert.strictEqual(imageEls.length, 1, "expected one image element");
assert.ok(scene.files[imageEls[0].fileId], "image file must be embedded");

// 2) round-trip fidelity: serialize -> parse -> serialize is stable + valid.
const json1 = serializeScene(scene);
const parsed = JSON.parse(json1);
assert.strictEqual(parsed.type, "excalidraw", "type must be 'excalidraw'");
assert.ok(parsed.files && Object.keys(parsed.files).length === 1, "files embedded inline");

const reparsed = parseSceneFile(json1);
const json2 = serializeScene(reparsed);
assert.strictEqual(
  JSON.parse(json2).elements.length,
  parsed.elements.length,
  "round-trip preserves element count",
);

// 3) edit + delete by query.
const edited = editElements(reparsed, { text: "Start here" }, () => ({
  backgroundColor: "#ffec99",
}));
assert.strictEqual(edited.matched, 1, "edit matched the labelled box text");

const del = deleteElements(edited.scene, { type: "ellipse" });
assert.strictEqual(del.deleted, 1, "deleted the ellipse");

// 4) summary projection for an LLM.
const summary = getSceneSummary(del.scene);
assert.ok(Array.isArray(summary) && summary.length >= 3, "summary returned");

console.log(
  JSON.stringify(
    {
      ok: true,
      elements: scene.elements.length,
      types: [...new Set(scene.elements.map((e) => e.type))].sort(),
      roundTripElements: JSON.parse(json2).elements.length,
      editMatched: edited.matched,
      ellipsesDeleted: del.deleted,
      summaryRows: summary.length,
      domAbsent: typeof globalThis.document === "undefined",
    },
    null,
    2,
  ),
);
