// STRL: optional AI image generation. OFF by default — only enabled when the user
// sets STRL_MCP_IMAGE_ENDPOINT (an OpenAI-Images-compatible endpoint). No default
// endpoint, no telemetry: preserves no-phone-home unless the user opts in.
export const isImageGenEnabled = (): boolean =>
  Boolean(process.env.STRL_MCP_IMAGE_ENDPOINT);

/** Generate an image from a prompt via the configured endpoint; returns a data URL. */
export const generateImageDataURL = async (prompt: string): Promise<string> => {
  const endpoint = process.env.STRL_MCP_IMAGE_ENDPOINT;
  if (!endpoint) {
    throw new Error(
      "generate_image is disabled — set STRL_MCP_IMAGE_ENDPOINT to enable it",
    );
  }
  const model = process.env.STRL_MCP_IMAGE_MODEL ?? "gpt-image-1";
  const key = process.env.STRL_MCP_IMAGE_KEY;
  const size = process.env.STRL_MCP_IMAGE_SIZE ?? "1024x1024";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200);
    throw new Error(`Image endpoint returned ${response.status}: ${detail}`);
  }

  const json = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Image endpoint returned no b64_json payload");
  }
  return `data:image/png;base64,${b64}`;
};
