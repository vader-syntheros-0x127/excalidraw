// STRL: BYO (bring-your-own) AI configuration for the in-app text-to-diagram
// panel. localStorage-backed; AI is OFF until the user configures an endpoint.
// On desktop we additionally tell main which origin(s) to allow in the strict
// CSP — so no-phone-home stays the default and only the user's chosen endpoint
// is ever reachable.
export interface AISettings {
  /** master toggle — AI is off unless this is true AND endpoint+model are set */
  enabled: boolean;
  /** OpenAI-compatible chat-completions URL (Ollama / LM Studio / OpenAI / proxy) */
  endpoint: string;
  /** bearer key; omit for keyless local servers (Ollama / LM Studio) */
  apiKey?: string;
  /** model id, e.g. "llama3.1", "gpt-4o-mini" */
  model: string;
  /** optional OpenAI-Images-compatible URL for AI image generation */
  imageEndpoint?: string;
  /** image model id, e.g. "gpt-image-1" */
  imageModel?: string;
}

const STORAGE_KEY = "strl-ai-settings";

export const getAISettings = (): AISettings | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AISettings>;
    if (typeof parsed?.endpoint !== "string") {
      return null;
    }
    return {
      enabled: Boolean(parsed.enabled),
      endpoint: parsed.endpoint,
      apiKey: parsed.apiKey,
      model: parsed.model ?? "",
      imageEndpoint: parsed.imageEndpoint,
      imageModel: parsed.imageModel,
    };
  } catch {
    return null;
  }
};

/** AI features render only when explicitly enabled with a valid endpoint+model. */
export const isAiConfigured = (): boolean => {
  const settings = getAISettings();
  return Boolean(settings?.enabled && settings.endpoint && settings.model);
};

export const isImageGenConfigured = (): boolean => {
  const settings = getAISettings();
  return Boolean(
    settings?.enabled && settings.imageEndpoint && settings.imageModel,
  );
};

const originOf = (url?: string): string | null => {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

/** http(s) origins the desktop CSP must allow for the configured endpoints. */
export const aiAllowedOrigins = (settings: AISettings | null): string[] => {
  if (!settings?.enabled) {
    return [];
  }
  const origins = [
    originOf(settings.endpoint),
    originOf(settings.imageEndpoint),
  ];
  return Array.from(
    new Set(origins.filter((origin): origin is string => Boolean(origin))),
  );
};

const syncDesktopOrigins = (settings: AISettings | null): void => {
  // Tell main which origins to allow; on the web this is a no-op.
  window.strlDesktop?.setAiOrigins?.(aiAllowedOrigins(settings));
};

export const setAISettings = (settings: AISettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  syncDesktopOrigins(settings.enabled ? settings : null);
};

export const clearAISettings = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  syncDesktopOrigins(null);
};
