"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WorkerColumn, WorkerHeader } from "@/App";
import { useI18n } from "@/i18n";
import { clearCapture, lastReportId, loadReports } from "@/storage";

export function Done() {
  const { t } = useI18n();
  const [line, setLine] = useState("");

  useEffect(() => {
    const id = lastReportId();
    const report = loadReports().find((item) => item.id === id);
    setLine(report?.first_line || "");
  }, []);

  return (
    <WorkerColumn>
      <WorkerHeader />
      <div className="px-4 pt-16">
        <h1 className="text-2xl font-semibold tracking-tight">{t("reportSent")}</h1>
        {line ? <p className="mt-4 text-ink">{line}</p> : null}
        <Link href="/" className="tap tap-primary mt-8 w-full" onClick={() => clearCapture()}>
          {t("newReport")}
        </Link>
      </div>
    </WorkerColumn>
  );
}
