import { db } from "@/lib/supabase/admin";
import { clearGuestCookie, currentGuest } from "@/lib/auth";
import { ok } from "@/lib/http";

/**
 * El invitado sale de su nombre (por si eligió uno equivocado).
 * Libera el nombre para que pueda elegirse de nuevo; las fotos ya tomadas
 * se conservan con ese nombre (nunca se borran).
 */
export async function POST() {
  const me = await currentGuest();
  if (me) {
    await db()
      .from("guests")
      .update({ device_token: null, claimed_at: null })
      .eq("id", me.id)
      .eq("device_token", me.device_token!);
  }
  await clearGuestCookie();
  return ok({ ok: true });
}
