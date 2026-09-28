import { createHash, randomBytes } from "node:crypto";
import { matchOrgNode, orgPath, type SessionUser, type SsoProvider } from "@/org";
import { cookieHeader, readCookie } from "@/server/http.server";
import { loadStore, saveStore, type Store } from "@/server/store.server";

const OAUTH_COOKIE = "sb_oauth";
const SESSION_COOKIE = "sb_session";

export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  if (forwarded) return `${proto}://${forwarded.split(",")[0].trim()}`;
  return url.origin;
}

export function redirectUri(request: Request, provider: SsoProvider): string {
  return `${publicOrigin(request)}/api/auth/${provider}/callback`;
}

export function beginSignIn(request: Request, provider: SsoProvider): Response {
  const store = loadStore();
  const config = store.sso;
  if (provider === "microsoft" && !config.microsoft.enabled) return fail("Microsoft sign-in is off.");
  if (provider === "google" && !config.google.enabled) return fail("Google sign-in is off.");
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirect = redirectUri(request, provider);
  const url =
    provider === "microsoft"
      ? microsoftAuthorize(config.microsoft.tenantId, config.microsoft.clientId, redirect, state, challenge)
      : googleAuthorize(config.google.clientId, redirect, state, challenge);
  return new Response(null, {
    status: 302,
    headers: {
      location: url,
      "set-cookie": cookieHeader(OAUTH_COOKIE, `${provider}.${state}.${verifier}`, 600),
      "cache-control": "no-store",
    },
  });
}

export async function finishSignIn(request: Request, provider: SsoProvider): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const problem = url.searchParams.get("error");
  if (problem || !code) return back(request, "failed");
  const pending = readCookie(request, OAUTH_COOKIE);
  const [pendingProvider, pendingState, verifier] = pending.split(".");
  if (pendingProvider !== provider || !verifier || pendingState !== state) return back(request, "failed");
  const store = loadStore();
  try {
    const user = await exchange(store, provider, code, verifier, redirectUri(request, provider));
    store.sessions = [user, ...store.sessions.filter((item) => item.id !== user.id)].slice(0, 100);
    saveStore(store);
    const headers = new Headers();
    headers.append("set-cookie", cookieHeader(OAUTH_COOKIE, "", 0));
    headers.append("set-cookie", cookieHeader(SESSION_COOKIE, user.id, 60 * 60 * 12));
    headers.set("location", `${publicOrigin(request)}/`);
    headers.set("cache-control", "no-store");
    return new Response(null, { status: 302, headers });
  } catch {
    return back(request, "failed");
  }
}

export function currentSession(request: Request): SessionUser | null {
  const id = readCookie(request, SESSION_COOKIE);
  if (!id) return null;
  const store = loadStore();
  const now = new Date().toISOString();
  const user = store.sessions.find((item) => item.id === id && item.expires > now) ?? null;
  return user;
}

export function endSession(request: Request): Response {
  const id = readCookie(request, SESSION_COOKIE);
  if (id) {
    const store = loadStore();
    store.sessions = store.sessions.filter((item) => item.id !== id);
    saveStore(store);
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "set-cookie": cookieHeader(SESSION_COOKIE, "", 0),
      "cache-control": "no-store",
    },
  });
}

async function exchange(store: Store, provider: SsoProvider, code: string, verifier: string, redirect: string): Promise<SessionUser> {
  if (provider === "microsoft") {
    const tenant = store.sso.microsoft.tenantId;
    const body = new URLSearchParams({
      client_id: store.sso.microsoft.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: verifier,
      scope: "openid profile email User.Read",
    });
    const token = await postForm(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, body);
    const access = String(token.access_token || "");
    const claims = decodeJwt(String(token.id_token || ""));
    let department = "";
    let company = "";
    let office = "";
    let name = String(claims.name || "");
    let email = String(claims.preferred_username || claims.email || "");
    if (access) {
      const me = await readJson(
        "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,department,companyName,officeLocation",
        access,
      );
      if (me) {
        name = String(me.displayName || name);
        email = String(me.mail || me.userPrincipalName || email);
        department = String(me.department || "");
        company = String(me.companyName || "");
        office = String(me.officeLocation || "");
      }
    }
    return sessionFrom(store, "microsoft", email, name, [department, office, company]);
  }
  const body = new URLSearchParams({
    client_id: store.sso.google.clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirect,
    code_verifier: verifier,
  });
  const token = await postForm("https://oauth2.googleapis.com/token", body);
  const claims = decodeJwt(String(token.id_token || ""));
  let name = String(claims.name || "");
  let email = String(claims.email || "");
  if (!email && token.access_token) {
    const info = await readJson("https://openidconnect.googleapis.com/v1/userinfo", String(token.access_token));
    if (info) {
      name = String(info.name || name);
      email = String(info.email || email);
    }
  }
  const domain = email.includes("@") ? email.split("@")[1] : "";
  return sessionFrom(store, "google", email, name, [String(claims.hd || ""), domain]);
}

function sessionFrom(store: Store, provider: SsoProvider, email: string, name: string, hints: string[]): SessionUser {
  const node = matchOrgNode(store.organization.nodes, hints);
  const expires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  return {
    id: randomBytes(18).toString("base64url"),
    provider,
    email: email.slice(0, 160),
    name: (name || email || "Signed in").slice(0, 120),
    org_id: node?.id ?? null,
    org_path: node ? orgPath(store.organization.nodes, node.id) : null,
    expires,
  };
}

function microsoftAuthorize(tenant: string, clientId: string, redirect: string, state: string, challenge: string): string {
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid profile email User.Read");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function googleAuthorize(clientId: string, redirect: string, state: string, challenge: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function postForm(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(payload.error || response.status));
  return payload;
}

async function readJson(url: string, access: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${access}` } });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeJwt(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function back(request: Request, code: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: `${publicOrigin(request)}/?sso=${code}`,
      "set-cookie": cookieHeader(OAUTH_COOKIE, "", 0),
      "cache-control": "no-store",
    },
  });
}

function fail(message: string): Response {
  return new Response(message, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
}
