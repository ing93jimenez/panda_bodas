import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

const Body = z.object({
  coupleNames: z.string().trim().min(1).max(100).optional(),
  eventDate: z.iso.date().nullable().optional(),
  minPhotos: z.number().int().min(1).max(100).optional(),
});

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const b = parsed.data;
  const { error } = await db()
    .from("event")
    .update({
      ...(b.coupleNames !== undefined && { couple_names: b.coupleNames }),
      ...(b.eventDate !== undefined && { event_date: b.eventDate }),
      ...(b.minPhotos !== undefined && { min_photos_for_winner: b.minPhotos }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
