import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, BUCKET } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getEvent } from "@/lib/data";
import { fail, ok } from "@/lib/http";

const Body = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const MAX_PHOTOS_PER_GUEST = 300;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Formato de imagen no soportado");
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const event = await getEvent();
  if (event.status !== "live") return fail("El evento ya terminó; no se reciben más fotos", 403);

  const { count } = await db().from("photos").select("id", { count: "exact", head: true }).eq("guest_id", me.id);
  if ((count ?? 0) >= MAX_PHOTOS_PER_GUEST) return fail("Llegaste al máximo de fotos permitidas", 429);

  const path = `photos/${me.id}/${randomUUID()}.${EXT[parsed.data.contentType]}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("No se pudo preparar la subida", 500);
  return ok({ path: data.path, token: data.token });
}
