import type { OrgStructure, SessionUser, SsoConfig } from "@/org";
import { toSafetyReport, type SafetyReport } from "@/schema";
import {
  loadApiKey,
  loadLogic,
  loadReports,
  loadWebhook,
  saveApiKey,
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

export async function pushConfig(extra?: {
  rotateTo?: string;
  organization?: OrgStructure;
  sso?: SsoConfig;
}): Promise<{ apiKey: string; reports: SafetyReport[] } | null> {
  try {
    const webhook = loadWebhook();
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        logic: loadLogic(),
        reports: loadReports(),
        webhookUrl: webhook.url,
        webhookSecret: webhook.secret,
        rotateTo: extra?.rotateTo,
        organization: extra?.organization,
        sso: extra?.sso,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      apiKey: string;
      reports: SafetyReport[];
      organization?: OrgStructure;
      sso?: SsoConfig;
    };
    if (body.apiKey) saveApiKey(body.apiKey);
    if (Array.isArray(body.reports)) saveReports(body.reports);
    if (body.organization) saveOrg(body.organization);
    if (body.sso) saveSso(body.sso);
    return body;
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
