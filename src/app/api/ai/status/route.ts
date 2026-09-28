import { serverGrokReady } from "@/server/ai.server";
import { json } from "@/server/http.server";

export const dynamic = "force-dynamic";

export function GET() {
  return json({ available: serverGrokReady() });
}
