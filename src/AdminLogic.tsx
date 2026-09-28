import { useMemo, useState } from "react";
import { ReportForm } from "@/Draft";
import { useI18n } from "@/i18n";
import { pushConfig } from "@/remote";
import {
  SAMPLE_TRANSCRIPT,
  defaultLogic,
  demoExtract,
  enabledCases,
  type CaseType,
  type ExtractFrom,
  type Field,
  type FieldType,
  type Logic,
  type ShowOp,
  type Values,
} from "@/schema";
import { loadLogic, saveLogic } from "@/storage";

const TYPES: FieldType[] = ["text", "textarea", "enum", "boolean", "datetime", "number"];
const EXTRACTS: ExtractFrom[] = ["speech", "photo", "both", "none"];
const OPS: ShowOp[] = ["eq", "neq", "in", "not_in"];

const SAMPLES = [
  { id: "esc", label: "Escalator", text: SAMPLE_TRANSCRIPT },
  {
    id: "ksc",
    label: "Supply chain",
    text: "Supply chain stop and go. Work stopped because the truck was not secured. Employee.",
  },
  {
    id: "nbs",
    label: "New building",
    text: "New building major project. Idea: add a better barricade at the landing door.",
  },
];

export function AdminLogic() {
  const { t, label } = useI18n();
  const [logic, setLogic] = useState<Logic>(() => loadLogic());
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saved, setSaved] = useState("");
  const [sampleId, setSampleId] = useState("esc");

  const sample = SAMPLES.find((item) => item.id === sampleId) ?? SAMPLES[0];
  const preview = useMemo(() => demoExtract(sample.text, logic, 0), [sample.text, logic]);
  const [previewValues, setPreviewValues] = useState<Values>(preview.values);
  const [previewCase, setPreviewCase] = useState(preview.case_type);

  function adoptPreview(nextLogic: Logic, text = sample.text) {
    const next = demoExtract(text, nextLogic, 0);
    setPreviewValues(next.values);
    setPreviewCase(next.case_type);
  }

  function persist(next: Logic, message = "logic.saved") {
    const stored = saveLogic(next);
    setLogic(stored);
    setSaved(message);
    void pushConfig();
    return stored;
  }

  function currentFromEditor(): Logic | null {
    if (!jsonMode) return logic;
    try {
      const parsed = JSON.parse(jsonText) as Logic;
      setJsonError("");
      return parsed;
    } catch {
      setJsonError("logic.badJson");
      return null;
    }
  }

  function save() {
    const next = currentFromEditor();
    if (!next) return;
    const stored = persist(next);
    if (jsonMode) setJsonText(JSON.stringify(stored, null, 2));
  }

  function reset() {
    const stored = persist(defaultLogic(), "logic.restored");
    setJsonMode(false);
    adoptPreview(stored);
  }

  function updateField(index: number, patch: Partial<Field>) {
    const fields = logic.fields.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    const next = { ...logic, fields };
    setLogic(next);
    adoptPreview(next);
  }

  function updateCase(index: number, patch: Partial<CaseType>, andSave = false) {
    const case_types = logic.case_types.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    const next = { ...logic, case_types };
    setLogic(next);
    adoptPreview(next);
    if (andSave) persist(next, patch.enabled === false ? "logic.caseOff" : "logic.caseOn");
  }

  const previewMissing = new Set<string>();

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="tap tap-primary" onClick={save}>
            {t("logic.save")}
          </button>
          <button type="button" className="tap tap-quiet" onClick={reset}>
            {t("logic.reset")}
          </button>
          <button
            type="button"
            className="tap tap-quiet"
            onClick={() => {
              if (jsonMode) {
                const next = currentFromEditor();
                if (!next) return;
                setLogic(next);
                setJsonMode(false);
                adoptPreview(next);
              } else {
                setJsonText(JSON.stringify(logic, null, 2));
                setJsonError("");
                setJsonMode(true);
              }
            }}
          >
            {jsonMode ? t("logic.form") : t("logic.json")}
          </button>
        </div>
        {saved ? <p className="text-sm text-primary">{t(saved)}</p> : null}
        {jsonMode ? (
          <div>
            <textarea
              className="field-input min-h-96 font-mono text-sm"
              value={jsonText}
              spellCheck={false}
              onChange={(event) => setJsonText(event.target.value)}
            />
            {jsonError ? <p className="mt-2 text-sm text-primary">{t(jsonError)}</p> : null}
          </div>
        ) : (
          <>
            <section className="card grid gap-3">
              <h2 className="px-2 pt-2 text-sm font-semibold">{t("logic.title")}</h2>
              <label className="grid gap-1 px-2 text-sm font-medium">
                {t("logic.rules")}
                <textarea
                  className="field-input"
                  value={logic.classification_rules}
                  onChange={(event) => setLogic({ ...logic, classification_rules: event.target.value })}
                />
              </label>
              <label className="grid gap-1 px-2 text-sm font-medium">
                {t("logic.template")}
                <textarea
                  className="field-input"
                  value={logic.description_template}
                  onChange={(event) => setLogic({ ...logic, description_template: event.target.value })}
                />
              </label>
              <label className="grid gap-1 px-2 text-sm font-medium">
                {t("logic.prompt")}
                <textarea
                  className="field-input"
                  value={logic.extract_system_prompt}
                  onChange={(event) => setLogic({ ...logic, extract_system_prompt: event.target.value })}
                />
              </label>
              <label className="grid gap-1 px-2 pb-2 text-sm font-medium">
                {t("logic.terms")}
                <textarea
                  className="field-input"
                  value={logic.stt_keyterms.join(", ")}
                  onChange={(event) =>
                    setLogic({
                      ...logic,
                      stt_keyterms: event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </section>
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("logic.cases")}</h2>
                <button
                  type="button"
                  className="tap tap-quiet"
                  onClick={() => {
                    const priority = Math.max(0, ...logic.case_types.map((item) => item.priority)) + 1;
                    setLogic({
                      ...logic,
                      case_types: [
                        ...logic.case_types,
                        {
                          id: `case_${priority}`,
                          label: "New type",
                          needs_confirm: false,
                          priority,
                          hint: "",
                          enabled: true,
                        },
                      ],
                    });
                  }}
                >
                  {t("logic.addCase")}
                </button>
              </div>
              {logic.case_types
                .map((item, index) => ({ item, index }))
                .sort((a, b) => a.item.priority - b.item.priority)
                .map(({ item, index }) => (
                  <div key={`${item.id}-${index}`} className="card grid gap-2 p-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className="field-input"
                        aria-label={t("logic.caseLabel")}
                        value={item.label}
                        onChange={(event) => updateCase(index, { label: event.target.value })}
                      />
                      <input
                        className="field-input"
                        aria-label={t("logic.caseId")}
                        value={item.id}
                        onChange={(event) => updateCase(index, { id: event.target.value.replace(/\s+/g, "_") })}
                      />
                    </div>
                    <input
                      className="field-input"
                      aria-label={t("logic.hint")}
                      value={item.hint}
                      placeholder={t("logic.hint")}
                      onChange={(event) => updateCase(index, { hint: event.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      <label className="tap tap-quiet">
                        <input
                          type="checkbox"
                          checked={item.needs_confirm}
                          onChange={(event) => updateCase(index, { needs_confirm: event.target.checked })}
                        />
                        {t("logic.needsConfirm")}
                      </label>
                      <button
                        type="button"
                        className="tap tap-quiet"
                        onClick={() => updateCase(index, { enabled: item.enabled === false }, true)}
                      >
                        {item.enabled === false ? t("logic.enable") : t("logic.disable")}
                      </button>
                    </div>
                  </div>
                ))}
            </section>
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">{t("logic.fields")}</h2>
                <button
                  type="button"
                  className="tap tap-quiet"
                  onClick={() => {
                    const taken = new Set(logic.fields.map((item) => item.key));
                    let key = "new_field";
                    let n = 2;
                    while (taken.has(key)) {
                      key = `new_field_${n}`;
                      n += 1;
                    }
                    const next = {
                      ...logic,
                      fields: [
                        ...logic.fields,
                        {
                          key,
                          label: "New field",
                          type: "text" as const,
                          required: false,
                          extract_from: "speech" as const,
                          show_if: null,
                          enum_values: [],
                          hint_for_ai: "",
                        },
                      ],
                    };
                    setLogic(next);
                    adoptPreview(next);
                  }}
                >
                  {t("logic.addField")}
                </button>
              </div>
              {logic.fields.map((field, index) => (
                <div key={`${field.key}-${index}`} className="card grid gap-2 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="field-input"
                      aria-label={t("logic.fieldLabel")}
                      value={field.label}
                      onChange={(event) => updateField(index, { label: event.target.value })}
                    />
                    <input
                      className="field-input"
                      aria-label={t("logic.fieldKey")}
                      value={field.key}
                      onChange={(event) =>
                        updateField(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                      }
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      className="select-input"
                      aria-label={t("logic.fieldType")}
                      value={field.type}
                      onChange={(event) => updateField(index, { type: event.target.value as FieldType })}
                    >
                      {TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`type.${type}`)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="select-input"
                      aria-label={t("logic.extractFrom")}
                      value={field.extract_from}
                      onChange={(event) => updateField(index, { extract_from: event.target.value as ExtractFrom })}
                    >
                      {EXTRACTS.map((item) => (
                        <option key={item} value={item}>
                          {t(`extract.${item}`)}
                        </option>
                      ))}
                    </select>
                    <label className="tap tap-quiet">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(index, { required: event.target.checked })}
                      />
                      {t("logic.required")}
                    </label>
                  </div>
                  <input
                    className="field-input"
                    aria-label={t("logic.modelHint")}
                    placeholder={t("logic.modelHint")}
                    value={field.hint_for_ai}
                    onChange={(event) => updateField(index, { hint_for_ai: event.target.value })}
                  />
                  {field.type === "enum" ? (
                    <input
                      className="field-input"
                      aria-label={t("logic.allowed")}
                      placeholder={t("logic.allowed")}
                      value={field.enum_values.join(", ")}
                      onChange={(event) =>
                        updateField(index, {
                          enum_values: event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  ) : null}
                  <ShowIfEditor
                    field={field}
                    keys={["case_type", ...logic.fields.map((item) => item.key)]}
                    onChange={(show_if) => updateField(index, { show_if })}
                  />
                  <button
                    type="button"
                    className="tap tap-text justify-start px-0"
                    onClick={() => {
                      const next = { ...logic, fields: logic.fields.filter((_, item) => item !== index) };
                      setLogic(next);
                      adoptPreview(next);
                    }}
                  >
                    {t("logic.delete")}
                  </button>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
      <aside className="card p-3 lg:sticky lg:top-3">
        <h2 className="text-sm font-semibold">{t("logic.preview")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("logic.previewHelp").replace("{n}", String(enabledCases(logic).length))}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SAMPLES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="chip"
              data-on={item.id === sampleId}
              onClick={() => {
                setSampleId(item.id);
                const next = demoExtract(item.text, logic, 0);
                setPreviewValues(next.values);
                setPreviewCase(next.case_type);
              }}
            >
              {label("opt", item.label, item.label)}
            </button>
          ))}
        </div>
        <div className="mt-4 max-h-[70dvh] overflow-auto pr-1">
          <ReportForm
            logic={logic}
            values={previewCase === preview.case_type ? previewValues : preview.values}
            caseType={previewCase}
            photos={[]}
            missing={previewMissing}
            readOnly={false}
            onCaseType={(id) => {
              setPreviewCase(id);
            }}
            onChange={setPreviewValues}
          />
        </div>
      </aside>
    </div>
  );
}

function ShowIfEditor({
  field,
  keys,
  onChange,
}: {
  field: Field;
  keys: string[];
  onChange: (show_if: Field["show_if"]) => void;
}) {
  const { t } = useI18n();
  const cond = field.show_if;
  const valueText = !cond ? "" : Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select
        className="select-input"
        aria-label={t("logic.showWhen")}
        value={cond?.field ?? ""}
        onChange={(event) => {
          if (!event.target.value) {
            onChange(null);
            return;
          }
          onChange({ field: event.target.value, op: cond?.op ?? "eq", value: cond?.value ?? "" });
        }}
      >
        <option value="">{t("logic.always")}</option>
        {keys.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
      <select
        className="select-input"
        aria-label={t("logic.showOp")}
        disabled={!cond}
        value={cond?.op ?? "eq"}
        onChange={(event) => {
          if (!cond) return;
          const op = event.target.value as ShowOp;
          onChange({ ...cond, op });
        }}
      >
        {OPS.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      <input
        className="field-input"
        aria-label={t("logic.showValue")}
        disabled={!cond}
        placeholder={t("logic.value")}
        value={valueText}
        onChange={(event) => {
          if (!cond) return;
          const op = cond.op;
          const raw = event.target.value;
          const value =
            op === "in" || op === "not_in"
              ? raw.split(",").map((item) => item.trim()).filter(Boolean)
              : raw;
          onChange({ ...cond, value });
        }}
      />
    </div>
  );
}
