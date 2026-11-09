import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { computeResults } from "@/lib/data";
import { fail, ok } from "@/lib/http";

/** Marca el fin del evento: bloquea subidas, fija ganador y mejores fotos. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { winner, topIds } = await computeResults();
  const { error } = await db()
    .from("event")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      winner_guest_id: winner?.guestId ?? null,
      top_photo_ids: topIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail(error.message, 500);
  return ok({ winner, topIds });
}
