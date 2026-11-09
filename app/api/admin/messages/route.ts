import { connection } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getGuests } from "@/lib/data";
import { getMessages, withAudio } from "@/lib/messages";
import { fail, ok } from "@/lib/http";

const Update = z.object({
  id: z.uuid(),
  featured: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export async function GET() {
  await connection();
  const denied = await requireAdmin();
  if (denied) return denied;
  const [msgs, guests] = await Promise.all([getMessages({ includeDeleted: true }).then(withAudio), getGuests()]);
  const names = new Map(guests.map((g) => [g.id, g.name]));
  return ok({
    messages: msgs.map((m) => ({
      id: m.id,
      name: names.get(m.guest_id) ?? "",
      body: m.body,
      audioUrl: m.audioUrl,
      audioDownloadUrl: m.audioDownloadUrl,
      audioExt: m.audio_path?.split(".").pop() ?? null,
      featured: m.featured,
      deleted: !!m.deleted_at,
      createdAt: m.created_at,
    })),
  });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { id, featured, deleted } = parsed.data;
  const update: Record<string, unknown> = {};
  if (featured !== undefined) update.featured = featured;
  if (deleted !== undefined) update.deleted_at = deleted ? new Date().toISOString() : null;
  const { error } = await db().from("messages").update(update).eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
