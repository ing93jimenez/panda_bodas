import { describe, expect, it, vi } from "vitest";
import { scoreImage } from "@/lib/ai/score";
import { ScoreSchema } from "@/lib/ai/prompt";

const good = { score: 4, fine_score: 78, reason: "Bonita" };

describe("scoreImage", () => {
  it("usa Claude cuando funciona", async () => {
    const gemini = vi.fn();
    const r = await scoreImage("x", "image/jpeg", { claude: async () => good, gemini });
    expect(r.provider).toBe("claude");
    expect(gemini).not.toHaveBeenCalled();
  });

  it("cae a Gemini si Claude se queda sin saldo o tokens", async () => {
    const r = await scoreImage("x", "image/jpeg", {
      claude: async () => {
        throw new Error("Your credit balance is too low");
      },
      gemini: async () => ({ ...good, score: 5 }),
    });
    expect(r).toMatchObject({ provider: "gemini", score: 5 });
  });

  it("reporta ambos errores si los dos fallan", async () => {
    await expect(
      scoreImage("x", "image/jpeg", {
        claude: async () => {
          throw new Error("429");
        },
        gemini: async () => {
          throw new Error("quota");
        },
      }),
    ).rejects.toThrow(/Claude: 429 \| Gemini: quota/);
  });

  it("el esquema rechaza calificaciones fuera de rango", () => {
    expect(ScoreSchema.safeParse({ score: 6, fine_score: 50, reason: "" }).success).toBe(false);
    expect(ScoreSchema.safeParse({ score: 0, fine_score: 50, reason: "" }).success).toBe(false);
  });
});
