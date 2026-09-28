import {
  buildExtractPrompt,
  buildExtractSchema,
  sanitizeExtraction,
  wantsPhotoExtract,
  type Logic,
} from "@/schema";

const STT_MODEL = "grok-voice-transcribe-2.0";

export type AiProvider = "xai" | "openai" | "azure" | "compatible";

export type AiClient = {
  provider: AiProvider;
  apiKey: string | null;
  model: string;
  baseUrl: string;
};

const DEFAULTS: Record<AiProvider, { model: string; baseUrl: string }> = {
  xai: { model: "grok-4.6", baseUrl: "https://api.x.ai/v1" },
  openai: { model: "gpt-4.1-mini", baseUrl: "https://api.openai.com/v1" },
  azure: { model: "", baseUrl: "" },
  compatible: { model: "", baseUrl: "" },
};

export function aiFromRequest(request: Request): AiClient {
  const raw = request.headers.get("x-ai-provider") || "xai";
  const provider: AiProvider = raw === "openai" || raw === "azure" || raw === "compatible" ? raw : "xai";
  const pasted = headerText(request, "x-ai-key") || headerText(request, "x-grok-key");
  const env =
    provider === "openai"
      ? process.env.OPENAI_API_KEY?.trim()
      : provider === "xai"
        ? process.env.XAI_API_KEY?.trim()
        : "";
  return {
    provider,
    apiKey: pasted || env || null,
    model: headerText(request, "x-ai-model") || DEFAULTS[provider].model,
    baseUrl: headerText(request, "x-ai-base") || DEFAULTS[provider].baseUrl,
  };
}

function headerText(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim() || "";
  if (!value || /[\r\n]/.test(value)) return "";
  return value.slice(0, 300);
}

export function serverGrokReady(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());
}

export async function transcribeAudio(input: {
  audioBase64: string;
  mime: string;
  language: string;
  keyterms: string[];
  ai: AiClient;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const apiKey = input.ai.apiKey;
  if (!apiKey) return { ok: false, error: "no key" };
  if (input.ai.provider === "azure") return { ok: false, error: "no stt" };
  if (!input.audioBase64 || input.audioBase64.length > 12_000_000) {
    return { ok: false, error: "audio missing" };
  }
  const bytes = Buffer.from(input.audioBase64, "base64");
  const form = new FormData();
  const base = (input.ai.baseUrl || DEFAULTS[input.ai.provider].baseUrl).replace(/\/$/, "");
  if (input.ai.provider === "xai") {
    form.append("model", STT_MODEL);
    if (input.language && input.language !== "auto") {
      form.append("language", input.language);
      form.append("format", "true");
    }
    for (const term of input.keyterms.slice(0, 100)) {
      const clean = term.trim().slice(0, 50);
      if (clean) form.append("keyterm", clean);
    }
  } else {
    form.append("model", "whisper-1");
    if (input.language && input.language !== "auto") form.append("language", input.language.slice(0, 12));
  }
  form.append("file", new File([bytes], "speech.webm", { type: input.mime || "audio/webm" }));
  const response = await fetch(input.ai.provider === "xai" ? "https://api.x.ai/v1/stt" : `${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) return { ok: false, error: `stt ${response.status}` };
  const body = (await response.json()) as { text?: string };
  return { ok: true, text: body.text?.trim() || "" };
}

function chatEndpoint(ai: AiClient): string {
  const base = (ai.baseUrl || DEFAULTS[ai.provider].baseUrl).replace(/\/$/, "");
  if (ai.provider === "azure") {
    return `${base}/openai/deployments/${encodeURIComponent(ai.model)}/chat/completions?api-version=2024-10-21`;
  }
  return `${base}/chat/completions`;
}

function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : trimmed;
  return JSON.parse(source);
}

export async function extractWithGrok(input: {
  transcript: string;
  photos: string[];
  logic: Logic;
  language: string;
  ai: AiClient;
}): Promise<{ ok: true; extraction: ReturnType<typeof sanitizeExtraction> } | { ok: false; error: string }> {
  const apiKey = input.ai.apiKey;
  if (!apiKey) return { ok: false, error: "no key" };
  if ((input.ai.provider === "azure" || input.ai.provider === "compatible") && !input.ai.baseUrl.trim()) {
    return { ok: false, error: "no key" };
  }
  const photos = wantsPhotoExtract(input.logic) ? input.photos.slice(0, 3) : [];
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Transcript:\n${input.transcript.trim() || "(none)"}\nPhotos attached: ${photos.length}`,
    },
  ];
  for (const url of photos) {
    if (typeof url === "string" && url.startsWith("data:image/") && url.length < 2_000_000) {
      content.push({ type: "image_url", image_url: { url } });
    }
  }
  const messages = [
    { role: "system", content: buildExtractPrompt(input.logic, input.language) },
    { role: "user", content },
  ];
  const schema = buildExtractSchema(input.logic);
  const baseBody = {
    temperature: 0.2,
    max_tokens: 1600,
    messages,
  };
  const chatBody = input.ai.provider === "azure" ? baseBody : { ...baseBody, model: input.ai.model || DEFAULTS[input.ai.provider].model };
  const xaiExtra = input.ai.provider === "xai" ? { reasoning_effort: "low" } : {};
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (input.ai.provider === "azure") headers["api-key"] = apiKey;
  else headers.Authorization = `Bearer ${apiKey}`;
  const endpoint = chatEndpoint(input.ai);
  let response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...chatBody,
      ...xaiExtra,
      response_format: {
        type: "json_schema",
        json_schema: { name: "safetybot_report", strict: true, schema },
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...chatBody,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });
  }
  if (!response.ok) return { ok: false, error: `extract ${response.status}` };
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content || "";
  try {
    const parsed = parseModelJson(text);
    return {
      ok: true,
      extraction: sanitizeExtraction(input.logic, parsed, input.transcript, photos.length),
    };
  } catch {
    return { ok: false, error: "bad json" };
  }
}
