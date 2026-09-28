import { authorize, json } from "@/server/http.server";
import { saveStore } from "@/server/store.server";
import { normalizeOrg, normalizeSso } from "@/org";
import { normalizeLogic, reportToRow, toSafetyReport, type SafetyReport } from "@/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  let body: {
    logic?: unknown;
    reports?: SafetyReport[];
    webhookUrl?: string;
    webhookSecret?: string;
    rotateTo?: string;
    organization?: unknown;
    sso?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const store = auth.store;
  if (body.logic) store.logic = normalizeLogic(body.logic);
  if (typeof body.webhookUrl === "string") store.webhookUrl = body.webhookUrl.trim();
  if (typeof body.webhookSecret === "string") store.webhookSecret = body.webhookSecret;
  if (Array.isArray(body.reports)) {
    const map = new Map<string, SafetyReport>();
    for (const item of store.reports) map.set(item.id, item);
    for (const item of body.reports) {
      const report = toSafetyReport(item, store.logic);
      if (report) map.set(report.id, report);
    }
    store.reports = [...map.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200);
  }
  if (body.organization) store.organization = normalizeOrg(body.organization);
  if (body.sso) store.sso = normalizeSso(body.sso);
  if (typeof body.rotateTo === "string" && /^sb_live_[a-z0-9_]{8,}$/i.test(body.rotateTo)) {
    store.apiKey = body.rotateTo;
  }
  saveStore(store);
  return json({
    ok: true,
    apiKey: store.apiKey,
    reports: store.reports.map((item) => reportToRow(item, store.logic)),
    organization: store.organization,
    sso: store.sso,
  });
}
