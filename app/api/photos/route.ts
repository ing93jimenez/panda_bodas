import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getEvent, scorePhoto } from "@/lib/data";
import { fail, ok } from "@/lib/http";

export const maxDuration = 60;

const Body = z.object({
  path: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const event = await getEvent();
  if (event.status !== "live") return fail("El evento ya terminó", 403);

  const { path, width, height } = parsed.data;
  if (!new RegExp(`^photos/${me.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return fail("Ruta inválida", 403);

  const { data, error } = await db()
    .from("photos")
    .insert({ guest_id: me.id, storage_path: path, width, height })
    .select("id")
    .single();
  if (error || !data) return fail("No se pudo registrar la foto", 500);

  after(() => scorePhoto(data.id));

  const { count } = await db().from("photos").select("id", { count: "exact", head: true }).eq("guest_id", me.id);
  return ok({ id: data.id, photoCount: count ?? 0 });
}
