import { connection } from "next/server";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getEvent } from "@/lib/data";
import { ok } from "@/lib/http";


export async function GET() {
  await connection();
  const [me, event] = await Promise.all([currentGuest(), getEvent()]);
  let photoCount = 0;
  if (me) {
    const { count } = await db().from("photos").select("id", { count: "exact", head: true }).eq("guest_id", me.id);
    photoCount = count ?? 0;
  }
  return ok({
    guest: me ? { id: me.id, name: me.name } : null,
    photoCount,
    event: { status: event.status, coupleNames: event.couple_names, eventDate: event.event_date },
  });
}
