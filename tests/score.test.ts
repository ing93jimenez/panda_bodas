import { describe, expect, it, vi } from "vitest";
import { scoreImage } from "@/lib/ai/score";
import { ScoreSchema } from "@/lib/ai/prompt";

const good = { score: 4, fine_score: 78, reason: "Bonita", challenge_met: false };

describe("scoreImage", () => {
  it("usa Claude cuando funciona", async () => {
    const gemini = vi.fn();
    const r = await scoreImage("x", "image/jpeg", undefined, { claude: async () => good, gemini });
    expect(r.provider).toBe("claude");
    expect(gemini).not.toHaveBeenCalled();
  });

  it("cae a Gemini si Claude se queda sin saldo o tokens", async () => {
    const r = await scoreImage("x", "image/jpeg", undefined, {
      claude: async () => {
        throw new Error("Your credit balance is too low");
      },
      gemini: async () => ({ ...good, score: 5 }),
    });
    expect(r).toMatchObject({ provider: "gemini", score: 5 });
  });

  it("pasa el reto a quien califica", async () => {
    const seen: (string | undefined)[] = [];
    await scoreImage("x", "image/jpeg", "Foto con los abuelos", {
      claude: async (_b, _m, c) => {
        seen.push(c);
        return { ...good, challenge_met: true };
      },
      gemini: async () => good,
    });
    expect(seen).toEqual(["Foto con los abuelos"]);
  });

  it("reporta ambos errores si los dos fallan", async () => {
    await expect(
      scoreImage("x", "image/jpeg", undefined, {
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
    expect(ScoreSchema.safeParse({ score: 6, fine_score: 50, reason: "", challenge_met: false }).success).toBe(false);
    expect(ScoreSchema.safeParse({ score: 0, fine_score: 50, reason: "", challenge_met: false }).success).toBe(false);
  });
});
