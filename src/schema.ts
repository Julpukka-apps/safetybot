export type FieldType = "text" | "textarea" | "enum" | "boolean" | "datetime" | "number";
export type ExtractFrom = "speech" | "photo" | "both" | "none";
export type ShowOp = "eq" | "neq" | "in" | "not_in";

export type ShowIf = {
  field: string;
  op: ShowOp;
  value: string | number | boolean | string[];
} | null;

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  extract_from: ExtractFrom;
  show_if: ShowIf;
  enum_values: string[];
  enum_map?: Record<string, string[]>;
  enum_map_field?: string;
  hint_for_ai: string;
  default?: string | number | boolean | null;
};

export type CaseType = {
  id: string;
  label: string;
  needs_confirm: boolean;
  priority: number;
  hint: string;
  enabled: boolean;
};

export type Logic = {
  schema_version: "1.0.0";
  app_name: "SafetyBot";
  default_language: string;
  case_types: CaseType[];
  classification_rules: string;
  description_template: string;
  extract_system_prompt: string;
  stt_keyterms: string[];
  fields: Field[];
};

export type Value = string | number | boolean | null;
export type Values = Record<string, Value>;

export type Extraction = {
  case_type: string;
  confidence: number;
  ask_user: string[];
  values: Values;
  source: "grok" | "demo";
  note?: string;
};

export type SafetyReport = {
  id: string;
  created_at: string;
  case_type: string;
  case_label: string;
  confidence: number | null;
  language: string;
  transcript: string;
  values: Values;
  photos: string[];
  ask_user: string[];
  source: "grok" | "demo";
  first_line: string;
  photo_count?: number;
  org_id?: string | null;
  org_name?: string | null;
  org_path?: string | null;
  reporter_email?: string | null;
  reporter_name?: string | null;
};

export type ReportRow = Record<string, Value>;

const ROW_META = [
  "id",
  "created_at",
  "case_type",
  "case_label",
  "confidence",
  "language",
  "source",
  "transcript",
  "first_line",
  "photo_count",
  "org_id",
  "org_name",
  "org_path",
  "reporter_email",
  "reporter_name",
] as const;

const ROW_SKIP = new Set<string>([...ROW_META, "photos", "ask_user", "values", "note"]);

export function reportToRow(report: SafetyReport, logic: Logic): ReportRow {
  const row: ReportRow = {
    id: report.id,
    created_at: report.created_at,
    case_type: report.case_type,
    case_label: report.case_label,
    confidence: report.confidence,
    language: report.language,
    source: report.source,
    transcript: report.transcript,
    first_line: report.first_line,
    photo_count: report.photos.length > 0 ? report.photos.length : (report.photo_count ?? 0),
    org_id: report.org_id || null,
    org_name: report.org_name || null,
    org_path: report.org_path || null,
    reporter_email: report.reporter_email || null,
    reporter_name: report.reporter_name || null,
  };
  for (const field of logic.fields) {
    const value = report.values?.[field.key];
    row[field.key] = value === undefined ? null : value;
  }
  return row;
}

export function toSafetyReport(value: unknown, logic: Logic): SafetyReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.created_at !== "string" || typeof raw.case_type !== "string") return null;
  if (raw.values && typeof raw.values === "object" && !Array.isArray(raw.values)) {
    const nested = raw as unknown as SafetyReport;
    return {
      id: nested.id,
      created_at: nested.created_at,
      case_type: nested.case_type,
      case_label: nested.case_label || nested.case_type,
      confidence: typeof nested.confidence === "number" ? nested.confidence : null,
      language: nested.language || "en",
      transcript: nested.transcript || "",
      values: nested.values ?? {},
      photos: Array.isArray(nested.photos) ? nested.photos : [],
      ask_user: Array.isArray(nested.ask_user) ? nested.ask_user : [],
      source: nested.source === "grok" ? "grok" : "demo",
      first_line: nested.first_line || "",
      photo_count: typeof nested.photo_count === "number" ? nested.photo_count : undefined,
      org_id: textOrNull(nested.org_id),
      org_name: textOrNull(nested.org_name),
      org_path: textOrNull(nested.org_path),
      reporter_email: textOrNull(nested.reporter_email),
      reporter_name: textOrNull(nested.reporter_name),
    };
  }
  const values: Values = {};
  for (const field of logic.fields) {
    if (field.key in raw) values[field.key] = plainValue(raw[field.key]);
  }
  for (const [key, item] of Object.entries(raw)) {
    if (ROW_SKIP.has(key) || key in values) continue;
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") values[key] = item;
  }
  return {
    id: raw.id,
    created_at: raw.created_at,
    case_type: raw.case_type,
    case_label: typeof raw.case_label === "string" ? raw.case_label : raw.case_type,
    confidence: typeof raw.confidence === "number" ? raw.confidence : null,
    language: typeof raw.language === "string" ? raw.language : "en",
    transcript: typeof raw.transcript === "string" ? raw.transcript : "",
    values,
    photos: [],
    ask_user: [],
    source: raw.source === "grok" ? "grok" : "demo",
    first_line: typeof raw.first_line === "string" ? raw.first_line : "",
    photo_count: typeof raw.photo_count === "number" ? raw.photo_count : 0,
    org_id: textOrNull(raw.org_id),
    org_name: textOrNull(raw.org_name),
    org_path: textOrNull(raw.org_path),
    reporter_email: textOrNull(raw.reporter_email),
    reporter_name: textOrNull(raw.reporter_name),
  };
}

function plainValue(value: unknown): Value {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export const DEFAULT_API_KEY = "sb_live_demo_change_me";
export const DEFAULT_ADMIN_USER = "admin";
export const DEFAULT_ADMIN_PASSWORD = "SafetyBot2026";

export const LANGUAGES: { id: string; label: string; speech: string }[] = [
  { id: "auto", label: "Auto-detect", speech: "" },
  { id: "en", label: "English", speech: "en-US" },
  { id: "fi", label: "Suomi", speech: "fi-FI" },
  { id: "ar", label: "العربية", speech: "ar" },
  { id: "cs", label: "Čeština", speech: "cs-CZ" },
  { id: "da", label: "Dansk", speech: "da-DK" },
  { id: "nl", label: "Nederlands", speech: "nl-NL" },
  { id: "fil", label: "Filipino", speech: "fil-PH" },
  { id: "fr", label: "Français", speech: "fr-FR" },
  { id: "de", label: "Deutsch", speech: "de-DE" },
  { id: "hi", label: "हिन्दी", speech: "hi-IN" },
  { id: "id", label: "Bahasa Indonesia", speech: "id-ID" },
  { id: "it", label: "Italiano", speech: "it-IT" },
  { id: "ja", label: "日本語", speech: "ja-JP" },
  { id: "ko", label: "한국어", speech: "ko-KR" },
  { id: "mk", label: "Македонски", speech: "mk-MK" },
  { id: "ms", label: "Bahasa Melayu", speech: "ms-MY" },
  { id: "fa", label: "فارسی", speech: "fa-IR" },
  { id: "pl", label: "Polski", speech: "pl-PL" },
  { id: "pt", label: "Português", speech: "pt-PT" },
  { id: "ro", label: "Română", speech: "ro-RO" },
  { id: "ru", label: "Русский", speech: "ru-RU" },
  { id: "es", label: "Español", speech: "es-ES" },
  { id: "sv", label: "Svenska", speech: "sv-SE" },
  { id: "th", label: "ไทย", speech: "th-TH" },
  { id: "tr", label: "Türkçe", speech: "tr-TR" },
  { id: "vi", label: "Tiếng Việt", speech: "vi-VN" },
];

const ELEVATOR_LOCS = [
  "In shaft",
  "On top of elevator car",
  "In pit",
  "Inside elevator car",
  "In machine room",
  "Elevator lobby",
  "Sill of the landing/Car door",
  "Landing Door or Temporary Entrance Protection",
  "Elevator other",
];

const ESCALATOR_LOCS = [
  "In escalator pit",
  "Entrance/Exit of escalator",
  "Escalator lobby",
  "In vicinity of escalator",
  "Handrail of escalator",
  "Escalator other",
];

const DOOR_LOCS = [
  "Sill of the door",
  "Vicinity of the door",
  "Between door panels",
  "Building door lobby",
  "Door other",
];

const BU = {
  ser: "Maintenance",
  nbs: "New building",
  mod: "Modernization",
  ksc: "Supply chain",
  adm: "Administration",
} as const;

const OLD_LABELS: Record<string, string> = {
  "Maintenance Business (SER)": "Maintenance",
  "New Building Solutions (NBS)": "New building",
  "Modernization Business (MOD)": "Modernization",
  "Supply Chain (KSC)": "Supply chain",
  "Administration (ADM) / Technology & Innovation (KTI)": "Administration",
};

function plainText(value: string): string {
  const known = OLD_LABELS[value];
  const source = known ?? value;
  return source
    .replace(/\bKONE\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

const PARTIES = ["Employee", "Subcontractor", "Third party", "End user"] as const;
const EQUIPMENT = ["Elevator", "Escalator", "Door", "Other", "Not applicable"] as const;

function field(
  partial: Pick<Field, "key" | "label" | "type"> & Partial<Field>,
): Field {
  return {
    required: false,
    extract_from: "speech",
    show_if: null,
    enum_values: [],
    hint_for_ai: "",
    ...partial,
  };
}

export function defaultLogic(): Logic {
  const description_template =
    "what / where / who / equipment / activity / hazard or event / immediate action / residual risk. Factual. No blame. User language.";
  return {
    schema_version: "1.0.0",
    app_name: "SafetyBot",
    default_language: "en",
    case_types: [
      {
        id: "injury",
        label: "Injury",
        needs_confirm: true,
        priority: 1,
        hint: "Person was hurt",
        enabled: true,
      },
      {
        id: "near_miss",
        label: "Near miss",
        needs_confirm: false,
        priority: 2,
        hint: "Something happened, nobody hurt",
        enabled: true,
      },
      {
        id: "good_practice",
        label: "Good practice",
        needs_confirm: false,
        priority: 3,
        hint: "Praising something done well",
        enabled: true,
      },
      {
        id: "improvement_idea",
        label: "Idea",
        needs_confirm: false,
        priority: 4,
        hint: "Proposal, no live hazard",
        enabled: true,
      },
      {
        id: "safety_observation",
        label: "Observation",
        needs_confirm: false,
        priority: 5,
        hint: "Hazard or risk seen",
        enabled: true,
      },
    ],
    classification_rules:
      "Apply case_types in priority order. Never invent an injury from an unclear photo.",
    description_template,
    extract_system_prompt:
      "You fill a SafetyBot report. Return only JSON matching the current field schema. Use only allowed enums. Unknown fields null. List missing requireds in ask_user. Classify case_type with confidence 0-1.",
    stt_keyterms: [
      "elevator",
      "escalator",
      "shaft",
      "pit",
      "car top",
      "machine room",
      "landing door",
      "handrail",
      "comb plate",
      "STOP AND GO",
      "first aid",
      "near miss",
      "subcontractor",
      "modernization",
      "maintenance",
    ],
    fields: [
      field({
        key: "incident_datetime",
        label: "When",
        type: "datetime",
        required: true,
        extract_from: "none",
        default: "now",
      }),
      field({
        key: "description",
        label: "Description",
        type: "textarea",
        required: true,
        extract_from: "both",
        hint_for_ai: description_template,
      }),
      field({
        key: "immediate_action",
        label: "Immediate action",
        type: "text",
        extract_from: "both",
        hint_for_ai: "What was done right away to make it safe. Null if not said.",
      }),
      field({
        key: "business_unit",
        label: "Business unit",
        type: "enum",
        required: true,
        extract_from: "speech",
        enum_values: [BU.ser, BU.nbs, BU.mod, BU.ksc, BU.adm],
      }),
      field({
        key: "party_involved",
        label: "Party involved",
        type: "enum",
        required: true,
        extract_from: "speech",
        enum_values: [...PARTIES],
      }),
      field({
        key: "equipment",
        label: "Equipment",
        type: "enum",
        required: true,
        extract_from: "both",
        enum_values: [...EQUIPMENT],
        show_if: { field: "business_unit", op: "not_in", value: [BU.ksc] },
      }),
      field({
        key: "precise_location",
        label: "Precise location",
        type: "enum",
        required: true,
        extract_from: "both",
        enum_values: [],
        enum_map_field: "equipment",
        enum_map: {
          Elevator: ELEVATOR_LOCS,
          Escalator: ESCALATOR_LOCS,
          Door: DOOR_LOCS,
        },
        show_if: { field: "equipment", op: "in", value: ["Elevator", "Escalator", "Door"] },
        hint_for_ai:
          "Pick from the list that matches equipment. Elevator, Escalator, and Door each have their own locations.",
      }),
      field({
        key: "equipment_number",
        label: "Equipment number",
        type: "text",
        extract_from: "both",
        show_if: { field: "equipment", op: "in", value: ["Elevator", "Escalator", "Door"] },
      }),
      field({
        key: "job_site_name",
        label: "Job site",
        type: "text",
        extract_from: "speech",
      }),
      field({
        key: "major_project",
        label: "Major project",
        type: "enum",
        required: true,
        extract_from: "speech",
        enum_values: ["Yes", "No"],
        show_if: { field: "business_unit", op: "in", value: [BU.nbs, BU.mod] },
      }),
      field({
        key: "subcontractor_company",
        label: "Subcontractor company",
        type: "text",
        extract_from: "speech",
        show_if: { field: "party_involved", op: "eq", value: "Subcontractor" },
      }),
      field({
        key: "stop_and_go",
        label: "STOP AND GO",
        type: "enum",
        extract_from: "speech",
        enum_values: ["Yes", "No"],
        show_if: { field: "business_unit", op: "eq", value: BU.ksc },
      }),
      field({
        key: "why_work_stopped",
        label: "Why work stopped",
        type: "text",
        extract_from: "speech",
        show_if: { field: "stop_and_go", op: "eq", value: "Yes" },
      }),
      field({
        key: "classifier",
        label: "Classifier",
        type: "text",
        required: true,
        extract_from: "none",
        default: "Me",
      }),
      field({
        key: "confidential",
        label: "Confidential",
        type: "boolean",
        extract_from: "none",
        default: false,
      }),
      field({
        key: "what_happened",
        label: "What happened",
        type: "textarea",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "near_miss" },
      }),
      field({
        key: "what_could_have_happened",
        label: "What could have happened",
        type: "textarea",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "near_miss" },
      }),
      field({
        key: "potential_severity",
        label: "Potential severity",
        type: "enum",
        extract_from: "both",
        enum_values: ["minor", "moderate", "serious", "fatal"],
        show_if: { field: "case_type", op: "eq", value: "near_miss" },
      }),
      field({
        key: "injured_role",
        label: "Injured person",
        type: "text",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "injury" },
      }),
      field({
        key: "severity",
        label: "Severity",
        type: "enum",
        extract_from: "both",
        enum_values: [
          "first_aid",
          "medical_treatment",
          "restricted_work",
          "lost_time",
          "fatality",
        ],
        show_if: { field: "case_type", op: "eq", value: "injury" },
      }),
      field({
        key: "body_parts",
        label: "Body parts",
        type: "text",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "injury" },
      }),
      field({
        key: "nature_of_injury",
        label: "Nature of injury",
        type: "text",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "injury" },
      }),
      field({
        key: "what_was_done_well",
        label: "What was done well",
        type: "textarea",
        extract_from: "both",
        show_if: { field: "case_type", op: "eq", value: "good_practice" },
      }),
      field({
        key: "current_pain",
        label: "Current pain",
        type: "textarea",
        extract_from: "speech",
        show_if: { field: "case_type", op: "eq", value: "improvement_idea" },
      }),
      field({
        key: "proposed_change",
        label: "Proposed change",
        type: "textarea",
        extract_from: "speech",
        show_if: { field: "case_type", op: "eq", value: "improvement_idea" },
      }),
      field({
        key: "expected_benefit",
        label: "Expected benefit",
        type: "textarea",
        extract_from: "speech",
        show_if: { field: "case_type", op: "eq", value: "improvement_idea" },
      }),
    ],
  };
}

const FIELD_TYPES: FieldType[] = ["text", "textarea", "enum", "boolean", "datetime", "number"];
const EXTRACTS: ExtractFrom[] = ["speech", "photo", "both", "none"];
const OPS: ShowOp[] = ["eq", "neq", "in", "not_in"];

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => plainText(item.trim()))
    .filter(Boolean);
}

function normalizeShow(value: unknown): ShowIf {
  if (!value || typeof value !== "object") return null;
  const raw = value as { field?: unknown; op?: unknown; value?: unknown };
  if (typeof raw.field !== "string" || !raw.field.trim()) return null;
  if (typeof raw.op !== "string" || !OPS.includes(raw.op as ShowOp)) return null;
  const op = raw.op as ShowOp;
  if (op === "in" || op === "not_in") {
    const list = Array.isArray(raw.value)
      ? asStringList(raw.value)
      : typeof raw.value === "string"
        ? raw.value.split(",").map((part) => part.trim()).filter(Boolean)
        : [];
    if (!list.length) return null;
    return { field: raw.field.trim(), op, value: list };
  }
  if (typeof raw.value === "string" || typeof raw.value === "number" || typeof raw.value === "boolean") {
    const next = typeof raw.value === "string" ? plainText(raw.value) : raw.value;
    return { field: raw.field.trim(), op, value: next };
  }
  return null;
}

function normalizeField(value: unknown): Field | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Field>;
  if (typeof raw.key !== "string" || !/^[a-z][a-z0-9_]*$/i.test(raw.key.trim())) return null;
  const type = FIELD_TYPES.includes(raw.type as FieldType) ? (raw.type as FieldType) : "text";
  const extract = EXTRACTS.includes(raw.extract_from as ExtractFrom)
    ? (raw.extract_from as ExtractFrom)
    : "speech";
  let enumMap: Record<string, string[]> | undefined;
  if (raw.enum_map && typeof raw.enum_map === "object") {
    enumMap = {};
    for (const [key, list] of Object.entries(raw.enum_map)) {
      const items = asStringList(list);
      const mapKey = plainText(key);
      if (items.length && mapKey) enumMap[mapKey] = items;
    }
    if (!Object.keys(enumMap).length) enumMap = undefined;
  }
  return {
    key: raw.key.trim(),
    label: typeof raw.label === "string" && raw.label.trim() ? plainText(raw.label.trim()) : raw.key.trim(),
    type,
    required: Boolean(raw.required),
    extract_from: extract,
    show_if: normalizeShow(raw.show_if),
    enum_values: asStringList(raw.enum_values),
    enum_map: enumMap,
    enum_map_field:
      typeof raw.enum_map_field === "string" && raw.enum_map_field.trim()
        ? raw.enum_map_field.trim()
        : undefined,
    hint_for_ai: typeof raw.hint_for_ai === "string" ? plainText(raw.hint_for_ai) : "",
    default:
      typeof raw.default === "string" ||
      typeof raw.default === "number" ||
      typeof raw.default === "boolean" ||
      raw.default === null
        ? raw.default
        : undefined,
  };
}

function normalizeCase(value: unknown, index: number): CaseType | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CaseType>;
  if (typeof raw.id !== "string" || !/^[a-z][a-z0-9_]*$/i.test(raw.id.trim())) return null;
  return {
    id: raw.id.trim(),
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : raw.id.trim(),
    needs_confirm: Boolean(raw.needs_confirm),
    priority: typeof raw.priority === "number" && Number.isFinite(raw.priority) ? raw.priority : index + 1,
    hint: typeof raw.hint === "string" ? raw.hint : "",
    enabled: raw.enabled !== false,
  };
}

export function normalizeLogic(input: unknown): Logic {
  const seed = defaultLogic();
  if (!input || typeof input !== "object") return seed;
  const raw = input as Partial<Logic>;
  const caseTypes = Array.isArray(raw.case_types)
    ? raw.case_types.map(normalizeCase).filter((item): item is CaseType => item !== null)
    : seed.case_types;
  const fields = Array.isArray(raw.fields)
    ? raw.fields.map(normalizeField).filter((item): item is Field => item !== null)
    : seed.fields;
  const keys = new Set<string>();
  const uniqueFields = fields.filter((item) => {
    if (keys.has(item.key)) return false;
    keys.add(item.key);
    return true;
  });
  const lang = typeof raw.default_language === "string" ? raw.default_language : "en";
  return {
    schema_version: "1.0.0",
    app_name: "SafetyBot",
    default_language: LANGUAGES.some((item) => item.id === lang) ? lang : "en",
    case_types: caseTypes.length ? caseTypes : seed.case_types,
    classification_rules:
      typeof raw.classification_rules === "string" && raw.classification_rules.trim()
        ? raw.classification_rules
        : seed.classification_rules,
    description_template:
      typeof raw.description_template === "string" && raw.description_template.trim()
        ? raw.description_template
        : seed.description_template,
    extract_system_prompt:
      typeof raw.extract_system_prompt === "string" && raw.extract_system_prompt.trim()
        ? raw.extract_system_prompt
        : seed.extract_system_prompt,
    stt_keyterms: asStringList(raw.stt_keyterms).slice(0, 100).map((term) => term.slice(0, 50)),
    fields: uniqueFields,
  };
}

export function enabledCases(logic: Logic): CaseType[] {
  return [...logic.case_types]
    .filter((item) => item.enabled !== false)
    .sort((a, b) => a.priority - b.priority);
}

export function caseById(logic: Logic, id: string): CaseType | undefined {
  return logic.case_types.find((item) => item.id === id);
}

export function languageLabel(id: string): string {
  return LANGUAGES.find((item) => item.id === id)?.label ?? "English";
}

export function isEmpty(fieldDef: Field, value: Value | undefined): boolean {
  if (fieldDef.type === "boolean") return value === null || value === undefined;
  if (typeof value === "number") return Number.isNaN(value);
  return value === null || value === undefined || String(value).trim() === "";
}

export function isVisible(fieldDef: Field, values: Values, caseType?: string): boolean {
  const cond = fieldDef.show_if;
  if (!cond) return true;
  const current = cond.field === "case_type" ? caseType : values[cond.field];
  if (cond.op === "eq") return current === cond.value;
  if (cond.op === "neq") return current !== cond.value;
  const list = Array.isArray(cond.value) ? cond.value.map(String) : [String(cond.value)];
  const hit = list.includes(String(current ?? ""));
  return cond.op === "in" ? hit : !hit;
}

export function enumOptions(fieldDef: Field, values: Values): string[] {
  if (fieldDef.enum_map) {
    const keyField = fieldDef.enum_map_field || "equipment";
    const selected = String(values[keyField] ?? "");
    if (fieldDef.enum_map[selected]?.length) return fieldDef.enum_map[selected];
  }
  return fieldDef.enum_values;
}

export function allEnumValues(fieldDef: Field): string[] {
  const set = new Set(fieldDef.enum_values);
  if (fieldDef.enum_map) {
    for (const list of Object.values(fieldDef.enum_map)) {
      for (const item of list) set.add(item);
    }
  }
  return [...set];
}

export function visibleFields(logic: Logic, values: Values, caseType: string): Field[] {
  return logic.fields.filter((item) => isVisible(item, values, caseType));
}

export function applyDefaults(logic: Logic, values: Values): Values {
  const next: Values = { ...values };
  for (const item of logic.fields) {
    if (!isEmpty(item, next[item.key])) continue;
    if (item.default === "now" && item.type === "datetime") next[item.key] = new Date().toISOString();
    else if (item.default !== undefined) next[item.key] = item.default;
  }
  return next;
}

export function pruneHidden(logic: Logic, values: Values, caseType: string): Values {
  const next: Values = { ...values };
  for (let pass = 0; pass < logic.fields.length; pass += 1) {
    let changed = false;
    for (const item of logic.fields) {
      if (isVisible(item, next, caseType)) continue;
      if (item.type === "boolean") {
        if (next[item.key]) {
          next[item.key] = false;
          changed = true;
        }
        continue;
      }
      if (!isEmpty(item, next[item.key])) {
        next[item.key] = "";
        changed = true;
      }
    }
    if (!changed) break;
  }
  return next;
}

export function missingRequired(logic: Logic, values: Values, caseType: string): Field[] {
  return visibleFields(logic, values, caseType).filter(
    (item) => item.required && isEmpty(item, values[item.key]),
  );
}

export function optionLabel(value: string): string {
  if (!value.includes("_") && /[A-Z]/.test(value)) return value;
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function firstLineOf(values: Values, transcript = ""): string {
  const description = String(values.description ?? "").trim();
  const line = (description || transcript || "Report").split(/\n/)[0]?.trim() || "Report";
  return line.slice(0, 180);
}

export function wantsPhotoExtract(logic: Logic): boolean {
  return logic.fields.some((item) => item.extract_from === "photo" || item.extract_from === "both");
}

/** What to tell the model about attached photos. A photo with no speech is the whole report. */
export function photoCaptureBrief(transcript: string, photoCount: number): string {
  if (photoCount <= 0) return "";
  if (transcript.trim()) {
    return "Photos are attached. Use them for every field you can see, especially those marked extract photo or both. Name hazards that are visible. Do not invent an injury from an unclear photo.";
  }
  return [
    "The worker did not speak. The photo is the whole report.",
    "Identify visible hazards: unsafe conditions, missing guards, spills, blocked exits, damaged equipment, bad housekeeping, and anyone in the line of fire.",
    "Fill description and the other fields from what is actually visible.",
    "Prefer safety_observation when you see a hazard and no injury.",
    "Do not invent an injury, a name, an equipment number, or a cause you cannot see.",
    "If the photo is too unclear to name a hazard, say that in description and leave the other fields null.",
  ].join(" ");
}

const CASE_PATTERNS: Record<string, RegExp> = {
  injury: /\b(injur\w*|hurt|wounded|bleeding|blood|fracture|first aid|fatality|fatal|ambulance|unconscious)\b/i,
  near_miss: /\b(near miss|almost|nearly|could have|close call)\b/i,
  good_practice: /\b(good practice|well done|praise|did well|nice work|done well)\b/i,
  improvement_idea: /\b(idea|suggest\w*|proposal|propose|should we|improvement)\b/i,
  safety_observation: /\b(hazard|risk|unsafe|observation|noticed|i saw)\b/i,
};

function matchesCase(id: string, text: string): boolean {
  if (id === "injury") {
    if (/\b(nobody|no one|no-one)\b[\s\S]{0,40}\b(hurt|injured|injury)\b/i.test(text)) return false;
    if (/\b(not|never|wasn't|weren't)\s+(hurt|injured)\b/i.test(text)) return false;
  }
  const pattern = CASE_PATTERNS[id];
  return Boolean(pattern && pattern.test(text));
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function guessBusiness(text: string): string | null {
  if (has(text, /supply chain|\bksc\b/i)) return BU.ksc;
  if (has(text, /new building|\bnbs\b/i)) return BU.nbs;
  if (has(text, /moderni[sz]ation|\bmod\b/i)) return BU.mod;
  if (has(text, /administration|\badm\b|\bkti\b|technology\s*&\s*innovation/i)) return BU.adm;
  if (has(text, /maintenance|\bser\b/i)) return BU.ser;
  return null;
}

function guessEquipment(text: string): string | null {
  const found: { at: number; value: string }[] = [];
  const pairs: [RegExp, string][] = [
    [/\belevator\b/i, "Elevator"],
    [/\bescalator\b/i, "Escalator"],
    [/\bdoor\b/i, "Door"],
  ];
  for (const [pattern, value] of pairs) {
    const match = pattern.exec(text);
    if (match) found.push({ at: match.index, value });
  }
  found.sort((a, b) => a.at - b.at);
  return found[0]?.value ?? null;
}

function guessParty(text: string): string | null {
  if (has(text, /subcontractor|sub-contractor/i)) return "Subcontractor";
  if (has(text, /end user|passenger|customer|public/i)) return "End user";
  if (has(text, /third party|visitor|bystander/i)) return "Third party";
  if (has(text, /employee|colleague|technician|our team|worker/i)) return "Employee";
  return null;
}

function guessLocation(text: string, equipment: string): string | null {
  const table: Record<string, [RegExp, string][]> = {
    Elevator: [
      [/machine room/i, "In machine room"],
      [/car top|top of (the )?elevator/i, "On top of elevator car"],
      [/landing door|temporary entrance/i, "Landing Door or Temporary Entrance Protection"],
      [/sill/i, "Sill of the landing/Car door"],
      [/\blobby\b/i, "Elevator lobby"],
      [/inside (the )?elevator|in the car\b/i, "Inside elevator car"],
      [/\bpit\b/i, "In pit"],
      [/\bshaft\b/i, "In shaft"],
    ],
    Escalator: [
      [/handrail/i, "Handrail of escalator"],
      [/comb plate/i, "Entrance/Exit of escalator"],
      [/entrance|exit/i, "Entrance/Exit of escalator"],
      [/\bpit\b/i, "In escalator pit"],
      [/\blobby\b/i, "Escalator lobby"],
      [/vicinity|near the escalator/i, "In vicinity of escalator"],
    ],
    Door: [
      [/between (the )?door panels|door panels/i, "Between door panels"],
      [/sill/i, "Sill of the door"],
      [/\blobby\b/i, "Building door lobby"],
      [/vicinity|near the door/i, "Vicinity of the door"],
    ],
  };
  for (const [pattern, value] of table[equipment] ?? []) {
    if (pattern.test(text)) return value;
  }
  return null;
}

function classifyCase(logic: Logic, text: string, photoCount: number): { id: string; confidence: number } {
  const cases = enabledCases(logic);
  const fallback = cases[cases.length - 1] ?? cases[0];
  if (!fallback) return { id: "safety_observation", confidence: 0.2 };
  if (!text.trim()) {
    return { id: fallback.id, confidence: photoCount ? 0.35 : 0.2 };
  }
  for (const item of cases) {
    if (matchesCase(item.id, text)) return { id: item.id, confidence: 0.74 };
    if (item.hint && text.toLowerCase().includes(item.hint.toLowerCase())) {
      return { id: item.id, confidence: 0.66 };
    }
  }
  return { id: fallback.id, confidence: 0.42 };
}

export function demoExtract(transcript: string, logic: Logic, photoCount = 0): Extraction {
  const text = transcript.trim();
  const classified = classifyCase(logic, text, photoCount);
  const values: Values = {};
  if (text) values.description = text;
  else if (photoCount) values.description = "Photo only. Add what happened.";

  const business = guessBusiness(text);
  if (business) values.business_unit = business;
  const party = guessParty(text);
  if (party) values.party_involved = party;
  if (business === BU.ksc) {
    if (has(text, /stop and go|stop & go|stopped work|work stopped/i)) values.stop_and_go = "Yes";
  } else {
    const equipment = guessEquipment(text);
    if (equipment) values.equipment = equipment;
    if (equipment && equipment !== "Other" && equipment !== "Not applicable") {
      const location = guessLocation(text, equipment);
      if (location) values.precise_location = location;
      const number = text.match(/\b[A-Z]{1,5}-?\d{2,}\b/);
      if (number) values.equipment_number = number[0];
    }
  }
  if (business === BU.nbs || business === BU.mod) {
    if (has(text, /major project/i)) values.major_project = has(text, /not a major|no major/i) ? "No" : "Yes";
  }
  if (party === "Subcontractor") {
    const company = text.match(/subcontractor(?: company)?[:\s]+([A-Z][\w& .'-]{2,40})/);
    if (company) values.subcontractor_company = company[1].trim();
  }
  const site = text.match(/\b(?:job site|site|station|building)\s+([A-Z][\w .'-]{2,40})/);
  if (site) values.job_site_name = site[1].trim().replace(/[.,]$/, "");
  const action = text.match(
    /(?:^|[.]\s*)((?:I |we )?(?:stopped|isolated|locked out|called|gave first aid|barricaded|shut down)[^.]+)/i,
  );
  if (action) values.immediate_action = action[1].trim();
  if (values.stop_and_go === "Yes" && action) values.why_work_stopped = action[1].trim();

  if (classified.id === "near_miss") {
    values.what_happened = text;
    if (has(text, /fatal/i)) values.potential_severity = "fatal";
    else if (has(text, /serious|severe/i)) values.potential_severity = "serious";
    else if (has(text, /moderate/i)) values.potential_severity = "moderate";
    else if (has(text, /minor/i)) values.potential_severity = "minor";
  }
  if (classified.id === "injury") {
    if (has(text, /fatality|fatal|died/i)) values.severity = "fatality";
    else if (has(text, /lost time/i)) values.severity = "lost_time";
    else if (has(text, /restricted/i)) values.severity = "restricted_work";
    else if (has(text, /hospital|doctor|medical/i)) values.severity = "medical_treatment";
    else if (has(text, /first aid/i)) values.severity = "first_aid";
  }
  if (classified.id === "good_practice" && text) values.what_was_done_well = text;
  if (classified.id === "improvement_idea" && text) {
    values.current_pain = text;
    values.proposed_change = text;
  }

  const withDefaults = applyDefaults(logic, values);
  const pruned = pruneHidden(logic, withDefaults, classified.id);
  const ask = missingRequired(logic, pruned, classified.id).map((item) => item.key);
  return {
    case_type: classified.id,
    confidence: classified.confidence,
    ask_user: ask,
    values: pruned,
    source: "demo",
  };
}

type JsonSchema = Record<string, unknown>;

function fieldSchema(fieldDef: Field): JsonSchema {
  if (fieldDef.type === "boolean") return { type: ["boolean", "null"] };
  if (fieldDef.type === "number") return { type: ["number", "null"] };
  if (fieldDef.type === "enum") {
    const values = allEnumValues(fieldDef);
    if (!values.length) return { type: ["string", "null"] };
    return { type: ["string", "null"], enum: [...values, null] };
  }
  return { type: ["string", "null"] };
}

export function buildExtractSchema(logic: Logic): JsonSchema {
  const cases = enabledCases(logic).map((item) => item.id);
  const extractable = logic.fields.filter((item) => item.extract_from !== "none");
  const properties: Record<string, JsonSchema> = {};
  for (const item of extractable) properties[item.key] = fieldSchema(item);
  return {
    type: "object",
    additionalProperties: false,
    required: ["case_type", "confidence", "ask_user", "values"],
    properties: {
      case_type: cases.length
        ? { type: "string", enum: cases }
        : { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      ask_user: { type: "array", items: { type: "string" } },
      values: {
        type: "object",
        additionalProperties: false,
        required: extractable.map((item) => item.key),
        properties,
      },
    },
  };
}

export function buildExtractPrompt(logic: Logic, languageId: string): string {
  const lang = languageId === "auto" ? "the language the worker spoke" : languageLabel(languageId);
  const cases = enabledCases(logic)
    .map((item) => `- ${item.id} | ${item.label} | priority ${item.priority} | confirm ${item.needs_confirm} | ${item.hint}`)
    .join("\n");
  const fields = logic.fields
    .map((item) => {
      const enums = allEnumValues(item);
      const show = item.show_if
        ? ` show_if ${item.show_if.field} ${item.show_if.op} ${JSON.stringify(item.show_if.value)}`
        : "";
      const map = item.enum_map ? ` enum_map ${JSON.stringify(item.enum_map)}` : "";
      return `- ${item.key} | ${item.label} | ${item.type} | required ${item.required} | extract ${item.extract_from}${show}${enums.length ? ` | enums ${enums.join(" / ")}` : ""}${map}${item.hint_for_ai ? ` | hint ${item.hint_for_ai}` : ""}`;
    })
    .join("\n");
  return [
    logic.extract_system_prompt,
    "",
    "Classification rules:",
    logic.classification_rules,
    "Enabled case types, priority order:",
    cases || "(none)",
    "",
    "Description template:",
    logic.description_template,
    "",
    `Write description and other free text in ${lang}. Do not translate labels.`,
    "Fields:",
    fields || "(none)",
    "",
    "Return JSON with case_type, confidence, ask_user, and values. Use null when unknown. Never invent an injury from an unclear photo.",
  ].join("\n");
}

function asValue(value: unknown, fieldDef: Field): Value {
  if (value === null || value === undefined || value === "") return null;
  if (fieldDef.type === "boolean") return value === true || value === "true";
  if (fieldDef.type === "number") {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : null;
  }
  if (fieldDef.type === "enum") {
    const allowed = allEnumValues(fieldDef);
    const text = String(value).trim();
    if (!allowed.length) return text || null;
    return allowed.includes(text) ? text : null;
  }
  return String(value).slice(0, 4000);
}

export function sanitizeExtraction(logic: Logic, raw: unknown, fallbackText: string, photoCount: number): Extraction {
  const demo = demoExtract(fallbackText, logic, photoCount);
  if (!raw || typeof raw !== "object") return { ...demo, note: "The model returned an unreadable draft. Filled from your words." };
  const body = raw as { case_type?: unknown; confidence?: unknown; ask_user?: unknown; values?: unknown };
  const enabled = enabledCases(logic);
  const requested = typeof body.case_type === "string" ? body.case_type : "";
  const caseType = enabled.some((item) => item.id === requested) ? requested : demo.case_type;
  const confidence =
    typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 1
      ? body.confidence
      : demo.confidence;
  const sourceValues = body.values && typeof body.values === "object" ? (body.values as Record<string, unknown>) : {};
  const values: Values = {};
  for (const item of logic.fields) {
    if (item.extract_from === "none") continue;
    if (item.key in sourceValues) values[item.key] = asValue(sourceValues[item.key], item);
  }
  if (isEmpty(logic.fields.find((item) => item.key === "description") ?? { type: "text" } as Field, values.description) && fallbackText) {
    values.description = fallbackText;
  }
  const merged = pruneHidden(logic, applyDefaults(logic, { ...demo.values, ...values }), caseType);
  const ask = Array.isArray(body.ask_user)
    ? body.ask_user.filter((item): item is string => typeof item === "string")
    : [];
  const computed = missingRequired(logic, merged, caseType).map((item) => item.key);
  return {
    case_type: caseType,
    confidence,
    ask_user: [...new Set([...ask, ...computed])],
    values: merged,
    source: "grok",
  };
}

export const SAMPLE_TRANSCRIPT =
  "Near miss at the escalator comb plate in the lobby. Maintenance Business. Employee. Nobody was hurt. I stopped the unit and called the supervisor. Equipment ESC-204, site Central Station.";
