import type { Extraction, Logic } from "@/schema";
import { demoExtract, normalizeLogic } from "@/schema";
import { loadAi } from "@/storage";

export async function resizeImage(file: File, max = 1024): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("photo"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return url;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function aiHeaders(): Record<string, string> {
  const ai = loadAi();
  return {
    "content-type": "application/json",
    "x-ai-provider": ai.provider,
    "x-ai-key": ai.apiKey,
    "x-ai-model": ai.model,
    "x-ai-base": ai.baseUrl,
  };
}

export async function aiConfigured(): Promise<boolean> {
  const ai = loadAi();
  if (ai.apiKey.trim()) return true;
  if (ai.provider !== "xai") return false;
  try {
    const response = await fetch("/api/ai/status");
    const body = (await response.json()) as { available?: boolean };
    return Boolean(body.available);
  } catch {
    return false;
  }
}

export const grokConfigured = aiConfigured;

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

export async function transcribeSpeech(input: {
  audio: Blob;
  language: string;
  keyterms: string[];
}): Promise<string | null> {
  try {
    const response = await fetch("/api/ai/transcribe", {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        audioBase64: await blobToBase64(input.audio),
        mime: input.audio.type || "audio/webm",
        language: input.language,
        keyterms: input.keyterms,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { text?: string };
    return body.text?.trim() || null;
  } catch {
    return null;
  }
}

export async function extractReport(input: {
  transcript: string;
  photos: string[];
  logic: Logic;
  language: string;
}): Promise<Extraction> {
  const fallback = () => demoExtract(input.transcript, input.logic, input.photos.length);
  if (!(await aiConfigured())) return fallback();
  try {
    const response = await fetch("/api/ai/extract", {
      method: "POST",
      headers: aiHeaders(),
      body: JSON.stringify({
        transcript: input.transcript,
        photos: input.photos.slice(0, 3),
        logic: input.logic,
        language: input.language,
      }),
    });
    if (!response.ok) {
      const demo = fallback();
      demo.note = "The AI did not answer. Filled a draft from your words.";
      return demo;
    }
    const body = (await response.json()) as { extraction?: Extraction };
    if (!body.extraction) return fallback();
    return {
      ...body.extraction,
      values: body.extraction.values || {},
      source: body.extraction.source || "grok",
    };
  } catch {
    const demo = fallback();
    demo.note = "The AI did not answer. Filled a draft from your words.";
    return demo;
  }
}

export function logicFromUnknown(value: unknown): Logic {
  return normalizeLogic(value);
}
