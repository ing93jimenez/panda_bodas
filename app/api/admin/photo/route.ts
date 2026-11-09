import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

const Body = z
  .object({
    id: z.uuid(),
    score: z.number().int().min(1).max(5).optional(),
    /** Corregir si la foto cumple su reto. */
    challengeOk: z.boolean().optional(),
  })
  .refine((b) => b.score !== undefined || b.challengeOk !== undefined);

/** Corrección manual de la calificación o del reto. */
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { id, score, challengeOk } = parsed.data;
  const update: Record<string, unknown> = {};
  if (score !== undefined)
    Object.assign(update, { score, fine_score: score * 20, status: "scored", manual_override: true, error: null });
  if (challengeOk !== undefined) Object.assign(update, { challenge_ok: challengeOk, challenge_manual: true });
  const { error } = await db().from("photos").update(update).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
