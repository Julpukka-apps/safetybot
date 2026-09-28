import { aiFromRequest, transcribeAudio } from "@/server/ai.server";
import { json } from "@/server/http.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { audioBase64?: string; mime?: string; language?: string; keyterms?: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  try {
    const result = await transcribeAudio({
      audioBase64: body.audioBase64 || "",
      mime: body.mime || "audio/webm",
      language: body.language || "auto",
      keyterms: Array.isArray(body.keyterms) ? body.keyterms : [],
      ai: aiFromRequest(request),
    });
    if (!result.ok) return json({ error: result.error }, result.error === "no key" ? 503 : 502);
    return json({ text: result.text });
  } catch {
    return json({ error: "stt failed" }, 502);
  }
}
