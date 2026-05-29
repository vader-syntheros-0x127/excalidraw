// STRL: prominent on-canvas export button (PNG / SVG / PDF).
// Uses the library's own export utilities so output matches the native
// "Save as image" dialog; PDF is added on top via jsPDF (raster).
import {
  exportToBlob,
  exportToSvg,
  exportToCanvas,
} from "@excalidraw/excalidraw";
import { jsPDF } from "jspdf";
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./StrlExportButton.scss";

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

type ExportFormat = "png" | "svg" | "pdf";

export const StrlExportButton: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const getScene = () => {
    const elements = excalidrawAPI.getSceneElements();
    if (!elements.length) {
      excalidrawAPI.setToast({ message: "Nothing to export", duration: 2000 });
      return null;
    }
    return {
      elements,
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      name: excalidrawAPI.getName() || "strl-ideate",
    };
  };

  const exportAs = async (format: ExportFormat) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const scene = getScene();
      if (!scene) {
        return;
      }
      const { elements, appState, files, name } = scene;

      if (format === "png") {
        const blob = await exportToBlob({
          elements,
          appState,
          files,
          mimeType: "image/png",
        });
        downloadBlob(blob, `${name}.png`);
      } else if (format === "svg") {
        const svg = await exportToSvg({ elements, appState, files });
        const data = new XMLSerializer().serializeToString(svg);
        downloadBlob(
          new Blob([data], { type: "image/svg+xml" }),
          `${name}.svg`,
        );
      } else {
        const canvas = await exportToCanvas({ elements, appState, files });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
          unit: "px",
          format: [canvas.width, canvas.height],
          hotfixes: ["px_scaling"],
        });
        pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`${name}.pdf`);
      }
    } catch (error: any) {
      excalidrawAPI.setToast({
        message: `Export failed: ${error?.message ?? "unknown error"}`,
        duration: 3000,
      });
      // eslint-disable-next-line no-console
      console.error("STRL export failed", error);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="strl-export">
      <button
        type="button"
        className="strl-export__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? "Exporting…" : "Export ▾"}
      </button>
      {open && (
        <div className="strl-export__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => exportAs("png")}>
            PNG image
          </button>
          <button type="button" role="menuitem" onClick={() => exportAs("svg")}>
            SVG vector
          </button>
          <button type="button" role="menuitem" onClick={() => exportAs("pdf")}>
            PDF document
          </button>
        </div>
      )}
    </div>
  );
};
