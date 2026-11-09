import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { env } from "@/lib/env";
import { buildPrompt, ScoreSchema, type ScoreResult } from "./prompt";

let client: GoogleGenAI | null = null;

export async function scoreWithGemini(
  imageBase64: string,
  mediaType: string,
  challenge?: string,
): Promise<ScoreResult> {
  const apiKey = env.geminiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  client ??= new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: env.geminiModel(),
    contents: [
      {
        role: "user",
        parts: [{ inlineData: { mimeType: mediaType, data: imageBase64 } }, { text: buildPrompt(challenge) }],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(ScoreSchema),
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini no devolvió respuesta");
  return ScoreSchema.parse(JSON.parse(text));
}
