import { authorize, json } from "@/server/http.server";
import { saveStore } from "@/server/store.server";
import { reportToRow } from "@/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const report = auth.store.reports.find((item) => item.id === id);
  if (!report) return json({ error: "Not found" }, 404);
  return json(reportToRow(report, auth.store.logic));
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const store = auth.store;
  const before = store.reports.length;
  store.reports = store.reports.filter((item) => item.id !== id);
  if (store.reports.length === before) return json({ error: "Not found" }, 404);
  saveStore(store);
  return json({ ok: true });
}
