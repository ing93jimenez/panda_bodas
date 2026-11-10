import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

const Body = z.object({ contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

/** URL firmada para subir la foto de referencia de una persona clave. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Formato de imagen no soportado");
  const path = `people/${randomUUID()}.${EXT[parsed.data.contentType]}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return fail("No se pudo preparar la subida", 500);
  return ok({ path: data.path, token: data.token });
}
