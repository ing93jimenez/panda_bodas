import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { scorePhoto } from "@/lib/data";
import { ok } from "@/lib/http";

export const maxDuration = 60;
const BATCH = 6;

/** Recalifica fotos pendientes, fallidas o atascadas, en lotes. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Fotos "calificando" por más de 3 minutos se consideran atascadas.
  const stale = new Date(Date.now() - 3 * 60_000).toISOString();
  await db().from("photos").update({ status: "pending" }).eq("status", "scoring").lt("created_at", stale);

  const { data } = await db()
    .from("photos")
    .select("id")
    .in("status", ["pending", "failed"])
    .is("deleted_at", null)
    .order("created_at")
    .limit(BATCH);
  const ids = (data ?? []).map((p) => p.id);
  for (let i = 0; i < ids.length; i += 3) await Promise.all(ids.slice(i, i + 3).map(scorePhoto));

  const { count } = await db()
    .from("photos")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "failed"])
    .is("deleted_at", null);
  return ok({ processed: ids.length, remaining: count ?? 0 });
}
