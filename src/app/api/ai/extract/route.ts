import { aiFromRequest, extractWithGrok } from "@/server/ai.server";
import { json } from "@/server/http.server";
import { normalizeLogic } from "@/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { transcript?: string; photos?: string[]; logic?: unknown; language?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  try {
    const result = await extractWithGrok({
      transcript: body.transcript || "",
      photos: Array.isArray(body.photos) ? body.photos.slice(0, 3) : [],
      logic: normalizeLogic(body.logic),
      language: body.language || "en",
      ai: aiFromRequest(request),
    });
    if (!result.ok) return json({ error: result.error }, result.error === "no key" ? 503 : 502);
    return json({ extraction: result.extraction });
  } catch {
    return json({ error: "extract failed" }, 502);
  }
}
