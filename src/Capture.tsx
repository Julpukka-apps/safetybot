"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic } from "lucide-react";
import { HOME_EVENT, WorkerColumn, WorkerHeader, Wordmark } from "@/App";
import { activeLanguage, useI18n } from "@/i18n";
import { isNetworkError, isReachable } from "@/online";
import { enqueue, list, remove, type OutboxItem } from "@/outbox";
import { requestFlush, setFlushPaused } from "@/outbox-flush";
import { fetchSession, pullLogic, pushConfig, signOutSession, type SignedInUser } from "@/remote";
import { LANGUAGES } from "@/schema";
import { cacheSession, loadCachedSession, loadLogic, loadSso, saveCapture } from "@/storage";
import { extractReport, resizeImage, transcribeSpeech } from "@/xai";

export function Capture() {
  const navigate = useRouter();
  const { language, t } = useI18n();
  const spoken = activeLanguage(language);
  const [sheet, setSheet] = useState(false);
  const [holding, setHolding] = useState(false);
  const [phase, setPhase] = useState<"idle" | "writing">("idle");
  const [transcript, setTranscript] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<SignedInUser | null>(null);
  const [requireSignIn, setRequireSignIn] = useState(false);
  const [providers, setProviders] = useState({ microsoft: false, google: false });
  const [savedNotice, setSavedNotice] = useState(false);
  const [waiting, setWaiting] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [pendingDelete, setPendingDelete] = useState("");
  const transcriptRef = useRef("");
  const holdingRef = useRef(false);
  const photosRef = useRef<string[]>([]);
  const recorderRef = useRef<{ stop: () => Promise<Blob | null> } | null>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const epoch = useRef(0);

  async function refreshQueue() {
    const items = await list();
    setQueue(items);
    setWaiting(items.length);
  }

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") === "failed") setError("ssoFailed");
    void (async () => {
      await pullLogic();
      await pushConfig();
      const sso = loadSso();
      setRequireSignIn(sso.requireSignIn);
      setProviders({ microsoft: sso.microsoft.enabled, google: sso.google.enabled });
      const live = await fetchSession();
      if (live) {
        cacheSession(live);
        setSession(live);
      } else if (await isReachable()) {
        cacheSession(null);
        setSession(null);
      } else {
        setSession(loadCachedSession<SignedInUser>());
      }
      await refreshQueue();
      await requestFlush();
    })();
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    function home() {
      epoch.current += 1;
      if (holdingRef.current) {
        holdingRef.current = false;
        speechRef.current?.stop();
        speechRef.current = null;
        void recorderRef.current?.stop();
        recorderRef.current = null;
      }
      setFlushPaused(false);
      setHolding(false);
      setPhase("idle");
      setSheet(false);
      setQueueOpen(false);
      setPendingDelete("");
      setTyping(false);
      setSavedNotice(false);
      setError("");
      setPhotos([]);
      photosRef.current = [];
      setTyped("");
      setTranscript("");
      transcriptRef.current = "";
    }
    window.addEventListener(HOME_EVENT, home);
    return () => window.removeEventListener(HOME_EVENT, home);
  }, []);

  async function saveOffline(input: {
    typed: string;
    live: string;
    transcript: string;
    photos: string[];
    audio: Blob | null;
  }) {
    const saved = await enqueue({
      language: spoken,
      typed_text: input.typed,
      live_transcript: input.live,
      transcript: input.transcript || input.typed || input.live,
      photos: input.photos,
      audio: input.audio,
      audio_mime: input.audio?.type || "",
    });
    setPhase("idle");
    if (saved === "full") {
      setError("outboxFull");
      return;
    }
    setError("");
    setPhotos([]);
    setTyped("");
    setTranscript("");
    transcriptRef.current = "";
    setSavedNotice(true);
    await refreshQueue();
  }

  async function beginHold() {
    if (holdingRef.current || phase === "writing") return;
    holdingRef.current = true;
    setHolding(true);
    setError("");
    setTranscript("");
    transcriptRef.current = "";
    speechRef.current = startLiveSpeech(spoken, (text) => {
      transcriptRef.current = text;
      setTranscript(text);
    });
    recorderRef.current = await startRecorder();
  }

  async function endHold() {
    if (!holdingRef.current) return;
    const ticket = epoch.current;
    holdingRef.current = false;
    setHolding(false);
    const audioPromise = recorderRef.current?.stop() ?? Promise.resolve(null);
    speechRef.current?.stop();
    speechRef.current = null;
    recorderRef.current = null;
    const audio = await audioPromise;
    if (ticket !== epoch.current) return;
    const live = transcriptRef.current.trim();
    const shot = photosRef.current;
    if (!(await isReachable())) {
      if (!live && !(audio && audio.size > 800) && shot.length === 0) {
        setError("holdLonger");
        return;
      }
      await saveOffline({ typed: "", live, transcript: live, photos: shot, audio });
      return;
    }
    setPhase("writing");
    setFlushPaused(true);
    try {
      const logic = (await pullLogic()) ?? loadLogic();
      let text = live;
      if (audio && audio.size > 800) {
        const heard = await transcribeSpeech({
          audio,
          language: spoken,
          keyterms: logic.stt_keyterms,
        });
        if (heard) {
          text = heard;
          setTranscript(heard);
        }
      }
      if (!text && shot.length === 0) {
        setPhase("idle");
        setError("holdLonger");
        return;
      }
      if (ticket !== epoch.current) return;
      const extraction = await extractReport({ transcript: text, photos: shot, logic, language: spoken });
      if (ticket !== epoch.current) return;
      saveCapture({ transcript: text, photos: shot, language: spoken, extraction });
      void navigate.push("/draft");
    } catch (caught) {
      if (ticket !== epoch.current) return;
      if (isNetworkError(caught)) {
        await saveOffline({ typed: "", live, transcript: live, photos: shot, audio });
        return;
      }
      setPhase("idle");
      setError("outboxFailed");
    } finally {
      if (ticket === epoch.current) setFlushPaused(false);
    }
  }

  async function submitTyped() {
    const ticket = epoch.current;
    const text = typed.trim();
    const shot = photosRef.current;
    if (!text && shot.length === 0) {
      setError("typeOrPhoto");
      return;
    }
    if (!(await isReachable())) {
      await saveOffline({ typed: text, live: "", transcript: text, photos: shot, audio: null });
      return;
    }
    setPhase("writing");
    setFlushPaused(true);
    try {
      const logic = (await pullLogic()) ?? loadLogic();
      if (ticket !== epoch.current) return;
      const extraction = await extractReport({ transcript: text, photos: shot, logic, language: spoken });
      if (ticket !== epoch.current) return;
      saveCapture({ transcript: text, photos: shot, language: spoken, extraction });
      void navigate.push("/draft");
    } catch (caught) {
      if (ticket !== epoch.current) return;
      if (isNetworkError(caught)) {
        await saveOffline({ typed: text, live: "", transcript: text, photos: shot, audio: null });
        return;
      }
      setPhase("idle");
      setError("outboxFailed");
    } finally {
      if (ticket === epoch.current) setFlushPaused(false);
    }
  }

  async function writeFromPhoto(all: string[]) {
    const ticket = epoch.current;
    if (!(await isReachable())) {
      await saveOffline({ typed: "", live: "", transcript: "", photos: all, audio: null });
      return;
    }
    setPhase("writing");
    setError("");
    setFlushPaused(true);
    try {
      const logic = (await pullLogic()) ?? loadLogic();
      if (ticket !== epoch.current) return;
      const extraction = await extractReport({ transcript: "", photos: all, logic, language: spoken });
      if (ticket !== epoch.current) return;
      saveCapture({ transcript: "", photos: all, language: spoken, extraction });
      void navigate.push("/draft");
    } catch (caught) {
      if (ticket !== epoch.current) return;
      if (isNetworkError(caught)) {
        await saveOffline({ typed: "", live: "", transcript: "", photos: all, audio: null });
        return;
      }
      setPhase("idle");
      setError("outboxFailed");
    } finally {
      if (ticket === epoch.current) setFlushPaused(false);
    }
  }

  async function onPhotos(fileList: FileList | null) {
    if (!fileList?.length || phase === "writing") return;
    const room = 3 - photos.length;
    const next: string[] = [];
    for (const file of [...fileList].slice(0, room)) {
      try {
        next.push(await resizeImage(file));
      } catch {
        setError("badPhoto");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    if (!next.length) return;
    const all = [...photos, ...next].slice(0, 3);
    setPhotos(all);
    photosRef.current = all;
    await writeFromPhoto(all);
  }

  function startNew() {
    setSavedNotice(false);
    setTyping(false);
    setError("");
    setPhotos([]);
    setTyped("");
    setTranscript("");
    transcriptRef.current = "";
  }

  const gated = requireSignIn && !session;
  const waitingLabel = t("waitingSignal").replace("{n}", String(waiting));

  return (
    <WorkerColumn>
      <WorkerHeader onGear={() => setSheet(true)} />
      {gated ? (
        <div className="capture">
          <p className="capture-help">{t("signInReport")}</p>
          <div className="capture-stage">
            {providers.microsoft ? (
              <a className="tap tap-primary w-full" href="/api/auth/microsoft">
                {t("signInMicrosoft")}
              </a>
            ) : null}
            {providers.google ? (
              <a className={providers.microsoft ? "photo-bar mt-3" : "tap tap-primary w-full"} href="/api/auth/google">
                {t("signInGoogle")}
              </a>
            ) : null}
            {!providers.microsoft && !providers.google ? <p className="capture-note">{t("askAdminSso")}</p> : null}
          </div>
          {error ? <p className="capture-note">{t(error)}</p> : null}
        </div>
      ) : savedNotice ? (
        <div className="capture">
          <p className="capture-mic-label">{t("savedOffline")}</p>
          <p className="capture-help">{t("savedOfflineHelp")}</p>
          <button type="button" className="tap tap-primary capture-write w-full" onClick={startNew}>
            {t("newReport")}
          </button>
          {waiting > 0 ? (
            <button type="button" className="outbox-badge" onClick={() => setQueueOpen(true)}>
              {waitingLabel}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="capture">
          {typing ? (
            <div className="capture-type">
              <textarea
                className="field-input capture-box"
                value={typed}
                placeholder={t("whatHappened")}
                onChange={(event) => setTyped(event.target.value)}
              />
              <button type="button" className="tap tap-primary capture-write w-full" onClick={() => void submitTyped()}>
                {t("writeReport")}
              </button>
              <button type="button" className="type-link" onClick={() => setTyping(false)}>
                {t("backButton")}
              </button>
              {error ? <p className="capture-note">{t(error)}</p> : null}
            </div>
          ) : (
            <>
              <p className="capture-help">{t("holdHelp")}</p>
              <div className="capture-stage">
                <button
                  type="button"
                  className="mic"
                  data-holding={holding}
                  aria-label={t("holdTalk")}
                  aria-pressed={holding}
                  disabled={phase === "writing"}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    void beginHold();
                  }}
                  onPointerUp={() => void endHold()}
                  onPointerCancel={() => void endHold()}
                >
                  <Mic size={92} strokeWidth={1.75} color="#ffffff" />
                </button>
                <p className="capture-mic-label" aria-live="polite">
                  {holding ? t("listening") : t("holdTalk")}
                </p>
                {transcript ? <p className="capture-note">{transcript}</p> : null}
                {error ? <p className="capture-note">{t(error)}</p> : null}
              </div>
              <div className="capture-more">
                {waiting > 0 ? (
                  <button type="button" className="outbox-badge" onClick={() => setQueueOpen(true)}>
                    {waitingLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="photo-bar"
                  disabled={photos.length >= 3 || phase === "writing"}
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera size={36} />
                  {t("addPhoto")}
                  {photos.length > 0 ? <span className="photo-badge">{photos.length}/3</span> : null}
                </button>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={(event) => void onPhotos(event.target.files)}
                />
                <p className="photo-caption">{t("photoCap")}</p>
                <button type="button" className="type-link" onClick={() => setTyping(true)}>
                  {t("typeInstead")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {phase === "writing" ? (
        <div className="sheet" role="status">
          <div className="sheet-card text-center">
            <Wordmark />
            <p className="mt-4 text-lg">{t("writing")}</p>
          </div>
        </div>
      ) : null}
      {queueOpen ? (
        <div className="sheet" role="presentation" onClick={() => setQueueOpen(false)}>
          <div className="sheet-card" role="dialog" aria-label={waitingLabel} onClick={(event) => event.stopPropagation()}>
            {queue.length === 0 ? <p>{t("outboxEmpty")}</p> : null}
            <div className="outbox-list">
              {queue.map((item) => {
                const words = (item.transcript || item.typed_text || item.live_transcript).trim();
                return (
                  <div key={item.id} className="outbox-row">
                    {item.photos[0] ? <img className="outbox-thumb" src={item.photos[0]} alt="" /> : <span className="outbox-thumb" />}
                    <div>
                      <p className="outbox-meta">
                        {new Date(item.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="outbox-words">{words || t("savedOffline")}</p>
                      <p className="outbox-meta">
                        {item.status === "failed" ? t("outboxFailed") : item.status === "writing" ? t("writing") : t("savedOfflineHelp")}
                      </p>
                      {item.error === "audio_dropped" ? <p className="outbox-meta">{t("outboxAudioNote")}</p> : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="tap tap-primary"
                          onClick={() => void requestFlush(item.id).then(() => refreshQueue())}
                        >
                          {t("writeNow")}
                        </button>
                        {item.status === "failed" ? (
                          <button
                            type="button"
                            className="tap tap-quiet"
                            onClick={() => void requestFlush(item.id).then(() => refreshQueue())}
                          >
                            {t("outboxRetry")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="tap tap-quiet"
                          onClick={() => {
                            if (pendingDelete !== item.id) {
                              setPendingDelete(item.id);
                              return;
                            }
                            void remove(item.id).then(() => {
                              setPendingDelete("");
                              return refreshQueue();
                            });
                          }}
                        >
                          {pendingDelete === item.id ? t("reports.confirmDelete") : t("outboxDelete")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" className="tap tap-text mt-2 w-full" onClick={() => setQueueOpen(false)}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
      {sheet ? (
        <div className="sheet" role="presentation" onClick={() => setSheet(false)}>
          <div className="sheet-card" role="dialog" aria-label={t("settings")} onClick={(event) => event.stopPropagation()}>
            {session ? (
              <p className="text-base">
                {t("signedIn")} {session.name}
                {session.org_path ? ` · ${session.org_path}` : ""}
              </p>
            ) : null}
            {!session && providers.microsoft ? (
              <a className="tap tap-quiet mt-4 w-full" href="/api/auth/microsoft">
                {t("signInMicrosoft")}
              </a>
            ) : null}
            {!session && providers.google ? (
              <a className="tap tap-quiet mt-2 w-full" href="/api/auth/google">
                {t("signInGoogle")}
              </a>
            ) : null}
            {session ? (
              <button
                type="button"
                className="tap tap-quiet mt-4 w-full"
                onClick={() => {
                  cacheSession(null);
                  void signOutSession().then(() => setSession(null));
                }}
              >
                {t("signOut")}
              </button>
            ) : null}
            <a className="tap tap-quiet mt-4 w-full" href="/admin">
              {t("admin")}
            </a>
            <button type="button" className="tap tap-text mt-2 w-full" onClick={() => setSheet(false)}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </WorkerColumn>
  );
}

type LiveSpeech = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  start: () => void;
  stop: () => void;
};

function startLiveSpeech(language: string, onText: (text: string) => void): { stop: () => void } | null {
  const host = window as typeof window & {
    SpeechRecognition?: new () => LiveSpeech;
    webkitSpeechRecognition?: new () => LiveSpeech;
  };
  const Ctor = host.SpeechRecognition || host.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  const speech = LANGUAGES.find((item) => item.id === language)?.speech;
  if (speech) rec.lang = speech;
  rec.onresult = (event) => {
    let text = "";
    for (let i = 0; i < event.results.length; i += 1) {
      text += event.results[i]?.[0]?.transcript || "";
    }
    onText(text.trim());
  };
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    },
  };
}

async function startRecorder(): Promise<{ stop: () => Promise<Blob | null> } | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    rec.start();
    return {
      stop: () =>
        new Promise((resolve) => {
          rec.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            resolve(chunks.length ? new Blob(chunks, { type: rec.mimeType || "audio/webm" }) : null);
          };
          if (rec.state === "inactive") {
            stream.getTracks().forEach((track) => track.stop());
            resolve(null);
            return;
          }
          rec.stop();
        }),
    };
  } catch {
    return null;
  }
}
