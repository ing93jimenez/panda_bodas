import { describe, expect, it } from "vitest";
import { scoreImage } from "@/lib/ai/score";
import { buildPrompt, ScoreSchema, type ScoreInput } from "@/lib/ai/prompt";

const good = { score: 4, fine_score: 78, reason: "Bonita", challenge_met: false, people_present: [] as string[] };
const img = { b64: "x", mediaType: "image/jpeg" as const };
const refs = [
  { ...img, name: "Laura", role: "Novia" },
  { ...img, name: "Sebas", role: "Novio" },
];

describe("scoreImage", () => {
  it("usa Claude cuando funciona", async () => {
    let geminiCalled = false;
    const r = await scoreImage({ image: img }, {
      claude: async () => good,
      gemini: async () => {
        geminiCalled = true;
        return good;
      },
    });
    expect(r.provider).toBe("claude");
    expect(geminiCalled).toBe(false);
  });

  it("cae a Gemini si Claude se queda sin saldo o tokens", async () => {
    const r = await scoreImage({ image: img }, {
      claude: async () => {
        throw new Error("Your credit balance is too low");
      },
      gemini: async () => ({ ...good, score: 5 }),
    });
    expect(r).toMatchObject({ provider: "gemini", score: 5 });
  });

  it("pasa reto, contexto y referencias a quien califica", async () => {
    const seen: ScoreInput[] = [];
    await scoreImage({ image: img, challenge: "Foto con los abuelos", context: "Boda civil casual", refs }, {
      claude: async (input) => {
        seen.push(input);
        return { ...good, challenge_met: true };
      },
      gemini: async () => good,
    });
    expect(seen[0]).toMatchObject({ challenge: "Foto con los abuelos", context: "Boda civil casual" });
    expect(seen[0].refs?.map((r) => r.name)).toEqual(["Laura", "Sebas"]);
  });

  it("solo acepta nombres de personas que estén en las referencias", async () => {
    const r = await scoreImage({ image: img, refs }, {
      claude: async () => ({ ...good, people_present: ["Laura", "Desconocido", "Laura"] }),
      gemini: async () => good,
    });
    expect(r.people_present).toEqual(["Laura"]);
  });

  it("reporta ambos errores si los dos fallan", async () => {
    await expect(
      scoreImage({ image: img }, {
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
    expect(ScoreSchema.safeParse({ ...good, score: 6 }).success).toBe(false);
    expect(ScoreSchema.safeParse({ ...good, score: 0 }).success).toBe(false);
  });
});

describe("buildPrompt", () => {
  it("incluye el contexto, las personas clave y el reto", () => {
    const p = buildPrompt({ context: "Boda civil casual, sin vestido de novia", refs, challenge: "Selfie con los novios" });
    expect(p).toContain("Boda civil casual, sin vestido de novia");
    expect(p).toContain("Laura (Novia), Sebas (Novio)");
    expect(p).toContain("«Selfie con los novios»");
  });
  it("sin extras no menciona personas ni contexto", () => {
    const p = buildPrompt({});
    expect(p).not.toContain("Personas clave (ver");
    expect(p).not.toContain("Contexto de esta boda");
    expect(p).toContain("Reto: (ninguno)");
  });
});
