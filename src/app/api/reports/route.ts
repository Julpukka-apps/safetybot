import { authorize, json } from "@/server/http.server";
import { listReports, postWebhook, saveStore } from "@/server/store.server";
import { reportToRow, toSafetyReport } from "@/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  return json(
    listReports(auth.store, url.searchParams.get("since"), url.searchParams.get("case_type"), url.searchParams.get("org_id")).map(
      (item) => reportToRow(item, auth.store.logic),
    ),
  );
}

export async function POST(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const store = auth.store;
  const report = toSafetyReport(body, store.logic);
  if (!report) return json({ error: "invalid report" }, 400);
  store.reports = [report, ...store.reports.filter((item) => item.id !== report.id)].slice(0, 200);
  saveStore(store);
  const webhook = await postWebhook(store, report);
  return json({ ok: true, id: report.id, webhook }, 201);
}
