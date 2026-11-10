import { z } from "zod";

export const ScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  fine_score: z.number().int().min(0).max(100),
  reason: z.string(),
  challenge_met: z.boolean(),
  /** Nombres de las personas clave que aparecen (según las fotos de referencia). */
  people_present: z.array(z.string()),
});
export type ScoreResult = z.infer<typeof ScoreSchema>;

export type MediaType = "image/jpeg" | "image/png" | "image/webp";
export interface ImageData {
  b64: string;
  mediaType: MediaType;
}
export interface RefPerson extends ImageData {
  name: string;
  role: string;
}
export interface ScoreInput {
  image: ImageData;
  /** Reto que el invitado dice cumplir con esta foto. */
  challenge?: string;
  /** Contexto escrito por los novios (tipo de boda, vestimenta, lugar…). */
  context?: string;
  /** Fotos de referencia de personas clave (novios, padres…). */
  refs?: RefPerson[];
}

const BASE = `Eres un fotógrafo profesional de bodas y jurado de un concurso entre los invitados.
Califica la FOTO A CALIFICAR, tomada por un invitado durante la boda.

Criterios (en orden de importancia):
1. Momento y emoción: sonrisas, abrazos, risas, lágrimas, interacción real, momentos clave (los novios, sus familias, brindis, baile, primer beso).
2. Calidad técnica: enfoque/nitidez, exposición, sin movimiento indeseado, ojos abiertos.
3. Composición: encuadre, sujetos completos (sin cortar cabezas), fondo limpio, ángulo.
4. Relevancia: que sea de la boda. Fotos accidentales, del piso, borrosas, capturas de pantalla o sin relación valen poco.

Escala:
- 5: excepcional, digna del álbum oficial.
- 4: muy buena, con algún detalle menor.
- 3: correcta, recuerdo agradable pero común.
- 2: con problemas claros (borrosa, oscura, mal encuadre).
- 1: inservible o accidental.

Devuelve:
- score: entero de 1 a 5.
- fine_score: entero de 0 a 100 para desempatar fotos con las mismas estrellas (coherente con score).
- reason: una frase corta en español explicando la calificación.
- challenge_met: true solo si se indica un reto abajo y la foto lo cumple claramente; si no hay reto, false.
- people_present: nombres (tal como aparecen en las referencias) de las personas clave que reconozcas en la foto a calificar; lista vacía si no hay referencias o no reconoces a nadie con seguridad.`;

/** Texto que acompaña a las fotos de referencia (va antes de la foto a calificar). */
export function refsIntro(refs: RefPerson[]): string {
  return (
    "FOTOS DE REFERENCIA de las personas clave de esta boda. No las califiques: úsalas solo para reconocer " +
    "a estas personas en la foto a calificar (compara rasgos de la cara, cabello, complexión; la ropa puede ser distinta). " +
    `Son ${refs.length}:`
  );
}

export const refLabel = (r: RefPerson) => `Referencia: ${r.name} (${r.role})`;

/** Instrucciones finales (van después de la foto a calificar). */
export function buildPrompt(input: Omit<ScoreInput, "image">): string {
  const parts = [BASE];
  if (input.context?.trim()) {
    parts.push(
      `Contexto de esta boda (escrito por los novios; tenlo en cuenta al juzgar relevancia y al reconocer a las personas): ${input.context.trim()}`,
    );
  }
  if (input.refs?.length) {
    parts.push(
      "Personas clave (ver fotos de referencia): " +
        input.refs.map((r) => `${r.name} (${r.role})`).join(", ") +
        ". Una foto bien lograda donde aparecen ellas, sobre todo los novios, es especialmente valiosa para el álbum.",
    );
  }
  if (input.challenge) {
    parts.push(
      `Reto que el invitado dice cumplir con esta foto: «${input.challenge}». Verifica si la foto realmente lo cumple ` +
        "(si el reto menciona a personas clave, usa las referencias para confirmar que son ellas). El reto no cambia la calificación de estrellas.",
    );
  } else {
    parts.push("Reto: (ninguno)");
  }
  return parts.join("\n\n");
}
