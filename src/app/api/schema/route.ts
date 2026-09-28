import { authorize, json } from "@/server/http.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  return json(auth.store.logic);
}
