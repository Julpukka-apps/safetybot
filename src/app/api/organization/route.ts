import { normalizeOrg, parseOrgText } from "@/org";
import { authorize, json } from "@/server/http.server";
import { saveStore } from "@/server/store.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  return json(auth.store.organization);
}

export async function PUT(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  const store = auth.store;
  try {
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const nodes = parseOrgText(JSON.stringify(await request.json()));
      store.organization = normalizeOrg({ nodes, updated_at: new Date().toISOString() });
    } else {
      const nodes = parseOrgText(await request.text());
      store.organization = normalizeOrg({ nodes, updated_at: new Date().toISOString() });
    }
  } catch {
    return json({ error: "Could not read the organization file." }, 400);
  }
  if (!store.organization.updated_at) store.organization.updated_at = new Date().toISOString();
  saveStore(store);
  return json(store.organization);
}

export async function DELETE(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  auth.store.organization = normalizeOrg({ nodes: [], updated_at: new Date().toISOString() });
  saveStore(auth.store);
  return json(auth.store.organization);
}
