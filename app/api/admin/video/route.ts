import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase/admin";
import { fail, ok } from "@/lib/http";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upload-url"), ext: z.enum(["mp4", "webm"]) }),
  z.object({
    action: z.literal("publish"),
    path: z.string().regex(/^videos\/[0-9a-f-]{36}\.(mp4|webm)$/),
    photoIds: z.array(z.uuid()).min(1).max(50),
  }),
]);

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const b = parsed.data;

  if (b.action === "upload-url") {
    const path = `videos/${randomUUID()}.${b.ext}`;
    const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return fail("No se pudo preparar la subida del video", 500);
    return ok({ path: data.path, token: data.token });
  }

  // Publicar: el Top que ven los invitados son exactamente las fotos del video.
  const { error } = await db()
    .from("event")
    .update({
      video_path: b.path,
      top_photo_ids: b.photoIds,
      top_count: b.photoIds.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
