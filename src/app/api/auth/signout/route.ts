import { endSession } from "@/server/oauth.server";

export const dynamic = "force-dynamic";

export function POST(request: Request) {
  return endSession(request);
}
