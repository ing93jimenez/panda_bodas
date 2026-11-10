import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env } from "@/lib/env";
import { buildPrompt, refLabel, refsIntro, ScoreSchema, type ScoreInput, type ScoreResult } from "./prompt";

let client: Anthropic | null = null;

export async function scoreWithClaude(input: ScoreInput): Promise<ScoreResult> {
  const apiKey = env.anthropicKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");
  client ??= new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });

  const content: Anthropic.ContentBlockParam[] = [];
  const refs = input.refs ?? [];
  if (refs.length) {
    // Las referencias son iguales en cada llamada: van primero y se cachean (cuestan ~10 % al reusarse).
    content.push({ type: "text", text: refsIntro(refs) });
    refs.forEach((r, i) => {
      content.push({ type: "text", text: refLabel(r) });
      content.push({
        type: "image",
        source: { type: "base64", media_type: r.mediaType, data: r.b64 },
        ...(i === refs.length - 1 && { cache_control: { type: "ephemeral" as const } }),
      });
    });
  }
  content.push({ type: "text", text: "FOTO A CALIFICAR:" });
  content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.b64 } });
  content.push({ type: "text", text: buildPrompt(input) });

  const response = await client.messages.parse({
    model: env.claudeModel(),
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ScoreSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude rechazó calificar la foto");
  if (!response.parsed_output) throw new Error("Claude no devolvió una calificación válida");
  return response.parsed_output;
}
