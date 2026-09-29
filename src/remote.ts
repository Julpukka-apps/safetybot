import type { OrgStructure, SessionUser, SsoConfig } from "@/org";
import { normalizeLogic, toSafetyReport, type Logic, type SafetyReport } from "@/schema";
import {
  loadApiKey,
  loadLogic,
  loadReports,
  loadWebhook,
  saveApiKey,
  saveLogic,
  saveOrg,
  saveReports,
  saveSso,
} from "@/storage";

function authHeaders(): HeadersInit {
  return {
    authorization: `Bearer ${loadApiKey()}`,
    "content-type": "application/json",
  };
}

export async function pullLogic(): Promise<Logic | null> {
  try {
    const response = await fetch("/api/schema", { headers: authHeaders() });
    if (!response.ok) return null;
    const logic = saveLogic(normalizeLogic(await response.json()));
    return logic;
  } catch {
    return null;
  }
}

export async function pushConfig(extra?: {
  rotateTo?: string;
  organization?: OrgStructure;
  sso?: SsoConfig;
  replaceLogic?: boolean;
}): Promise<{ apiKey: string; reports: SafetyReport[] } | null> {
  try {
    const webhook = loadWebhook();
    const body: Record<string, unknown> = {
      reports: loadReports(),
      webhookUrl: webhook.url,
      webhookSecret: webhook.secret,
      rotateTo: extra?.rotateTo,
      organization: extra?.organization,
      sso: extra?.sso,
    };
    if (extra?.replaceLogic) {
      body.logic = loadLogic();
      body.replaceLogic = true;
    }
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      apiKey: string;
      reports: SafetyReport[];
      organization?: OrgStructure;
      sso?: SsoConfig;
    };
    if (payload.apiKey) saveApiKey(payload.apiKey);
    if (Array.isArray(payload.reports)) saveReports(payload.reports);
    if (payload.organization) saveOrg(payload.organization);
    if (payload.sso) saveSso(payload.sso);
    return payload;
  } catch {
    return null;
  }
}

export async function publishReport(report: SafetyReport): Promise<string> {
  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(report),
    });
    if (!response.ok) return "failed";
    const body = (await response.json()) as { webhook?: string };
    return body.webhook || "skipped";
  } catch {
    return "failed";
  }
}

export async function pullReports(): Promise<SafetyReport[]> {
  const logic = loadLogic();
  try {
    const response = await fetch("/api/reports", { headers: authHeaders() });
    if (!response.ok) return loadReports();
    const body = (await response.json()) as unknown[] | { reports?: unknown[] };
    const incoming = Array.isArray(body) ? body : (body.reports ?? []);
    const map = new Map<string, SafetyReport>();
    for (const item of loadReports()) map.set(item.id, item);
    for (const item of incoming) {
      const report = toSafetyReport(item, logic);
      if (report) map.set(report.id, report);
    }
    const merged = [...map.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    saveReports(merged);
    return merged;
  } catch {
    return loadReports();
  }
}

export type SignedInUser = {
  name: string;
  email: string;
  provider: SessionUser["provider"];
  org_id: string | null;
  org_path: string | null;
};

export async function fetchSession(): Promise<SignedInUser | null> {
  try {
    const response = await fetch("/api/auth/session");
    if (!response.ok) return null;
    const body = (await response.json()) as { user: SignedInUser | null };
    return body.user;
  } catch {
    return null;
  }
}

export async function signOutSession(): Promise<void> {
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    /* the next report can still be filed */
  }
}

export async function removeRemoteReport(id: string) {
  try {
    await fetch(`/api/reports/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
  } catch {
    // Local delete still stands. The next sync cannot drop a server row, so this call matters.
  }
}
