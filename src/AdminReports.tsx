import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { pullReports, pushConfig, removeRemoteReport } from "@/remote";
import { reportToRow, type ReportRow, type SafetyReport } from "@/schema";
import { copyText, deleteLocalReport, loadLogic, loadReports } from "@/storage";

function header(
  key: string,
  labels: Map<string, string>,
  translate: (key: string) => string,
  name: (kind: "field" | "case" | "opt", id: string, fallback: string) => string,
): string {
  if (key === "created_at") return translate("reports.when");
  if (key === "case_label") return translate("reports.case");
  if (key === "org_path") return translate("reports.org");
  if (key === "reporter_name") return translate("reports.reporter");
  if (key === "photo_count") return translate("reports.photos");
  if (key === "source") return translate("reports.source");
  return name("field", key, labels.get(key) ?? key);
}

function show(
  key: string,
  value: ReportRow[string],
  translate: (key: string) => string,
  name: (kind: "field" | "case" | "opt", id: string, fallback: string) => string,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? translate("opt.Yes") : translate("opt.No");
  if (key === "source" && typeof value === "string") return translate(value === "demo" ? "source.demo" : "source.ai");
  if (key === "created_at" && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
  }
  if (typeof value === "string" && key !== "org_path" && key !== "reporter_name" && key !== "transcript" && key !== "first_line") {
    const named = name("opt", value, "");
    if (named) return named;
  }
  return String(value);
}

function columnsFor(rows: ReportRow[], fieldKeys: string[]): string[] {
  const used = fieldKeys.filter((key) => rows.some((row) => row[key] !== null && row[key] !== ""));
  const reporter = rows.some((row) => row.reporter_name) ? ["reporter_name"] : [];
  const org = rows.some((row) => row.org_path) ? ["org_path"] : [];
  return ["created_at", "case_label", ...org, ...reporter, ...used, "photo_count", "source"];
}

function sheet(
  rows: ReportRow[],
  columns: string[],
  labels: Map<string, string>,
  translate: (key: string) => string,
  name: (kind: "field" | "case" | "opt", id: string, fallback: string) => string,
): string {
  const esc = (value: ReportRow[string]) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const head = columns.map((key) => header(key, labels, translate, name)).join("\t");
  const body = rows.map((row) => columns.map((key) => esc(row[key])).join("\t"));
  return [head, ...body].join("\n");
}

export function AdminReports() {
  const { t, label } = useI18n();
  const [reports, setReports] = useState<SafetyReport[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      await pushConfig();
      setReports(await pullReports());
    })();
  }, []);

  function refresh() {
    setReports(loadReports());
  }

  const logic = loadLogic();
  const labels = new Map(logic.fields.map((field) => [field.key, field.label]));
  const rows = reports.map((report) => reportToRow(report, logic));
  const columns = columnsFor(rows, logic.fields.map((field) => field.key));
  const cell = (key: string, row: ReportRow) =>
    key === "case_label"
      ? label("case", String(row.case_type ?? ""), show(key, row[key], t, label))
      : show(key, row[key], t, label);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("reports.hint")}</p>
        {rows.length > 0 ? (
          <button type="button" className="tap tap-quiet" onClick={() => void copyText(sheet(rows, columns, labels, t, label))}>
            {t("reports.copy")}
          </button>
        ) : null}
      </div>
      {rows.length === 0 ? <p className="text-muted">{t("reports.empty")}</p> : null}
      {rows.length > 0 ? (
        <div className="report-scroll">
          <table className="report-table">
            <thead>
              <tr>
                {columns.map((key) => (
                  <th key={key}>{header(key, labels, t, label)}</th>
                ))}
                <th> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row.id ?? "");
                return (
                  <tr key={id}>
                    {columns.map((key) => (
                      <td key={key} title={cell(key, row)}>
                        {cell(key, row)}
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="tap tap-quiet"
                        onClick={() => {
                          if (pending !== id) {
                            setPending(id);
                            return;
                          }
                          deleteLocalReport(id);
                          void removeRemoteReport(id);
                          setPending(null);
                          refresh();
                        }}
                      >
                        {pending === id ? t("reports.confirmDelete") : t("reports.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}