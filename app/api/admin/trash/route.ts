import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getLeaderboard } from "@/lib/data";
import { pickWinner } from "@/lib/ranking";
import { fail, ok } from "@/lib/http";

const Body = z.object({
  photoIds: z.array(z.uuid()).min(1).max(1000),
  restore: z.boolean().optional(),
});

/**
 * Solo el admin: elimina fotos (las manda a la papelera) o las restaura.
 * Una foto eliminada desaparece del ranking, del Top, de las descargas y del video.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { photoIds, restore } = parsed.data;

  const { data, error } = await db()
    .from("photos")
    .update({ deleted_at: restore ? null : new Date().toISOString() })
    .in("id", photoIds)
    .select("id");
  if (error) return fail(error.message, 500);

  // Si los resultados ya se revelaron, el ganador puede cambiar.
  const { event, board } = await getLeaderboard();
  if (event.status === "ended") {
    await db()
      .from("event")
      .update({ winner_guest_id: pickWinner(board)?.guestId ?? null, updated_at: new Date().toISOString() })
      .eq("id", 1);
  }

  return ok({ count: data?.length ?? 0 });
}
