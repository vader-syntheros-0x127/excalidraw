// STRL: in-app text-to-diagram panel, pointed at the user's own OpenAI-compatible
// LLM. Re-creates the wiring of the removed AI.tsx (git 1f9d9e45) but local-first:
// no hosted backend, BYO endpoint, AI off until configured. The intact library
// pipeline (TTDDialog -> useTextGeneration -> parseMermaidToExcalidraw ->
// insertToEditor) does the rest, in the renderer where the DOM/mermaid live.
import { TTDDialog } from "@excalidraw/excalidraw";
import { RequestError } from "@excalidraw/excalidraw/errors";

import { getAISettings } from "../data/aiSettings";
import { byoStreamFetch } from "../data/byoStreamFetch";
import { TTDIndexedDBAdapter } from "../data/TTDStorage";

export const AIComponents = () => {
  return (
    <TTDDialog
      onTextSubmit={async ({ messages, onChunk, onStreamCreated, signal }) => {
        const settings = getAISettings();
        if (!settings?.enabled || !settings.endpoint || !settings.model) {
          return {
            error: new RequestError({
              message: "AI is not configured (open Menu → AI settings)",
              status: 400,
            }),
          };
        }
        return byoStreamFetch({
          endpoint: settings.endpoint,
          apiKey: settings.apiKey,
          model: settings.model,
          messages,
          onChunk,
          onStreamCreated,
          signal,
        });
      }}
      persistenceAdapter={TTDIndexedDBAdapter}
    />
  );
};
