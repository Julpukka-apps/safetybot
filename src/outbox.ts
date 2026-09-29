export type OutboxStatus = "queued" | "writing" | "drafted" | "failed";

export type OutboxItem = {
  id: string;
  created_at: string;
  language: string;
  typed_text: string;
  live_transcript: string;
  transcript: string;
  photos: string[];
  audio: Blob | null;
  audio_mime: string;
  status: OutboxStatus;
  error?: string;
};

const DB_NAME = "safetybot";
const STORE = "safetybot_outbox_v1";
const MAX_ITEMS = 20;

export type OutboxInput = {
  language: string;
  typed_text: string;
  live_transcript: string;
  transcript: string;
  photos: string[];
  audio: Blob | null;
  audio_mime: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isQuota(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name || "";
  return name === "QuotaExceededError" || name === "AbortError";
}

async function put(item: OutboxItem): Promise<void> {
  const db = await openDb();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(item));
}

export async function list(): Promise<OutboxItem[]> {
  const db = await openDb();
  const items = await done(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
  return items.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function get(id: string): Promise<OutboxItem | null> {
  const db = await openDb();
  return (await done(db.transaction(STORE, "readonly").objectStore(STORE).get(id))) ?? null;
}

export async function update(id: string, patch: Partial<OutboxItem>): Promise<OutboxItem | null> {
  const current = await get(id);
  if (!current) return null;
  const next = { ...current, ...patch, id: current.id };
  await put(next);
  return next;
}

export async function remove(id: string): Promise<void> {
  const db = await openDb();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}

export async function queuedCount(): Promise<number> {
  const items = await list();
  return items.length;
}

export async function enqueue(input: OutboxInput): Promise<OutboxItem | "full"> {
  if ((await queuedCount()) >= MAX_ITEMS) return "full";
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    language: input.language,
    typed_text: input.typed_text,
    live_transcript: input.live_transcript,
    transcript: input.transcript,
    photos: input.photos.slice(0, 3),
    audio: input.audio,
    audio_mime: input.audio_mime || input.audio?.type || "",
    status: "queued",
  };
  try {
    await put(item);
    return item;
  } catch (error) {
    if (!item.audio || !isQuota(error)) throw error;
    const dropped: OutboxItem = { ...item, audio: null, audio_mime: "", error: "audio_dropped" };
    await put(dropped);
    return dropped;
  }
}
