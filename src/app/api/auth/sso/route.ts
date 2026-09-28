import { normalizeSso } from "@/org";
import { authorize, bearer, json } from "@/server/http.server";
import { redirectUri } from "@/server/oauth.server";
import { keyMatches, loadStore, saveStore } from "@/server/store.server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const store = loadStore();
  const full = keyMatches(store, bearer(request));
  return json({
    microsoft: full ? store.sso.microsoft : store.sso.microsoft.enabled,
    google: full ? store.sso.google : store.sso.google.enabled,
    requireSignIn: store.sso.requireSignIn,
    redirects: {
      microsoft: redirectUri(request, "microsoft"),
      google: redirectUri(request, "google"),
    },
  });
}

export async function PUT(request: Request) {
  const auth = authorize(request);
  if (!auth.ok) return auth.response;
  try {
    auth.store.sso = normalizeSso(await request.json());
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  saveStore(auth.store);
  return json(auth.store.sso);
}
