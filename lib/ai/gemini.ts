import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { buildPrompt, refLabel, refsIntro, ScoreSchema, type ScoreInput, type ScoreResult } from "./prompt";

let client: GoogleGenAI | null = null;

export async function scoreWithGemini(input: ScoreInput): Promise<ScoreResult> {
  const apiKey = env.geminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  client ??= new GoogleGenAI({ apiKey });

  const parts: Part[] = [];
  const refs = input.refs ?? [];
  if (refs.length) {
    parts.push({ text: refsIntro(refs) });
    for (const r of refs) {
      parts.push({ text: refLabel(r) });
      parts.push({ inlineData: { mimeType: r.mediaType, data: r.b64 } });
    }
  }
  parts.push({ text: "FOTO A CALIFICAR:" });
  parts.push({ inlineData: { mimeType: input.image.mediaType, data: input.image.b64 } });
  parts.push({ text: buildPrompt(input) });

  const response = await client.models.generateContent({
    model: env.geminiModel(),
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(ScoreSchema),
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini no devolvió respuesta");
  return ScoreSchema.parse(JSON.parse(text));
}
