import { connection } from "next/server";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { ok } from "@/lib/http";


export async function GET() {
  await connection();
  const [{ data }, me] = await Promise.all([
    db().from("guests").select("id,name,device_token").order("name"),
    currentGuest(),
  ]);
  const guests = (data ?? []).map((g) => ({ id: g.id, name: g.name, claimed: !!g.device_token }));
  return ok({ guests, meId: me?.id ?? null });
}
