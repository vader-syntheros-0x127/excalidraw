// STRL: BYO AI configuration dialog. Lets the user point the in-app text-to-diagram
// panel (and optional image generation) at their own OpenAI-compatible endpoint.
// AI is off until enabled here; on desktop, saving updates the CSP allowlist so
// only the configured origin is ever reachable (no-phone-home stays the default).
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { useState } from "react";

import {
  clearAISettings,
  getAISettings,
  setAISettings,
} from "../data/aiSettings";

export const AISettingsDialog = ({ onClose }: { onClose: () => void }) => {
  const existing = getAISettings();
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? "");
  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [imageEndpoint, setImageEndpoint] = useState(
    existing?.imageEndpoint ?? "",
  );
  const [imageModel, setImageModel] = useState(existing?.imageModel ?? "");

  const canSave = endpoint.trim() !== "" && model.trim() !== "";

  const handleSave = () => {
    setAISettings({
      enabled: true,
      endpoint: endpoint.trim(),
      apiKey: apiKey.trim() || undefined,
      model: model.trim(),
      imageEndpoint: imageEndpoint.trim() || undefined,
      imageModel: imageModel.trim() || undefined,
    });
    onClose();
  };

  const handleDisable = () => {
    clearAISettings();
    onClose();
  };

  return (
    <Dialog onCloseRequest={onClose} title="AI settings" size="small">
      <div className="strl-ai-settings">
        <p style={{ marginTop: 0, fontSize: ".875rem", lineHeight: 1.5 }}>
          Connect your own OpenAI-compatible model (Ollama, LM Studio, OpenAI,
          or a proxy). AI is off until you save a configuration. Your key is
          stored locally and only sent to the endpoint you configure.
        </p>

        <TextField
          label="Chat endpoint"
          placeholder="http://localhost:11434/v1/chat/completions"
          value={endpoint}
          onChange={setEndpoint}
        />
        <TextField
          label="Model"
          placeholder="llama3.1  /  gpt-4o-mini"
          value={model}
          onChange={setModel}
        />
        <TextField
          label="API key (optional — leave blank for local servers)"
          placeholder="sk-…"
          value={apiKey}
          onChange={setApiKey}
          isRedacted
        />

        <p style={{ marginBottom: 4, fontSize: ".8125rem", opacity: 0.8 }}>
          Optional — AI image generation (OpenAI-Images compatible):
        </p>
        <TextField
          label="Image endpoint"
          placeholder="https://api.openai.com/v1/images/generations"
          value={imageEndpoint}
          onChange={setImageEndpoint}
        />
        <TextField
          label="Image model"
          placeholder="gpt-image-1"
          value={imageModel}
          onChange={setImageModel}
        />

        <div
          style={{
            display: "flex",
            gap: ".5rem",
            justifyContent: "flex-end",
            marginTop: "1rem",
          }}
        >
          <FilledButton
            label="Disable AI"
            variant="outlined"
            color="muted"
            onClick={handleDisable}
          />
          <FilledButton
            label="Save"
            color="primary"
            onClick={handleSave}
            disabled={!canSave}
          />
        </div>
      </div>
    </Dialog>
  );
};
