import type { ReactNode } from "react";
import { Settings } from "lucide-react";
import { useI18n } from "@/i18n";
import { LANGUAGES } from "@/schema";

export function WorkerColumn({ children }: { children: ReactNode }) {
  return <div className="worker-col">{children}</div>;
}

export function AdminColumn({ children }: { children: ReactNode }) {
  return <div className="admin-col">{children}</div>;
}

export function Wordmark() {
  return <p className="wordmark">SafetyBot</p>;
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
    <header className="flex items-center justify-between gap-2 px-2 pt-[max(8px,env(safe-area-inset-top))]">
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