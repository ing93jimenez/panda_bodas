import { connection } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db, BUCKET } from "@/lib/supabase/admin";
import { getPeople, signedUrls } from "@/lib/data";
import { fail, ok } from "@/lib/http";

const PATH = /^people\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const Create = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  photoPath: z.string().regex(PATH),
});
const Update = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().min(1).max(80).optional(),
  photoPath: z.string().regex(PATH).optional(),
});
const Remove = z.object({ id: z.uuid() });

export async function GET() {
  await connection();
  const denied = await requireAdmin();
  if (denied) return denied;
  const people = await getPeople();
  const urls = await signedUrls(people.map((p) => p.photo_path));
  return ok({ people: people.map((p) => ({ id: p.id, name: p.name, role: p.role, url: urls.get(p.photo_path) ?? null })) });
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { count } = await db().from("people").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= 12) return fail("Máximo 12 personas clave (cada una agrega costo a cada calificación)", 400);
  const { name, role, photoPath } = parsed.data;
  const { error } = await db().from("people").insert({ name, role, photo_path: photoPath, sort: count ?? 0 });
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}

export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { id, name, role, photoPath } = parsed.data;
  const { data: before } = await db().from("people").select("photo_path").eq("id", id).maybeSingle();
  const { error } = await db()
    .from("people")
    .update({ ...(name && { name }), ...(role && { role }), ...(photoPath && { photo_path: photoPath }) })
    .eq("id", id);
  if (error) return fail(error.message, 500);
  if (photoPath && before?.photo_path && before.photo_path !== photoPath)
    await db().storage.from(BUCKET).remove([before.photo_path]);
  return ok({ ok: true });
}

export async function DELETE(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = Remove.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Datos inválidos");
  const { data } = await db().from("people").delete().eq("id", parsed.data.id).select("photo_path").maybeSingle();
  if (data?.photo_path) await db().storage.from(BUCKET).remove([data.photo_path]);
  return ok({ ok: true });
}
