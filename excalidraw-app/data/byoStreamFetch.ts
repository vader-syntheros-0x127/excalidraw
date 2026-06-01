// STRL: streaming client for a user-supplied OpenAI-compatible chat endpoint.
//
// We can't reuse the library's TTDStreamFetch here: it speaks Excalidraw's
// bespoke SSE shape (POST {messages}; chunks {type:'content',delta}) against the
// old hosted backend. Real OpenAI-compatible servers (Ollama / LM Studio /
// OpenAI) expect {model, stream, messages} and emit {choices:[{delta:{content}}]}.
// This parses that standard stream and returns the same OnTextSubmitRetValue
// contract, so the intact TTDDialog / useTextGeneration pipeline is unchanged.
import { RequestError } from "@excalidraw/excalidraw/errors";

import type {
  LLMMessage,
  TTTDDialog,
} from "@excalidraw/excalidraw/components/TTDDialog/types";

// Instruct the model to emit ONLY a mermaid diagram — that's what
// parseMermaidToExcalidraw consumes downstream.
export const MERMAID_SYSTEM_PROMPT =
  "You are a diagramming assistant for Excalidraw. Respond with ONLY a single " +
  "valid Mermaid diagram and nothing else — no prose, no explanations, and no " +
  "Markdown code fences. Prefer flowchart/graph, sequenceDiagram, or classDiagram. " +
  "If the user asks to modify an existing diagram, return the complete updated " +
  "Mermaid diagram.";

// Strip a ```mermaid ... ``` (or bare ```) fence if the model added one anyway.
const stripMermaidFences = (text: string): string => {
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
};

export interface ByoStreamOptions {
  endpoint: string;
  apiKey?: string;
  model: string;
  messages: readonly LLMMessage[];
  onChunk?: (chunk: string) => void;
  onStreamCreated?: () => void;
  signal?: AbortSignal;
}

export const byoStreamFetch = async ({
  endpoint,
  apiKey,
  model,
  messages,
  onChunk,
  onStreamCreated,
  signal,
}: ByoStreamOptions): Promise<TTTDDialog.OnTextSubmitRetValue> => {
  // STRL: only ever fetch an http(s) endpoint — never file:/data:/etc. (the web
  // build has no CSP to fall back on; on desktop the CSP allowlist is http(s)-only).
  if (!/^https?:\/\//i.test(endpoint)) {
    return {
      error: new RequestError({
        message: "AI endpoint must be an http(s) URL.",
        status: 0,
      }),
    };
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: MERMAID_SYSTEM_PROMPT },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      return {
        error: new RequestError({
          message: detail || `Request failed (${response.status})`,
          status: response.status,
        }),
      };
    }

    onStreamCreated?.();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") {
          continue;
        }
        try {
          const json = JSON.parse(data);
          const delta: string | undefined = json?.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onChunk?.(delta);
          }
        } catch {
          // ignore keep-alive / non-JSON lines
        }
      }
    }

    return { generatedResponse: stripMermaidFences(full), error: null };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { error: new RequestError({ message: "Aborted", status: 499 }) };
    }
    return {
      error: new RequestError({
        message: error instanceof Error ? error.message : String(error),
        status: 0,
      }),
    };
  }
};
