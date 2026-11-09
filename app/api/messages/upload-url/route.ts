import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, BUCKET } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { AUDIO_EXT } from "@/lib/messages";
import { fail, ok } from "@/lib/http";

const Body = z.object({ contentType: z.string().max(60) });

/** URL firmada para subir la nota de voz de una dedicatoria. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  const ext = parsed.success ? AUDIO_EXT[parsed.data.contentType] : undefined;
  if (!ext) return fail("Formato de audio no soportado");
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const path = `messages/${me.id}/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("No se pudo preparar la subida", 500);
  return ok({ path: data.path, token: data.token });
}
