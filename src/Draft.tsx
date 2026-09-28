"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { WorkerColumn, WorkerHeader } from "@/App";
import { useI18n } from "@/i18n";
import { orgName, orgPath } from "@/org";
import { fetchSession, publishReport, pushConfig, type SignedInUser } from "@/remote";
import {
  applyDefaults,
  caseById,
  enabledCases,
  enumOptions,
  firstLineOf,
  isEmpty,
  isVisible,
  missingRequired,
  optionLabel,
  pruneHidden,
  type Field,
  type Logic,
  type Value,
  type Values,
} from "@/schema";
import {
  clearCapture,
  loadCapture,
  loadLogic,
  loadOrg,
  rememberReport,
  saveCapture,
  upsertReport,
  type CaptureDraft,
} from "@/storage";

export function Draft() {
  const navigate = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [logic, setLogic] = useState<Logic | null>(null);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [values, setValues] = useState<Values>({});
  const [caseType, setCaseType] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [places, setPlaces] = useState<{ id: string; path: string; name: string }[]>([]);
  const [reporter, setReporter] = useState<SignedInUser | null>(null);

  useEffect(() => {
    const current = loadLogic();
    const capture = loadCapture();
    setLogic(current);
    setDraft(capture);
    if (capture) {
      const initialType = capture.extraction.case_type;
      setCaseType(initialType);
      setValues(pruneHidden(current, applyDefaults(current, capture.extraction.values), initialType));
    }
    setReady(true);
    const nodes = loadOrg().nodes;
    setPlaces(
      nodes
        .map((node) => ({ id: node.id, name: node.name, path: orgPath(nodes, node.id) }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    );
    void fetchSession().then((user) => {
      setReporter(user);
      if (user?.org_id) setOrgId((current) => current || user.org_id || "");
    });
  }, []);

  useEffect(() => {
    if (!ready || !logic || !draft) return;
    saveCapture({
      ...draft,
      extraction: { ...draft.extraction, case_type: caseType, values },
    });
  }, [ready, logic, draft, caseType, values]);

  if (!ready || !logic) {
    return (
      <WorkerColumn>
        <WorkerHeader />
        <p className="px-4 pt-8 text-muted">{t("opening")}</p>
      </WorkerColumn>
    );
  }

  if (!draft) {
    return (
      <WorkerColumn>
        <WorkerHeader />
        <div className="px-4 pt-10">
          <p className="text-lg">{t("noReport")}</p>
          <Link href="/" className="tap tap-primary mt-6 w-full">
            {t("newReport")}
          </Link>
        </div>
      </WorkerColumn>
    );
  }

  const selected = caseById(logic, caseType);
  const missing = new Set(missingRequired(logic, values, caseType).map((item) => item.key));

  function commit(nextValues: Values, nextCase = caseType) {
    setValues(pruneHidden(logic as Logic, nextValues, nextCase));
  }

  async function submit() {
    if (!logic || !draft) return;
    const next = pruneHidden(logic, applyDefaults(logic, values), caseType);
    setValues(next);
    if (missingRequired(logic, next, caseType).length || (places.length > 0 && !orgId)) {
      setBlocked(true);
      return;
    }
    setSending(true);
    const item = caseById(logic, caseType);
    const report = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      case_type: caseType,
      case_label: item?.label || caseType,
      confidence: draft.extraction.confidence,
      language: draft.language,
      transcript: draft.transcript,
      values: next,
      photos: draft.photos,
      ask_user: missingRequired(logic, next, caseType).map((field) => field.key),
      source: draft.extraction.source,
      first_line: firstLineOf(next, draft.transcript),
      org_id: orgId || null,
      org_name: orgId ? orgName(loadOrg().nodes, orgId) : null,
      org_path: orgId ? orgPath(loadOrg().nodes, orgId) : reporter?.org_path || null,
      reporter_email: reporter?.email || null,
      reporter_name: reporter?.name || null,
    };
    upsertReport(report);
    rememberReport(report.id);
    await publishReport(report);
    await pushConfig();
    clearCapture();
    void navigate.push("/done");
  }

  return (
    <WorkerColumn>
      <WorkerHeader />
      <div className="px-4 pb-10 pt-4">
        {places.length > 0 ? (
          <label className="mb-4 grid gap-1 text-base font-medium" htmlFor="organization">
            {t("organization")}
            <select
              id="organization"
              className={blocked && !orgId ? "select-input missing" : "select-input"}
              value={orgId}
              onChange={(event) => {
                setBlocked(false);
                setOrgId(event.target.value);
              }}
            >
              <option value="">{t("choosePlace")}</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.path || place.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <ReportForm
          logic={logic}
          values={values}
          caseType={caseType}
          photos={draft.photos}
          missing={missing}
          note={draftNote(draft.extraction.note, draft.extraction.source, t)}
          onCaseType={(id) => {
            setCaseType(id);
            setBlocked(false);
            commit(values, id);
          }}
          onChange={(next) => {
            setBlocked(false);
            commit(next);
          }}
        />
        {blocked ? (
          <p className="mt-4 text-base text-primary">
            {places.length > 0 && !orgId ? t("choosePlace") : t("fillFields")}
          </p>
        ) : null}
        <div className="mt-6 grid gap-3">
          {selected?.needs_confirm ? (
            <button type="button" className="tap tap-danger w-full" disabled={sending} onClick={() => void submit()}>
              {t("injurySend")}
            </button>
          ) : (
            <button type="button" className="tap tap-primary w-full" disabled={sending} onClick={() => void submit()}>
              {sending ? t("sending") : t("submit")}
            </button>
          )}
          <button
            type="button"
            className="tap tap-quiet w-full"
            onClick={() => {
              clearCapture();
              void navigate.push("/");
            }}
          >
            {t("recordAgain")}
          </button>
        </div>
      </div>
    </WorkerColumn>
  );
}

export function ReportForm({
  logic,
  values,
  caseType,
  photos,
  missing,
  note,
  readOnly,
  onCaseType,
  onChange,
}: {
  logic: Logic;
  values: Values;
  caseType: string;
  photos: string[];
  missing?: Set<string>;
  note?: string;
  readOnly?: boolean;
  onCaseType?: (id: string) => void;
  onChange?: (values: Values) => void;
}) {
  const { t, label } = useI18n();
  const cases = enabledCases(logic);
  const description = logic.fields.find((item) => item.key === "description");
  const action = logic.fields.find((item) => item.key === "immediate_action");
  const details = useMemo(() => {
    const rest = logic.fields.filter((item) => item.key !== "description" && item.key !== "immediate_action");
    const shown = rest.filter((item) => isVisible(item, values, caseType));
    const gaps = shown.filter((item) => item.required && isEmpty(item, values[item.key]));
    return [...gaps, ...shown.filter((item) => !gaps.includes(item))];
  }, [logic, values, caseType]);

  function change(key: string, value: Value) {
    onChange?.({ ...values, [key]: value });
  }

  return (
    <div>
      {photos.length ? (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {photos.map((src, index) => (
            <div className="thumb" key={`${index}-${src.length}`}>
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {cases.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            data-on={item.id === caseType}
            disabled={readOnly}
            onClick={() => onCaseType?.(item.id)}
          >
            {label("case", item.id, item.label)}
          </button>
        ))}
      </div>
      {note ? <p className="mt-3 text-sm text-muted">{note}</p> : null}
      {description && isVisible(description, values, caseType) ? (
        <div className="mt-4">
          <FieldEditor
            field={description}
            values={values}
            missing={Boolean(missing?.has(description.key))}
            readOnly={readOnly}
            onChange={change}
          />
        </div>
      ) : null}
      {action && isVisible(action, values, caseType) ? (
        <div className="mt-4">
          <FieldEditor
            field={action}
            values={values}
            missing={Boolean(missing?.has(action.key))}
            readOnly={readOnly}
            onChange={change}
          />
        </div>
      ) : null}
      {details.length ? (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted">{t("details")}</h2>
          <div className="mt-3 grid gap-4">
            {details.map((item) => (
              <FieldEditor
                key={item.key}
                field={item}
                values={values}
                missing={Boolean(missing?.has(item.key))}
                readOnly={readOnly}
                onChange={change}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldEditor({
  field,
  values,
  missing,
  readOnly,
  onChange,
}: {
  field: Field;
  values: Values;
  missing: boolean;
  readOnly?: boolean;
  onChange: (key: string, value: Value) => void;
}) {
  const { t, label } = useI18n();
  const id = `field-${field.key}`;
  const shown = label("field", field.key, field.label);
  const value = values[field.key];
  const options = enumOptions(field, values);
  const className = missing ? "field-input missing" : "field-input";
  let control: ReactNode;
  if (field.type === "textarea") {
    control = (
      <textarea
        id={id}
        className={className}
        readOnly={readOnly}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  } else if (field.type === "boolean") {
    control = (
      <label className="tap tap-quiet w-full justify-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={readOnly}
          onChange={(event) => onChange(field.key, event.target.checked)}
        />
        {shown}
      </label>
    );
  } else if (field.type === "enum") {
    control = (
      <select
        id={id}
        className={missing ? "select-input missing" : "select-input"}
        disabled={readOnly}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      >
        <option value="">{t("choose")}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {label("opt", option, optionLabel(option))}
          </option>
        ))}
      </select>
    );
  } else if (field.type === "datetime") {
    control = (
      <input
        id={id}
        className={className}
        type="datetime-local"
        readOnly={readOnly}
        value={toLocalInput(typeof value === "string" ? value : "")}
        onChange={(event) => onChange(field.key, fromLocalInput(event.target.value))}
      />
    );
  } else if (field.type === "number") {
    control = (
      <input
        id={id}
        className={className}
        type="number"
        readOnly={readOnly}
        value={typeof value === "number" ? value : ""}
        onChange={(event) => onChange(field.key, event.target.value === "" ? null : Number(event.target.value))}
      />
    );
  } else {
    control = (
      <input
        id={id}
        className={className}
        type="text"
        readOnly={readOnly}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(field.key, event.target.value)}
      />
    );
  }
  if (field.type === "boolean") return control;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {shown}
        {field.required ? <span className="text-primary"> *</span> : null}
      </label>
      {control}
    </div>
  );
}

function toLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function draftNote(note: string | undefined, source: string, translate: (key: string) => string): string {
  if (!note || note === "Drafted from your words.") {
    return source === "demo" ? translate("draftedWords") : translate("draftedAi");
  }
  if (
    note.startsWith("The AI did not answer") ||
    note.startsWith("The model returned") ||
    note.startsWith("Grok did not")
  ) {
    return translate("aiFallback");
  }
  return note;
}
