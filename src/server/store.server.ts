import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  emptyOrg,
  emptySso,
  normalizeOrg,
  normalizeSso,
  type OrgStructure,
  type SessionUser,
  type SsoConfig,
} from "@/org";
import {
  DEFAULT_API_KEY,
  type Logic,
  type SafetyReport,
  defaultLogic,
  normalizeLogic,
  reportToRow,
  toSafetyReport,
} from "@/schema";

export const LOGIC_SEED = "construction-1";

export type Store = {
  apiKey: string;
  logic: Logic;
  logicSeed: string;
  reports: SafetyReport[];
  webhookUrl: string;
  webhookSecret: string;
  organization: OrgStructure;
  sso: SsoConfig;
  sessions: SessionUser[];
};

const FILE = "data/safetybot-store.json";
const ROWS = "data/safetybot-reports.jsonl";
let lastWritten = "";

const bag = globalThis as typeof globalThis & { __safetybotStore?: Store };

function emptyStore(): Store {
  return {
    apiKey: DEFAULT_API_KEY,
    logic: defaultLogic(),
    logicSeed: LOGIC_SEED,
    reports: [],
    webhookUrl: "",
    webhookSecret: "",
    organization: emptyOrg(),
    sso: emptySso(),
    sessions: [],
  };
}

function normalizeStore(value: unknown): Store {
  const base = emptyStore();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<Store>;
  const rawSeed = typeof raw.logicSeed === "string" ? raw.logicSeed : "";
  const logic = rawSeed === LOGIC_SEED ? normalizeLogic(raw.logic) : defaultLogic();
  const reports = Array.isArray(raw.reports)
    ? raw.reports
        .map((item) => toSafetyReport(item, logic))
        .filter((item): item is SafetyReport => Boolean(item))
        .slice(0, 200)
    : [];
  return {
    apiKey: typeof raw.apiKey === "string" && raw.apiKey.trim() ? raw.apiKey.trim() : base.apiKey,
    logic,
    logicSeed: LOGIC_SEED,
    reports,
    webhookUrl: typeof raw.webhookUrl === "string" ? raw.webhookUrl : "",
    webhookSecret: typeof raw.webhookSecret === "string" ? raw.webhookSecret : "",
    organization: normalizeOrg(raw.organization),
    sso: normalizeSso(raw.sso),
    sessions: Array.isArray(raw.sessions) ? raw.sessions.filter(isSession).slice(0, 100) : [],
  };
}

function readRows(logic: Logic): SafetyReport[] | null {
  try {
    const text = readFileSync(ROWS, "utf8");
    if (!text.trim()) return [];
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => toSafetyReport(JSON.parse(line), logic))
      .filter((item): item is SafetyReport => Boolean(item))
      .slice(0, 200);
  } catch {
    return null;
  }
}

function metaOf(store: Store): string {
  return JSON.stringify({
    apiKey: store.apiKey,
    logic: store.logic,
    logicSeed: store.logicSeed || LOGIC_SEED,
    webhookUrl: store.webhookUrl,
    webhookSecret: store.webhookSecret,
    organization: store.organization,
    sso: store.sso,
    sessions: store.sessions,
  });
}

export function loadStore(): Store {
  const cached = bag.__safetybotStore;
  if (cached) {
    if (!cached.organization) cached.organization = emptyOrg();
    if (!cached.sso) cached.sso = emptySso();
    if (!Array.isArray(cached.sessions)) cached.sessions = [];
    if (!cached.logicSeed) cached.logicSeed = LOGIC_SEED;
    return cached;
  }
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as { logicSeed?: unknown };
    const rawSeed = typeof parsed.logicSeed === "string" ? parsed.logicSeed : "";
    const store = normalizeStore(parsed);
    const rows = readRows(store.logic);
    if (rows) store.reports = rows;
    bag.__safetybotStore = store;
    if (rawSeed !== LOGIC_SEED) {
      lastWritten = "";
      saveStore(store);
    } else {
      const meta = metaOf(store);
      const lines = store.reports.map((item) => JSON.stringify(reportToRow(item, store.logic))).join("\n");
      lastWritten = `${meta}\n${lines}`;
    }
  } catch {
    bag.__safetybotStore = emptyStore();
  }
  return bag.__safetybotStore;
}

export function saveStore(store: Store) {
  bag.__safetybotStore = store;
  const meta = metaOf(store);
  const lines = store.reports.map((item) => JSON.stringify(reportToRow(item, store.logic))).join("\n");
  const stamp = `${meta}\n${lines}`;
  if (stamp === lastWritten) return;
  lastWritten = stamp;
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, meta);
    writeFileSync(ROWS, lines ? `${lines}\n` : "");
  } catch {
    // Preview keeps the in-memory copy when the disk is read-only.
  }
}

export function keyMatches(store: Store, token: string | null): boolean {
  if (!token) return false;
  const a = token.trim();
  const b = store.apiKey;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function listReports(
  store: Store,
  since: string | null,
  caseType: string | null,
  orgId: string | null = null,
): SafetyReport[] {
  return store.reports.filter((item) => {
    if (caseType && item.case_type !== caseType) return false;
    if (orgId && item.org_id !== orgId) return false;
    if (since && item.created_at < since) return false;
    return true;
  });
}

function isSession(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const raw = value as SessionUser;
  return typeof raw.id === "string" && (raw.provider === "microsoft" || raw.provider === "google") && typeof raw.expires === "string";
}

export async function postWebhook(store: Store, report: SafetyReport): Promise<"sent" | "skipped" | "failed"> {
  if (!store.webhookUrl.trim()) return "skipped";
  try {
    const response = await fetch(store.webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-safetybot-secret": store.webhookSecret,
      },
      body: JSON.stringify(reportToRow(report, store.logic)),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
