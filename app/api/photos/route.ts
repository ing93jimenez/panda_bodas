import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getEvent, scorePhoto } from "@/lib/data";
import { acceptsPhoto } from "@/lib/acceptance";
import { fail, ok } from "@/lib/http";

export const maxDuration = 60;

const Body = z.object({
  path: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  /** Clave generada en el celular: si la misma foto llega dos veces, no se duplica. */
  clientKey: z.string().min(8).max(100).optional(),
  capturedAt: z.iso.datetime().optional(),
  challengeId: z.uuid().optional(),
});

async function countFor(guestId: string) {
  const { count } = await db()
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("guest_id", guestId)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const { path, width, height, clientKey, capturedAt, challengeId } = parsed.data;

  if (clientKey) {
    const { data: dup } = await db()
      .from("photos")
      .select("id")
      .eq("guest_id", me.id)
      .eq("client_key", clientKey)
      .maybeSingle();
    if (dup) return ok({ id: dup.id, photoCount: await countFor(me.id), duplicate: true });
  }

  const event = await getEvent();
  if (!acceptsPhoto(event, capturedAt)) return fail("El evento ya terminó", 403);
  if (!new RegExp(`^photos/${me.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(path)) return fail("Ruta inválida", 403);

  let challenge: string | null = null;
  if (challengeId) {
    const { data: c } = await db().from("challenges").select("id").eq("id", challengeId).eq("active", true).maybeSingle();
    challenge = c?.id ?? null;
  }

  const { data, error } = await db()
    .from("photos")
    .insert({
      guest_id: me.id,
      storage_path: path,
      width,
      height,
      client_key: clientKey ?? null,
      captured_at: capturedAt ?? null,
      challenge_id: challenge,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && clientKey) {
    // Llegó dos veces al mismo tiempo: ya está guardada.
    return ok({ photoCount: await countFor(me.id), duplicate: true });
  }
  if (error || !data) return fail("No se pudo registrar la foto", 500);

  after(() => scorePhoto(data.id));
  return ok({ id: data.id, photoCount: await countFor(me.id) });
}
