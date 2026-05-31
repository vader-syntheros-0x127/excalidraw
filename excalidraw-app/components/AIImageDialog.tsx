// STRL: in-app AI image generation dialog. Prompts the user-configured
// OpenAI-Images-compatible endpoint and inserts the result as a real, editable
// image element. Shown only when an image endpoint+model is configured in AI
// settings (isImageGenConfigured); AI stays off by default.
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { useRef, useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { getAISettings } from "../data/aiSettings";
import { generateImage, insertGeneratedImage } from "../data/byoImageGen";

export const AIImageDialog = ({
  excalidrawAPI,
  onClose,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onClose: () => void;
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    const settings = getAISettings();
    if (!settings?.imageEndpoint || !settings.imageModel) {
      setError("Configure an image endpoint and model in AI settings first.");
      return;
    }
    if (!prompt.trim()) {
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const image = await generateImage({
        endpoint: settings.imageEndpoint,
        apiKey: settings.apiKey,
        model: settings.imageModel,
        prompt: prompt.trim(),
        signal: controller.signal,
      });
      if (excalidrawAPI) {
        await insertGeneratedImage(excalidrawAPI, image);
      }
      onClose();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // user canceled — leave the dialog open, no error
      } else {
        setError(err?.message || "Image generation failed");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
  };

  return (
    <Dialog
      onCloseRequest={handleClose}
      title="Generate image (AI)"
      size="small"
    >
      <div className="strl-ai-image">
        <p style={{ marginTop: 0, fontSize: ".875rem", lineHeight: 1.5 }}>
          Describe the image to generate. It's created by your configured image
          endpoint and inserted as an editable image element. Your key is sent
          only to that endpoint.
        </p>

        <textarea
          autoFocus
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              void handleGenerate();
            }
          }}
          placeholder="a minimalist mountain logo, flat vector, teal on white"
          rows={4}
          disabled={loading}
          style={{
            width: "100%",
            resize: "vertical",
            fontFamily: "inherit",
            fontSize: ".875rem",
            padding: ".5rem",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p
            style={{
              color: "var(--color-danger, #c92a2a)",
              fontSize: ".8125rem",
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: ".5rem",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <FilledButton
            label={loading ? "Cancel" : "Close"}
            variant="outlined"
            color="muted"
            onClick={handleClose}
          />
          <FilledButton
            label={loading ? "Generating…" : "Generate"}
            color="primary"
            onClick={handleGenerate}
            disabled={loading || prompt.trim() === ""}
          />
        </div>
      </div>
    </Dialog>
  );
};
