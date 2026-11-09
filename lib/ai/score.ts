import "server-only";
import type { ScoreResult } from "./prompt";
import { scoreWithClaude } from "./claude";
import { scoreWithGemini } from "./gemini";

export type Provider = "claude" | "gemini";
export interface ScoreOutcome extends ScoreResult {
  provider: Provider;
}

type Scorer = (
  b64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  challenge?: string,
) => Promise<ScoreResult>;

/**
 * Califica primero con Claude. Si Claude falla por cualquier motivo
 * (sin saldo/tokens, límite de uso, caída, rechazo), usa Gemini.
 */
export async function scoreImage(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp",
  challenge?: string,
  scorers: { claude: Scorer; gemini: Scorer } = { claude: scoreWithClaude, gemini: scoreWithGemini },
): Promise<ScoreOutcome> {
  let claudeError: unknown;
  try {
    return { ...(await scorers.claude(imageBase64, mediaType, challenge)), provider: "claude" };
  } catch (e) {
    claudeError = e;
    console.warn("Claude falló, usando Gemini:", e instanceof Error ? e.message : e);
  }
  try {
    return { ...(await scorers.gemini(imageBase64, mediaType, challenge)), provider: "gemini" };
  } catch (geminiError) {
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    throw new Error(`Claude: ${msg(claudeError)} | Gemini: ${msg(geminiError)}`);
  }
}
