import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

/** Por si se terminó el evento por error: vuelve a aceptar fotos y oculta resultados. */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { error } = await db()
    .from("event")
    .update({ status: "live", ended_at: null, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
