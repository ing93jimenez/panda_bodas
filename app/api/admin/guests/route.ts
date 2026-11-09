import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

const Add = z.object({ names: z.array(z.string().trim().min(1).max(80)).min(1).max(500) });
const Act = z.object({ id: z.uuid(), action: z.enum(["release", "delete"]) });

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Add.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Lista inválida");

  const { data: existing } = await db().from("guests").select("name");
  const taken = new Set((existing ?? []).map((g) => g.name.toLowerCase()));
  const fresh: string[] = [];
  for (const n of parsed.data.names) {
    const key = n.toLowerCase();
    if (!taken.has(key)) {
      taken.add(key);
      fresh.push(n);
    }
  }
  if (fresh.length) {
    const { error } = await db().from("guests").insert(fresh.map((name) => ({ name })));
    if (error) return fail(error.message, 500);
  }
  return ok({ added: fresh.length, skipped: parsed.data.names.length - fresh.length });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Act.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { id, action } = parsed.data;

  if (action === "release") {
    const { error } = await db().from("guests").update({ device_token: null, claimed_at: null }).eq("id", id);
    if (error) return fail(error.message, 500);
    return ok({ ok: true });
  }
  const { count } = await db().from("photos").select("id", { count: "exact", head: true }).eq("guest_id", id);
  if ((count ?? 0) > 0) return fail("No se puede eliminar: ese invitado ya tiene fotos", 409);
  const { error } = await db().from("guests").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
