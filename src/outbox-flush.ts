import { isNetworkError, isReachable } from "@/online";
import { get, list, remove, update, type OutboxItem } from "@/outbox";
import { loadCapture, loadLogic, saveCapture } from "@/storage";
import { extractReport, transcribeSpeech } from "@/xai";

export type FlushResult = "idle" | "flushed" | "blocked" | "offline" | "failed";

let running = false;
let paused = false;
let navigateTo: ((path: string) => void) | null = null;

export function setFlushPaused(value: boolean) {
  paused = value;
}

export function bindFlushNavigate(navigate: (path: string) => void) {
  navigateTo = navigate;
}

function goToDraft() {
  if (window.location.pathname.startsWith("/draft")) {
    window.location.assign("/draft");
    return;
  }
  navigateTo?.("/draft");
}

async function writeItem(item: OutboxItem): Promise<FlushResult> {
  if (loadCapture()) return "blocked";
  await update(item.id, { status: "writing", error: item.error === "audio_dropped" ? item.error : undefined });
  const logic = loadLogic();
  let text = item.transcript || item.typed_text || item.live_transcript;
  if (item.audio && item.audio.size > 800) {
    const heard = await transcribeSpeech({
      audio: item.audio,
      language: item.language,
      keyterms: logic.stt_keyterms,
    });
    if (heard) text = heard;
  }
  if (!text.trim() && item.photos.length === 0) {
    await update(item.id, { status: "failed" });
    return "failed";
  }
  const extraction = await extractReport({
    transcript: text,
    photos: item.photos,
    logic,
    language: item.language,
  });
  if (loadCapture()) {
    await update(item.id, { status: "queued", transcript: text });
    return "blocked";
  }
  saveCapture({ transcript: text, photos: item.photos, language: item.language, extraction });
  await update(item.id, { status: "drafted", transcript: text });
  await remove(item.id);
  return "flushed";
}

export async function requestFlush(id?: string): Promise<FlushResult> {
  if (running || paused || typeof window === "undefined") return "idle";
  if (document.visibilityState === "hidden") return "idle";
  if (window.location.pathname.startsWith("/admin")) return "idle";
  if (loadCapture()) return "blocked";
  running = true;
  try {
    if (!(await isReachable())) return "offline";
    const item = id ? await get(id) : (await list())[0];
    if (!item) return "idle";
    try {
      const result = await writeItem(item);
      if (result === "flushed") goToDraft();
      return result;
    } catch (error) {
      if (isNetworkError(error)) {
        await update(item.id, { status: "failed" });
        return "failed";
      }
      await update(item.id, { status: "failed" });
      return "failed";
    }
  } finally {
    running = false;
  }
}
