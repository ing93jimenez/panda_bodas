import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "@/lib/env";
import { buildPrompt, ScoreSchema, type ScoreResult } from "./prompt";

let client: Anthropic | null = null;

export async function scoreWithClaude(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  challenge?: string,
): Promise<ScoreResult> {
  const apiKey = env.anthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

  const response = await client.messages.parse({
    model: env.claudeModel(),
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ScoreSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: buildPrompt(challenge) },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude rechazó calificar la foto");
  if (!response.parsed_output) throw new Error("Claude no devolvió una calificación válida");
  return response.parsed_output;
}
