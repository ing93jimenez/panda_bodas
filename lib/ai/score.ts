import "server-only";
import type { ScoreInput, ScoreResult } from "./prompt";
import { scoreWithClaude } from "./claude";
import { scoreWithGemini } from "./gemini";

export type Provider = "claude" | "gemini";
export interface ScoreOutcome extends ScoreResult {
  provider: Provider;
}

type Scorer = (input: ScoreInput) => Promise<ScoreResult>;

/**
 * Califica primero con Claude. Si Claude falla por cualquier motivo
 * (sin saldo/tokens, límite de uso, caída, rechazo), usa Gemini.
 */
export async function scoreImage(
  input: ScoreInput,
  scorers: { claude: Scorer; gemini: Scorer } = { claude: scoreWithClaude, gemini: scoreWithGemini },
): Promise<ScoreOutcome> {
  const refs = new Set((input.refs ?? []).map((r) => r.name));
  // Solo se aceptan nombres que existan en las referencias.
  const clean = (r: ScoreResult): ScoreResult => ({ ...r, people_present: [...new Set(r.people_present)].filter((n) => refs.has(n)) });
  let claudeError: unknown;
  try {
    return { ...clean(await scorers.claude(input)), provider: "claude" };
  } catch (e) {
    claudeError = e;
    console.warn("Claude falló, usando Gemini:", e instanceof Error ? e.message : e);
  }
  try {
    return { ...clean(await scorers.gemini(input)), provider: "gemini" };
  } catch (geminiError) {
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    throw new Error(`Claude: ${msg(claudeError)} | Gemini: ${msg(geminiError)}`);
  }
}
