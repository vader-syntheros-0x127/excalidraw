// STRL: keystone of the headless engine. The only DOM dependency in the
// convertToExcalidrawElements / restoreElements path is CanvasTextMetricsProvider
// (document.createElement("canvas")). The library exposes a pluggable hook —
// setCustomTextMetricsProvider — so we register a pure-Node provider and the
// whole transform/restore path runs under bare `node` with no DOM.
//
// Width is APPROXIMATE but DETERMINISTIC (per-character advance as a fraction of
// the font size). That is all wrapText/label layout needs, and it self-heals: the
// app re-measures text with the real canvas the moment the file is opened, and our
// edit path runs restoreElements({ refreshDimensions: true }). Height is already
// exact (it comes from FONT_METADATA, not the canvas).
import { setCustomTextMetricsProvider } from "@excalidraw/element/textMeasurements";

import type { TextMetricsProvider } from "@excalidraw/element/textMeasurements";
import type { FontString } from "@excalidraw/element/types";

// Average glyph advance as a fraction of font size (em), per bundled family.
// Matched against the family name carried in the fontString (e.g. "20px Excalifont, …").
const FAMILY_ADVANCE_EM: ReadonlyArray<readonly [string, number]> = [
  ["Excalifont", 0.5],
  ["Virgil", 0.5],
  ["Nunito", 0.52],
  ["Lilita", 0.55],
  ["Comic Shanns", 0.55],
  ["Cascadia", 0.6],
  ["Liberation", 0.52],
  ["Assistant", 0.52],
];

const DEFAULT_ADVANCE_EM = 0.52;

const advanceEmFor = (fontString: string): number => {
  for (const [name, em] of FAMILY_ADVANCE_EM) {
    if (fontString.includes(name)) {
      return em;
    }
  }
  return DEFAULT_ADVANCE_EM;
};

class NodeTextMetricsProvider implements TextMetricsProvider {
  public getLineWidth(text: string, fontString: FontString): number {
    // matches measureText(): font size is the leading number in "20px <family>"
    const fontSize = parseFloat(fontString) || 16;
    return text.length * fontSize * advanceEmFor(fontString);
  }
}

let registered = false;

/**
 * Register the pure-Node text-metrics provider. Idempotent. MUST be called before
 * any convertToExcalidrawElements / restoreElements / measureText call in Node.
 */
export const registerNodeTextMetrics = (): void => {
  if (registered) {
    return;
  }
  setCustomTextMetricsProvider(new NodeTextMetricsProvider());
  registered = true;
};
