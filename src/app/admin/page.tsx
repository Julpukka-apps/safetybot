"use client";

import { useEffect, useState } from "react";
import { AdminColumn, LanguageSelect, Wordmark } from "@/App";
import { useI18n } from "@/i18n";
import { AdminAccess } from "@/AdminAccess";
import { AdminApi } from "@/AdminApi";
import { AdminLogin, PasswordSetup } from "@/AdminLogin";
import { AdminLogic } from "@/AdminLogic";
import { AdminReports } from "@/AdminReports";
import { adminSessionActive, endAdminSession, passwordSetupActive } from "@/storage";

type Tab = "logic" | "api" | "reports" | "access";
type Mode = "login" | "setup" | "app";

export default function AdminPage() {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [tab, setTab] = useState<Tab>("logic");

  useEffect(() => {
    if (adminSessionActive()) setMode("app");
    else if (passwordSetupActive()) setMode("setup");
    else setMode("login");
  }, []);

  if (mode === "setup") return <PasswordSetup onReady={() => setMode("app")} />;
  if (mode !== "app") return <AdminLogin onReady={() => setMode("app")} onSetup={() => setMode("setup")} />;

  return (
    <AdminColumn>
      <header className="flex items-center justify-between pt-4">
        <div>
          <Wordmark />
          <p className="text-sm text-muted">{t("admin")}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelect />
          <button
            type="button"
            className="tap tap-quiet"
            onClick={() => {
              endAdminSession();
              setMode("login");
            }}
          >
            {t("signOut")}
          </button>
        </div>
      </header>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t("admin")}>
        {(
          [
            ["logic", "tab.logic"],
            ["api", "tab.api"],
            ["reports", "tab.reports"],
            ["access", "tab.access"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="chip"
            data-on={tab === id}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "logic" ? <AdminLogic /> : null}
        {tab === "api" ? <AdminApi /> : null}
        {tab === "reports" ? <AdminReports /> : null}
        {tab === "access" ? <AdminAccess /> : null}
      </div>
    </AdminColumn>
  );
}
