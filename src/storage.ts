import { emptyOrg, emptySso, normalizeOrg, normalizeSso, type OrgStructure, type SsoConfig } from "@/org";
import {
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USER,
  DEFAULT_API_KEY,
  type Extraction,
  type Logic,
  type SafetyReport,
  defaultLogic,
  normalizeLogic,
  reportToRow,
  toSafetyReport,
} from "@/schema";

export const LOGIC_KEY = "safetybot_logic_v1";
export const REPORTS_KEY = "safetybot_reports_v1";
const PASSWORD_KEY = "safetybot_admin_pw";
const API_KEY = "safetybot_api_key";
const WEBHOOK_KEY = "safetybot_webhook";
const SESSION_ADMIN = "safetybot_admin";
const SESSION_SETUP = "safetybot_pw_setup";
const SESSION_XAI = "safetybot_xai_key";
const SESSION_CAPTURE = "safetybot_capture";
const SESSION_USER = "safetybot_session_user";
const SESSION_LAST = "safetybot_last_id";
const ORG_KEY = "safetybot_org_v1";
const SSO_KEY = "safetybot_sso_v1";

export type CaptureDraft = {
  transcript: string;
  photos: string[];
  language: string;
  extraction: Extraction;
};

export type WebhookConfig = { url: string; secret: string };

function canUse(): boolean {
  return typeof window !== "undefined";
}

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function loadLogic(): Logic {
  if (!canUse()) return defaultLogic();
  try {
    const raw = localStorage.getItem(LOGIC_KEY);
    if (!raw) return defaultLogic();
    return normalizeLogic(JSON.parse(raw));
  } catch {
    return defaultLogic();
  }
}

export function saveLogic(logic: Logic): Logic {
  const next = normalizeLogic(logic);
  localStorage.setItem(LOGIC_KEY, JSON.stringify(next));
  return next;
}

export function loadReports(): SafetyReport[] {
  if (!canUse()) return [];
  const logic = loadLogic();
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => toSafetyReport(item, logic))
      .filter((item): item is SafetyReport => Boolean(item));
  } catch {
    return [];
  }
}

export function saveReports(reports: SafetyReport[]) {
  const logic = loadLogic();
  const rows = reports.slice(0, 200).map((item) => reportToRow(toSafetyReport(item, logic) ?? item, logic));
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(rows));
  } catch {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(rows.map((row) => ({ ...row, transcript: "" }))));
  }
}

export function loadOrg(): OrgStructure {
  if (!canUse()) return emptyOrg();
  try {
    return normalizeOrg(JSON.parse(localStorage.getItem(ORG_KEY) || "null"));
  } catch {
    return emptyOrg();
  }
}

export function saveOrg(org: OrgStructure) {
  localStorage.setItem(ORG_KEY, JSON.stringify(normalizeOrg(org)));
}

export function loadSso(): SsoConfig {
  if (!canUse()) return emptySso();
  try {
    return normalizeSso(JSON.parse(localStorage.getItem(SSO_KEY) || "null"));
  } catch {
    return emptySso();
  }
}

export function saveSso(sso: SsoConfig) {
  localStorage.setItem(SSO_KEY, JSON.stringify(normalizeSso(sso)));
}

export function upsertReport(report: SafetyReport) {
  const all = loadReports().filter((item) => item.id !== report.id);
  all.unshift(report);
  saveReports(all);
}

export function deleteLocalReport(id: string) {
  saveReports(loadReports().filter((item) => item.id !== id));
}

export function passwordIsCustom(): boolean {
  return canUse() && Boolean(localStorage.getItem(PASSWORD_KEY));
}

export async function checkAdminPassword(username: string, password: string): Promise<boolean> {
  if (username.trim() !== DEFAULT_ADMIN_USER) return false;
  const stored = canUse() ? localStorage.getItem(PASSWORD_KEY) : null;
  if (!stored) return password === DEFAULT_ADMIN_PASSWORD;
  return (await sha256(password)) === stored;
}

export async function setAdminPassword(password: string) {
  localStorage.setItem(PASSWORD_KEY, await sha256(password));
}

export function startAdminSession() {
  sessionStorage.setItem(SESSION_ADMIN, "1");
  sessionStorage.removeItem(SESSION_SETUP);
}

export function markPasswordSetup() {
  sessionStorage.setItem(SESSION_SETUP, "1");
}

export function adminSessionActive(): boolean {
  return canUse() && sessionStorage.getItem(SESSION_ADMIN) === "1";
}

export function passwordSetupActive(): boolean {
  return canUse() && sessionStorage.getItem(SESSION_SETUP) === "1";
}

export function endAdminSession() {
  if (!canUse()) return;
  sessionStorage.removeItem(SESSION_ADMIN);
  sessionStorage.removeItem(SESSION_SETUP);
}

export function loadApiKey(): string {
  if (!canUse()) return DEFAULT_API_KEY;
  return localStorage.getItem(API_KEY) || DEFAULT_API_KEY;
}

export function saveApiKey(key: string) {
  localStorage.setItem(API_KEY, key);
}

export function loadWebhook(): WebhookConfig {
  if (!canUse()) return { url: "", secret: "" };
  try {
    const raw = JSON.parse(localStorage.getItem(WEBHOOK_KEY) || "{}") as WebhookConfig;
    return { url: raw.url || "", secret: raw.secret || "" };
  } catch {
    return { url: "", secret: "" };
  }
}

export function saveWebhook(config: WebhookConfig) {
  localStorage.setItem(WEBHOOK_KEY, JSON.stringify(config));
}

export type AiProvider = "xai" | "openai" | "azure" | "compatible";

export type AiSettings = {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
};

const AI_SETTINGS = "safetybot_ai_v1";

export function loadAi(): AiSettings {
  const empty: AiSettings = { provider: "xai", apiKey: "", model: "", baseUrl: "" };
  if (!canUse()) return empty;
  try {
    const raw = sessionStorage.getItem(AI_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AiSettings>;
      const provider: AiProvider =
        parsed.provider === "openai" || parsed.provider === "azure" || parsed.provider === "compatible"
          ? parsed.provider
          : "xai";
      return {
        provider,
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model : "",
        baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : "",
      };
    }
  } catch {
    /* use the older key */
  }
  return { ...empty, apiKey: sessionStorage.getItem(SESSION_XAI) || "" };
}

export function saveAi(settings: AiSettings) {
  const next: AiSettings = {
    provider: settings.provider,
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
    baseUrl: settings.baseUrl.trim(),
  };
  sessionStorage.setItem(AI_SETTINGS, JSON.stringify(next));
  if (next.provider === "xai" && next.apiKey) sessionStorage.setItem(SESSION_XAI, next.apiKey);
  else sessionStorage.removeItem(SESSION_XAI);
}

export function loadGrokKey(): string {
  return loadAi().apiKey;
}

export function saveGrokKey(key: string) {
  saveAi({ ...loadAi(), apiKey: key });
}

export function loadCapture(): CaptureDraft | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CAPTURE);
    if (!raw) return null;
    return JSON.parse(raw) as CaptureDraft;
  } catch {
    return null;
  }
}

export function saveCapture(draft: CaptureDraft) {
  sessionStorage.setItem(SESSION_CAPTURE, JSON.stringify(draft));
}

export function clearCapture() {
  if (!canUse()) return;
  sessionStorage.removeItem(SESSION_CAPTURE);
}

export function cacheSession(user: { name: string; email: string } | null) {
  if (!canUse()) return;
  if (!user) sessionStorage.removeItem(SESSION_USER);
  else sessionStorage.setItem(SESSION_USER, JSON.stringify(user));
}

export function loadCachedSession<T>(): T | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_USER);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function rememberReport(id: string) {
  sessionStorage.setItem(SESSION_LAST, id);
}

export function lastReportId(): string {
  if (!canUse()) return "";
  return sessionStorage.getItem(SESSION_LAST) || "";
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
