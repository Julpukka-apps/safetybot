import { json } from "@/server/http.server";
import { currentSession } from "@/server/oauth.server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const user = currentSession(request);
  return json({
    user: user
      ? { name: user.name, email: user.email, provider: user.provider, org_id: user.org_id, org_path: user.org_path }
      : null,
  });
}
