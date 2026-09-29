"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { useI18n } from "@/i18n";
import { LANGUAGES } from "@/schema";

export const HOME_EVENT = "safetybot-home";

export function requestHome() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(HOME_EVENT));
}

export function WorkerColumn({ children }: { children: ReactNode }) {
  return <div className="worker-col">{children}</div>;
}

export function AdminColumn({ children }: { children: ReactNode }) {
  return <div className="admin-col">{children}</div>;
}

export function Wordmark() {
  const router = useRouter();
  return (
    <Link
      href="/"
      className="wordmark"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        requestHome();
        router.push("/");
      }}
    >
      SafetyBot
    </Link>
  );
}

export function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();
  return (
    <select
      className="lang-select"
      aria-label={t("language")}
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
    >
      {LANGUAGES.map((item) => (
        <option key={item.id} value={item.id}>
          {item.id === "auto" ? t("autoDetect") : item.label}
        </option>
      ))}
    </select>
  );
}

export function WorkerHeader({ onGear }: { onGear?: () => void }) {
  const { t } = useI18n();
  return (
    <header className="worker-head flex items-center justify-between gap-2 px-2 pt-[max(8px,env(safe-area-inset-top))]">
      <Wordmark />
      <div className="flex items-center gap-1">
        <LanguageSelect />
        {onGear ? (
          <button type="button" className="icon-btn" aria-label={t("settings")} onClick={onGear}>
            <Settings size={22} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </header>
  );
}