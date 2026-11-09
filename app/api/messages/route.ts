import { connection } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/admin";
import { currentGuest } from "@/lib/auth";
import { getMessages, withAudio } from "@/lib/messages";
import { fail, ok } from "@/lib/http";

const Body = z
  .object({
    body: z.string().trim().max(600).optional(),
    audioPath: z.string().max(300).optional(),
  })
  .refine((b) => !!b.body || !!b.audioPath, "Escribe un mensaje o graba una nota de voz");

/** Mis dedicatorias. */
export async function GET() {
  await connection();
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const msgs = await withAudio(await getMessages({ guestId: me.id }));
  return ok({
    messages: msgs.map((m) => ({ id: m.id, body: m.body, audioUrl: m.audioUrl, createdAt: m.created_at })),
  });
}

/** Enviar una dedicatoria a los novios (texto y/o nota de voz). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const me = await currentGuest();
  if (!me) return fail("Primero elige tu nombre", 401);
  const { body, audioPath } = parsed.data;
  if (audioPath && !new RegExp(`^messages/${me.id}/[0-9a-f-]{36}\\.(m4a|aac|webm|ogg|mp3)$`).test(audioPath))
    return fail("Audio inválido", 403);
  const { data, error } = await db()
    .from("messages")
    .insert({ guest_id: me.id, body: body || null, audio_path: audioPath ?? null })
    .select("id")
    .single();
  if (error || !data) return fail("No se pudo guardar la dedicatoria", 500);
  return ok({ id: data.id });
}
