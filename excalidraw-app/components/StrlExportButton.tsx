// STRL: prominent on-canvas export button (PNG / SVG / PDF).
// Export logic lives in ./strlExport so the desktop app's native menu can
// reuse it.
import React, { useEffect, useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  resolveScene,
  sceneToExportBytes,
  triggerDownload,
} from "./strlExport";

import "./StrlExportButton.scss";

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

  const exportAs = async (format: ExportFormat) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const scene = resolveScene(excalidrawAPI);
      if (!scene) {
        return;
      }

      const { data, extension, mimeType } = await sceneToExportBytes(
        scene,
        format,
      );
      triggerDownload(data, `${scene.name}.${extension}`, mimeType);
    } catch (error: any) {
      excalidrawAPI.setToast({
        message: `Export failed: ${error?.message ?? "unknown error"}`,
        duration: 3000,
      });
       
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
