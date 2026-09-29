"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic } from "lucide-react";
import { WorkerColumn, WorkerHeader, Wordmark } from "@/App";
import { activeLanguage, useI18n } from "@/i18n";
import { fetchSession, pushConfig, signOutSession, type SignedInUser } from "@/remote";
import { LANGUAGES } from "@/schema";
import { loadLogic, loadSso, saveCapture } from "@/storage";
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
  const transcriptRef = useRef("");
  const holdingRef = useRef(false);
  const recorderRef = useRef<{ stop: () => Promise<Blob | null> } | null>(null);
  const speechRef = useRef<{ stop: () => void } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("sso") === "failed") setError("ssoFailed");
    void (async () => {
      await pushConfig();
      const sso = loadSso();
      setRequireSignIn(sso.requireSignIn);
      setProviders({ microsoft: sso.microsoft.enabled, google: sso.google.enabled });
      setSession(await fetchSession());
    })();
  }, []);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

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
    holdingRef.current = false;
    setHolding(false);
    setPhase("writing");
    const audioPromise = recorderRef.current?.stop() ?? Promise.resolve(null);
    speechRef.current?.stop();
    speechRef.current = null;
    recorderRef.current = null;
    const audio = await audioPromise;
    const logic = loadLogic();
    let text = transcriptRef.current.trim();
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
    if (!text && photos.length === 0) {
      setPhase("idle");
      setError("holdLonger");
      return;
    }
    const extraction = await extractReport({ transcript: text, photos, logic, language: spoken });
    saveCapture({ transcript: text, photos, language: spoken, extraction });
    void navigate.push("/draft");
  }

  async function submitTyped() {
    const text = typed.trim();
    if (!text && photos.length === 0) {
      setError("typeOrPhoto");
      return;
    }
    setPhase("writing");
    const logic = loadLogic();
    const extraction = await extractReport({ transcript: text, photos, logic, language: spoken });
    saveCapture({ transcript: text, photos, language: spoken, extraction });
    void navigate.push("/draft");
  }

  async function onPhotos(list: FileList | null) {
    if (!list?.length) return;
    const room = 3 - photos.length;
    const next: string[] = [];
    for (const file of [...list].slice(0, room)) {
      try {
        next.push(await resizeImage(file));
      } catch {
        setError("badPhoto");
      }
    }
    setPhotos((current) => [...current, ...next].slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  const gated = requireSignIn && !session;

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
            {!providers.microsoft && !providers.google ? (
              <p className="capture-note">{t("askAdminSso")}</p>
            ) : null}
          </div>
          {error ? <p className="capture-note">{t(error)}</p> : null}
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
      {sheet ? (
        <div className="sheet" role="presentation" onClick={() => setSheet(false)}>
          <div
            className="sheet-card"
            role="dialog"
            aria-label={t("settings")}
            onClick={(event) => event.stopPropagation()}
          >
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
