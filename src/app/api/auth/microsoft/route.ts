import { beginSignIn } from "@/server/oauth.server";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return beginSignIn(request, "microsoft");
}
